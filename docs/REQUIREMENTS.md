# Isocode assignment requirements — pinned project checklist

**Selected client:** Customs broker/freight forwarder, Navi Mumbai / Nhava Sheva. Deadline **9 November 2026, 11:59 PM IST**. Seven-day take-home, work individually. AI tools are recommended, but the design judgement and choices must be explainable in the interview.

## Core end-to-end slice (non-negotiable)

- [ ] Shipment list with status and sample records.
- [ ] Upload **commercial invoice + packing list + bill of lading** (PDF/scans/photos).
- [ ] REAL vision-model extraction (parties, invoice number/date, currency, Incoterm, line items with HSN, packages, weights, container references).
- [ ] Field-level confidence/uncertainty and source document link, editable review next to document.
- [x] Deterministic invoice arithmetic and package/weight cross-check logic (milestone 01).
- [x] API: verify uncertain fields, edit mismatches, retain audit history (UI remains pending).
- [x] API: block export until checks clear and manager approves current revision.
- [x] API: CSV export in assumed filing-software import layout (layout not supplied).
- [x] Authenticated executive and manager roles with server-side authorization (milestone 02 API).
- [ ] Approximately 6–8 purposeful, desktop-first screens with excellent UX.

## More of MUST HAVE (optional depth once core is stable)

- [ ] Supplier/field accuracy reporting, richer edit history views.
- [ ] More formats or cases; Excel-compatible export variation.

## Hard constraints and quality bar

- [ ] No fake AI, dead buttons, or demo-only frontend without backend.
- [ ] Sensible retries, unreadable document/manual-entry case, low-confidence highlighting.
- [ ] Well-designed minimal, high-readability UI with loading, empty and error states.
- [x] Realistic fictional seed data including SHP-24811 (gross weight 3120 vs 3165) and SHP-24812.
- [x] Standalone cross-check and API/auth/export integration tests (31 passing).
- [ ] Validated inputs, safe file size/type limits, private file storage, hashed passwords, server-side role checks.
- [ ] Confidential prices / personal importer contacts: India-hosted production systems, role-based access and model provider that does not train on client data.
- [ ] Robustness against skewed and bilingual scans; no accuracy claim based only on one clean test PDF.
- [ ] No real personal/client data or secrets in repository; no key in browser JS.

## Explicit out-of-scope

- Customs portal filing.
- HSN classification or duty calculation.
- Importer-facing tracking portal.
- Full replacement of existing filing software.

## Submission and review rules

- [ ] Public GitHub repository with **meaningful commit history** until review completes.
- [ ] GitHub URL at top of TDD; live app URL if deployed.
- [ ] TDD in PDF or Word: architecture + why, data model, primary flows, AI behavior, UI screen rationale, assumptions, scope cuts, future roadmap.
- [ ] `deployment.md`: how to run locally, how it is deployed, environment-variable **names only**, reviewer demo credentials.
- [ ] Upload a **single ZIP (max 25 MB) containing exactly TDD and deployment.md**; repo stays on GitHub, not stuffed in submission ZIP.
- [ ] You may resubmit before deadline, but latest submitted version is judged.
- [ ] Prepare to explain the decisions and numbers in the interview.

**Isocode scoring:** quality 50%, problem solving 30%, communication 20%.
