# Milestone 6 — final refinement acceptance matrix

**Project:** ClearPort AI / Isocode customs-document take-home
**Scope baseline:** All user-requested desktop and mobile refinements through 5 Nov 2026; original Isocode core requirements remain authoritative.
**Important:** Code present ≠ browser-verified. **Every changed UI item remains pending Mac browser acceptance until actually tested.**

Status key: **Existing/verified** = previously demonstrated in screenshots or automated tests before this patch; **Implemented / retest** = source changes made in this patch, final Mac browser test required; **Deferred / documented** = intentionally not claimed complete.

| ID | Exact requirement / acceptance target | Relevant source | Status / verification |
|---|---|---|---|
| D01 | Preserve warm cream paper background, muted steel-blue, dark navy headings | `app/manifest-theme.css` | Existing/verified; no palette replacement; visual regression needed |
| D02 | Only muted soft orange for genuine problems; tiny green confirmation mark | `app/manifest-theme.css` | Existing/verified; visual regression needed |
| D03 | Faint blue-grey curves on every screen, no lavender | `components/Illustrations.tsx`, `components/Shell.tsx` | Existing/verified; keep unobtrusive |
| D04 | No Customs Clearance stamp; retain approved fine-line login art | `app/login/page.tsx` | Existing/verified; unchanged |
| D05 | Slightly larger login art while retaining no-scroll laptop view | `app/manifest-theme.css` short-viewport rules | Already implemented in initial M6; verify again on Mac |
| D06 | Serif page headings, readable interface text, purposeful minimal components | `app/manifest-theme.css` | Existing/verified; unchanged |
| D07 | Shipment disclaimer not overlapping bottom curves | `components/Shell.tsx`, `app/manifest-theme.css` | Existing M6 adjusted; visual recheck |
| D08 | Shipment status labels and filters correctly distinguish **only actual Mismatch** from other Needs review blockers, Approved and Exported | `shipments/page.tsx` | **Corrected status-filter logic**; Mac search/filter regression pending |
| D09 | Shipment list search, status filter, Refresh and new shipment work | `shipments/page.tsx`, `shipments/new/page.tsx` | Existing browser testing; regression check |
| D10 | Empty shipment illustration and CTA only for truly empty list | `components/Elements.tsx` | Existing; data-state test pending |
| D11 | Shipment list shows loading skeleton rows | `shipments/page.tsx`, CSS | Implemented / retest |
| D12 | Compact shipment/review/checks/approval page header | `components/Elements.tsx`, CSS | Improved in initial M6, further mobile compression in final patch; retest |
| D13 | Review has PDF and fields side-by-side, ~55/45 | `shipments/[id]/review/page.tsx`, CSS | Existing/verified; regression check |
| D14 | Two genuine mismatches first; other fields categorized; confirmed collapsed | `shipments/[id]/review/page.tsx` | Categories corrected in this patch; retest |
| D15 | Edit / Confirm / Find in PDF actions one click away; no AI self-score mistaken for verified | `shipments/[id]/review/page.tsx` | Existing; browser regression check |
| D16 | Find in PDF highlights *actual matching searchable PDF text*, original unmodified | backend `api.py`, `components/SourcePreview.tsx` | Existing backend/UI tested; new reusable viewer retest |
| D17 | Scans/images explicitly disclose lack of reliable precise location | `components/SourcePreview.tsx` | Implemented / retest |
| D18 | Click discrepancy → display invoice/packing-list/B-L values and real difference | `shipments/[id]/review/page.tsx` | Existing/verified; regression check |
| D19 | Buyer/importer explanation correctly distinguishes shipment master from source | `shipments/[id]/review/page.tsx` | Existing; now manual/AI provenance-aware; retest |
| D20 | Correct source conflicts are not silently overwritten to clear export | backend `cross_checks.py`, `api.py` | Existing test; 46 total passing in isolated runner |
| D21 | Upload shows actual filenames without splitting `.pdf` mid-word | `shipments/[id]/upload/page.tsx`, CSS | Implemented ellipsis + title; retest |
| D22 | Exactly one clear extraction status per upload card | `shipments/[id]/upload/page.tsx` | Implemented / retest |
| D23 | Show PDF/PNG/JPEG and per-document 6 MB cap | `shipments/[id]/upload/page.tsx`, backend | Existing/verified |
| D24 | Meaningful real extraction loading/success/error/retry; never fake a completion percentage | `shipments/[id]/upload/page.tsx` | Existing; runtime Gemini retry/error retest |
| D25 | Manual-entry fallback links on all three types | `shipments/[id]/upload/page.tsx` | Existing/verified; mobile access refined |
| **D26** | **Manual entry must show authenticated original document beside editable form on desktop** | **`components/SourcePreview.tsx`, `shipments/[id]/manual/page.tsx`, CSS** | **Implemented / critical browser acceptance pending** |
| D27 | Manual entry mobile Document / Entry fields tabs; switching preserves unsaved typed values | `shipments/[id]/manual/page.tsx`, CSS | Implemented / critical browser acceptance pending |
| D28 | Original preview expandable with zoom and external native viewer option | `components/SourcePreview.tsx`, CSS | Implemented / critical browser acceptance pending |
| D29 | Manual entry groups references, totals, line items and verification | `shipments/[id]/manual/page.tsx` | Implemented / retest |
| D30 | Validation gives specific errors for bad dates/numbers; warn on inconsistent totals | `shipments/[id]/manual/page.tsx`, backend `api.py` | Implemented; new automated negative-path tests passed |
| D31 | Unreadable/missing values can stay blank; cannot be presented as verified by AI | manual form + backend `manual_fields` + cross-checks | Existing/verified; regression check |
| D32 | Checkbox and explanatory text remain aligned; reason required and audited | manual form + backend audit | Implemented UI / backend existing test passed |
| D33 | Multiple line items supported, with Add and Remove controls | manual form | Added Remove; browser test pending |
| D34 | Cross-check headings compact; technical field paths hidden; values formatted with units | `shipments/[id]/checks/page.tsx` | Existing M6; regression check |
| D35 | Clarify edit-vs-request-corrected-paperwork resolution | `shipments/[id]/checks/page.tsx` | Existing; regression check |
| D36 | Approval screen status/next action visible sooner; concise readiness checklist | `shipments/[id]/export/page.tsx` | Existing/verified; mobile browser check passed |
| D37 | Only documentation manager can approve current revision; edits invalidate sign-off | backend `api.py`, `cross_checks.py` | Existing automated tests passed |
| D38 | CSV never exported with unresolved checks; schema explicitly assumed | backend `api.py`, export UI | Existing tests + WPS demonstration; no official template claim |
| D39 | Group repetitive source-view audit UI without dropping original DB events | history UI + backend | Existing/verified |
| D40 | Audit filters include reviews, source views, approvals, exports | history UI | Existing/verified |
| D41 | Human-readable audit titles + responsible user and role | history UI, backend history `actors` | **Actor mapping implemented / retest;** IDs and emails are returned to authenticated users |
| D42 | Consistent dropdown-arrow spacing for **History → Show events** and **Shipments → Status**, including future native single-choice selects | `app/manifest-theme.css` | **Custom chevron 18px inside right border implemented**; Mac desktop/mobile visual retest pending |
| D43 | Mobile shipment cards readable wrapping, consistent status, label “Revision N” | `shipments/page.tsx`, CSS | Implemented / retest |
| D44 | Mobile hamburger has contextual shipment links, active state, closes on selection | `components/Shell.tsx`, CSS | Implemented / retest |
| D45 | Mobile review uses Document / Fields tabs, compact header and bottom bar | reviewer + CSS | Existing tabs; CSS refined / retest |
| D46 | Mobile PDFs readable even when the native browser ignores PDF zoom; page navigation, real zoom and panning, full-screen view, return to entry fields | `components/SourcePreview.tsx`, backend `api.py` `/preview-page`, API relay, CSS | **Upgraded to authenticated PNG page raster with 200% starting zoom and 100–300% controls**. 2 new backend tests pass; actual mobile viewing pending |
| D47 | Mobile upload slots stacked, readable filenames, uncluttered manual options | upload + CSS | Implemented / retest |
| D48 | Mobile manual input fields single column, 44px controls, source preview switch | manual + CSS | Implemented / retest |
| D49 | Mobile checks/approval stack without horizontal overflow and preserve blocked state | existing CSS and export page | Existing browser verification; regression check |
| D50 | Keep buttons accessible: focus states, readable ≥14px body/labels, mobile inputs ≥16px to avoid auto zoom, essential mobile targets ≈44px | theme CSS | **Mobile type/target overrides implemented**; visual and accessibility audit on device pending |
| D51 | Eliminate Next.js `scroll-behavior: smooth` dev warning | `app/manifest-theme.css` | Override implemented; actual console retest |
| D52 | Keep all secrets/sample originals out of update, retain npm fixes and commit history | Selective patch ZIP | Contents verified; Mac `git status` and npm audit pending |
| D53 | Automated backend, frontend syntax, security testing | backend tests, scripts | Backend **48 passed** in reconstructed project (46 existing + 2 mobile-PDF tests), structural and evidence checks passed, TS/TSX parsed/transpiled **26 project files**, CSS parsed; Mac Next build/typecheck/audit pending |

## Core brief features that remain in scope, not silently marked complete

- Genuine Gemini extraction on fictional samples; real confidence is a *model self-score* and not measured accuracy.
- Cross-document checks for arithmetic, package counts and weights, plus party/reference disagreements.
- Manager/executive login, optimistic revision guard, field edit audit, CSV export prevention.
- Handling badly skewed/bilingual or non-searchable scanned PDFs is best-effort; exact in-PDF highlighting is **not** guaranteed for scans.
- Supplier/field **accuracy reporting is not yet a statistically valid feature**. We cannot claim 95% accuracy from two demo shipments; a 200-shipment benchmark is future validation, not a completed test.
- Real India-region hosting, DPDP compliance, client-data training terms and production encryption are **not verified** and must not be represented as done.
- A seed shipment with approved/exported status and no attached source is a **deliberate demo limitation**, not proof of source verification.
- Unspecified exact customs filing-software Excel template is **assumed**; final `deployment.md`/TDD must say so.

## Required Mac acceptance steps before committing

1. Stop dev servers, apply the **corrected consolidated ZIP only**, run backend `python -m pytest -q`: expect **48 passed**.
2. In frontend run `node scripts/m6-polish-check.cjs`, `npm run typecheck`, `npm run build`, `npm audit`.
3. Login, Shipments desktop/mobile, navbar, History dropdown/actor; verify no footer overlap. Filter Mismatch and Needs review independently: a missing-only shipment must NOT appear under Mismatch.
4. **Manual-entry critical:** use test shipment `SHP-CC1E5D94` with a saved fictional PDF, verify original on left and form on right; type a field; switch tabs in 400px view; confirm text is preserved. Try Expand, Zoom and Open in tab. Mobile PDF must show rendered page images with Previous/Next and readable panning; no PDF toolbar dependence. **Do not overwrite the primary seeded shipments.**
5. Reviewer: check source text highlighting still works both in desktop PDF and mobile page raster; see three weight values; test multi-page mobile Next/Previous, zoom, horizontal/vertical swipe and full-screen expansion.
6. Manual form: invalid `2026-02-30`, invalid number and mismatched line sum should display honest validation/warnings. Don't save fabricated values.
7. Approval: unresolved sample still blocked for an executive; clean manager-approved seed remains downloadable with assumed CSV schema.
8. Verify other upload/error/empty/loading flows as possible with fictional data. Then commit only after all required checks are actually satisfied.

## Corrections after the 53-item review (same requirements, no new scope)

- **D08**: Previously the `Mismatch` filter incorrectly included all shipments with blocked checks. It now evaluates the same `shipmentState()` shown in each shipment row. The **Needs review** filter likewise reflects the displayed state. No change to server validation or approval logic.
- **D46**: Replaced mobile reliance on the PDF iframe's `#zoom` hint with a PDF-page-to-PNG route. Each page fetch requires the logged-in session, is limited in rendered pixels, is audited and never mutates the original PDF. `x-page-count` and `x-page-number` headers are forwarded by the existing authenticated Next relay. Field evidence is highlighted only if actual searchable text matches. Page previews may be slower for complex PDFs; opening the original remains available.
- **D50**: Added mobile font-size lower bounds for visible controls/copy and 44px input/action targets, leaving desktop styling and approved colors untouched. Real 400px browser and screen-reader verification remain required.

**The final M6 ZIP supersedes the earlier `clearport-ai-m6-final-polish.zip` which the user was asked not to install.** It still does not constitute production compliance, benchmarked accuracy, or proof of cross-browser completion.

### Dropdown follow-up (D09 and D42) — November 5

Both app-owned native selects (Status and Show events) now use the same shared CSS chevron rather than trying to move the browser-native arrow using padding alone. A source-wide `<select>` inventory found exactly two current dropdowns. Styling is applied to all native single-select elements under the ClearPort workspace or login in the future. `node scripts/m6-dropdown-check.cjs` verifies coverage. **Mac visual verification remains pending**, with attention to mobile and desktop arrow inset, long labels and keyboard behavior. Browser-controlled PDF toolbar selects are outside app scope.

### Acceptance follow-up: CSV button/link spacing — November 5

- **D54 / approval CTA spacing:** The disabled **Download verified CSV** button and **Review blocking issues** link were almost touching in the desktop screenshot. Targeted spacing now gives an 18px horizontal gap on desktop and positions the link 12px below the button on mobile with a minimum 44px tap target. Only `frontend/app/manifest-theme.css` changes. **Actual Mac desktop/mobile visual verification remains pending**. The CSV guard logic is unchanged.
