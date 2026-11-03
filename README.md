# ClearPort AI — Isocode Customs Take-Home

**Current milestone: 01 — deterministic validation foundation. This is not yet the finished application.**

Client scenario: a freight forwarder/customs broker in Navi Mumbai, working with invoices, packing lists and bills of lading. The core product will use a vision-capable AI model to create drafts; humans must verify low-confidence or conflicting details, and export is blocked until review and approval are complete.

## What works in milestone 01

- Pure-Python cross-document validation engine (no AI dependency for these checks).
- Invoice total vs. line totals, individual line arithmetic, packages and gross weights across the three documents.
- Required-document, missing-value, invalid-value, unreadable-page, and low-confidence flags.
- Two synthetic shipments: `SHP-24811` has a deliberate **3120 kg vs 3165 kg** mismatch; `SHP-24812` is internally consistent.
- Automated tests; PostgreSQL schema designed for authenticated roles, document storage references, review audit and export records.

## Run on macOS or Linux (Python 3.10+)

```bash
cd ~/Downloads/clearport-ai/backend
python3 -m unittest discover -s tests -v
python3 -m clearport.demo
```

Expected: all tests pass, and the demo prints the weight mismatch for SHP-24811. No API key, server, payment or package installation is required for this milestone.

## Future milestones (not implemented yet)

1. FastAPI backend, PostgreSQL connection, role-based sign-in, secure file upload.
2. Gemini PDF/image extraction with structured fields and confidence/uncertainty flags; keep the earlier working `gemini-2.5-flash` model and use only fictional files on a free tier.
3. User interface (~6–8 screens): shipment list, upload, extraction state, review next to document, corrections, manager approval, export and history.
4. Correctness and security tests, deployment, documentation, final reviewer demo.

See `docs/REQUIREMENTS.md` and `docs/ASSUMPTIONS.md` for the assignment contract and recorded decisions. **Keep Git commits meaningful**. No secret, real client document or real personal data belongs in a public GitHub repo.

## Final submission packaging rule

The **final Isocode upload** must be a ZIP of **exactly two files**: (1) Technical Design Document in PDF/Word, with the GitHub URL at the top (and live URL if deployed), and (2) `deployment.md` including local and deployment steps, environment variable *names* and reviewer demo logins. Source code stays in a **public GitHub repo** through review. This starter ZIP is a local development handoff, **not** the final submission ZIP.
