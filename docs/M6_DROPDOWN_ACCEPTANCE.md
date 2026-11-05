# Milestone 6 — Dropdown chevron acceptance correction

**Status:** Implemented in CSS; browser visual verification pending.

### Scope

Reviewed all app-owned native `<select>` controls in the current Milestone 6 frontend source:

1. All shipments → **Status** (`frontend/app/(workspace)/shipments/page.tsx`)
2. Decision history → **Show events** (`frontend/app/(workspace)/shipments/[id]/history/page.tsx`)

The previous rule added padding to the native select, but Chrome controls its own arrow independently. Instead, the shared style in `frontend/app/manifest-theme.css` now removes the platform-specific arrow and draws a small muted-steel chevron **18px from the right edge** at a consistent size. This moves it visibly inward while preserving the existing box, color, width and focus behavior. The padding leaves room for long option labels. This rule also covers future simple dropdowns under `.mt-shell` and `.mt-login`, rather than hard-coding only two fields.

**Accessibility:** Uses native `<select>` controls; no custom JavaScript replacement. Keyboard and touch behavior and focus indication remain native. Multiple-selection/listbox controls are excluded.

**Not in scope:** The Chromium PDF viewer's toolbar/dropdowns are rendered by the browser and are not app-owned native selects.

### Check on Mac after extraction

```bash
cd ~/Downloads/clearport-ai/frontend
node scripts/m6-dropdown-check.cjs
npm run typecheck
npm run build
```

1. At ~400px and desktop width, inspect **Shipments → Status**; arrow should sit comfortably inside the right border.
2. At ~400px and desktop width, inspect **Decision history → Show events**; arrow should match Status positioning.
3. Open each control with mouse/keyboard; selection should still work, including the longer **Uploads, corrections and confirmations** option.
4. Confirm selected text does not overlap the arrow, existing focus ring and border remain unchanged.

This is a **small incremental patch** to apply on top of the **corrected consolidated Milestone 6 ZIP already installed**. It does not touch the database, backend, API secrets or design identity. **Do not reinstall the earlier ZIP after applying this one.**
