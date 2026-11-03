"""Run `python3 -m clearport.demo` from the backend directory."""
import json
from pathlib import Path
from .cross_checks import validate_shipment

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "shipments.json"


def main():
    shipments = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    for shipment in shipments:
        result = validate_shipment(shipment)
        print(f"\n{result.shipment_id} | checks_clear={result.checks_clear}")
        for issue in result.issues:
            print(f"  - {issue.code}: {issue.message}")
            if issue.details:
                print(f"    Values: {issue.details}")
        if not result.issues:
            print("  - No automatic validation issues. Manager approval STILL needed before export.")


if __name__ == "__main__":
    main()
