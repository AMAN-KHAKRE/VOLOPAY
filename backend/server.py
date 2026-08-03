from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class LeadInput(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: Optional[str] = ""
    source: Optional[str] = ""
    interest: Optional[str] = ""
    budget: Optional[str] = ""
    notes: Optional[str] = ""
    stage: Optional[str] = "New"


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    interest: Optional[str] = None
    budget: Optional[str] = None
    notes: Optional[str] = None
    stage: Optional[str] = None


def lead_to_public(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("user_id", None)
    return doc


# ---------- AI qualification ----------
async def qualify_lead(lead: dict) -> dict:
    system = (
        "You are an expert B2B/B2C sales development representative and lead qualification engine. "
        "Given a lead's information, analyse buying intent, budget signals, engagement, and fit. "
        "Respond with STRICT JSON only, no markdown, using exactly these keys: "
        "score (integer 0-100), priority (one of 'Hot','Warm','Cold'), "
        "reasoning (2-3 sentence explanation of the score), "
        "next_action (one concrete recommended next step for the sales rep), "
        "follow_up_message (a warm, personalised 2-4 sentence follow-up email/message addressed to the lead by name). "
        "Scoring guide: 70-100 Hot, 40-69 Warm, 0-39 Cold."
    )
    prompt = (
        "Qualify this lead and return JSON only:\n"
        f"Name: {lead.get('name','')}\n"
        f"Email: {lead.get('email','')}\n"
        f"Phone: {lead.get('phone','')}\n"
        f"Company: {lead.get('company','')}\n"
        f"Lead source: {lead.get('source','')}\n"
        f"Interested in: {lead.get('interest','')}\n"
        f"Stated budget: {lead.get('budget','')}\n"
        f"Notes: {lead.get('notes','')}\n"
    )
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"lead-{lead.get('email','')}-{datetime.now(timezone.utc).timestamp()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-6")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp if isinstance(resp, str) else str(resp)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        data = json.loads(match.group(0) if match else text)
        score = int(data.get("score", 0))
        score = max(0, min(100, score))
        priority = data.get("priority") or ("Hot" if score >= 70 else "Warm" if score >= 40 else "Cold")
        return {
            "ai_score": score,
            "ai_priority": priority,
            "ai_reasoning": data.get("reasoning", ""),
            "ai_next_action": data.get("next_action", ""),
            "ai_follow_up": data.get("follow_up_message", ""),
            "ai_generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"AI qualification failed: {e}")
        return {
            "ai_score": 0, "ai_priority": "Cold",
            "ai_reasoning": "AI qualification could not be completed. Please retry.",
            "ai_next_action": "Retry AI qualification.", "ai_follow_up": "",
            "ai_generated_at": datetime.now(timezone.utc).isoformat(),
        }


# ---------- Auth routes ----------
@api_router.post("/auth/register")
async def register(body: RegisterInput):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "name": body.name, "password_hash": hash_password(body.password),
           "role": "user", "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_access_token(uid, email)
    return {"token": token, "user": {"id": uid, "name": body.name, "email": email}}


@api_router.post("/auth/login")
async def login(body: LoginInput):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    return {"token": token, "user": {"id": uid, "name": user.get("name", ""), "email": email}}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "name": user.get("name", ""), "email": user["email"]}


# ---------- Lead routes ----------
@api_router.post("/leads")
async def create_lead(body: LeadInput, user: dict = Depends(get_current_user)):
    lead = body.model_dump()
    lead["stage"] = lead.get("stage") or "New"
    ai = await qualify_lead(lead)
    lead.update(ai)
    lead["user_id"] = user["id"]
    now = datetime.now(timezone.utc).isoformat()
    lead["created_at"] = now
    lead["updated_at"] = now
    res = await db.leads.insert_one(lead)
    doc = await db.leads.find_one({"_id": res.inserted_id})
    return lead_to_public(doc)


@api_router.get("/leads")
async def list_leads(user: dict = Depends(get_current_user),
                     search: Optional[str] = None, stage: Optional[str] = None,
                     priority: Optional[str] = None):
    query: dict = {"user_id": user["id"]}
    if stage and stage != "all":
        query["stage"] = stage
    if priority and priority != "all":
        query["ai_priority"] = priority
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"name": rx}, {"email": rx}, {"company": rx}, {"interest": rx}]
    docs = await db.leads.find(query).sort("created_at", -1).to_list(1000)
    return [lead_to_public(d) for d in docs]


@api_router.get("/leads/stats")
async def stats(user: dict = Depends(get_current_user)):
    docs = await db.leads.find({"user_id": user["id"]}).to_list(2000)
    total = len(docs)
    by_priority = {"Hot": 0, "Warm": 0, "Cold": 0}
    by_stage = {s: 0 for s in STAGES}
    score_sum = 0
    for d in docs:
        by_priority[d.get("ai_priority", "Cold")] = by_priority.get(d.get("ai_priority", "Cold"), 0) + 1
        by_stage[d.get("stage", "New")] = by_stage.get(d.get("stage", "New"), 0) + 1
        score_sum += int(d.get("ai_score", 0))
    avg = round(score_sum / total) if total else 0
    won = by_stage.get("Won", 0)
    active = total - by_stage.get("Won", 0) - by_stage.get("Lost", 0)
    return {"total": total, "avg_score": avg, "won": won, "active": active,
            "by_priority": by_priority,
            "by_stage": [{"stage": s, "count": by_stage.get(s, 0)} for s in STAGES]}


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    doc = await db.leads.find_one({"_id": ObjectId(lead_id), "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead_to_public(doc)


@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, user: dict = Depends(get_current_user)):
    doc = await db.leads.find_one({"_id": ObjectId(lead_id), "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": updates})
    doc = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return lead_to_public(doc)


@api_router.post("/leads/{lead_id}/requalify")
async def requalify(lead_id: str, user: dict = Depends(get_current_user)):
    doc = await db.leads.find_one({"_id": ObjectId(lead_id), "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    ai = await qualify_lead(doc)
    ai["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": ai})
    doc = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return lead_to_public(doc)


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    res = await db.leads.delete_one({"_id": ObjectId(lead_id), "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@api_router.post("/leads/import")
async def import_csv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    text = content.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    fields = {"name", "email", "phone", "company", "source", "interest", "budget", "notes", "stage"}
    imported = 0
    for row in reader:
        norm = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        lead = {f: norm.get(f, "") for f in fields}
        if not lead.get("name") and not lead.get("email"):
            continue
        lead["stage"] = lead.get("stage") or "New"
        ai = await qualify_lead(lead)
        lead.update(ai)
        lead["user_id"] = user["id"]
        now = datetime.now(timezone.utc).isoformat()
        lead["created_at"] = now
        lead["updated_at"] = now
        await db.leads.insert_one(lead)
        imported += 1
    return {"imported": imported}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "sales@demo.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "demo1234")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"email": admin_email, "name": "Demo Sales",
                                   "password_hash": hash_password(admin_pw), "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
