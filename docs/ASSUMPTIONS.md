# Explicit design assumptions for TDD (review and revise)

Do not present these as client-provided requirements. Add every unsupported choice we make here, and copy the relevant list to the final Technical Design Document.

- **A-001:** The sample USD invoice has no freight, insurance, tax or discount adjustments; therefore `invoice_total = sum(line_total)` directly. Later handle adjustment fields explicitly if needed.
- **A-002:** All sample weights are in kilograms and all package counts are integer counts. Cross-document discrepancies are flagged even if differences could be legitimate; humans investigate.
- **A-003:** Invoice amount comparisons allow up to USD/EUR 0.01 as a rounding allowance. No currency exchange is performed.
- **A-004:** A model-provided per-field score below 0.85 is tagged for review. Scores are *uncalibrated*, so reviewers can still reject high-scoring guesses.
- **A-005:** A document's draft `extracted` JSON and `confidence` JSON are saved separately from immutable file metadata; edits are written to an append-only field-edit history.
- **A-006:** There is one active invoice, one packing list and one bill of lading per shipment during the core build; replacement versions need audit history before production.
- **A-007:** Executive can upload and edit; manager can approve the current reviewed revision. Any later edit invalidates that approval. No exports with open blocking issues.
- **A-008:** The client did not supply the filing system's exact Excel layout. We will document an assumed column layout and provide reviewable CSV export for the core build, rather than claim compatibility with a specific system.
- **A-009:** All demo company/person names, emails, quantities not in the brief, and document text are synthetic. The user-provided brief supplies example shipment IDs and a deliberate gross-weight conflict.
- **A-010:** Gemini 2.5 Flash is chosen based on a successful Python+PDF test using synthetic files. The free API tier may not satisfy the client's production no-training requirement; production requires a confirmed compliant, suitably located data-processing plan.
- **A-011:** During local development, source files live in private local upload storage; a production deployment needs private object storage with signed access and India-region infrastructure.
- **A-012:** Frontend is desktop-first since the brief says desktop use. Minimalist visual palette and side-by-side review are mandatory design priorities.
- **A-013:** Milestone 02 uses SQLite for an easy local persistent demonstration; SQLAlchemy models allow a later PostgreSQL configuration. No claims of production-ready migration or concurrent transactions are made.
- **A-014:** Demo executive and manager accounts are fictional with documented example passwords; production requires secure credential provisioning, rate limits and stronger account lifecycle controls.
- **A-015:** Human confirmation suppresses a *review alert* for that field while retaining the original model confidence and writing an audit record. Field edits require a reason and invalidate a prior manager approval.
- **A-016:** CSV uses assumed columns because no filing-software-specific import template was provided; spreadsheet formula escaping is applied to untrusted text fields.


## Milestone 3 explicit assumptions
- **ASSUMPTION M3-1:** Individual uploaded files are limited to 6 MiB and PDF/PNG/JPEG in this demo; the client did not specify a file size limit.
- **ASSUMPTION M3-2:** Per-field confidence scores are self-reported by Gemini and treated as *uncalibrated hints*. Missing/invalid scores are forced to 0 and require manual confirmation.
- **ASSUMPTION M3-3:** Local source files are private and ignored by Git, but production will need India-hosted encrypted object storage, deletion and access audit. This is not claimed as implemented.
- **ASSUMPTION M3-4:** Uploading a source replaces the prior draft for that document and always invalidates manager approval by incrementing the shipment revision.
- **ASSUMPTION M3-5:** The client has not provided the proprietary Excel import layout; current CSV columns are fictional prototype columns.
