# ClearPort AI — mandatory final review before commit

This update addresses user-approved requirements without changing the importer mismatch rule or the design theme.

| Requirement | Implementation | Acceptance |
|---|---|---|
| Remove duplicate desktop navigation | Global top bar shows global destinations only; shipment navigation remains in the shipment tabs. Shipment links remain available in mobile hamburger menu | Desktop and 400px mobile browser review required |
| Clear review-screen hierarchy | Dynamically show *all* blocking issue cards first; place linked fields and not-yet-verified fields in separate collapsible groups; confirmed fields remain collapsed; counts are based on actual shipment/revision state | Revisit SHP-24811 and a clean shipment; test Inspect evidence and mobile tabs |
| Curated demo data | `backend/scripts/prepare_reviewer_demo.py` makes a separate SQLite snapshot containing only seeded shipment IDs; the developer's database and audit events are preserved. No test record is deleted from development data | Run on Mac when preparing demo, check that the resulting copy excludes SHP-CC1E5D94; never commit SQLite DBs |
| AI extraction and backend safeguards | Existing implementation; NOT changed by this patch | On Mac with `GEMINI_API_KEY` already set locally, upload a new fictional document, check the AI result and failed/unreadable fallback; rerun backend tests and verify role/export authorization. Do not claim live AI verified until completed. |

## Important

The original importer mismatch remains as an additional documented validation assumption.

Curated-copy setup (run only after finishing the development tests):

```sh
python3 backend/scripts/prepare_reviewer_demo.py
```

This creates `backend/clearport_reviewer_demo.sqlite3`. The default local app continues using `backend/clearport_dev.sqlite3` unless you deliberately change `DATABASE_URL`.

The evidence viewer and sticky bar modifications are optional; no risky restructuring is introduced here.
