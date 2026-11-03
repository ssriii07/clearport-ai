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

def test_full_workflow_low_confidence_fix_approve_export(env):
    client, exe, manager = env
    sid = 'SHP-24811'
    r = client.post(f'/shipments/{sid}/documents/bill_of_lading/confirm', headers=exe,
        json={'field_path':'container_numbers','expected_revision':1})
    assert r.status_code == 200, r.text
    assert r.json()['revision'] == 2
    assert 'LOW_CONFIDENCE' not in {i['code'] for i in r.json()['validation']['issues']}
    r = client.patch(f'/shipments/{sid}/documents/packing_list/field', headers=exe, json={
        'field_path':'gross_weight_kg','value':3120,
        'reason':'Verified original packing list', 'expected_revision':2})
    assert r.status_code == 200, r.text
    assert r.json()['revision'] == 3
    assert r.json()['checks_clear'] is True
    assert r.json()['export_allowed'] is False
    r = client.post(f'/shipments/{sid}/approve', headers=manager, json={'expected_revision':3, 'comment':'Reviewed documents and corrections'})
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
    assert len(hist['edits_and_confirmations']) == 2
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
