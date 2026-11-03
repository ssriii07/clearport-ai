-- PostgreSQL schema blueprint for milestone 02. NOT yet wired to a running app.
-- Requires a maintained PostgreSQL installation. Only synthetic data in public demos.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- NEVER store plaintext
  role TEXT NOT NULL CHECK (role IN ('executive', 'manager')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_users_email_lower ON app_users (lower(email));

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  importer_name TEXT NOT NULL,
  supplier_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
      'draft', 'processing', 'needs_review', 'awaiting_approval', 'approved', 'exported'
  )),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invoice', 'packing_list', 'bill_of_lading')),
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  storage_key TEXT NOT NULL, -- path/key, NOT public URL or raw document bytes
  sha256 TEXT NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN (
      'pending', 'processing', 'extracted', 'unreadable', 'failed'
  )),
  ai_model TEXT,
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, kind)
);

CREATE TABLE validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  shipment_revision INTEGER NOT NULL,
  code TEXT NOT NULL,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES app_users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE field_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES app_users(id),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manager_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  approved_revision INTEGER NOT NULL,
  approved_by UUID NOT NULL REFERENCES app_users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment TEXT,
  UNIQUE(shipment_id, approved_revision)
);

CREATE TABLE export_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  exported_revision INTEGER NOT NULL,
  exported_by UUID NOT NULL REFERENCES app_users(id),
  export_sha256 TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_by_shipment ON documents(shipment_id);
CREATE INDEX issues_by_shipment_status ON validation_issues(shipment_id, status);
CREATE INDEX edits_by_document_time ON field_edits(document_id, edited_at DESC);
-- API must revalidate under a transaction, ensure all 3 documents, all
-- blocking issues resolved, and an approval for shipments.revision before export.
-- Editing any confirmed field increments shipments.revision (invalidates prior approval).
