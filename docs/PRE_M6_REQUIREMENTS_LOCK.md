# ClearPort AI — Pre-Milestone-6 requirement lock

**Source:** the user-provided Isocode customs-broker brief and take-home instructions, 4 November 2026. Do not silently drop a requirement in order to improve aesthetics.

## Exact client setting and scope
- Fictional Company A, Navi Mumbai / Nhava Sheva: customs broker and freight forwarder, 85 people, 14 documentation executives.
- Core goal: reduce retyping from invoices, packing lists and bills of lading, detect conflicting data and hand off to the **existing filing software**, without integrating with the customs portal.
- Users: documentation executive (entry/confirmation) and documentation manager (approval). Importers provide documents / respond to questions outside the core application.
- Core slice **~6–8 screens**: shipment list, upload, AI extraction, side-by-side document review, cross-checks, CSV export, roles. Current implementation has login, list and six shipment routes (overview, upload, review, checks, history, export).
- 6 weeks and ₹7.5 lakh are the fictional client's project constraints, **not** this candidate's take-home delivery time or a promise about real costs.

## Requirements and actual implementation status (never overclaim)

| Requirement from brief | Implementation today | Remaining / honesty notes |
|---|---|---|
| Shipment status list, seeded SHP-24811 and SHP-24812 | **Implemented** | Filters now use API values, never mock KPI totals |
| Upload three kinds, genuine PDF/PNG/JPEG | **Implemented** | 6 MB per document in local prototype |
| Vision AI extraction: parties, invoice reference/date, currency, Incoterm, line items/HSN, packages, weights, containers | **Implemented** via Gemini with source file storage | Some types do not naturally have every field; extraction accuracy is not measured on 200 real cases |
| Model confidence field-by-field; humans review low scores | **Implemented** self-score display and blocking rules | Scores are uncalibrated model opinions, not statistical accuracy |
| Original document alongside editable extracted data | **Implemented** | Source file PDF/image is viewed through an authenticated relay; no bounding-box/page-coordinate linking yet |
| Cross-check invoice total vs lines, packages/weights across all three; reference and buyer checks | **Implemented** via deterministic Python | Keep deliberate gross weight mismatch 3120 vs 3165 vs 3120. Never silently rewrite authentic source data |
| Hover/click evidence trace | **Integrated UI** in Review Desk | Interactive source nodes use **live API fields and issues**, not fictional hardcoded proof. Hover updates inspector, click locks, open source jumps to PDF + field. Does **not** point to an exact PDF coordinate without bounding boxes |
| Human-edit corrections, reason, source confirmation, audit | **Implemented** with revision checks and source requirement for confirmations | Seed data without originals cannot be labeled source-confirmed; editing without source needs an explicit reason |
| No export for unresolved issues / low confidence; manager sign-off | **Implemented** | Seeded clean demonstration can be approved without originals: a known **demo-only policy gap** to address before real deployment |
| CSV in filing software's Excel layout | **Assumed CSV layout implemented** | Client has **not provided an actual Excel column specification**, so exact import compatibility remains unverified |
| Edit history | **Implemented** | Source viewing is also audited |
| Accuracy reporting per field and supplier | **Not finished** | Human-confirmed/corrected event counts exist, but no validated accuracy report or 200-shipment ground truth; include as a prioritized follow-up, do not invent an accuracy percentage |
| Unreadable pages go to manual entry | **Partial** | Individual field editing works, but full blank/unreadable-document manual-entry workflow is still incomplete |
| Clean desktop UI, restrained palette, clear typography, no useless UI | **Redesigned** | Warm cream + lavender + charcoal, purposeful hover and source comparisons; mobile layout available but desktop is priority |
| Security: RBAC, importer privacy, India-region hosting, no provider training on client files | **Local prototype partially** | Auth / roles and private local file access exist. **India-region hosting, provider enterprise no-training contract, encryption, DPDP controls, production security remain unverified** |
| 95% field accuracy over 200 historical shipments; under 15 minutes per shipment; amended entries halved | **Not measured** | These are client's target success metrics, not achieved results; require real evaluation after consent and production controls |
| No filing on customs portal, no HSN classification or duty calculation, no customer tracking portal | **Honored** | Do not add as fake features |

## Take-home rules to preserve for Milestone 6
- **Due 9 November 2026, 11:59 PM IST**.
- Submit a **single ZIP no larger than 25 MB**, containing **only two documents**: TDD as PDF or DOCX and `deployment.md`.
- Put public GitHub repository URL **at the top of TDD**; include deployed URL **if available**.
- Put source code in the **public GitHub repo with meaningful commit history**; no API keys, private data, real importer documents, DB credentials or `.env` secrets.
- TDD: architecture, data model, API and flows, AI use and uncertainty handling, trust/security decisions, UI/UX decisions, tests, deliberate cuts and trade-offs, assumptions and follow-on work; give truthful functionality claims.
- `deployment.md`: reproducible local startup and deployment instructions; environment variable **names**, never values; fictional demonstration accounts; links when available.
- Evaluation: **quality 50%, problem solving 30%, communication 20%**. Take-home must have running frontend, backend, DB, authentication, working AI, meaningful tests and polished responsive loading/error/empty states.

## Interaction and safety contract
- Evidence graph represents reported field values / rule results, **not** a machine-verified ground truth or OCR coordinates.
- Each source card responds to hover/focus/click; "Inspect" opens the real side-by-side viewer with the corresponding field highlighted when available. Source availability is explicit.
- Clarification request UI **drafts/copies text only**. It never sends WhatsApp, email or external messages and never changes the shipment.
- No UI animation should unlock export or alter validation; only persisted field edits / human source confirmations and manager approval can do that.
- Ordinary review opens directly to PDF and fields; Evidence Studio opens on user request or the explicit `?studio=1` link, so review remains efficient all day.

## Required next verification on the actual Mac
1. `python -m pytest -q` from `backend` (baseline: 39 tests).
2. `node scripts/evidence-check.cjs` from `frontend` after npm install (new mapping checks).
3. `npm run typecheck`, `npm run build`, `npm audit` from `frontend`.
4. Live browser: exec and manager login, dashboard filters, open Evidence Studio for SHP-24811, hover/click sources, "Inspect original + field" jump to real PDF and correct field; return to existing 2 mismatch checks; test guarded export and History.
5. Inspect responsive width and reduced-motion mode; verify no secrets or generated files in `git status --short` before commit.

## Deployment is a separate Milestone 6 deliverable
This patch is not a deployment, not a TDD submission ZIP, and not proof of production DPDP/privacy compliance. Preserve the client's India hosting + no-training condition in deployment decisions, not just in prose.
