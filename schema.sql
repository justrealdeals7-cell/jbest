-- Membership Card App — Neon Postgres schema
-- RUN THIS FIRST, directly in the Neon SQL editor (or `psql "$DATABASE_URL" -f schema.sql`)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ── Members ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no          TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  title           TEXT,
  gender          TEXT,
  photo_url       TEXT,
  phone           TEXT,
  email           TEXT,
  occupation      TEXT,
  origin_state    TEXT,
  origin_lga      TEXT,
  residence_state TEXT,
  residence_lga   TEXT,
  reg_state       TEXT,
  reg_lga         TEXT,
  ward            TEXT,
  polling_unit    TEXT,
  polling_unit_name TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','revoked','suspended','expired')),
  captured_via    TEXT DEFAULT 'self-registration',
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_reg_no ON members (reg_no);
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);
CREATE INDEX IF NOT EXISTS idx_members_reg_state_lga ON members (reg_state, reg_lga);

-- ── Admin users ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('super_admin','admin','agent')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_member ON member_audit_log (member_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
