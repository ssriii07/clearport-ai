# Milestone 6 — Quality and experience refinements

## Scope and design decisions

This update builds on the existing ClearPort AI take-home solution and **does not change** the approved warm-paper, muted steel-blue, restrained soft-orange, serif-heading, and thin blue-grey-curve design. All sources remain fictional.

### Implemented in this update

- **Login:** the line drawing is slightly larger in laptop-height windows without returning to a scrolling login.
- **Shipments:** remove bottom footer copy that overlapped the curves; replace it with a small `Demo` context label in the authenticated header. Report actual `Exported`/`Approved` state instead of implying that all source fields are confirmed; new or low-confidence shipments that lack document mismatches read `Needs review`.
- **Review:** compact shipment title/navigation; preserve 55/45 source/fields layout; place genuine mismatches first; group non-conflicting unconfirmed fields behind a disclosure; keep confirmed fields collapsed; maintain Edit, Confirm from source, J/K and E/Enter shortcuts. Clicking a row or `Find in PDF` asks the backend to annotate the **actual source text in a temporary PDF copy** when it can find it, and opens the correct PDF page. It never alters stored originals.
- **Cross-checks:** clear numeric units and labels, source-vs-shipment-record buyer explanation, actual numerical discrepancy calculation (not hardcoded), no field-path debug text in the customer-facing UI; improved resolution guidance that distinguishes AI corrections from conflicting documents.
- **Upload:** actual original filenames, extracted/manual status, PDF/PNG/JPEG 6 MB guidance, honest sequential extraction state, explicit retry, and manual-entry recovery when AI fails or a scan is unreadable.
- **Manual entry:** authenticated source attachment (private file), form fields, reviewer attestation, audit events, optimistic revision checks, strict field schema and size limits, automatic-check gating, and status `manual_verified`. Missing/invalid information and cross-document conflicts remain blocking; human input does not silently override source discrepancies.
- **Approval/export:** earlier readiness and next-action messaging, revision-aware manager sign-off, guarded CSV action, and a note when seeded documents have no original attached.
- **History:** user-friendly audit descriptions, event-type filters, and grouping of repeated adjacent source views in the interface only. Every original access event remains in the database.
- **Responsive states:** mobile tabs for PDF/fields, compact layout and forms, readable statuses, reduced-motion-compatible extraction animation.

### Technical notes and honesty about limitations

- Source highlighting uses **PyMuPDF** on searchable text PDFs only. If a scan is image-only, its exact text location cannot be confidently identified; the product shows a plain explanation instead of a fake highlight. Search may find the first matching occurrence if the same number appears multiple times; a reviewer must check context.
- This demo does **not** automatically calibrate AI model confidence. Percentages remain hover-only, clearly labeled as an uncalibrated hint. No measured 95% accuracy result is claimed.
- The fictional clean sample **SHP-24812** was seeded and may already be manager-approved/exported **without an attached original file**; it demonstrates the policy gate but cannot claim source-verification. Live source confirmation requires the original file.
- CSV columns are an **assumed import schema**. The client did not supply its filing software's actual Excel import template. This is not customs portal submission.
- The brief's per-field/per-supplier measured accuracy report is **optional depth not completed**; do not claim it in the TDD. India-only production hosting, client-data no-training contracts and full DPDP controls remain deployment prerequisites, not verified in this local fictional demo.
- The backend tests and static source checks are not a replacement for a production Next.js build and a browser end-to-end run on the user's Mac.

## Manual acceptance run (use fictional documents)

1. Check login on laptop and a narrow phone viewport: no overflow, muted steel-blue curves remain clear.
2. In Shipments verify `SHP-24811` shows a real `Mismatch` and previously exported `SHP-24812` shows `Exported` rather than `Confirmed`. Confirm search/filter work.
3. Open `SHP-24811` Review: source and fields are visible without excessive scrolling. Confirm flagged fields appear first and others are collapsed; expand a group; test J/K and `E` keys while a row is focused.
4. From Checks choose `Inspect evidence` for gross weight. Verify the comparison `3,120 / 3,165 / 3,120 kg`, source location highlighting in a searchable sample invoice, and that genuine mismatch remains blocking. For an image-only scan, verify the truthful fallback message.
5. In Upload inspect original filenames; use a new throwaway shipment to test a failed extraction and `Enter manually`. Attach its original, enter source-backed values with an explanation, and verify audit history. Incomplete manual values must remain blocked.
6. As executive, check SHP-24811 cannot be approved/exported; as manager, check SHP-24812 current revision approval and CSV. Do not change seed data in this run.
7. History: verify PDF view events are grouped visually, filters work, and the backend's original event count remains available.
8. Check error/no-data states, mobile actions/tap targets, keyboard focus and reduced-motion setting.

## Suggested verification commands

```sh
cd ~/Downloads/clearport-ai/backend
source ../.venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest -q
cd ../frontend
npm run typecheck
npm run build
npm audit
```

Do **not** reseed or delete the existing SQLite database. Preserve Git history. Only commit after the Mac's Next.js build and browser acceptance pass.
