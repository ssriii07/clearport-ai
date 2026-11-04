"""Deterministic checks on *draft* extraction data.

This module has no dependency on AI providers, databases or HTTP libraries.
All issues block export until humans resolve them and a manager approves the
CURRENT reviewed revision (approval enforcement belongs in the API layer).
"""

from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
import re
from typing import Any

REQUIRED_DOCUMENTS = ("invoice", "packing_list", "bill_of_lading")
REQUIRED_INVOICE_FIELDS = (
    "supplier_name", "buyer_name", "invoice_number", "invoice_date", "currency", "incoterm"
)
REQUIRED_BOL_FIELDS = ("bill_of_lading_number", "container_numbers")


@dataclass(frozen=True)
class Issue:
    code: str
    message: str
    locations: tuple[str, ...] = ()
    details: dict[str, str] = field(default_factory=dict)
    severity: str = "blocking"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Report:
    shipment_id: str
    issues: list[Issue]

    @property
    def checks_clear(self) -> bool:
        """Only checks; final export ALSO needs manager approval."""
        return not any(i.severity == "blocking" for i in self.issues)

    def to_dict(self) -> dict[str, Any]:
        return {"shipment_id": self.shipment_id,
                "checks_clear": self.checks_clear,
                "manager_approval_required": True,
                "issues": [issue.to_dict() for issue in self.issues]}


def _decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value).replace(",", "").strip())
        return number if number.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def _meaningful(value: Any) -> bool:
    if value is None or value == "" or value == []:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def _comparable_party(value: Any) -> str:
    """Avoid false positives from harmless capitalization and punctuation changes.

    Names that still differ are sent to humans: never silently rewrite parties.
    """
    return re.sub(r'[^a-z0-9]', '', str(value or '').casefold())


def validate_shipment(shipment: dict[str, Any], *, confidence_threshold: str = "0.85") -> Report:
    """Expects `{shipment_id, documents: {kind: {status, extracted, confidence}}}`.

    Confidence is an *uncalibrated model hint*, not a mathematical guarantee.
    Mismatches are not silently waived or rounded away.
    """
    issues: list[Issue] = []
    shipment_id = str(shipment.get("shipment_id", "unknown"))
    docs = shipment.get("documents", {})
    if not isinstance(docs, dict):
        docs = {}

    for kind in REQUIRED_DOCUMENTS:
        if kind not in docs:
            issues.append(Issue("MISSING_DOCUMENT", f"Missing required {kind.replace('_', ' ')}.",
                                (kind,)))

    valid_docs: dict[str, dict[str, Any]] = {}
    for kind in REQUIRED_DOCUMENTS:
        raw = docs.get(kind)
        if not isinstance(raw, dict):
            if kind in docs:
                issues.append(Issue("INVALID_DOCUMENT", f"{kind} document record is invalid.", (kind,)))
            continue
        data = raw.get("extracted", {})
        if not isinstance(data, dict):
            issues.append(Issue("INVALID_DOCUMENT", f"{kind} has no valid extracted fields.", (kind,)))
            continue
        valid_docs[kind] = data
        status = raw.get("status")
        if status == "unreadable":
            issues.append(Issue("UNREADABLE_DOCUMENT", f"{kind} is unreadable; use manual entry or replace the scan.", (kind,)))
        elif status != "extracted":
            issues.append(Issue("DOCUMENT_NOT_READY", f"{kind} is not ready for review (status: {status}).", (kind,)))
        confidence = raw.get("confidence", {})
        confirmed = raw.get("confirmed_fields", [])
        if not isinstance(confirmed, list):
            confirmed = []
        if not isinstance(confidence, dict):
            confidence = {}
        for path, score in confidence.items():
            if path in confirmed:
                # Human confirmation is tracked separately; never fabricate a higher model score.
                continue
            number = _decimal(score)
            if number is None or not Decimal("0") <= number <= Decimal("1"):
                issues.append(Issue("INVALID_CONFIDENCE", f"Unusable AI confidence on {kind}.{path}.",
                                    (f"{kind}.{path}",)))
            elif number < Decimal(confidence_threshold):
                issues.append(Issue("LOW_CONFIDENCE", f"Human confirmation required for {kind}.{path}.",
                                    (f"{kind}.{path}",), {"score": str(number)}))

    invoice = valid_docs.get("invoice")
    if invoice is not None:
        importer_name = shipment.get('importer_name')
        buyer_name = invoice.get('buyer_name')
        if (_meaningful(importer_name) and _meaningful(buyer_name) and
                _comparable_party(importer_name) != _comparable_party(buyer_name)):
            issues.append(Issue(
                'BUYER_IMPORTER_MISMATCH',
                'Invoice buyer differs from the shipment importer; verify the correct party.',
                ('invoice.buyer_name',),
                {'invoice_buyer': str(buyer_name), 'shipment_importer': str(importer_name)}))
        for key in REQUIRED_INVOICE_FIELDS:
            if not _meaningful(invoice.get(key)):
                issues.append(Issue("MISSING_FIELD", f"Invoice is missing {key}.", (f"invoice.{key}",)))
        lines = invoice.get("line_items")
        invoice_total = _decimal(invoice.get("invoice_total"))
        if invoice_total is None or invoice_total < 0:
            issues.append(Issue("INVALID_FIELD", "Invoice total is missing or invalid.",
                                ("invoice.invoice_total",)))
        if not isinstance(lines, list) or not lines:
            issues.append(Issue("MISSING_FIELD", "Invoice must have at least one line item.",
                                ("invoice.line_items",)))
        else:
            line_sum = Decimal("0")
            can_sum = True
            for index, line in enumerate(lines):
                at = f"invoice.line_items[{index}]"
                if not isinstance(line, dict):
                    issues.append(Issue("INVALID_FIELD", "Line item must be an object.", (at,)))
                    can_sum = False
                    continue
                for key in ("description", "hsn_code"):
                    if not _meaningful(line.get(key)):
                        issues.append(Issue("MISSING_FIELD", f"{at} missing {key}.", (f"{at}.{key}",)))
                qty = _decimal(line.get("quantity"))
                price = _decimal(line.get("unit_price"))
                total = _decimal(line.get("line_total"))
                if qty is None or qty <= 0 or price is None or price < 0 or total is None or total < 0:
                    issues.append(Issue("INVALID_LINE", f"{at} has missing/invalid quantity or price.", (at,)))
                    can_sum = False
                    continue
                expected = qty * price
                if abs(expected - total) > Decimal("0.01"):
                    issues.append(Issue("LINE_TOTAL_MISMATCH", f"{at}: quantity × unit price differs from stated line total.",
                                        (at,), {"calculated": str(expected), "stated": str(total)}))
                line_sum += total
            if invoice_total is not None and invoice_total >= 0 and can_sum and abs(invoice_total - line_sum) > Decimal("0.01"):
                issues.append(Issue("INVOICE_TOTAL_MISMATCH", "Invoice total differs from summed line totals.",
                                    ("invoice.invoice_total", "invoice.line_items"),
                                    {"calculated": str(line_sum), "stated": str(invoice_total)}))

    packing = valid_docs.get("packing_list")
    if packing is not None and invoice is not None:
        pack_invoice = packing.get('invoice_number')
        inv_number = invoice.get('invoice_number')
        if (_meaningful(pack_invoice) and _meaningful(inv_number) and
                str(pack_invoice).strip().casefold() != str(inv_number).strip().casefold()):
            issues.append(Issue(
                'INVOICE_REFERENCE_MISMATCH',
                'Packing-list invoice reference differs from the commercial invoice.',
                ('packing_list.invoice_number', 'invoice.invoice_number'),
                {'packing_list': str(pack_invoice), 'invoice': str(inv_number)}))

    bol = valid_docs.get("bill_of_lading")
    if bol is not None:
        for key in REQUIRED_BOL_FIELDS:
            if not _meaningful(bol.get(key)):
                issues.append(Issue("MISSING_FIELD", f"Bill of lading is missing {key}.",
                                    (f"bill_of_lading.{key}",)))

    for field_name, label in (("packages", "Package count"), ("gross_weight_kg", "Gross weight (kg)")):
        values: dict[str, Decimal] = {}
        for kind in REQUIRED_DOCUMENTS:
            data = valid_docs.get(kind)
            if data is None:
                continue
            raw = data.get(field_name)
            number = _decimal(raw)
            if number is None or number <= 0 or (field_name == "packages" and number != int(number)):
                issues.append(Issue("INVALID_FIELD", f"{kind}: missing or invalid {label.lower()}.",
                                    (f"{kind}.{field_name}",)))
            else:
                values[kind] = number
        if len(values) >= 2 and len(set(values.values())) > 1:
            issues.append(Issue(
                "PACKAGE_MISMATCH" if field_name == "packages" else "GROSS_WEIGHT_MISMATCH",
                f"{label} does not match across documents; human review required.",
                tuple(f"{kind}.{field_name}" for kind in values),
                {kind: str(number) for kind, number in values.items()}
            ))
    return Report(shipment_id, issues)
