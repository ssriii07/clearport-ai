"""Milestone 02 API integration tests, using an isolated temporary SQL database."""
import csv
import io
import os
from pathlib import Path
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from clearport.api import app
from clearport.database import Base, get_db, make_engine
from clearport.seed_db import seed

@pytest.fixture()
def env():
    with tempfile.TemporaryDirectory() as temp:
        os.environ['CLEARPORT_JWT_SECRET'] = 'test-only-random-signing-secret-aaaaaaaaaaaaaaaaaaaa'
        engine = make_engine('sqlite:///' + str(Path(temp) / 'test.sqlite3'))
        Base.metadata.create_all(engine)
        local_session = sessionmaker(bind=engine, expire_on_commit=False)
        with local_session() as db:
            seed(db)
        def overridden():
            with local_session() as db:
                yield db
        app.dependency_overrides[get_db] = overridden
        with TestClient(app) as client:
            def login(email, password):
                response = client.post('/auth/login', json={'email': email, 'password': password})
                assert response.status_code == 200, response.text
                return {'Authorization': 'Bearer ' + response.json()['access_token']}
            executive = login('executive@clearport.demo', 'DemoExec#2026')
            manager = login('manager@clearport.demo', 'DemoManager#2026')
            yield client, executive, manager
        app.dependency_overrides.clear()
        engine.dispose()
        os.environ.pop('CLEARPORT_JWT_SECRET', None)

def test_health_unprotected(env):
    client, _, _ = env
    r = client.get('/health')
    assert r.status_code == 200 and r.json()['ai_ingestion_enabled']

def test_auth_required_for_shipments(env):
    client, _, _ = env
    assert client.get('/shipments').status_code == 401
    assert client.post('/shipments/SHP-24811/export').status_code == 401

def test_wrong_login_rejected(env):
    client, _, _ = env
    assert client.post('/auth/login', json={'email': 'manager@clearport.demo', 'password': 'wrong'}).status_code == 401

def test_seed_and_cross_checks_visible(env):
    client, exe, _ = env
    all_shipments = client.get('/shipments', headers=exe).json()
    assert len(all_shipments) == 2
    detail = client.get('/shipments/SHP-24811', headers=exe).json()
    codes = {i['code'] for i in detail['validation']['issues']}
    assert {'LOW_CONFIDENCE','GROSS_WEIGHT_MISMATCH'} <= codes
    assert detail['export_allowed'] is False
    assert client.get('/shipments/SHP-24812', headers=exe).json()['checks_clear'] is True

def test_cannot_approve_wrong_or_unreviewed(env):
    client, exe, manager = env
    assert client.post('/shipments/SHP-24811/approve', headers=exe, json={'expected_revision':1}).status_code == 403
    assert client.post('/shipments/SHP-24811/approve', headers=manager, json={'expected_revision':1}).status_code == 409
    assert client.post('/shipments/SHP-24812/export', headers=exe).status_code == 409

def test_full_workflow_low_confidence_fix_approve_export(env, monkeypatch, tmp_path):
    from clearport import api
    from clearport.ai_extract import ExtractionResult
    client, exe, manager = env
    sid = 'SHP-24811'
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    existing = client.get(f'/shipments/{sid}', headers=exe).json()['documents']['bill_of_lading']
    monkeypatch.setattr(api, 'extract_document', lambda *args: ExtractionResult(
        existing['extracted'], existing['confidence'], 'extracted'))
    # Source-backed review: a seeded extraction alone is not valid source evidence.
    upload = client.post(f'/shipments/{sid}/documents/bill_of_lading/upload?expected_revision=1',
        files={'file': ('bol.pdf', b'%PDF-1.4 pretend fictional document', 'application/pdf')}, headers=exe)
    assert upload.status_code == 200, upload.text
    assert upload.json()['documents']['bill_of_lading']['source_available'] is True
    r = client.post(f'/shipments/{sid}/documents/bill_of_lading/confirm', headers=exe,
        json={'field_path':'container_numbers','expected_revision':2})
    assert r.status_code == 200, r.text
    assert r.json()['revision'] == 3
    assert 'LOW_CONFIDENCE' not in {i['code'] for i in r.json()['validation']['issues']}
    r = client.patch(f'/shipments/{sid}/documents/packing_list/field', headers=exe, json={
        'field_path':'gross_weight_kg','value':3120,
        'reason':'Manual correction to reconcile fictional packing-list sample', 'expected_revision':3})
    assert r.status_code == 200, r.text
    assert r.json()['revision'] == 4
    assert r.json()['checks_clear'] is True
    assert r.json()['export_allowed'] is False
    r = client.post(f'/shipments/{sid}/approve', headers=manager, json={'expected_revision':4, 'comment':'Reviewed documents and corrections'})
    assert r.status_code == 200, r.text
    assert r.json()['export_allowed'] is True
    r = client.post(f'/shipments/{sid}/export', headers=exe)
    assert r.status_code == 200, r.text
    assert 'text/csv' in r.headers['content-type']
    rows = list(csv.DictReader(io.StringIO(r.text)))
    assert len(rows) == 1
    assert rows[0]['invoice_total'] == '16320.00'
    assert rows[0]['gross_weight_kg'] == '3120'
    hist = client.get(f'/shipments/{sid}/history', headers=manager).json()
    assert len(hist['edits_and_confirmations']) == 3
    assert len(hist['approvals']) == 1
    assert len(hist['exports']) == 1

def test_approval_invalidated_by_any_edit(env):
    client, exe, manager = env
    sid = 'SHP-24812'
    assert client.post(f'/shipments/{sid}/approve', headers=manager, json={'expected_revision':1}).status_code == 200
    edit = client.patch(f'/shipments/{sid}/documents/invoice/field', headers=exe, json={
        'field_path':'invoice_number','value':'INV-24812-CHANGED',
        'reason':'Corrected after checking document', 'expected_revision':1})
    assert edit.status_code == 200
    assert edit.json()['revision'] == 2
    assert edit.json()['approved_current_revision'] is False
    assert client.post(f'/shipments/{sid}/export', headers=exe).status_code == 409
    assert client.post(f'/shipments/{sid}/approve', headers=manager, json={'expected_revision':1}).status_code == 409

def test_stale_revision_conflict(env):
    client, exe, _ = env
    sid = 'SHP-24811'
    payload = {'field_path':'gross_weight_kg','value':3120,'reason':'Checked against original document','expected_revision':1}
    assert client.patch(f'/shipments/{sid}/documents/packing_list/field', headers=exe, json=payload).status_code == 200
    payload['value'] = 3121
    assert client.patch(f'/shipments/{sid}/documents/packing_list/field', headers=exe, json=payload).status_code == 409

def test_invalid_paths_and_fields_rejected(env):
    client, exe, _ = env
    sid = 'SHP-24811'
    url = f'/shipments/{sid}/documents/packing_list/field'
    base = {'field_path':'secret_admin','value':'oops','reason':'checked original source', 'expected_revision':1}
    assert client.patch(url, headers=exe, json=base).status_code == 422
    base['field_path'] = 'gross_weight_kg'
    base['value'] = True
    assert client.patch(url, headers=exe, json=base).status_code == 422
    base['value'] = 0
    base['reason'] = 'hi'
    assert client.patch(url, headers=exe, json=base).status_code == 422

def test_missing_field_cannot_be_confirmed(env):
    client, exe, _ = env
    r = client.post('/shipments/SHP-24811/documents/invoice/confirm', headers=exe,
                    json={'field_path':'nonexistent','expected_revision':1})
    assert r.status_code == 422

def test_no_manager_approval_after_unsafe_edit(env):
    client, exe, manager = env
    r = client.patch('/shipments/SHP-24812/documents/invoice/field', headers=exe, json={
        'field_path':'invoice_total','value':'99999.00','reason':'Intentionally changed to test controls','expected_revision':1})
    assert r.status_code == 200
    assert not r.json()['checks_clear']
    assert client.post('/shipments/SHP-24812/approve', headers=manager, json={'expected_revision':2}).status_code == 409

def test_csv_formula_injection_escaped():
    from clearport.api import csv_safe
    assert csv_safe('=SUM(A1:A2)') == "'=SUM(A1:A2)"
    assert csv_safe('+cmd') == "'+cmd"
    assert csv_safe('safe') == 'safe'

def test_unknown_shipment_rejected(env):
    client, exe, _ = env
    assert client.get('/shipments/NOT-REAL', headers=exe).status_code == 404


def test_upload_requires_auth_and_valid_pdf(env, monkeypatch, tmp_path):
    from clearport import api
    from clearport.ai_extract import normalize_ai_response
    client, exe, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    hit = []
    def fake_extract(kind, data, mime):
        hit.append((kind, mime))
        return normalize_ai_response('invoice', {'unreadable': False, 'extracted': {
            'supplier_name': 'Company C', 'buyer_name': 'Example Importer India Pvt Ltd',
            'invoice_number':'INV-24812', 'invoice_date':'2026-10-25',
            'currency':'EUR', 'incoterm':'FOB Gothenburg', 'invoice_total': 7650,
            'packages':18, 'gross_weight_kg':1460,
            'line_items':[{'description':'Steel ball valve DN50','hsn_code':'8481 80 30',
                           'quantity':180,'unit_price':42.5,'line_total':7650}]},
            'confidence': {} })
    monkeypatch.setattr(api, 'extract_document', fake_extract)
    route = '/shipments/SHP-24812/documents/invoice/upload?expected_revision=1'
    pdf = {'file': ('invoice.pdf', b'%PDF-1.4\n1 0 obj\nendobj\n%%EOF', 'application/pdf')}
    assert client.post(route, files=pdf).status_code == 401
    assert client.post(route, files={'file': ('invoice.pdf', b'not a pdf', 'application/pdf')}, headers=exe).status_code == 415
    assert client.post(route, files={'file': ('a.pdf', b'%PDF-'+b'a'*(6*1024*1024+1), 'application/pdf')},headers=exe).status_code == 413
    r = client.post(route, files=pdf, headers=exe)
    assert r.status_code == 200, r.text
    assert r.json()['revision'] == 2
    assert r.json()['approved_current_revision'] is False
    assert r.json()['checks_clear'] is False  # confidence missing => review required
    assert hit == [('invoice','application/pdf')]
    assert client.get('/shipments/SHP-24812/documents/invoice/file').status_code == 401
    fetched = client.get('/shipments/SHP-24812/documents/invoice/file', headers=exe)
    assert fetched.status_code == 200 and fetched.content.startswith(b'%PDF-')
    assert client.post(route,files=pdf,headers=exe).status_code == 409
    history = client.get('/shipments/SHP-24812/history',headers=exe).json()
    assert any(a['action'] == 'ai_upload' for a in history['edits_and_confirmations'])


def test_upload_failure_never_destroys_existing_draft(env, monkeypatch, tmp_path):
    from clearport import api
    from clearport.ai_extract import ExtractionFailure
    client, exe, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    def unavailable(kind, data, mime):
        raise ExtractionFailure('Model temporarily unavailable')
    monkeypatch.setattr(api, 'extract_document', unavailable)
    old = client.get('/shipments/SHP-24812',headers=exe).json()
    response = client.post('/shipments/SHP-24812/documents/invoice/upload?expected_revision=1',
        files={'file':('invoice.pdf', b'%PDF-1.4 test', 'application/pdf')}, headers=exe)
    assert response.status_code == 502
    after = client.get('/shipments/SHP-24812',headers=exe).json()
    assert after['revision'] == old['revision']
    assert after['documents']['invoice']['extracted'] == old['documents']['invoice']['extracted']
    assert not list(tmp_path.iterdir())


def test_replacing_approved_document_invalidates_manager_signoff(env, monkeypatch, tmp_path):
    from clearport import api
    from clearport.ai_extract import ExtractionResult
    client, exe, manager = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    assert client.post('/shipments/SHP-24812/approve',headers=manager,
                       json={'expected_revision':1}).status_code == 200
    prior = client.get('/shipments/SHP-24812', headers=exe).json()
    doc = prior['documents']['invoice']['extracted']
    monkeypatch.setattr(api,'extract_document',lambda kind,data,mime: ExtractionResult(doc, {}, 'extracted'))
    r = client.post('/shipments/SHP-24812/documents/invoice/upload?expected_revision=1',
      files={'file':('invoice.pdf',b'%PDF-1.4 sample','application/pdf')},headers=exe)
    assert r.status_code == 200, r.text
    assert r.json()['approved_current_revision'] is False
    assert client.post('/shipments/SHP-24812/export',headers=exe).status_code == 409


def test_normalization_unknown_model_confidence_blocks():
    from clearport.ai_extract import normalize_ai_response
    draft = normalize_ai_response('bill_of_lading',{'extracted':{
        'bill_of_lading_number':'BOL-1','container_numbers':['ABCD1234567'],
        'packages':12,'gross_weight_kg':100},'confidence':{'packages':2.1}})
    assert draft.confidence['packages'] == 0
    assert draft.confidence['container_numbers'] == 0
    assert 'bill_of_lading_number' in draft.confidence


def test_seeded_records_never_claim_source_verification(env):
    client, exe, _ = env
    detail = client.get('/shipments/SHP-24811', headers=exe).json()
    assert detail['documents']['bill_of_lading']['source_available'] is False
    response = client.post('/shipments/SHP-24811/documents/bill_of_lading/confirm',
        headers=exe, json={'field_path': 'container_numbers', 'expected_revision': 1})
    assert response.status_code == 409
    assert 'original document' in response.json()['detail'].lower()
    assert client.get('/shipments/SHP-24811', headers=exe).json()['revision'] == 1


def test_uploaded_source_view_is_audited_without_changing_revision(env, monkeypatch, tmp_path):
    from clearport import api
    from clearport.ai_extract import ExtractionResult
    client, exe, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    existing = client.get('/shipments/SHP-24811',headers=exe).json()['documents']['bill_of_lading']
    monkeypatch.setattr(api, 'extract_document', lambda *args: ExtractionResult(
        existing['extracted'], existing['confidence'], 'extracted'))
    r = client.post('/shipments/SHP-24811/documents/bill_of_lading/upload?expected_revision=1',
        files={'file': ('bol.pdf', b'%PDF-1.4 fictional', 'application/pdf')}, headers=exe)
    assert r.status_code == 200 and r.json()['revision'] == 2
    assert r.json()['documents']['bill_of_lading']['source_available']
    source = client.get('/shipments/SHP-24811/documents/bill_of_lading/file', headers=exe)
    assert source.status_code == 200
    detail = client.get('/shipments/SHP-24811', headers=exe).json()
    assert detail['revision'] == 2
    audit = client.get('/shipments/SHP-24811/history', headers=exe).json()['edits_and_confirmations']
    assert [a['action'] for a in audit] == ['ai_upload','source_view']
    r = client.post('/shipments/SHP-24811/documents/bill_of_lading/confirm', headers=exe,
        json={'field_path': 'container_numbers', 'expected_revision': 2})
    assert r.status_code == 200
    assert r.json()['revision'] == 3


def test_invoice_buyer_mismatch_blocks_export_and_approval(env):
    client, exe, manager = env
    r = client.patch('/shipments/SHP-24812/documents/invoice/field', headers=exe,
        json={'field_path':'buyer_name', 'value':'Different Fictional Buyer Ltd',
              'reason':'Testing buyer-importer mismatch control', 'expected_revision':1})
    assert r.status_code == 200
    assert 'BUYER_IMPORTER_MISMATCH' in {x['code'] for x in r.json()['validation']['issues']}
    assert r.json()['checks_clear'] is False
    assert client.post('/shipments/SHP-24812/approve', headers=manager,
        json={'expected_revision':2}).status_code == 409


def test_packing_invoice_reference_mismatch_detected(env):
    client, exe, _ = env
    r = client.patch('/shipments/SHP-24812/documents/packing_list/field', headers=exe,
        json={'field_path':'invoice_number', 'value':'INV-SOME-OTHER',
              'reason':'Testing invoice reference comparison', 'expected_revision':1})
    assert r.status_code == 200
    assert 'INVOICE_REFERENCE_MISMATCH' in {x['code'] for x in r.json()['validation']['issues']}


def test_create_shipment_auth_validation_and_blank_workspace(env):
    client, executive, _ = env
    assert client.post('/shipments', json={'importer_name': 'Synthetic Importer Ltd.'}).status_code == 401
    assert client.post('/shipments', headers=executive, json={'importer_name': '  '}).status_code == 422
    response = client.post('/shipments', headers=executive, json={'importer_name': '  Synthetic   Importer Ltd.  '})
    assert response.status_code == 201, response.text
    shipment = response.json()
    assert shipment['shipment_id'].startswith('SHP-')
    assert shipment['importer_name'] == 'Synthetic Importer Ltd.'
    assert shipment['revision'] == 1
    assert shipment['export_allowed'] is False
    assert shipment['checks_clear'] is False
    assert client.get('/shipments/' + shipment['shipment_id'], headers=executive).status_code == 200
    assert any(item['shipment_id'] == shipment['shipment_id'] for item in client.get('/shipments', headers=executive).json())

# Milestone 6 — unreadable-original fallback and source evidence tests.
def test_manual_entry_requires_original_and_authentication(env):
    client, executive, _ = env
    sid = 'SHP-24811'
    body = {'expected_revision': 1, 'fields': {'gross_weight_kg': 3120},
            'confirmation': 'I checked the source by hand.'}
    url = f'/shipments/{sid}/documents/packing_list/manual'
    assert client.post(url, json=body).status_code == 401
    r = client.post(url, headers=executive, json=body)
    assert r.status_code == 409
    assert 'original source' in r.json()['detail']


def test_manual_source_entry_is_audited_and_old_revision_blocked(env, monkeypatch, tmp_path):
    import fitz
    client, executive, manager = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    sid = 'SHP-24811'
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 75), 'Packing list gross weight 3,165 kg')
    payload = pdf.tobytes()
    pdf.close()
    src = client.post(f'/shipments/{sid}/documents/packing_list/source?expected_revision=1',
                      headers=executive, files={'file': ('skewed.pdf', payload, 'application/pdf')})
    assert src.status_code == 200, src.text
    assert src.json()['revision'] == 2
    assert src.json()['documents']['packing_list']['status'] == 'unreadable'
    assert src.json()['documents']['packing_list']['original_name'] == 'skewed.pdf'
    assert not src.json()['export_allowed']
    fields = {'supplier_name': 'Company B Exports Ltd. (China)', 'invoice_number': 'INV-24811-01',
              'packages': 120, 'gross_weight_kg': 3165}
    body = {'expected_revision': 1, 'fields': fields, 'confirmation': 'Manually checked source and verified all entered values.'}
    assert client.post(f'/shipments/{sid}/documents/packing_list/manual', headers=executive,
                       json=body).status_code == 409
    body['expected_revision'] = 2
    result = client.post(f'/shipments/{sid}/documents/packing_list/manual', headers=executive, json=body)
    assert result.status_code == 200, result.text
    detail = result.json()['documents']['packing_list']
    assert detail['status'] == 'manual_verified'
    assert 'gross_weight_kg' in detail['confirmed_fields']
    assert result.json()['revision'] == 3
    assert result.json()['checks_clear'] is False  # real source disagreement remains blocking
    assert client.post(f'/shipments/{sid}/approve', headers=manager,
                       json={'expected_revision': 3}).status_code == 409
    history = client.get(f'/shipments/{sid}/history', headers=manager).json()
    assert any(entry['action'] == 'manual_source' for entry in history['edits_and_confirmations'])
    assert any(entry['action'] == 'manual_entry' for entry in history['edits_and_confirmations'])


def test_manual_entry_rejects_unexpected_keys_and_bad_values(env, monkeypatch, tmp_path):
    import fitz
    client, executive, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    pdf = fitz.open(); pdf.new_page(); data = pdf.tobytes(); pdf.close()
    source = client.post('/shipments/SHP-24811/documents/invoice/source?expected_revision=1',
                         files={'file': ('source.pdf', data, 'application/pdf')}, headers=executive)
    assert source.status_code == 200, source.text
    url = '/shipments/SHP-24811/documents/invoice/manual'
    for fields in [{'is_admin': 'yes'}, {'invoice_total': True}, {'line_items': [{'admin': 'yes'}]}]:
        res = client.post(url, headers=executive, json={
            'expected_revision': 2, 'fields': fields,
            'confirmation': 'Checked the original printed document manually'})
        assert res.status_code == 422, res.text


def test_searchable_pdf_highlight_on_copy_only(env, monkeypatch, tmp_path):
    import fitz
    client, executive, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    pdf = fitz.open(); page = pdf.new_page(); page.insert_text((72, 72), 'Gross Weight: 3,120 kg')
    payload = pdf.tobytes(); pdf.close()
    from clearport import api as backend_api
    from clearport.ai_extract import ExtractionResult
    original = client.get('/shipments/SHP-24811', headers=executive).json()['documents']['invoice']
    monkeypatch.setattr(backend_api, 'extract_document', lambda *args: ExtractionResult(
        original['extracted'], original['confidence'], 'extracted'))
    attached = client.post('/shipments/SHP-24811/documents/invoice/upload?expected_revision=1',
                           headers=executive, files={'file': ('invoice.pdf', payload, 'application/pdf')})
    assert attached.status_code == 200, attached.text
    # The fixture retains the seeded extracted weight of 3120; search matches the printed 3,120.
    route = '/shipments/SHP-24811/documents/invoice/file'
    highlighted = client.get(route, params={'highlight_field': 'gross_weight_kg'}, headers=executive)
    assert highlighted.status_code == 200
    assert highlighted.headers['x-evidence-found'] == 'true'
    assert highlighted.headers['x-evidence-page'] == '1'
    marked = fitz.open(stream=highlighted.content, filetype='pdf')
    assert len(list(marked[0].annots() or [])) >= 1
    marked.close()
    raw = client.get(route, headers=executive)
    assert raw.content == payload  # original bytes are not modified

# Final M6 acceptance hardening: do not accept malformed human-verification fields.
def test_manual_entry_rejects_invalid_date_and_non_numeric_totals(env, monkeypatch, tmp_path):
    import fitz
    client, executive, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    doc = fitz.open(); doc.new_page(); source_bytes = doc.tobytes(); doc.close()
    sid = 'SHP-24811'
    saved = client.post(f'/shipments/{sid}/documents/invoice/source?expected_revision=1',
                        headers=executive, files={'file': ('original.pdf', source_bytes, 'application/pdf')})
    assert saved.status_code == 200
    url = f'/shipments/{sid}/documents/invoice/manual'
    bad_fields = [
        {'invoice_date': '2026-02-30'},
        {'invoice_date': '25 OCT 2026'},
        {'currency': 'US'},
        {'invoice_total': '16320'},
        {'invoice_total': -1},
        {'packages': 2.5},
        {'gross_weight_kg': -42},
        {'line_items': [{'quantity': 0}]},
        {'line_items': [{'unit_price': '6.8'}]},
    ]
    for fields in bad_fields:
        response = client.post(url, headers=executive, json={
            'expected_revision': 2, 'fields': fields,
            'confirmation': 'Human reviewed the original invoice and verified this field'})
        assert response.status_code == 422, (fields, response.text)
    assert client.get(f'/shipments/{sid}', headers=executive).json()['revision'] == 2


def test_history_returns_attributable_demo_actor_without_credentials(env):
    client, executive, manager = env
    sid = 'SHP-24812'
    approval = client.post(f'/shipments/{sid}/approve', headers=manager,
                           json={'expected_revision': 1, 'comment': 'Fictional review checked'})
    assert approval.status_code == 200
    history = client.get(f'/shipments/{sid}/history', headers=executive)
    assert history.status_code == 200
    body = history.json()
    actor = body['actors'][str(body['approvals'][0]['user_id'])]
    assert actor == {'role': 'manager', 'email': 'manager@clearport.demo'}
    assert 'password_hash' not in history.text
    assert 'DemoManager#2026' not in history.text

# Post-audit M6 correction: authenticated mobile PDF pages do not depend on
# the phone's native PDF iframe zoom implementation.
def test_mobile_pdf_page_raster_auth_pagination_and_original_integrity(env, monkeypatch, tmp_path):
    import fitz
    client, executive, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), 'Invoice page one')
    pdf.new_page().insert_text((72, 72), 'Invoice page two')
    original = pdf.tobytes()
    pdf.close()
    sid = 'SHP-24811'
    attach = client.post(f'/shipments/{sid}/documents/invoice/source?expected_revision=1',
                         headers=executive, files={'file': ('two-pages.pdf', original, 'application/pdf')})
    assert attach.status_code == 200, attach.text
    url = f'/shipments/{sid}/documents/invoice/preview-page'
    assert client.get(url).status_code == 401
    assert client.get(url, params={'page': 0}, headers=executive).status_code == 422
    assert client.get(url, params={'page': 3}, headers=executive).status_code == 404
    first = client.get(url, headers=executive)
    second = client.get(url, params={'page': 2}, headers=executive)
    assert first.status_code == second.status_code == 200
    assert first.headers['content-type'].startswith('image/png')
    assert first.content[:8] == b'\x89PNG\r\n\x1a\n'
    assert first.headers['x-page-count'] == '2'
    assert second.headers['x-page-number'] == '2'
    assert first.content != second.content
    raw = client.get(f'/shipments/{sid}/documents/invoice/file', headers=executive)
    assert raw.content == original
    history = client.get(f'/shipments/{sid}/history', headers=executive).json()
    assert len([item for item in history['edits_and_confirmations'] if item['action'] == 'source_view']) >= 3
    assert client.get(f'/shipments/{sid}', headers=executive).json()['revision'] == 2


def test_mobile_pdf_page_highlighting_finds_real_source_text(env, monkeypatch, tmp_path):
    import fitz
    from clearport import api as backend_api
    from clearport.ai_extract import ExtractionResult
    client, executive, _ = env
    monkeypatch.setenv('UPLOADS_DIR', str(tmp_path))
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), 'Gross Weight: 3,120 kg')
    pdf.new_page().insert_text((72, 72), 'Second page without the weight')
    original = pdf.tobytes();pdf.close()
    detail = client.get('/shipments/SHP-24811', headers=executive).json()['documents']['invoice']
    monkeypatch.setattr(backend_api, 'extract_document', lambda *args: ExtractionResult(
        detail['extracted'], detail['confidence'], 'extracted'))
    upload = client.post('/shipments/SHP-24811/documents/invoice/upload?expected_revision=1',
                         headers=executive, files={'file': ('invoice.pdf', original, 'application/pdf')})
    assert upload.status_code == 200, upload.text
    url = '/shipments/SHP-24811/documents/invoice/preview-page'
    matched = client.get(url, params={'page': 1, 'highlight_field': 'gross_weight_kg'}, headers=executive)
    other = client.get(url, params={'page': 2, 'highlight_field': 'gross_weight_kg'}, headers=executive)
    assert matched.status_code == other.status_code == 200
    assert matched.headers['x-evidence-found'] == 'true'
    assert other.headers['x-evidence-found'] == 'false'
    raw = client.get('/shipments/SHP-24811/documents/invoice/file', headers=executive)
    assert raw.content == original
