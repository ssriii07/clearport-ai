# ClearPort AI — Isocode Customs Take-Home

**Milestone 02: authenticated, persistent backend workflow (not the finished application).** Deadline: **9 Nov 2026, 11:59 PM IST**.

The live AI invoice extractor you already tested in `isocode-customs-api-test` is a separate proof of concept. **This milestone intentionally uses real database-backed synthetic extraction records, not a pretend AI integration.** Secure document upload + server-side Gemini ingestion comes next.

## Start here — macOS setup

1. If you already have Milestone 01 in `~/Downloads/clearport-ai`, apply `clearport-ai-milestone-02-update.zip` **into that same folder**, preserving your Git history. Alternatively, unzip the full `clearport-ai-milestone-02.zip` and work in its extracted `clearport-ai-milestone-02` folder.
2. Open Terminal, then run these commands **one at a time**:

```bash
cd ~/Downloads/clearport-ai/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m clearport.seed_db
python -m pytest -q
```

You should see **31 tests passed**. The seed command creates a **local-only** SQLite database (`backend/clearport_dev.sqlite3`), and a random JWT secret in `.env`; both are ignored by Git. **Never upload `.env` or the database file to GitHub.**

3. Start the API:

```bash
python -m uvicorn clearport.api:app --reload
```

4. Open `http://127.0.0.1:8000/docs` in your Mac's browser. This is **API documentation**, not the final polished UI. Use Ctrl+C in Terminal to stop the server.

### Try a protected endpoint

- Expand `POST /auth/login` → **Try it out**, enter `{"email":"executive@clearport.demo","password":"DemoExec#2026"}`, and press Execute.
- Copy only the `access_token` response value (not your Gemini key).
- Click **Authorize** near the top of the Docs screen, paste the token, and authorize.
- Expand `GET /shipments` → Try it out → Execute. Two sample shipments should appear.
- Expand `GET /shipments/SHP-24811` and set `shipment_id` to `SHP-24811` to see the deliberate 3120-vs-3165 kg conflict.

For manager-only approval, log in as `manager@clearport.demo` / `DemoManager#2026` and authorize with that token. These credentials are **synthetic local demo accounts, not production passwords**. The password must be changed and an identity provider chosen before production.

## Implemented and verified

- FastAPI: `/health`, `/auth/login`, `/auth/me`, shipment list/details/checks, human field confirmation, edited fields, manager approval, guarded CSV export, audit history.
- SQLAlchemy database models: user, shipment, documents, field audit, manager approval, export events. Local SQLite is persistent; `DATABASE_URL` can point to a PostgreSQL instance for a production-grade migration path. The legacy `backend/sql/schema.sql` is a **blueprint** not the active schema.
- Passwords hashed with scrypt; signed four-hour JWTs in a secret not committed to Git; authenticated roles, manager-only approval.
- Export blocked while any blocking check remains or unless the manager approves **the latest shipment revision**; edits and confirmations change revision.
- CSV export records an audit event; untrusted text is Excel formula-escaped.
- Human review explicitly records low-confidence field confirmations **without falsely changing the model's confidence score**.
- **31 passing tests:** 18 original logic tests and 13 backend tests, including role protection, wrong passwords, mismatch blocking, stale revisions, invalid edits, full resolve→approve→export flow.

## Not implemented yet (do not represent this as finished)

- File upload/PDF preview, API Gemini extraction, document storage or review UI.
- Production India-region hosting, private object storage, field source snippets, data access audit logs, mature auth/rate-limiting/migrations and transaction locks under concurrent load.
- User-facing 6–8 screen Next.js frontend and responsive polished UX.

## Project requirements and submission contract

- The real Isocode submission is **one ZIP <=25 MB containing only the TDD (PDF or Word) and deployment.md**; source belongs in a public GitHub repo with meaningful commit history, no secrets and fictional sample data. Place GitHub URL at top of TDD, plus live app URL if available.
- TDD covers architecture, data model, flows, AI, UI decisions, assumptions, cuts, and next steps. `deployment.md` contains runnable instructions, env **names only**, deployment details and reviewer demo accounts.
- See `docs/REQUIREMENTS.md`, `docs/ASSUMPTIONS.md` and `docs/ARCHITECTURE.md`.
- Core: upload invoice, packing list and bill of lading; genuine vision extraction with uncertainty; side-by-side review; numeric and cross-document checks; manager approval; CSV export; role-based access; clean desktop UI; tests and secure handling.
