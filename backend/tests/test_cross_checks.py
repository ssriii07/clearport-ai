import copy
import json
import unittest
from pathlib import Path

from clearport.cross_checks import validate_shipment

SAMPLES = json.loads((Path(__file__).parent.parent / "seed" / "shipments.json").read_text())


class CrossCheckTests(unittest.TestCase):
    def setUp(self):
        self.bad = copy.deepcopy(SAMPLES[0])
        self.good = copy.deepcopy(SAMPLES[1])

    def codes(self, shipment):
        return {i.code for i in validate_shipment(shipment).issues}

    def test_deliberate_gross_weight_discrepancy(self):
        report = validate_shipment(self.bad)
        self.assertFalse(report.checks_clear)
        weight = next(i for i in report.issues if i.code == "GROSS_WEIGHT_MISMATCH")
        self.assertEqual(weight.details["invoice"], "3120")
        self.assertEqual(weight.details["packing_list"], "3165")
        self.assertEqual(weight.details["bill_of_lading"], "3120")

    def test_weak_ai_extraction_needs_human_confirmation(self):
        self.assertIn("LOW_CONFIDENCE", self.codes(self.bad))

    def test_valid_shipment_passes_automatic_checks_not_manager_approval(self):
        report = validate_shipment(self.good)
        self.assertTrue(report.checks_clear)
        self.assertTrue(report.to_dict()["manager_approval_required"])

    def test_invalid_document_entry_blocks(self):
        self.good["documents"]["bill_of_lading"] = None
        self.assertIn("INVALID_DOCUMENT", self.codes(self.good))

    def test_pending_extraction_blocks(self):
        self.good["documents"]["invoice"]["status"] = "pending"
        self.assertIn("DOCUMENT_NOT_READY", self.codes(self.good))

    def test_missing_invoice_total_blocks_even_when_lines_missing(self):
        invoice = self.good["documents"]["invoice"]["extracted"]
        invoice.pop("invoice_total")
        invoice.pop("line_items")
        self.assertIn("INVALID_FIELD", self.codes(self.good))

    def test_missing_bol_blocks(self):
        del self.good["documents"]["bill_of_lading"]
        self.assertIn("MISSING_DOCUMENT", self.codes(self.good))

    def test_missing_invoice_field_blocks(self):
        self.good["documents"]["invoice"]["extracted"].pop("invoice_number")
        self.assertIn("MISSING_FIELD", self.codes(self.good))

    def test_invoice_total_vs_line_sum(self):
        self.good["documents"]["invoice"]["extracted"]["invoice_total"] = "8000.00"
        self.assertIn("INVOICE_TOTAL_MISMATCH", self.codes(self.good))

    def test_line_quantity_price_arithmetic(self):
        self.good["documents"]["invoice"]["extracted"]["line_items"][0]["line_total"] = "7000.00"
        codes = self.codes(self.good)
        self.assertIn("LINE_TOTAL_MISMATCH", codes)
        self.assertIn("INVOICE_TOTAL_MISMATCH", codes)

    def test_package_mismatch_blocks(self):
        self.good["documents"]["packing_list"]["extracted"]["packages"] = 19
        self.assertIn("PACKAGE_MISMATCH", self.codes(self.good))

    def test_unreadable_document_requires_manual_path(self):
        self.good["documents"]["packing_list"]["status"] = "unreadable"
        self.assertIn("UNREADABLE_DOCUMENT", self.codes(self.good))

    def test_bad_numeric_value_must_not_be_ignored(self):
        self.good["documents"]["invoice"]["extracted"]["gross_weight_kg"] = "unknown"
        self.assertIn("INVALID_FIELD", self.codes(self.good))

    def test_negative_or_boolean_quantity_rejected(self):
        lines = self.good["documents"]["invoice"]["extracted"]["line_items"]
        for value in (-5, True):
            lines[0]["quantity"] = value
            self.assertIn("INVALID_LINE", self.codes(self.good))

    def test_decimal_equivalence_does_not_flag_mismatch(self):
        self.good["documents"]["packing_list"]["extracted"]["gross_weight_kg"] = "1460.00"
        self.assertNotIn("GROSS_WEIGHT_MISMATCH", self.codes(self.good))

    def test_confidence_threshold_boundary(self):
        self.good["documents"]["invoice"]["confidence"]["invoice_number"] = 0.85
        self.assertNotIn("LOW_CONFIDENCE", self.codes(self.good))
        self.good["documents"]["invoice"]["confidence"]["invoice_number"] = 0.84
        self.assertIn("LOW_CONFIDENCE", self.codes(self.good))

    def test_invalid_confidence_needs_review(self):
        self.good["documents"]["invoice"]["confidence"]["invoice_total"] = 1.3
        self.assertIn("INVALID_CONFIDENCE", self.codes(self.good))

    def test_missing_container_reference_blocks(self):
        self.good["documents"]["bill_of_lading"]["extracted"]["container_numbers"] = []
        self.assertIn("MISSING_FIELD", self.codes(self.good))


if __name__ == "__main__":
    unittest.main()
