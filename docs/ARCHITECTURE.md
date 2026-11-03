# ClearPort AI architecture — implementation status

## Milestone 02 actually implemented

- FastAPI API (`backend/clearport/api.py`), testable with built-in Swagger UI at `/docs`.
- SQLAlchemy actual schema (`backend/clearport/database.py`) using local SQLite database by default. `DATABASE_URL` can configure PostgreSQL; automated migration tooling remains TODO. The existing `backend/sql/schema.sql` is **an older design blueprint, not used by the app**.
- Auth (`backend/clearport/auth.py`): scrypt password hashes, short-lived signed JWT bearer tokens, active user lookups. Manager-only approval is enforced on the server.
- Original deterministic cross-check engine (`backend/clearport/cross_checks.py`), extended to ignore low-confidence alerts only once a human confirmation is recorded separately, without mutating raw AI scores.
- Revision-based approvals: every edit and confirmation increments shipment revision, invalidating an earlier approval. Export always recomputes checks and validates current manager approval.
- Edit, confirmation, approval and export audit records in the database.
- Synthetic sample records and local demo users loaded by `python -m clearport.seed_db`.

## Next milestones

Browser UI (Next.js + TypeScript) → authenticated FastAPI → PostgreSQL for deployed demo.

Private storage holds PDFs/images. Server accepts validated uploads and calls Gemini only from backend with model output treated as draft. Document can be unreadable and manually entered. Executive reviews the document side by side with editable fields and confidence flags. Manager checks and approves current revision. Final CSV export requires all checks to be clear.

## Target reviewer demo

1. Sign in as executive; open seeded shipment list.
2. Upload invoice, packing list and bill of lading; Gemini reads fictional documents.
3. Side-by-side preview shows source and editable draft, including low-confidence fields.
4. SHP-24811 exhibits 3120-vs-3165 kg discrepancy and blocks export.
5. Fix source-verified field, explicitly confirm uncertain container reference.
6. Sign in as manager, approve current revision.
7. Export CSV and show audit history, explain one unreadable-scan fallback.

## Known security/engineering follow-ups

Avoid real importer data in free-tier AI tests; use paid provider with verified no-training / India-region contract for production. Audit all document reads; private object storage; limit sizes/types; inspect PDF content; handle prompt injection, provider errors, stale approvals, malformed values, race conditions and CSV formula injection. Database row locks and migration tooling are needed before a real multi-user production launch.


## Milestone 3 additions (2026-11-03)
The API accepts authenticated 6 MB PDF/PNG/JPEG uploads, invokes Gemini 2.5 Flash for genuine draft extraction, normalizes fields, records self-estimated confidence per field, saves source bytes outside Git, and increments the shipment revision. The source-file metadata table is added with `Base.metadata.create_all`; the existing local database is preserved. Uploaded source files are accessible only through an authenticated download route. Failed extraction does not replace earlier reviewed data. Old approval is invalidated automatically by the revision change.

Known remaining gaps: production encrypted India storage, read-access audit, queued asynchronous extraction, manual-ready transition for unreadable scans, page-level provenance and frontend document viewer. Source files must remain fictional on the free Gemini tier.
