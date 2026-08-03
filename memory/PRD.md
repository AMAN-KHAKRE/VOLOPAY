# Pipeline — AI Lead Qualification CRM

## Original Problem Statement
Build a working AI-powered CRM that helps sales teams capture, qualify, and prioritise leads. Add leads (manual form + CSV import), view/edit/delete, AI-generated score/priority/reasoning/next action/personalised follow-up, persistent DB, search + filtering + lead-stage management, publicly accessible live link, easy for teammates to use.

## Architecture
- **Frontend**: React (react-router, axios, recharts, shadcn/ui, lucide-react, sonner). Dark modern dashboard theme (Outfit + IBM Plex Sans).
- **Backend**: FastAPI, all routes under `/api`. JWT Bearer auth (localStorage `crm_token`), bcrypt hashing.
- **DB**: MongoDB (`users`, `leads`), leads scoped per `user_id`.
- **AI**: emergentintegrations LlmChat with Claude Sonnet 4.6 via EMERGENT_LLM_KEY → structured JSON (score, priority, reasoning, next_action, follow_up_message).

## User Personas
- Sales rep / SDR capturing and prioritising inbound and imported leads.

## Core Requirements (static)
- Lead capture (manual + CSV), CRUD, AI qualification, persistence, search/filter, stage management.

## Implemented (2026-08-03)
- JWT email/password auth + seeded demo account (sales@demo.com / demo1234).
- Dashboard: stat cards (total, hot, avg score, won), leads-by-stage bar chart, recent leads.
- Leads table: search, stage filter, priority filter, add-lead form, CSV import, delete.
- Lead detail: circular AI score gauge, reasoning, next action, copyable follow-up, editable fields, stage dropdown, AI re-run.
- AI qualification via Claude Sonnet 4.6 producing score/priority/reasoning/next action/follow-up.
- Tested: backend 19/19 pytest pass, frontend all critical flows pass.

## Backlog / Remaining
- P1: Kanban drag-and-drop stage board; bulk actions; lead activity timeline.
- P2: Parallelise CSV AI qualification (asyncio.gather); email sending of follow-up; team/multi-user sharing; export CSV.

## Next tasks
- Awaiting user feedback after first review.
