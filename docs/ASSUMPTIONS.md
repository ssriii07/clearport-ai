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
