-- S0: Create core DD tables that don't exist yet
-- Prerequisite for RLS migration

-- dd_areas: Legal area definitions
CREATE TABLE IF NOT EXISTS dd_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- dd_processes: Process definitions per area
CREATE TABLE IF NOT EXISTS dd_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  documents_to_prepare TEXT[] DEFAULT '{}'::TEXT[],
  workflow_steps TEXT[] DEFAULT '{}'::TEXT[],
  harvey_prompt TEXT,
  area_id UUID NOT NULL REFERENCES dd_areas(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- dd_project_user_roles: RBAC for projects
CREATE TABLE IF NOT EXISTS dd_project_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('clo', 'pm_transaccion', 'abogado_area', 'deal_sponsor', 'target_liaison', 'stakeholder_negocio', 'cliente_externo')),
  area_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_pur_project ON dd_project_user_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_pur_user ON dd_project_user_roles(user_id);

-- dd_tasks: Task tracking per process
CREATE TABLE IF NOT EXISTS dd_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  process_id UUID REFERENCES dd_processes(id),
  area_id UUID REFERENCES dd_areas(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'blocked', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assigned_to TEXT,
  reviewer TEXT,
  due_date DATE,
  notes TEXT,
  client_visible BOOLEAN DEFAULT false,
  ai_output JSONB,
  ai_status TEXT DEFAULT 'none' CHECK (ai_status IN ('none', 'running', 'completed', 'error')),
  hitl_reviewed_at TIMESTAMPTZ,
  hitl_reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON dd_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_process ON dd_tasks(process_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON dd_tasks(status);

-- dd_contingencies: Risk/contingency tracking
CREATE TABLE IF NOT EXISTS dd_contingencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  area_id UUID REFERENCES dd_areas(id),
  task_id UUID REFERENCES dd_tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  probability TEXT NOT NULL DEFAULT 'possible' CHECK (probability IN ('certain', 'probable', 'possible', 'remote')),
  estimated_amount NUMERIC,
  amount_currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'confirmed', 'mitigated', 'resolved', 'accepted')),
  client_visible BOOLEAN DEFAULT false,
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contingencies_project ON dd_contingencies(project_id);
CREATE INDEX IF NOT EXISTS idx_contingencies_severity ON dd_contingencies(severity);

-- dd_qa: Q&A tracking (legacy, new system uses qa_threads)
CREATE TABLE IF NOT EXISTS dd_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  area_id UUID REFERENCES dd_areas(id),
  question TEXT NOT NULL,
  question_reference TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'answered', 'follow_up', 'closed')),
  client_visible BOOLEAN DEFAULT false,
  answer TEXT,
  sent_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_project ON dd_qa(project_id);

-- dd_deliverables: Deliverable documents
CREATE TABLE IF NOT EXISTS dd_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'report',
  title TEXT NOT NULL,
  content JSONB,
  storage_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'final')),
  client_visible BOOLEAN DEFAULT false,
  generated_by TEXT DEFAULT 'manual' CHECK (generated_by IN ('manual', 'ai_assisted', 'ai_auto')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project ON dd_deliverables(project_id);

-- dd_evidence: Evidence records linked to tasks/contingencies
CREATE TABLE IF NOT EXISTS dd_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES dd_projects(id) ON DELETE SET NULL,
  tool_execution_id UUID REFERENCES dd_tool_executions(id) ON DELETE SET NULL,
  task_id UUID REFERENCES dd_tasks(id) ON DELETE SET NULL,
  contingency_id UUID REFERENCES dd_contingencies(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'document' CHECK (source_type IN ('document', 'registry_scrape', 'api_response', 'manual_entry', 'ai_output')),
  source_reference TEXT NOT NULL,
  source_name TEXT,
  page_range TEXT,
  snippet TEXT,
  snippet_hash TEXT,
  confidence_score NUMERIC,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_project ON dd_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_task ON dd_evidence(task_id);
CREATE INDEX IF NOT EXISTS idx_evidence_execution ON dd_evidence(tool_execution_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source_type ON dd_evidence(source_type);

-- dd_event_log: Application event log
CREATE TABLE IF NOT EXISTS dd_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  project_id UUID REFERENCES dd_projects(id) ON DELETE SET NULL,
  description TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('success', 'warning', 'error', 'info')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_type ON dd_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_project ON dd_event_log(project_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON dd_event_log(created_at);

-- Seed default areas
INSERT INTO dd_areas (code, name, color, icon, sort_order) VALUES
  ('MERC', 'Mercantil / Societario', '#2563eb', 'Building2', 1),
  ('CONT', 'Contratos', '#7c3aed', 'FileText', 2),
  ('LAB', 'Laboral', '#db2777', 'Users', 3),
  ('FISC', 'Fiscal', '#059669', 'Calculator', 4),
  ('PI', 'Propiedad Intelectual', '#d97706', 'Lightbulb', 5),
  ('ADM', 'Administrativo / Regulatorio', '#6366f1', 'Shield', 6),
  ('AMB', 'Medio Ambiente', '#16a34a', 'Leaf', 7),
  ('LIT', 'Litigios', '#dc2626', 'Gavel', 8),
  ('INM', 'Inmobiliario', '#0891b2', 'Home', 9),
  ('GENERAL', 'General / Transversal', '#64748b', 'Briefcase', 0)
ON CONFLICT (code) DO NOTHING;
