"""Backend API tests for AI Lead Qualification CRM.

Covers: auth (register/login/me), lead CRUD, stats, requalify, CSV import, filters.
"""
import io
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend/.env
    fe_env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    for line in fe_env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

API = f"{BASE_URL}/api"
DEMO_EMAIL = "sales@demo.com"
DEMO_PASSWORD = "demo1234"

TIMEOUT_AI = 60  # AI calls can take 5-15s


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_client(demo_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {demo_token}"})
    return s


@pytest.fixture(scope="session")
def new_user_token(session):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "TEST User", "email": email, "password": "Passw0rd!"
    }, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], email


# ---------- Auth ----------
class TestAuth:
    def test_login_demo_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == DEMO_EMAIL

    def test_login_invalid_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrongwrong"}, timeout=15)
        assert r.status_code == 401

    def test_register_new_user(self, new_user_token):
        token, email = new_user_token
        assert token

    def test_register_duplicate_email(self, session, new_user_token):
        _, email = new_user_token
        r = session.post(f"{API}/auth/register", json={
            "name": "Dup", "email": email, "password": "Passw0rd!"
        }, timeout=15)
        assert r.status_code == 400

    def test_me_endpoint(self, demo_client):
        r = demo_client.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_no_auth(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Leads ----------
class TestLeads:
    created_ids = []

    def test_create_lead_triggers_ai(self, demo_client):
        payload = {
            "name": "TEST Alice Corp",
            "email": "test_alice@corp.com",
            "phone": "+1234567890",
            "company": "Corp Inc",
            "source": "Website",
            "interest": "Enterprise CRM plan",
            "budget": "$50,000",
            "notes": "Ready to buy this quarter, decision maker",
        }
        r = demo_client.post(f"{API}/leads", json=payload, timeout=TIMEOUT_AI)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["name"] == payload["name"]
        assert "id" in lead
        assert isinstance(lead.get("ai_score"), int)
        assert 0 <= lead["ai_score"] <= 100
        assert lead.get("ai_priority") in ("Hot", "Warm", "Cold")
        assert isinstance(lead.get("ai_reasoning"), str) and len(lead["ai_reasoning"]) > 0
        assert isinstance(lead.get("ai_next_action"), str)
        assert isinstance(lead.get("ai_follow_up"), str)
        assert lead["stage"] == "New"
        TestLeads.created_ids.append(lead["id"])

    def test_get_lead_persists(self, demo_client):
        assert TestLeads.created_ids, "no lead created"
        lid = TestLeads.created_ids[0]
        r = demo_client.get(f"{API}/leads/{lid}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == lid
        assert data["ai_score"] is not None

    def test_list_leads(self, demo_client):
        r = demo_client.get(f"{API}/leads", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert any(l["id"] == TestLeads.created_ids[0] for l in arr)

    def test_search_filter(self, demo_client):
        r = demo_client.get(f"{API}/leads", params={"search": "TEST Alice"}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        assert all("alice" in (l.get("name", "").lower() + l.get("email", "").lower() + l.get("company", "").lower()) for l in arr)

    def test_stage_filter(self, demo_client):
        r = demo_client.get(f"{API}/leads", params={"stage": "New"}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert all(l["stage"] == "New" for l in arr)

    def test_priority_filter(self, demo_client):
        r = demo_client.get(f"{API}/leads", params={"priority": "Hot"}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert all(l["ai_priority"] == "Hot" for l in arr)

    def test_update_lead_and_persist(self, demo_client):
        lid = TestLeads.created_ids[0]
        r = demo_client.put(f"{API}/leads/{lid}", json={"stage": "Contacted", "notes": "TEST updated"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["stage"] == "Contacted"
        # verify persist
        r2 = demo_client.get(f"{API}/leads/{lid}", timeout=15)
        assert r2.json()["stage"] == "Contacted"
        assert r2.json()["notes"] == "TEST updated"

    def test_requalify(self, demo_client):
        lid = TestLeads.created_ids[0]
        r = demo_client.post(f"{API}/leads/{lid}/requalify", timeout=TIMEOUT_AI)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("ai_score"), int)
        assert data.get("ai_priority") in ("Hot", "Warm", "Cold")

    def test_stats(self, demo_client):
        r = demo_client.get(f"{API}/leads/stats", timeout=15)
        assert r.status_code == 200
        stats = r.json()
        for k in ("total", "avg_score", "won", "active", "by_priority", "by_stage"):
            assert k in stats
        assert isinstance(stats["by_stage"], list)
        assert len(stats["by_stage"]) == 6

    def test_delete_lead(self, demo_client):
        # Create a throwaway lead to delete
        r = demo_client.post(f"{API}/leads", json={"name": "TEST Delete Me", "email": "test_del@x.com"}, timeout=TIMEOUT_AI)
        assert r.status_code == 200
        lid = r.json()["id"]
        r2 = demo_client.delete(f"{API}/leads/{lid}", timeout=15)
        assert r2.status_code == 200
        r3 = demo_client.get(f"{API}/leads/{lid}", timeout=15)
        assert r3.status_code == 404

    def test_leads_unauth(self, session):
        r = session.get(f"{API}/leads", timeout=15)
        assert r.status_code == 401


# ---------- CSV import ----------
class TestCSVImport:
    def test_import_csv(self, demo_token):
        csv_content = (
            "name,email,company,source,interest,budget,notes\n"
            "TEST CSV One,test_csv1@x.com,AcmeCo,LinkedIn,Widget,10k,Interested\n"
            "TEST CSV Two,test_csv2@x.com,Beta LLC,Referral,Widget Pro,25k,Hot lead\n"
        )
        files = {"file": ("leads.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        r = requests.post(
            f"{API}/leads/import",
            files=files,
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 2


# ---------- User scoping ----------
class TestScoping:
    def test_new_user_has_no_leads(self, new_user_token):
        token, _ = new_user_token
        r = requests.get(f"{API}/leads", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == []


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup(demo_client):
    yield
    try:
        r = demo_client.get(f"{API}/leads", timeout=15)
        for lead in r.json():
            if lead.get("name", "").startswith("TEST ") or lead.get("email", "").startswith("test_"):
                demo_client.delete(f"{API}/leads/{lead['id']}", timeout=15)
    except Exception as e:
        print(f"Cleanup error: {e}")
