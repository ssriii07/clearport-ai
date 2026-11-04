"""Milestone 03: authenticated review, manager approval, guarded export and real AI uploads."""
import copy
import csv
import hashlib
import io
import json
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .auth import current_user, issue_token, manager_only, verify_password
from .cross_checks import validate_shipment
from .database import Document, ExportEvent, FieldAudit, ManagerApproval, Shipment, User, StoredDocument, get_db

from .ai_extract import ExtractionFailure, extract_document
from .uploads import MAX_BYTES, file_mime, private_root

app = FastAPI(title='ClearPort AI - Milestone 03', version='0.3.0', description='Real PDF/image Gemini extraction, authenticated review, approval and guarded CSV export.')
DOC_KINDS = {'invoice', 'packing_list', 'bill_of_lading'}
TOP_FIELDS = {
    'invoice': {'supplier_name','buyer_name','invoice_number','invoice_date','currency','incoterm','invoice_total','packages','gross_weight_kg','line_items'},
    'packing_list': {'supplier_name','invoice_number','packages','gross_weight_kg','line_items'},
    'bill_of_lading': {'bill_of_lading_number','container_numbers','packages','gross_weight_kg'},
}
LINE_FIELDS = {'description', 'hsn_code', 'quantity', 'unit_price', 'line_total'}
PATH_PATTERN = re.compile(r'^([a-z][a-z_]*)(?:\[(\d{1,3})\]\.([a-z][a-z_]*))?$')

class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=200)

class EditRequest(BaseModel):
    field_path: str = Field(min_length=1, max_length=140)
    value: Any
    reason: str = Field(min_length=8, max_length=500)
    expected_revision: int = Field(ge=1)

class ConfirmRequest(BaseModel):
    field_path: str = Field(min_length=1, max_length=140)
    expected_revision: int = Field(ge=1)

class ApproveRequest(BaseModel):
    expected_revision: int = Field(ge=1)
    comment: str = Field(default='', max_length=500)


def get_shipment(db: Session, shipment_id: str) -> Shipment:
    obj = db.get(Shipment, shipment_id)
    if obj is None:
        raise HTTPException(404, 'Shipment not found')
    return obj


def document_of(db: Session, shipment_id: str, kind: str) -> Document:
    if kind not in DOC_KINDS:
        raise HTTPException(400, 'Invalid document kind')
    doc = db.scalar(select(Document).where(Document.shipment_id == shipment_id, Document.kind == kind))
    if doc is None:
        raise HTTPException(404, 'Document not found')
    return doc


def check_report(db: Session, shipment_id: str):
    docs = db.scalars(select(Document).where(Document.shipment_id == shipment_id)).all()
    shipment = get_shipment(db, shipment_id)
    payload = {'shipment_id': shipment_id, 'importer_name': shipment.importer_name, 'documents': {d.kind: {
        'status': d.status, 'extracted': d.extracted,
        'confidence': d.confidence, 'confirmed_fields': d.confirmed_fields
    } for d in docs}}
    return validate_shipment(payload)


def approved_current_revision(db: Session, shipment: Shipment) -> bool:
    return db.scalar(select(ManagerApproval.id).where(
        ManagerApproval.shipment_id == shipment.id,
        ManagerApproval.revision == shipment.revision,
    )) is not None


def serialize_shipment(db: Session, obj: Shipment, detailed=False) -> dict:
    report = check_report(db, obj.id)
    result = {'shipment_id': obj.id, 'importer_name': obj.importer_name,
              'revision': obj.revision, 'status': obj.status,
              'checks_clear': report.checks_clear,
              'approved_current_revision': approved_current_revision(db, obj),
              'export_allowed': report.checks_clear and approved_current_revision(db, obj)}
    if detailed:
        result['validation'] = report.to_dict()
        stored = {source.kind: source for source in db.scalars(
            select(StoredDocument).where(StoredDocument.shipment_id == obj.id))}
        root = private_root()
        result['documents'] = {d.kind: {
            'status': d.status, 'extracted': d.extracted,
            'confidence': d.confidence, 'confirmed_fields': d.confirmed_fields,
            'source_available': d.kind in stored and (root / stored[d.kind].stored_name).is_file(),
        } for d in db.scalars(select(Document).where(Document.shipment_id == obj.id))}
    return result


def parse_path(kind: str, path: str):
    match = PATH_PATTERN.fullmatch(path)
    if not match:
        raise HTTPException(422, 'Invalid field path')
    parent, index, child = match.groups()
    if parent not in TOP_FIELDS[kind]:
        raise HTTPException(422, 'Field is not editable for this document')
    if index is not None and (parent != 'line_items' or child not in LINE_FIELDS):
        raise HTTPException(422, 'Invalid line-item field')
    if index is None and parent == 'line_items':
        raise HTTPException(422, 'Edit individual line-item values instead')
    return parent, int(index) if index is not None else None, child


def read_field(data: dict, path_parts):
    parent, index, child = path_parts
    if index is None:
        return data.get(parent)
    lines = data.get(parent)
    if not isinstance(lines, list) or index >= len(lines) or not isinstance(lines[index], dict):
        raise HTTPException(422, 'Line item does not exist')
    return lines[index].get(child)


def write_field(data: dict, path_parts, value):
    parent, index, child = path_parts
    if index is None:
        data[parent] = value
    else:
        data[parent][index][child] = value


def validate_edit_value(value):
    if value is None or isinstance(value, (dict, bool)):
        raise HTTPException(422, 'Expected a non-null string, number or string list')
    if isinstance(value, str) and (len(value) > 500 or not value.strip()):
        raise HTTPException(422, 'Field text must be 1–500 characters')
    if isinstance(value, list) and (len(value) > 20 or any(not isinstance(x, str) or not x.strip() or len(x) > 100 for x in value)):
        raise HTTPException(422, 'Expected a list of short nonempty strings')
    if not isinstance(value, (str, int, float, list)):
        raise HTTPException(422, 'Invalid field value')
    if len(json.dumps(value)) > 1200:
        raise HTTPException(422, 'Field value too large')


def revision_guard(db: Session, shipment: Shipment, expected_revision: int):
    """Optimistic revision check: stale edits cannot silently overwrite others."""
    result = db.execute(update(Shipment).where(
        Shipment.id == shipment.id, Shipment.revision == expected_revision
    ).values(revision=Shipment.revision + 1, status='needs_review'))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, 'Shipment changed. Refresh and review the latest revision.')
    db.refresh(shipment)


@app.get('/health')
def health():
    return {'status': 'ok', 'milestone': 3, 'ai_ingestion_enabled': True}

@app.post('/auth/login')
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, 'Invalid email or password')
    return {'access_token': issue_token(user), 'token_type': 'bearer', 'role': user.role}

@app.get('/auth/me')
def me(user: User = Depends(current_user)):
    return {'email': user.email, 'role': user.role}

@app.get('/shipments')
def shipments(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [serialize_shipment(db, obj) for obj in db.scalars(select(Shipment).order_by(Shipment.id))]

@app.get('/shipments/{shipment_id}')
def shipment(shipment_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return serialize_shipment(db, get_shipment(db, shipment_id), detailed=True)

@app.get('/shipments/{shipment_id}/checks')
def checks(shipment_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    get_shipment(db, shipment_id)
    return check_report(db, shipment_id).to_dict()

@app.post('/shipments/{shipment_id}/documents/{kind}/upload')
async def upload_document(shipment_id: str, kind: str,
                          expected_revision: int = Query(ge=1), file: UploadFile = File(...),
                          db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Store a SOURCE document and its actual AI draft; a retry never fabricates results."""
    shipment = get_shipment(db, shipment_id)
    if kind not in DOC_KINDS:
        raise HTTPException(400, 'Invalid document kind')
    if shipment.revision != expected_revision:
        raise HTTPException(409, 'Shipment changed; refresh before uploading')
    # The document is read at a fixed cap to prevent arbitrarily large uploads.
    try:
        data = await file.read(MAX_BYTES + 1)
    finally:
        await file.close()
    if not data:
        raise HTTPException(422, 'File is empty')
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Document exceeds 6 MB limit')
    mime = file_mime(data)
    if not mime:
        raise HTTPException(415, 'Only genuine PDF, PNG and JPEG files are supported')
    try:
        draft = extract_document(kind, data, mime)
    except ExtractionFailure as exc:
        raise HTTPException(502, str(exc)) from None
    # Persist the original file privately. It can be downloaded only with authorization.
    name = str(uuid.uuid4())
    root = private_root()
    destination = root / name
    destination.write_bytes(data)
    try:
        destination.chmod(0o600)
    except OSError:
        pass
    old_path = None
    try:
        revision_guard(db, shipment, expected_revision)
        doc = db.scalar(select(Document).where(Document.shipment_id == shipment_id, Document.kind == kind))
        if doc is None:
            doc = Document(shipment_id=shipment_id, kind=kind, status=draft.status,
                           extracted=draft.extracted, confidence=draft.confidence, confirmed_fields=[])
            db.add(doc)
        else:
            doc.status = draft.status
            doc.extracted = draft.extracted
            doc.confidence = draft.confidence
            doc.confirmed_fields = []
        stored = db.scalar(select(StoredDocument).where(
            StoredDocument.shipment_id == shipment_id, StoredDocument.kind == kind))
        if stored:
            old_path = stored.stored_name
        else:
            stored = StoredDocument(shipment_id=shipment_id, kind=kind)
            db.add(stored)
        stored.stored_name = name
        stored.original_name = Path(file.filename or 'upload').name[:150]
        stored.mime_type = mime
        stored.sha256 = hashlib.sha256(data).hexdigest()
        stored.size_bytes = len(data)
        db.add(FieldAudit(shipment_id=shipment_id, document_kind=kind, field_path='*',
                          action='ai_upload', old_value=None,
                          new_value=json.dumps({'sha256': stored.sha256, 'mime_type': mime}),
                          reason='Authenticated document upload; Gemini draft extraction', user_id=user.id))
        db.commit()
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    if old_path:
        # Old file names originate exclusively from server-generated UUIDs.
        (root / old_path).unlink(missing_ok=True)
    return serialize_shipment(db, shipment, detailed=True)


@app.get('/shipments/{shipment_id}/documents/{kind}/file')
def view_original(shipment_id: str, kind: str, db: Session = Depends(get_db),
                  user: User = Depends(current_user)):
    get_shipment(db, shipment_id)
    if kind not in DOC_KINDS:
        raise HTTPException(400, 'Invalid document kind')
    stored = db.scalar(select(StoredDocument).where(
        StoredDocument.shipment_id == shipment_id, StoredDocument.kind == kind))
    if stored is None:
        raise HTTPException(404, 'No uploaded source file for this document')
    root = private_root()
    target = (root / stored.stored_name).resolve()
    if target.parent != root or not target.is_file():
        raise HTTPException(404, 'Source file unavailable')
    # Document access is sensitive even in the fictional prototype. Audit reads
    # without modifying the reviewed shipment revision or manager approval.
    db.add(FieldAudit(shipment_id=shipment_id, document_kind=kind, field_path='*',
                      action='source_view', old_value=None,
                      new_value=json.dumps({'sha256': stored.sha256}),
                      reason='Authenticated access to original document', user_id=user.id))
    db.commit()
    return FileResponse(target, media_type=stored.mime_type, filename=stored.original_name,
                        content_disposition_type='inline',
                        headers={'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})


@app.patch('/shipments/{shipment_id}/documents/{kind}/field')
def edit_field(shipment_id: str, kind: str, body: EditRequest,
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    shipment = get_shipment(db, shipment_id)
    doc = document_of(db, shipment_id, kind)
    parts = parse_path(kind, body.field_path)
    validate_edit_value(body.value)
    data = copy.deepcopy(doc.extracted)
    old = read_field(data, parts)
    if old == body.value:
        raise HTTPException(422, 'Value is unchanged; use field confirmation for verification')
    revision_guard(db, shipment, body.expected_revision)
    write_field(data, parts, body.value)
    doc.extracted = data
    doc.confirmed_fields = [x for x in doc.confirmed_fields if x != body.field_path]
    db.add(FieldAudit(shipment_id=shipment_id, document_kind=kind, field_path=body.field_path,
                      action='edit', old_value=json.dumps(old), new_value=json.dumps(body.value),
                      reason=body.reason, user_id=user.id))
    db.commit()
    return serialize_shipment(db, shipment, detailed=True)

@app.post('/shipments/{shipment_id}/documents/{kind}/confirm')
def confirm_field(shipment_id: str, kind: str, body: ConfirmRequest,
                  db: Session = Depends(get_db), user: User = Depends(current_user)):
    shipment = get_shipment(db, shipment_id)
    doc = document_of(db, shipment_id, kind)
    parts = parse_path(kind, body.field_path)
    # A seeded extraction record is NOT a source document. Never claim a field
    # was verified against an unavailable original.
    source = db.scalar(select(StoredDocument).where(
        StoredDocument.shipment_id == shipment_id, StoredDocument.kind == kind))
    root = private_root()
    if not source or not (root / source.stored_name).is_file():
        raise HTTPException(409, 'Upload the original document before confirming fields from source')
    val = read_field(doc.extracted, parts)
    if val is None or val == '' or val == []:
        raise HTTPException(422, 'Missing field cannot be confirmed. Enter a value first.')
    if body.field_path not in doc.confidence:
        raise HTTPException(422, 'No AI uncertainty recorded for this field')
    if body.field_path in doc.confirmed_fields:
        raise HTTPException(422, 'Field already confirmed')
    revision_guard(db, shipment, body.expected_revision)
    doc.confirmed_fields = [*doc.confirmed_fields, body.field_path]
    db.add(FieldAudit(shipment_id=shipment_id, document_kind=kind, field_path=body.field_path,
                      action='confirmed', old_value=None, new_value=json.dumps(val),
                      reason='Explicitly confirmed by human reviewer against source', user_id=user.id))
    db.commit()
    return serialize_shipment(db, shipment, detailed=True)

@app.post('/shipments/{shipment_id}/approve')
def approve(shipment_id: str, body: ApproveRequest, db: Session = Depends(get_db), user: User = Depends(manager_only)):
    shipment = get_shipment(db, shipment_id)
    if shipment.revision != body.expected_revision:
        raise HTTPException(409, 'Shipment changed since you opened it')
    if not check_report(db, shipment_id).checks_clear:
        raise HTTPException(409, 'Resolve all blocking issues before manager approval')
    if approved_current_revision(db, shipment):
        raise HTTPException(409, 'Current revision already approved')
    # DB transaction protects the approval record; production should use row locking.
    db.add(ManagerApproval(shipment_id=shipment_id, revision=shipment.revision, user_id=user.id, comment=body.comment))
    shipment.status = 'approved'
    db.commit()
    return serialize_shipment(db, shipment)


def csv_safe(value):
    """Neutralize formula injection if a spreadsheet opens untrusted exported text."""
    s = str(value if value is not None else '')
    if s and (s[0] in '=+-@' or s[0] in '\t\r\n'):
        return "'" + s
    return s


def shipment_csv(db: Session, shipment_id: str) -> str:
    docs = {d.kind: d.extracted for d in db.scalars(select(Document).where(Document.shipment_id == shipment_id))}
    inv, bol = docs['invoice'], docs['bill_of_lading']
    shipment = get_shipment(db, shipment_id)
    output = io.StringIO(newline='')
    writer = csv.writer(output, lineterminator='\n')
    # Assumed layout: the client did not supply the filing application's exact columns.
    writer.writerow(['shipment_id','importer','supplier','invoice_number','invoice_date','currency','incoterm','item_description','hsn_code','quantity','unit_price','line_total','invoice_total','packages','gross_weight_kg','bill_of_lading_number','container_numbers'])
    for line in inv['line_items']:
        writer.writerow([csv_safe(x) for x in [shipment.id, shipment.importer_name, inv.get('supplier_name'),
            inv.get('invoice_number'), inv.get('invoice_date'), inv.get('currency'), inv.get('incoterm'),
            line.get('description'), line.get('hsn_code'), line.get('quantity'), line.get('unit_price'),
            line.get('line_total'), inv.get('invoice_total'), inv.get('packages'), inv.get('gross_weight_kg'),
            bol.get('bill_of_lading_number'), '; '.join(bol.get('container_numbers', []))]])
    return output.getvalue()

@app.post('/shipments/{shipment_id}/export')
def export_shipment(shipment_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    shipment = get_shipment(db, shipment_id)
    if not check_report(db, shipment_id).checks_clear:
        raise HTTPException(409, 'Blocking checks must be cleared before export')
    if not approved_current_revision(db, shipment):
        raise HTTPException(409, 'Manager must approve this exact shipment revision')
    result = shipment_csv(db, shipment_id)
    digest = hashlib.sha256(result.encode('utf-8')).hexdigest()
    db.add(ExportEvent(shipment_id=shipment_id, revision=shipment.revision, user_id=user.id, sha256=digest))
    shipment.status = 'exported'
    db.commit()
    return Response(result, media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{shipment_id}.csv"', 'Cache-Control': 'no-store'})

@app.get('/shipments/{shipment_id}/history')
def history(shipment_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    get_shipment(db, shipment_id)
    audits = db.scalars(select(FieldAudit).where(FieldAudit.shipment_id == shipment_id).order_by(FieldAudit.id)).all()
    approvals = db.scalars(select(ManagerApproval).where(ManagerApproval.shipment_id == shipment_id)).all()
    exports = db.scalars(select(ExportEvent).where(ExportEvent.shipment_id == shipment_id)).all()
    return {'edits_and_confirmations': [dict(field_path=a.field_path, action=a.action, document_kind=a.document_kind,
             old_value=a.old_value, new_value=a.new_value, reason=a.reason, user_id=a.user_id, created_at=a.created_at) for a in audits],
            'approvals': [dict(revision=a.revision, user_id=a.user_id, comment=a.comment, created_at=a.created_at) for a in approvals],
            'exports': [dict(revision=e.revision, user_id=e.user_id, sha256=e.sha256, created_at=e.created_at) for e in exports]}
