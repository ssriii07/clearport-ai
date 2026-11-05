"""Create a curated demonstration COPY of an existing local SQLite database.

No changes are made to the source database or stored document files.
The output includes only shipment IDs present in backend/seed/shipments.json,
while retaining their approvals, audits, stored-document metadata, and exports.

Usage, from the project root:
 python3 backend/scripts/prepare_reviewer_demo.py

The generated backend/clearport_reviewer_demo.sqlite3 must NOT be added to Git.
Run the app against it only when showcasing the curated demonstration dataset.
"""

import json
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
SOURCE = BACKEND_DIR / "clearport_dev.sqlite3"
TARGET = BACKEND_DIR / "clearport_reviewer_demo.sqlite3"
SEED = BACKEND_DIR / "seed" / "shipments.json"


def main():
    if not SOURCE.is_file():
        raise SystemExit(f"Development DB not found: {SOURCE}")
    if TARGET.exists():
        raise SystemExit(f"Target already exists, refusing to overwrite: {TARGET}")

    permitted_ids = [row["shipment_id"] for row in json.loads(SEED.read_text())]
    if not permitted_ids:
        raise SystemExit("Seed file contains no shipment IDs; refusing to create demonstration database")

    # SQLite's backup API takes a consistent snapshot even if the dev server is open.
    with sqlite3.connect(f"file:{SOURCE}?mode=ro", uri=True) as dev, sqlite3.connect(TARGET) as demo:
        dev.backup(demo)
        old_ids = [sid for (sid,) in demo.execute("SELECT id FROM shipments") if sid not in permitted_ids]
        if old_ids:
            placeholders = ",".join("?" for _ in old_ids)
            demo.execute("BEGIN")
            # Find all direct references dynamically, including audit/event tables.
            tables = [name for (name,) in demo.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )]
            for table in tables:
                if table == 'shipments':
                    continue
                # table names originate only from SQLite's catalog, not user input.
                columns = [row[1] for row in demo.execute(f'PRAGMA table_info("{table}")')]
                if "shipment_id" in columns:
                    demo.execute(f'DELETE FROM "{table}" WHERE shipment_id IN ({placeholders})', old_ids)
            demo.execute(f'DELETE FROM shipments WHERE id IN ({placeholders})', old_ids)
            demo.commit()
        integrity = demo.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"Curated database integrity check failed: {integrity}")
        remaining = [row[0] for row in demo.execute("SELECT id FROM shipments ORDER BY id")]
        if not remaining or any(sid not in permitted_ids for sid in remaining):
            raise RuntimeError("Unexpected shipments in curated database")

    print("Curated demo database created (original development database unchanged).")
    print(f"Output: {TARGET}")
    print("Shipments:", ", ".join(remaining))
    print(f"Removed {len(old_ids)} development-only shipment(s) from the COPY only.")
    print("Do not commit or publish either SQLite database.")


if __name__ == "__main__":
    main()
