-- ============================================================
-- Migration: Societario On-Demand Schema
-- PRD v1.1 — 3 enums + 9 tables
-- ============================================================

-- -------------------------------------------------------
-- 1. Enum types (create only if not exist)
-- -------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_acto') THEN
    CREATE TYPE tipo_acto AS ENUM (
      'CONSTITUCION',
      'NOMBRAMIENTO_ADMIN',
      'CESE_ADMIN',
      'REELECCION',
      'AMPLIACION_CAPITAL',
      'REDUCCION_CAPITAL',
      'CAMBIO_DOMICILIO',
      'CAMBIO_OBJETO',
      'CAMBIO_DENOMINACION',
      'DISOLUCION',
      'LIQUIDACION',
      'FUSION',
      'ESCISION',
      'TRANSFORMACION',
      'PODER_GENERAL',
      'PODER_ESPECIAL',
      'REVOCACION_PODER',
      'DEPOSITO_CUENTAS',
      'NOMBRAMIENTO_AUDITOR',
      'CESE_AUDITOR',
      'EMISION_OBLIGACIONES',
      'SITUACION_CONCURSAL',
      'OTRO'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_code') THEN
    CREATE TYPE cargo_code AS ENUM (
      'ADMIN_UNICO',
      'ADMIN_SOLIDARIO',
      'ADMIN_MANCOMUNADO',
      'CONSEJERO',
      'PRESIDENTE',
      'VICEPRESIDENTE',
      'SECRETARIO',
      'VICESECRETARIO',
      'CONSEJERO_DELEGADO',
      'DIRECTOR_GENERAL',
      'APODERADO',
      'LIQUIDADOR',
      'AUDITOR'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM (
      'pending',
      'running',
      'done',
      'needs_review',
      'failed'
    );
  END IF;
END $$;

-- -------------------------------------------------------
-- 2. sociedades — Resolved company master
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sociedades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denominacion  text NOT NULL,
  nif           text UNIQUE,
  domicilio     text,
  objeto_social text,
  capital_social numeric(18,2),
  moneda        text DEFAULT 'EUR',
  organo_admin  text,
  fecha_constitucion date,
  borme_id_primera text,
  is_active     boolean DEFAULT true,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- -------------------------------------------------------
-- 3. personas — Natural/legal persons
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS personas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  nif             text,
  tipo            text DEFAULT 'natural' CHECK (tipo IN ('natural', 'juridica')),
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- -------------------------------------------------------
-- 4. dd_requests — Idempotent request tracking
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS dd_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_execution_id uuid,
  idempotency_key   text UNIQUE,
  sociedad_input    text NOT NULL,
  nif_hint          text,
  periodo_anios     int DEFAULT 5,
  status            request_status DEFAULT 'pending',
  pipeline_step     text DEFAULT 'created',
  sociedad_id       uuid,
  error_log         text,
  requested_by      text DEFAULT 'system',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- FK guards (same pattern as existing migrations)
DO $$ BEGIN
  IF to_regclass('public.dd_tool_executions') IS NOT NULL THEN
    ALTER TABLE dd_requests
      ADD CONSTRAINT fk_requests_execution
      FOREIGN KEY (tool_execution_id) REFERENCES dd_tool_executions(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE dd_requests
    ADD CONSTRAINT fk_requests_sociedad
    FOREIGN KEY (sociedad_id) REFERENCES sociedades(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5. sociedad_candidates — Fuzzy match candidates
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sociedad_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            uuid NOT NULL REFERENCES dd_requests(id) ON DELETE CASCADE,
  denominacion_candidata text NOT NULL,
  nif_candidato         text,
  similarity_score      numeric(5,4) DEFAULT 0 CHECK (similarity_score >= 0 AND similarity_score <= 1),
  source                text DEFAULT 'borme',
  is_selected           boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sociedad_candidates_request ON sociedad_candidates(request_id);

-- -------------------------------------------------------
-- 6. borme_announcements — Parsed BORME entries
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS borme_announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id     uuid NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  borme_date      date NOT NULL,
  borme_section   text,
  borme_code      text,
  tipo_acto       tipo_acto DEFAULT 'OTRO',
  raw_text        text,
  parsed_data     jsonb DEFAULT '{}'::jsonb,
  source_url      text,
  ingested_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_borme_sociedad_date ON borme_announcements(sociedad_id, borme_date);
CREATE INDEX IF NOT EXISTS idx_borme_tipo_acto ON borme_announcements(tipo_acto);

-- Dedup constraint: same company + date + code = same announcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_borme_dedup
  ON borme_announcements(sociedad_id, borme_date, borme_code)
  WHERE borme_code IS NOT NULL;

-- -------------------------------------------------------
-- 7. governance_roles — Company officers timeline
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance_roles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad_id             uuid NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  persona_id              uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  cargo                   cargo_code NOT NULL,
  fecha_inicio            date,
  fecha_fin               date,
  borme_announcement_id   uuid,
  is_current              boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE governance_roles
    ADD CONSTRAINT fk_governance_borme
    FOREIGN KEY (borme_announcement_id) REFERENCES borme_announcements(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_governance_sociedad_current ON governance_roles(sociedad_id, is_current);

-- -------------------------------------------------------
-- 8. dd_snapshots — Point-in-time company state
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS dd_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid REFERENCES dd_requests(id) ON DELETE CASCADE,
  sociedad_id       uuid NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  snapshot_date     date DEFAULT CURRENT_DATE,
  datos_generales   jsonb DEFAULT '{}'::jsonb,
  administradores   jsonb DEFAULT '[]'::jsonb,
  apoderamientos    jsonb DEFAULT '[]'::jsonb,
  modificaciones    jsonb DEFAULT '[]'::jsonb,
  capital_history   jsonb DEFAULT '[]'::jsonb,
  timeline_eventos  jsonb DEFAULT '[]'::jsonb,
  red_flags         jsonb DEFAULT '[]'::jsonb,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_request ON dd_snapshots(request_id);

-- -------------------------------------------------------
-- 9. dd_reports — Harvey-generated reports
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS dd_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid REFERENCES dd_requests(id) ON DELETE CASCADE,
  snapshot_id       uuid REFERENCES dd_snapshots(id) ON DELETE SET NULL,
  report_type       text DEFAULT 'societario_standard',
  prompt_used       text,
  evidence_pack     jsonb DEFAULT '{}'::jsonb,
  harvey_response   jsonb DEFAULT '{}'::jsonb,
  grounding_score   numeric(5,2) DEFAULT 0 CHECK (grounding_score >= 0 AND grounding_score <= 100),
  grounding_issues  jsonb DEFAULT '[]'::jsonb,
  status            text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'done', 'failed')),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_request ON dd_reports(request_id);

-- -------------------------------------------------------
-- 10. dd_sources_log — Citation audit trail
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS dd_sources_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES dd_reports(id) ON DELETE CASCADE,
  source_type   text DEFAULT 'borme' CHECK (source_type IN ('borme', 'registro', 'manual', 'api')),
  source_url    text,
  fetched_at    timestamptz DEFAULT now(),
  http_status   int,
  response_hash text,
  is_valid      boolean DEFAULT true
);

-- -------------------------------------------------------
-- 11. Enable RLS (permissive, same pattern as existing)
-- -------------------------------------------------------
ALTER TABLE sociedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sociedad_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE borme_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_sources_log ENABLE ROW LEVEL SECURITY;

-- Permissive policies (allow all for now, tighten in production)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'sociedades', 'personas', 'dd_requests', 'sociedad_candidates',
    'borme_announcements', 'governance_roles', 'dd_snapshots',
    'dd_reports', 'dd_sources_log'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "allow_all_%1$s" ON %1$I FOR ALL USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;
