"""Actual database model. SQLite for local demos; PostgreSQL supported by DATABASE_URL.

The project's original `sql/schema.sql` is an earlier PostgreSQL blueprint,
not the migration mechanism. SQLAlchemy models here are authoritative.
"""
import os
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
ENV_FILE = PROJECT_DIR / '.env'
load_dotenv(ENV_FILE)
DEFAULT_DATABASE = f"sqlite:///{BACKEND_DIR / 'clearport_dev.sqlite3'}"
DATABASE_URL = os.environ.get('DATABASE_URL', DEFAULT_DATABASE)

class Base(DeclarativeBase):
    pass

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Shipment(Base):
    __tablename__ = 'shipments'
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    importer_name: Mapped[str] = mapped_column(String(250))
    status: Mapped[str] = mapped_column(String(32), default='needs_review')
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    documents: Mapped[list['Document']] = relationship(back_populates='shipment', cascade='all, delete-orphan')

class Document(Base):
    __tablename__ = 'documents'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey('shipments.id'), index=True)
    kind: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(24))
    extracted: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    confirmed_fields: Mapped[list] = mapped_column(JSON, default=list)
    shipment: Mapped[Shipment] = relationship(back_populates='documents')

class StoredDocument(Base):
    """Metadata for private source files; binary bytes are never stored in Git."""
    __tablename__ = 'stored_documents'
    __table_args__ = (UniqueConstraint('shipment_id', 'kind', name='uq_stored_document'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey('shipments.id'), index=True)
    kind: Mapped[str] = mapped_column(String(24))
    stored_name: Mapped[str] = mapped_column(String(80))
    original_name: Mapped[str] = mapped_column(String(150))
    mime_type: Mapped[str] = mapped_column(String(40))
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class FieldAudit(Base):
    __tablename__ = 'field_audits'
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey('shipments.id'), index=True)
    document_kind: Mapped[str] = mapped_column(String(24))
    field_path: Mapped[str] = mapped_column(String(140))
    action: Mapped[str] = mapped_column(String(24))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(String(500))
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class ManagerApproval(Base):
    __tablename__ = 'approvals'
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey('shipments.id'), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    comment: Mapped[str] = mapped_column(String(500), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class ExportEvent(Base):
    __tablename__ = 'export_events'
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey('shipments.id'))
    revision: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

def make_engine(url: str):
    options = {'connect_args': {'check_same_thread': False}} if url.startswith('sqlite') else {}
    return create_engine(url, **options)

engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

def get_db():
    with SessionLocal() as session:
        yield session
