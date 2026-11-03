"""Idempotent local seed: `python3 -m clearport.seed_db`.

Creates a fresh random local secret, if needed. Never prints or commits it.
"""
import json
import os
import secrets
from pathlib import Path
from sqlalchemy import select

from .auth import password_hash
from .database import Base, Document, ENV_FILE, FieldAudit, ManagerApproval, Shipment, User, engine, SessionLocal

SEED_FILE = Path(__file__).resolve().parent.parent / 'seed' / 'shipments.json'
DEMO_USERS = (
    ('executive@clearport.demo', 'DemoExec#2026', 'executive'),
    ('manager@clearport.demo', 'DemoManager#2026', 'manager'),
)

def ensure_secret():
    if not ENV_FILE.exists() and not os.getenv('CLEARPORT_JWT_SECRET'):
        ENV_FILE.write_text(f'CLEARPORT_JWT_SECRET={secrets.token_urlsafe(48)}\n', encoding='utf-8')
        try:
            os.chmod(ENV_FILE, 0o600)
        except OSError:
            pass

def seed(session):
    for email, pw, role in DEMO_USERS:
        if session.scalar(select(User).where(User.email == email)) is None:
            session.add(User(email=email, password_hash=password_hash(pw), role=role))
    session.flush()
    for entry in json.loads(SEED_FILE.read_text(encoding='utf-8')):
        if session.get(Shipment, entry['shipment_id']) is not None:
            continue
        shipment = Shipment(id=entry['shipment_id'], importer_name=entry['importer_name'], revision=1, status='needs_review')
        session.add(shipment)
        for kind, doc in entry['documents'].items():
            session.add(Document(shipment=shipment, kind=kind, status=doc['status'], extracted=doc['extracted'], confidence=doc['confidence'], confirmed_fields=[]))
    session.commit()

def main():
    ensure_secret()
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed(session)
    print('Demo database ready. Data is fictional. No API key needed.')
    print('Executive: executive@clearport.demo / DemoExec#2026')
    print('Manager: manager@clearport.demo / DemoManager#2026')

if __name__ == '__main__':
    main()
