# Milestone 5 — Quality and security notes (4 Nov 2026)

This document records the current safeguards and the still-outstanding scope. Use it to help draft the TDD; **do not claim production security/compliance from a local demonstration**.

## Implemented in this update

- A field cannot be marked **confirmed against source** until the corresponding original PDF/image was uploaded and still exists. The API enforces this independently of the UI; a source-less confirmation returns HTTP 409 and leaves shipment revision unchanged.
- Shipment details expose `documents.<kind>.source_available` to allow the review UI to hide the source-confirmation action when the original file is missing. Manual edits remain possible with a specific, recorded reason, but are **not represented as source confirmations**.
- Viewing a privately stored source document writes a `source_view` audit event with the reviewer account and a file fingerprint. Access events do not change the reviewed shipment revision or invalidate manager sign-off.
- Per-field model scores remain visible, but are labelled **AI self-score** rather than an accuracy percentage. These scores are uncalibrated model self-estimates, not verified probabilities.
- A buyer/importer name mismatch and a packing-list/commercial-invoice reference mismatch generate explicit blocking issues. Source discrepancies must be resolved with reliable documents; do not edit fields merely to silence warnings.
- Existing optimistic revision checks continue to invalidate approval when a document is uploaded, corrected, or confirmed. 39 automated backend tests now pass, including new tests covering the above safeguards.

## Expected behavior on the existing fictional test shipment

`SHP-24811` contains a deliberate gross-weight mismatch: invoice 3120 kg, packing list 3165 kg, bill of lading 3120 kg.

The fictional uploaded invoice may also name `Eastbridge Imports Pvt. Ltd. (India)` as its buyer, while the seeded shipment record says `Example Importer India Pvt Ltd`. With the new buyer/importer check, the system correctly reports an **additional** blocking issue. This is not an error in the patch or proof that either source is correct. Investigate and correct the fictional source/record consistently before export.

`SHP-24812` is the seeded clean approval/export demonstration. It may lack actual uploaded source files; seeded records are explicitly fictional demo data, and the application does not claim those fields were confirmed against an original.

## Important constraints that still require work before production

1. **Unreadable-page manual transcription** is not yet a complete end-to-end workflow. Editing individual displayed fields exists, but a dedicated manual-entry form for empty line-item arrays and a reviewed status transition still need implementation. Do not claim that fallback is finished.
2. Uploaded local files are private, but not encrypted at rest by the application. An actual deployment needs encrypted India-region storage, retention/deletion controls, authenticated audit access, and appropriate backup policies.
3. Gemini's free tier must **never** receive real client documents. Choose and verify a provider/data-processing setup that does not train on client data and meets the client's confidentiality and hosting constraints before real use.
4. SQLite is used for a single-developer local demo; PostgreSQL, migration discipline, and concurrency/locking tests remain deployment tasks.
5. The filing software's real Excel column specification has not been provided. CSV is based on an **explicit assumption**, not a verified integration.
6. Production authentication needs rate limiting, credential rotation, secure session lifetime management, and stricter deployment configuration.
7. Verify frontend production build (`npm run typecheck`, `npm run build`) and rerun `npm audit` on the **user's Mac** before committing. The frontend syntax was parsed here, but npm dependencies are not available in this isolated build environment.

## Tests

From the existing `backend` directory with virtualenv active:

```bash
python -m pytest -q
```

Expected: `39 passed` with the pinned local dependency environment. These tests use isolated fictional SQLite databases and mocked AI responses; a separate real Gemini test has already been completed using fictional documents.
