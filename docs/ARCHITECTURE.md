# Planned architecture — not yet implemented (Milestone 01)

Browser UI (Next.js + TypeScript) -> authenticated FastAPI -> PostgreSQL.

Private storage holds PDFs/images; API streams/uploads with validation. Backend calls Gemini server-side with synthetic test documents during development. AI creates only a DRAFT with field confidence and missing/uncertain markers. Human executive edits/confirms each field; backend executes deterministic cross-document checks. Manager approves a shipment revision; export endpoint rechecks validation and approval transactionally before streaming CSV. Audits record access, edits, approvals and exports.

### Proposed 7-step reviewer demo

1. Sign in as executive and see seeded shipments.
2. Open SHP-24811 and upload invoice, packing list, bill of lading.
3. Observe real extraction and confidence flags, side-by-side preview.
4. See automatic 3120 vs 3165 kg mismatch and blocked export.
5. Manually correct after checking source document, record edit reason.
6. Sign in as manager, review current revision and approve.
7. Export CSV; show audit history and one unreadable/failed AI case.

### Threats to handle in implementation

Broken object-level authorization, arbitrary file uploads, prompt injection in documents, bad AI output, missing fields, unsafe access to raw documents, race conditions between approval and export, leaked API keys, stale approvals, insufficient logging, exposing confidential client details, and ambiguous layout requirements.
