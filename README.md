# ClearPort AI — Isocode Customs Take-Home

**Milestone 03: real Gemini invoice/packing-list/bill-of-lading upload (backend only).** The final UI and production deployment are NOT finished.

## M3 update (apply to existing Git project, do NOT unzip as a new repository)

Stop your existing backend server with `Control+C` in its Terminal window, then from a fresh Terminal:

```bash
cd ~/Downloads/clearport-ai
unzip -o ~/Downloads/clearport-ai-milestone-03-update.zip -d ~/Downloads/clearport-ai
cd backend
source ../.venv/bin/activate
python -m pip install -r requirements.txt
python -m clearport.seed_db
python -m pytest -q
```

Expected: **35 passed**. `seed_db` is safe to rerun and adds the new source-file metadata table without overwriting existing sample shipments, corrections or manager approvals. The existing SQLite DB is preserved.

To test REAL AI upload, first stop the server if running, then in the *same Terminal where you will start the server* enter:

```bash
read -s "GEMINI_API_KEY?Paste your Gemini API key: "; echo; export GEMINI_API_KEY
python -m uvicorn clearport.api:app --reload
```

For Mac zsh, `read -s` hides your key. Never paste an API key into Swagger request JSON or screenshots, GitHub or chat. For first use, choose **fictional PDFs only**; Gemini free-tier data handling does not meet the client confidentiality requirement.

Open `http://127.0.0.1:8000/docs`, login as the demo executive and authorize. Use:

- `POST /shipments/{shipment_id}/documents/{kind}/upload` with `shipment_id=SHP-24811`, `kind=invoice`, `expected_revision=1` *if the record still has revision 1* and the fictional PDF downloaded previously. The endpoint checks the current revision, so always use the current `revision` from `GET /shipments/{shipment_id}`.
- If Gemini succeeds, the endpoint returns the updated shipment with extracted draft values and AI-estimated per-field confidence. If the API call fails, existing values are left unchanged and the endpoint returns an error; the model output is never faked.
- `GET /shipments/{shipment_id}/documents/{kind}/file` returns the original privately stored document only to a signed-in user.
- `GET /shipments/{shipment_id}/checks` highlights missing, uncertain and inconsistent fields. **Never export until checks clear and a manager approves the latest revision.**

Only source files up to 6 MB with a PDF/PNG/JPEG magic signature are allowed. Private document bytes are stored under `backend/private_uploads/` (ignored by Git). The code stores a SHA-256 file fingerprint and upload event; never upload real client data to this free-tier demo. Source access is not yet separately logged, and extraction lacks source-page highlights or an unreadable-to-manual-ready transition. Those remain outstanding.

### Model / privacy / engineering assumptions

- The account has already successfully invoked **Gemini 2.5 Flash** from Python for a fictional invoice. Default model: `gemini-2.5-flash` (override with `GEMINI_MODEL`).
- Gemini supplies *self-assessed* confidence, not statistically calibrated accuracy. If a returned field has no valid confidence score, the backend records `0.0`, requiring human confirmation.
- PDF/images are sent to Gemini through `google-genai` with the in-memory SDK bytes API; no OCR stub or hard-coded extraction is used for live requests.
- `UPLOADS_DIR` is configurable and must become private encrypted storage with controlled retention and audit access logs before actual client use. India-region hosting and an appropriately contracted non-training data processor are production requirements, not claimed as implemented.
- For a real customs filing export, the client needs to supply its exact software column layout. This milestone retains the documented *assumed* CSV structure.

---

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
