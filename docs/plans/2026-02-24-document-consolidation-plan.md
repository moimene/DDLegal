# Document Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the document management system for all 7 DD areas with CA integration, classification patterns, extraction schemas, and expected documents.

**Architecture:** Sequential migrations for database seeds (FOs, skills, workflow, expected docs), followed by code modifications to document-classifier.ts and fact-extractor.ts for pattern and extraction support. Each migration is independently testable.

**Tech Stack:** PostgreSQL/Supabase (migrations), TypeScript (code), Next.js API routes

---

## Task 1: Seed CA Finding Objectives

**Files:**
- Create: `supabase/migrations/202602280024_seed_ca_fos.sql`

**Step 1: Create the migration file**

```sql
-- 202602280024_seed_ca_fos.sql
-- Seed 15 Cuentas Anuales Finding Objectives
-- Source: docs/architecture/CA_CATALOG_SEED.sql

BEGIN;

-- FO-MERC-CA-001: Aprobación y depósito de cuentas
INSERT INTO dd_finding_objectives (
  objective_key, version, title, description, area_code, risk_category,
  deal_types, jurisdictions, materiality_threshold_amount,
  evaluation_criteria, data_required, severity_if_positive, severity_modifiers,
  positive_examples, negative_examples, false_positive_examples,
  regulatory_basis, is_active
) VALUES (
  'FO-MERC-CA-001', '1.0',
  'Aprobación y depósito de cuentas, auditoría y aplicación del resultado',
  'Verificar que las cuentas han sido aprobadas en plazo, depositadas correctamente, que el informe de auditoría (si procede) es adecuado y que la aplicación del resultado respeta restricciones legales y estatutarias',
  'MERC', 'Cumplimiento societario',
  ARRAY['M&A', 'LBO'], ARRAY['ES', 'UE'], NULL,
  '[{"criterion": "Aprobación en tiempo y forma", "weight": 0.30, "eval_type": "document_review"},{"criterion": "Depósito completo y en plazo", "weight": 0.30, "eval_type": "registry_check"},{"criterion": "Tipo de opinión y salvedades/énfasis", "weight": 0.25, "eval_type": "document_review"},{"criterion": "Legalidad del reparto y reservas", "weight": 0.15, "eval_type": "document_verification"}]'::jsonb,
  '[{"doc_type": "Cuentas anuales y memoria", "sample": "all", "extractions": ["fecha_formulacion", "fecha_aprobacion", "cifras_clave"]},{"doc_type": "Informe de auditoría", "sample": "all", "extractions": ["tipo_opinion", "salvedades", "enfasis", "KAM"]},{"doc_type": "Acta y certificado de junta", "sample": "all", "extractions": ["acuerdos", "aplicacion_resultado"]},{"doc_type": "Justificante de depósito RM", "sample": "all", "extractions": ["fecha_deposito", "estado"]}]'::jsonb,
  'high',
  '[{"condition": "Opinión desfavorable/denegada o falta de depósito", "action": "upgrade_to_critical"},{"condition": "Subsanación aceptada por el Registro", "action": "downgrade_to_medium"}]'::jsonb,
  ARRAY['Cuentas aprobadas fuera de plazo, no depositadas y opinión con salvedades significativas'],
  ARRAY['Cuentas depositadas en plazo; opinión limpia; reparto conforme a reservas'],
  ARRAY['Asiento de presentación aún no reflejado en el sistema'],
  'Legislación societaria aplicable; normativa contable; práctica registral', true
);

-- FO-MERC-CA-002 through FO-MERC-CA-014 + FO-MERC-CA-PatNeto-002
-- (Copy remaining 14 FOs from docs/architecture/CA_CATALOG_SEED.sql)

-- NOTE: The full content is in docs/architecture/CA_CATALOG_SEED.sql
-- Copy the complete file content here

COMMIT;
```

**Step 2: Copy full content from CA_CATALOG_SEED.sql**

Run: `cat docs/architecture/CA_CATALOG_SEED.sql > supabase/migrations/202602280024_seed_ca_fos.sql`

**Step 3: Apply migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully, 15 rows inserted

**Step 4: Verify**

Run: `npx supabase db execute "SELECT COUNT(*) FROM dd_finding_objectives WHERE objective_key LIKE 'FO-MERC-CA-%'"`
Expected: count = 15

**Step 5: Commit**

```bash
git add supabase/migrations/202602280024_seed_ca_fos.sql
git commit -m "feat(db): seed 15 Cuentas Anuales Finding Objectives"
```

---

## Task 2: Seed CA Skills

**Files:**
- Create: `supabase/migrations/202602280025_seed_ca_skills.sql`

**Step 1: Create the migration file**

```sql
-- 202602280025_seed_ca_skills.sql
-- Seed 8 Cuentas Anuales skills in dd_skills_catalog

BEGIN;

-- Skill 1: ca.extraccion_cuentas
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.extraccion_cuentas',
  'Extracción de Cuentas Anuales',
  'Extraer datos estructurados de las cuentas anuales (balance, P&L, memoria) y del certificado de depósito en RM',
  'MERC', 'extraccion',
  'Eres un analista legal especializado en cuentas anuales. Extrae de forma exhaustiva los datos del ciclo de formulación, aprobación y depósito. No inventes datos. Cita página y sección. Si hay discrepancias entre acta y depósito, márcalas como discrepancia_detectada.',
  '{"type": "object", "properties": {"ejercicio": {"type": "string"}, "fecha_formulacion": {"type": "string"}, "fecha_aprobacion": {"type": "string"}, "fecha_deposito_rm": {"type": "string"}, "estado_deposito": {"type": "string"}, "patrimonio_neto": {"type": "number"}, "capital_social": {"type": "number"}, "reserva_legal": {"type": "number"}, "resultado_ejercicio": {"type": "number"}, "auditoria": {"type": "object"}, "evidencias": {"type": "array"}}}'::jsonb,
  '["Cuentas anuales completas", "Acta de junta", "Justificante de depósito RM"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 2: ca.analisis_auditoria
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.analisis_auditoria',
  'Análisis de Auditoría',
  'Analizar el informe de auditoría: tipo de opinión, KAM, salvedades, énfasis, going concern',
  'MERC', 'analisis',
  'Analiza el informe de auditoría extrayendo: tipo de opinión, salvedades, párrafos de énfasis, KAMs, y cualquier mención a incertidumbre sobre continuidad del negocio.',
  '{"type": "object", "properties": {"obligacion_auditoria": {"type": "object"}, "auditor": {"type": "object"}, "opinion": {"type": "object"}, "going_concern": {"type": "object"}, "severidad_sugerida": {"type": "string"}}}'::jsonb,
  '["Informe de auditoría", "Nombramiento del auditor", "Cartas de independencia"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 3: ca.patrimonio_neto
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.patrimonio_neto',
  'Diagnóstico de Patrimonio Neto',
  'Diagnosticar la situación del patrimonio neto y evaluar si se activan deberes legales de reequilibrio o disolución',
  'MERC', 'verificacion',
  'Evalúa la situación patrimonial aplicando el mapa de 5 escenarios: holgado, pérdida coyuntural, deterioro incipiente, desequilibrio activo, persistencia sin medidas. Determina si se activa causa de disolución.',
  '{"type": "object", "properties": {"patrimonio_neto": {"type": "number"}, "capital_social": {"type": "number"}, "ratio_pn_cs": {"type": "number"}, "escenario_mapa": {"type": "string"}, "causa_disolucion_activada": {"type": "boolean"}, "medidas_detectadas": {"type": "object"}, "activa_fo_patneto_002": {"type": "boolean"}}}'::jsonb,
  '["Cuentas anuales", "Memoria (sección patrimonio)", "Actas de medidas"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 4: ca.aplicacion_resultado
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.aplicacion_resultado',
  'Legalidad de Aplicación del Resultado',
  'Verificar legalidad de la distribución de resultados y reservas, y cumplimiento de autocartera',
  'MERC', 'analisis',
  'Verifica que la distribución de dividendos y reservas respeta restricciones legales, estatutarias y contractuales. Comprueba dotación de reserva legal y tratamiento de autocartera.',
  '{"type": "object", "properties": {"aplicacion_resultado": {"type": "object"}, "restricciones_reparto": {"type": "object"}, "cumplimiento": {"type": "boolean"}, "autocartera": {"type": "object"}, "trazabilidad_pagos": {"type": "object"}}}'::jsonb,
  '["Acta de aplicación del resultado", "Memoria", "Justificantes de pago de dividendos"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 5: ca.partes_vinculadas
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.partes_vinculadas',
  'Conciliación de Partes Vinculadas',
  'Conciliar operaciones y saldos con partes vinculadas revelados en memoria con contratos y aprobaciones societarias',
  'MERC', 'analisis',
  'Contrasta las operaciones con partes vinculadas reveladas en memoria con los contratos subyacentes. Evalúa si las condiciones son arm''s length y si existen las aprobaciones societarias requeridas.',
  '{"type": "object", "properties": {"partes_vinculadas_identificadas": {"type": "array"}, "conciliacion": {"type": "object"}, "condiciones_mercado": {"type": "object"}, "aprobaciones_societarias": {"type": "object"}}}'::jsonb,
  '["Memoria - sección partes vinculadas", "Contratos con partes vinculadas", "Actas de aprobación"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 6: ca.contingencias_memoria
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.contingencias_memoria',
  'Compromisos, Contingencias y Hechos Posteriores',
  'Identificar compromisos y contingencias fuera de balance, y verificar hechos posteriores al cierre',
  'MERC', 'analisis',
  'Identifica garantías, avales, litigios y compromisos revelados en memoria. Cruza con litigios activos. Evalúa hechos posteriores al cierre con relevancia jurídica.',
  '{"type": "object", "properties": {"contingencias": {"type": "array"}, "total_contingencias": {"type": "number"}, "hechos_posteriores": {"type": "array"}, "cruces_litigios": {"type": "object"}}}'::jsonb,
  '["Memoria - compromisos y contingencias", "Pólizas y contratos de garantía", "Comunicaciones de reclamaciones"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 7: ca.compliance_revelaciones
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.compliance_revelaciones',
  'Compliance de Revelaciones en Memoria',
  'Verificar cumplimiento de obligaciones de revelación: cambios criterios, EINF/ESG, remuneración administradores, préstamos',
  'MERC', 'verificacion',
  'Verifica que la memoria cumple con todas las obligaciones de revelación: cambios de criterios contables, EINF si aplica, remuneración de administradores, préstamos a socios/administradores.',
  '{"type": "object", "properties": {"cambios_criterio": {"type": "array"}, "einf": {"type": "object"}, "remuneracion_administradores": {"type": "object"}, "prestamos_socios_admin": {"type": "object"}, "gaps_revelacion": {"type": "array"}}}'::jsonb,
  '["Memoria - políticas contables", "EINF o informe ESG", "Políticas retributivas", "Actas de junta y consejo"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

-- Skill 8: ca.medidas_reequilibrio
INSERT INTO dd_skills_catalog (
  skill_key, name, description, area_code, category,
  prompt_template, output_schema, evidence_requirements,
  agent_pipeline, is_active
) VALUES (
  'ca.medidas_reequilibrio',
  'Medidas Obligatorias de Reequilibrio',
  'Verificar adopción, ejecución e inscripción de medidas obligatorias ante desequilibrio patrimonial',
  'MERC', 'verificacion',
  'Verifica que, constatado el desequilibrio, el órgano de administración convocó y la junta acordó en plazo legal una medida idónea. Comprueba ejecución material, protección de acreedores e inscripción registral.',
  '{"type": "object", "properties": {"medida_adoptada": {"type": "object"}, "ejecucion": {"type": "object"}, "proteccion_acreedores": {"type": "object"}, "inscripcion_registral": {"type": "object"}, "riesgo_responsabilidad_administradores": {"type": "object"}}}'::jsonb,
  '["Actas de convocatoria y acuerdos", "Escrituras públicas de reducción/aumento", "Justificantes de desembolsos", "Asientos de inscripción en RM"]',
  '{"paranoico": true, "validador": true, "sanitizer": true}'::jsonb,
  true
);

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`
Expected: 8 skills inserted

**Step 3: Verify**

Run: `npx supabase db execute "SELECT COUNT(*) FROM dd_skills_catalog WHERE skill_key LIKE 'ca.%'"`
Expected: count = 8

**Step 4: Commit**

```bash
git add supabase/migrations/202602280025_seed_ca_skills.sql
git commit -m "feat(db): seed 8 Cuentas Anuales skills"
```

---

## Task 3: Seed CA Workflow Template

**Files:**
- Create: `supabase/migrations/202602280026_seed_ca_workflow.sql`

**Step 1: Create the migration file**

```sql
-- 202602280026_seed_ca_workflow.sql
-- Seed cuentas_anuales workflow template with 5 phases

BEGIN;

-- Insert workflow template
INSERT INTO dd_workflow_templates (template_key, name, description, area_codes, category, is_active)
VALUES (
  'cuentas_anuales',
  'Cuentas Anuales',
  'Revisión legal de cuentas anuales: aprobación, depósito, auditoría, patrimonio, distribución, revelaciones y coherencia registral',
  '{MERC}',
  'transactional',
  true
);

-- Insert workflow version with 5 phases
INSERT INTO dd_workflow_template_versions (
  template_id,
  version_number,
  phase_config,
  hitl_policy,
  published_at,
  published_by
)
SELECT
  t.id,
  1,
  '[
    {"phase": "obtencion", "name": "Recopilación documental CA", "duration_hours": 4, "skills": [], "hitl_required": false},
    {"phase": "gestion", "name": "Extracción y normalización", "duration_hours": 6, "skills": ["ca.extraccion_cuentas"], "hitl_required": false},
    {"phase": "analisis", "name": "Evaluación legal CA", "duration_hours": 8, "skills": ["ca.analisis_auditoria", "ca.patrimonio_neto", "ca.aplicacion_resultado", "ca.partes_vinculadas", "ca.contingencias_memoria", "ca.compliance_revelaciones", "ca.medidas_reequilibrio"], "hitl_required": false},
    {"phase": "valoracion", "name": "HITL: Revisión legal de hallazgos CA", "duration_hours": 4, "skills": [], "hitl_required": true},
    {"phase": "tratamiento", "name": "Acciones y sección de informe CA", "duration_hours": 4, "skills": [], "hitl_required": false}
  ]'::jsonb,
  '{"required_areas": ["MERC"], "auto_approve_below_severity": "low", "reviewer_role": "abogado_societario", "escalation_after_hours": 48, "mandatory_hitl_fos": ["FO-MERC-CA-003", "FO-MERC-CA-004", "FO-MERC-CA-005", "FO-MERC-CA-007", "FO-MERC-CA-008", "FO-MERC-CA-PatNeto-002"]}'::jsonb,
  NOW(),
  'system'
FROM dd_workflow_templates t
WHERE t.template_key = 'cuentas_anuales';

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify**

Run: `npx supabase db execute "SELECT template_key, name FROM dd_workflow_templates WHERE template_key = 'cuentas_anuales'"`
Expected: 1 row with cuentas_anuales

**Step 4: Commit**

```bash
git add supabase/migrations/202602280026_seed_ca_workflow.sql
git commit -m "feat(db): seed cuentas_anuales workflow template"
```

---

## Task 4: Seed CA Microtool

**Files:**
- Create: `supabase/migrations/202602280027_seed_ca_tool.sql`

**Step 1: Create the migration file**

```sql
-- 202602280027_seed_ca_tool.sql
-- Seed cuentas-anuales microtool in dd_tools

BEGIN;

INSERT INTO dd_tools (slug, name, description, icon, area_codes, skills_used, requires_project, sort_order, is_active)
VALUES (
  'cuentas-anuales',
  'Revisión Cuentas Anuales',
  'Analiza cuentas anuales completas: aprobación, auditoría, patrimonio neto, distribución de resultados, partes vinculadas, contingencias y coherencia registral. Cubre 15 FOs del catálogo MERC-CA.',
  'FileSpreadsheet',
  '{"MERC"}',
  '{"ca.extraccion_cuentas","ca.analisis_auditoria","ca.patrimonio_neto","ca.aplicacion_resultado","ca.partes_vinculadas","ca.contingencias_memoria","ca.compliance_revelaciones","ca.medidas_reequilibrio"}',
  true,
  5,
  true
);

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify**

Run: `npx supabase db execute "SELECT slug, name FROM dd_tools WHERE slug = 'cuentas-anuales'"`
Expected: 1 row

**Step 4: Commit**

```bash
git add supabase/migrations/202602280027_seed_ca_tool.sql
git commit -m "feat(db): seed cuentas-anuales microtool"
```

---

## Task 5: Update FO-Skill Mapping

**Files:**
- Create: `supabase/migrations/202602280028_update_fo_skill_mapping.sql`

**Step 1: Create the migration file**

```sql
-- 202602280028_update_fo_skill_mapping.sql
-- Link 15 CA FOs to their corresponding skills

BEGIN;

UPDATE dd_finding_objectives SET skill_key = 'ca.extraccion_cuentas'
WHERE objective_key IN ('FO-MERC-CA-001', 'FO-MERC-CA-014');

UPDATE dd_finding_objectives SET skill_key = 'ca.analisis_auditoria'
WHERE objective_key IN ('FO-MERC-CA-002', 'FO-MERC-CA-003');

UPDATE dd_finding_objectives SET skill_key = 'ca.patrimonio_neto'
WHERE objective_key = 'FO-MERC-CA-004';

UPDATE dd_finding_objectives SET skill_key = 'ca.aplicacion_resultado'
WHERE objective_key IN ('FO-MERC-CA-005', 'FO-MERC-CA-006');

UPDATE dd_finding_objectives SET skill_key = 'ca.partes_vinculadas'
WHERE objective_key = 'FO-MERC-CA-007';

UPDATE dd_finding_objectives SET skill_key = 'ca.contingencias_memoria'
WHERE objective_key IN ('FO-MERC-CA-008', 'FO-MERC-CA-009');

UPDATE dd_finding_objectives SET skill_key = 'ca.compliance_revelaciones'
WHERE objective_key IN ('FO-MERC-CA-010', 'FO-MERC-CA-011', 'FO-MERC-CA-012', 'FO-MERC-CA-013');

UPDATE dd_finding_objectives SET skill_key = 'ca.medidas_reequilibrio'
WHERE objective_key = 'FO-MERC-CA-PatNeto-002';

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify**

Run: `npx supabase db execute "SELECT objective_key, skill_key FROM dd_finding_objectives WHERE objective_key LIKE 'FO-MERC-CA-%' AND skill_key IS NOT NULL"`
Expected: 15 rows with skill_key set

**Step 4: Commit**

```bash
git add supabase/migrations/202602280028_update_fo_skill_mapping.sql
git commit -m "feat(db): link CA FOs to skills"
```

---

## Task 6: Seed Expected Documents for LIT and ADM

**Files:**
- Create: `supabase/migrations/202602280029_seed_expected_docs_lit_adm.sql`

**Step 1: Create the migration file**

```sql
-- 202602280029_seed_expected_docs_lit_adm.sql
-- Seed 10 expected documents for LIT (5) and ADM (5) areas

BEGIN;

-- LIT - Litigios (5 documents)
INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, review_depth)
VALUES
  ('LIT', 'procedimientos', 'Relación de procedimientos judiciales pendientes', 'Listado de todos los procedimientos judiciales y arbitrajes activos', true, 'standard'),
  ('LIT', 'provisiones', 'Cuadro de contingencias y provisiones (NIC 37)', 'Cuadro con estimación de probabilidad e impacto de contingencias litigiosas', true, 'standard'),
  ('LIT', 'compliance', 'Informe de compliance / Canal de denuncias', 'Programa de cumplimiento normativo y canal de denuncias', false, 'standard'),
  ('LIT', 'rgpd', 'Documentación RGPD y protección de datos', 'Registro de actividades, contratos de encargado, evaluaciones de impacto', false, 'deep'),
  ('LIT', 'medioambiente', 'Informes de pasivos medioambientales', 'Evaluaciones ambientales, permisos, planes de remediación', false, 'deep');

-- ADM - Administrativo (5 documents)
INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, review_depth)
VALUES
  ('ADM', 'licencias', 'Licencias y autorizaciones administrativas', 'Licencias de actividad, autorizaciones sectoriales, permisos de explotación', true, 'standard'),
  ('ADM', 'urbanismo', 'Documentación urbanística', 'Licencias de obra, certificados de conformidad, cédulas de habitabilidad', true, 'standard'),
  ('ADM', 'subvenciones', 'Expedientes de subvenciones recibidas', 'Resoluciones de concesión, justificaciones, obligaciones pendientes', false, 'deep'),
  ('ADM', 'contratos_publicos', 'Contratos con Administraciones Públicas', 'Contratos de licitación pública, encomiendas de gestión', false, 'deep'),
  ('ADM', 'fdi', 'Documentación FDI screening / merger control', 'Autorizaciones de inversión extranjera, notificaciones de concentración', false, 'deep');

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify**

Run: `npx supabase db execute "SELECT area_code, COUNT(*) FROM dd_expected_documents WHERE area_code IN ('LIT', 'ADM') GROUP BY area_code"`
Expected: LIT=5, ADM=5

**Step 4: Commit**

```bash
git add supabase/migrations/202602280029_seed_expected_docs_lit_adm.sql
git commit -m "feat(db): seed expected documents for LIT and ADM areas"
```

---

## Task 7: Seed Expected Documents for CA

**Files:**
- Create: `supabase/migrations/202602280030_seed_expected_docs_ca.sql`

**Step 1: Create the migration file**

```sql
-- 202602280030_seed_expected_docs_ca.sql
-- Seed 9 expected documents for MERC/CA sub-category

BEGIN;

INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, review_depth)
VALUES
  ('MERC', 'cuentas', 'Cuentas anuales completas (balance, PyG, memoria)', 'Cuentas anuales formuladas de los últimos ejercicios', true, 'standard'),
  ('MERC', 'auditoria', 'Informe de auditoría', 'Informes de auditoría de los ejercicios revisados', true, 'standard'),
  ('MERC', 'actas_ca', 'Actas JGA con aprobación de cuentas', 'Actas de junta general con aprobación de cuentas y aplicación del resultado', true, 'standard'),
  ('MERC', 'registro_ca', 'Notas simples Registro Mercantil', 'Certificación de depósito de cuentas en Registro Mercantil', true, 'standard'),
  ('MERC', 'vinculadas', 'Contratos con partes vinculadas', 'Contratos con socios, administradores y sociedades del grupo', false, 'deep'),
  ('MERC', 'garantias', 'Pólizas y garantías otorgadas', 'Avales, garantías y pólizas de seguro relevantes', false, 'deep'),
  ('MERC', 'escrituras_ca', 'Escrituras públicas relevantes', 'Escrituras de ampliación/reducción de capital, aportaciones', false, 'deep'),
  ('MERC', 'esg', 'EINF / Informe ESG', 'Estado de Información No Financiera o informe ESG si aplica', false, 'deep'),
  ('MERC', 'retributiva', 'Políticas retributivas', 'Política de remuneración de administradores', false, 'deep');

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify**

Run: `npx supabase db execute "SELECT COUNT(*) FROM dd_expected_documents WHERE area_code = 'MERC'"`
Expected: count = 13 (4 original + 9 new)

**Step 4: Commit**

```bash
git add supabase/migrations/202602280030_seed_expected_docs_ca.sql
git commit -m "feat(db): seed expected documents for CA"
```

---

## Task 8: Seed Extra Expected Documents

**Files:**
- Create: `supabase/migrations/202602280031_seed_expected_docs_extras.sql`

**Step 1: Create the migration file**

```sql
-- 202602280031_seed_expected_docs_extras.sql
-- Seed 3 extra expected documents for LAB, FISC, CONT

BEGIN;

INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, review_depth)
VALUES
  ('LAB', 'igualdad', 'Plan de igualdad y protocolo de acoso', 'Plan de igualdad obligatorio y protocolo de prevención del acoso', false, 'deep'),
  ('FISC', 'inspecciones', 'Actas de inspección y recursos', 'Actas de inspección tributaria y recursos pendientes', false, 'deep'),
  ('CONT', 'earn_out', 'Acuerdos de earn-out / escrow', 'Contratos de earn-out, escrow y cuentas de retención', false, 'deep');

COMMIT;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Verify total expected documents**

Run: `npx supabase db execute "SELECT area_code, COUNT(*) FROM dd_expected_documents GROUP BY area_code ORDER BY area_code"`
Expected: MERC=13, CONT=5, FISC=4, LAB=5, PI=2, LIT=5, ADM=5 (Total=39-40)

**Step 4: Commit**

```bash
git add supabase/migrations/202602280031_seed_expected_docs_extras.sql
git commit -m "feat(db): seed extra expected documents for LAB, FISC, CONT"
```

---

## Task 9: Add CA Classification Patterns

**Files:**
- Modify: `src/lib/worker/document-classifier.ts:63-230`

**Step 1: Add CA document types to the DocumentType union**

Find line ~31-46 and update:

```typescript
export type DocumentType =
  | 'contrato_material'
  | 'contrato_menor'
  | 'acta_junta'
  | 'escritura_constitucion'
  | 'certificado_registro'
  | 'informe_fiscal'
  | 'nomina'
  | 'convenio_colectivo'
  | 'patente'
  | 'marca'
  | 'licencia'
  | 'poliza_seguro'
  | 'permiso_administrativo'
  | 'resolucion_judicial'
  // CA types
  | 'cuentas_anuales'
  | 'informe_auditoria'
  | 'certificado_rm'
  | 'einf'
  | 'politica_retributiva'
  // LIT types
  | 'demanda'
  | 'informe_compliance'
  | 'programa_compliance'
  // ADM types
  | 'licencia_actividad'
  | 'subvencion'
  | 'fdi_screening'
  // LAB types
  | 'plan_igualdad'
  | 'ere_erte'
  | 'otro';
```

**Step 2: Add new patterns to CLASSIFICATION_PATTERNS array**

After line ~229 (before the closing bracket of the array), add:

```typescript
  // =========================================================================
  // MERC/CA - Cuentas Anuales (8 patterns)
  // =========================================================================
  {
    patterns: [
      /cuentas?\s*anuales/i,
      /annual\s+accounts/i,
      /estados?\s+financieros?\s+anuales?/i,
    ],
    document_type: 'cuentas_anuales',
    area_codes: ['MERC'],
    confidence: 0.92,
  },
  {
    patterns: [
      /balance\s+(de\s+)?situaci[oó]n/i,
      /balance\s+sheet/i,
    ],
    document_type: 'cuentas_anuales',
    area_codes: ['MERC'],
    confidence: 0.85,
  },
  {
    patterns: [
      /cuenta\s+de\s+p[eé]rdidas\s+y\s+ganancias/i,
      /income\s+statement/i,
      /profit\s+and\s+loss/i,
    ],
    document_type: 'cuentas_anuales',
    area_codes: ['MERC'],
    confidence: 0.88,
  },
  {
    patterns: [
      /memoria\s+(anual|de\s+las?\s+cuentas)/i,
      /notes\s+to\s+(the\s+)?(financial\s+)?statements/i,
    ],
    document_type: 'cuentas_anuales',
    area_codes: ['MERC'],
    confidence: 0.88,
  },
  {
    patterns: [
      /informe\s+(de\s+)?(los?\s+)?auditor[eí]a?/i,
      /audit\s+report/i,
      /auditor['']?s?\s+report/i,
    ],
    document_type: 'informe_auditoria',
    area_codes: ['MERC'],
    confidence: 0.90,
  },
  {
    patterns: [
      /certificad[oa]\s+(de\s+)?dep[oó]sito/i,
      /deposit\s+certificate/i,
      /justificante\s+(de\s+)?dep[oó]sito/i,
    ],
    document_type: 'certificado_rm',
    area_codes: ['MERC'],
    confidence: 0.88,
  },
  {
    patterns: [
      /estado\s+de\s+informaci[oó]n\s+no\s+financiera/i,
      /EINF/i,
      /non[\s-]?financial\s+(information\s+)?statement/i,
    ],
    document_type: 'einf',
    area_codes: ['MERC'],
    confidence: 0.90,
  },
  {
    patterns: [
      /pol[ií]tica\s+(de\s+)?retribuci[oó]n/i,
      /remuneration\s+policy/i,
    ],
    document_type: 'politica_retributiva',
    area_codes: ['MERC'],
    confidence: 0.85,
  },

  // =========================================================================
  // LIT - Litigios (4 patterns)
  // =========================================================================
  {
    patterns: [
      /demanda|querella|denuncia/i,
      /lawsuit|complaint|claim\s+form/i,
    ],
    document_type: 'demanda',
    area_codes: ['LIT'],
    confidence: 0.88,
  },
  {
    patterns: [
      /auto\s+de\s+admisi[oó]n/i,
      /providencia/i,
      /court\s+order/i,
    ],
    document_type: 'resolucion_judicial',
    area_codes: ['LIT'],
    confidence: 0.85,
  },
  {
    patterns: [
      /informe\s+(de\s+)?compliance/i,
      /compliance\s+report/i,
    ],
    document_type: 'informe_compliance',
    area_codes: ['LIT'],
    confidence: 0.88,
  },
  {
    patterns: [
      /programa\s+(de\s+)?cumplimiento/i,
      /compliance\s+program/i,
      /canal\s+(de\s+)?denuncias/i,
    ],
    document_type: 'programa_compliance',
    area_codes: ['LIT'],
    confidence: 0.85,
  },

  // =========================================================================
  // ADM - Administrativo (3 patterns)
  // =========================================================================
  {
    patterns: [
      /licencia\s+(de\s+)?actividad/i,
      /licencia\s+ambiental/i,
      /activity\s+license/i,
    ],
    document_type: 'licencia_actividad',
    area_codes: ['ADM'],
    confidence: 0.88,
  },
  {
    patterns: [
      /subvenci[oó]n/i,
      /ayuda\s+p[uú]blica/i,
      /grant\s+(agreement|resolution)/i,
    ],
    document_type: 'subvencion',
    area_codes: ['ADM'],
    confidence: 0.88,
  },
  {
    patterns: [
      /resoluci[oó]n.*inversi[oó]n\s+extranjera/i,
      /FDI\s+screening/i,
      /foreign\s+(direct\s+)?investment/i,
    ],
    document_type: 'fdi_screening',
    area_codes: ['ADM'],
    confidence: 0.85,
  },

  // =========================================================================
  // LAB - Laboral (2 patterns)
  // =========================================================================
  {
    patterns: [
      /plan\s+(de\s+)?igualdad/i,
      /protocolo\s+(de\s+)?(prevenci[oó]n\s+)?(del?\s+)?acoso/i,
      /equality\s+plan/i,
    ],
    document_type: 'plan_igualdad',
    area_codes: ['LAB'],
    confidence: 0.88,
  },
  {
    patterns: [
      /ERE|ERTE/i,
      /expediente\s+(de\s+)?regulaci[oó]n/i,
      /collective\s+redundancy/i,
    ],
    document_type: 'ere_erte',
    area_codes: ['LAB'],
    confidence: 0.90,
  },
```

**Step 3: Update VALID_DOC_TYPES array**

Find line ~517-522 and update:

```typescript
const VALID_DOC_TYPES: DocumentType[] = [
  'contrato_material', 'contrato_menor', 'acta_junta', 'escritura_constitucion',
  'certificado_registro', 'informe_fiscal', 'nomina', 'convenio_colectivo',
  'patente', 'marca', 'licencia', 'poliza_seguro', 'permiso_administrativo',
  'resolucion_judicial',
  // CA types
  'cuentas_anuales', 'informe_auditoria', 'certificado_rm', 'einf', 'politica_retributiva',
  // LIT types
  'demanda', 'informe_compliance', 'programa_compliance',
  // ADM types
  'licencia_actividad', 'subvencion', 'fdi_screening',
  // LAB types
  'plan_igualdad', 'ere_erte',
  'otro'
];
```

**Step 4: Run linter**

Run: `npm run lint -- --fix src/lib/worker/document-classifier.ts`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/worker/document-classifier.ts
git commit -m "feat(classifier): add 17 new classification patterns for CA, LIT, ADM, LAB"
```

---

## Task 10: Update AI Classification Prompt

**Files:**
- Modify: `src/lib/worker/document-classifier.ts:464-478`

**Step 1: Update CLASSIFICATION_PROMPT**

Replace line ~464-478:

```typescript
const CLASSIFICATION_PROMPT = `Classify this legal document:

Document name: {filename}
Content excerpt:
{content}

Return ONLY a JSON object:
{
  "document_type": "contrato_material|contrato_menor|acta_junta|escritura_constitucion|certificado_registro|informe_fiscal|nomina|convenio_colectivo|patente|marca|licencia|poliza_seguro|permiso_administrativo|resolucion_judicial|cuentas_anuales|informe_auditoria|certificado_rm|einf|politica_retributiva|demanda|informe_compliance|programa_compliance|licencia_actividad|subvencion|fdi_screening|plan_igualdad|ere_erte|otro",
  "document_subtype": "more specific type or null",
  "area_codes": ["MERC"|"CONT"|"FISC"|"LAB"|"PI"|"LIT"|"ADM"],
  "jurisdiction": "ES|UE|UK|US|otro|null",
  "language": "es|en|de|fr|it|pt",
  "confidence": 0.0-1.0
}`;
```

**Step 2: Commit**

```bash
git add src/lib/worker/document-classifier.ts
git commit -m "feat(classifier): update AI prompt with new document types"
```

---

## Task 11: Add CA Extraction Schema

**Files:**
- Modify: `src/lib/worker/fact-extractor.ts`

**Step 1: Add CA extraction interface after line ~75**

```typescript
// ============================================================================
// Area-Specific Extraction Interfaces
// ============================================================================

export interface AnnualAccountsFacts {
  ejercicio: string;
  fecha_formulacion: string | null;
  fecha_aprobacion: string | null;
  fecha_deposito: string | null;
  estado_deposito: 'depositado' | 'pendiente' | 'defectuoso' | 'no_depositado';
  patrimonio_neto: number | null;
  capital_social: number | null;
  reserva_legal: number | null;
  reservas_indisponibles: number | null;
  resultado_ejercicio: number | null;
  audit: {
    existe: boolean;
    tipo_opinion: 'favorable' | 'salvedades' | 'desfavorable' | 'denegada' | null;
    going_concern: boolean;
    KAM_count: number;
    enfasis_count: number;
  };
  distribution: {
    dividendos_aprobados: number | null;
    dividendos_a_cuenta: number | null;
    aplicacion_resultado: Record<string, number>;
  };
  related_parties: {
    operaciones_vinculadas: Array<{ parte: string; importe: number; tipo: string }>;
    saldos_vinculadas: number | null;
  };
  contingencies: {
    garantias_otorgadas: number | null;
    litigios_revelados: string[];
    compromisos_fuera_balance: number | null;
  };
  treasury_shares: {
    existencia: boolean;
    importe: number | null;
  };
}

export interface LitigationFacts {
  procedimientos: Array<{
    juzgado: string;
    numero_autos: string;
    tipo: string;
    demandante: string;
    demandado: string;
    cuantia: number | null;
    estado_procesal: string;
  }>;
  provision_NIC37: {
    probable: boolean;
    importe_estimado: number | null;
  };
  compliance: {
    programa_existe: boolean;
    canal_denuncias: boolean;
    ultima_revision: string | null;
  };
}

export interface AdministrativeFacts {
  licencias: Array<{
    tipo: string;
    autoridad: string;
    numero: string;
    fecha_concesion: string | null;
    fecha_vencimiento: string | null;
  }>;
  subvenciones: Array<{
    organismo: string;
    importe: number;
    estado: string;
    obligaciones_pendientes: string[];
  }>;
  contratos_publicos: Array<{
    licitador: string;
    importe: number;
    plazo: string;
  }>;
}

// Extend DocumentFacts with optional area-specific fields
export interface ExtendedDocumentFacts extends DocumentFacts {
  annual_accounts?: AnnualAccountsFacts;
  litigation?: LitigationFacts;
  administrative?: AdministrativeFacts;
}
```

**Step 2: Create conditional extraction prompts after EXTRACTION_PROMPT**

After line ~158, add:

```typescript
// ============================================================================
// Area-Specific Extraction Prompt Extensions
// ============================================================================

const CA_EXTRACTION_EXTENSION = `

7. ANNUAL ACCOUNTS (if document is cuentas_anuales or informe_auditoria)
   Extract:
   - ejercicio, fecha_formulacion, fecha_aprobacion, fecha_deposito, estado_deposito
   - patrimonio_neto, capital_social, reserva_legal, reservas_indisponibles, resultado_ejercicio
   - audit: { existe, tipo_opinion, going_concern, KAM_count, enfasis_count }
   - distribution: { dividendos_aprobados, dividendos_a_cuenta, aplicacion_resultado }
   - related_parties: { operaciones_vinculadas[], saldos_vinculadas }
   - contingencies: { garantias_otorgadas, litigios_revelados[], compromisos_fuera_balance }
   - treasury_shares: { existencia, importe }

   Add to response: "annual_accounts": { ... }
`;

const LIT_EXTRACTION_EXTENSION = `

8. LITIGATION (if area_codes includes LIT)
   Extract:
   - procedimientos: [{ juzgado, numero_autos, tipo, demandante, demandado, cuantia, estado_procesal }]
   - provision_NIC37: { probable, importe_estimado }
   - compliance: { programa_existe, canal_denuncias, ultima_revision }

   Add to response: "litigation": { ... }
`;

const ADM_EXTRACTION_EXTENSION = `

9. ADMINISTRATIVE (if area_codes includes ADM)
   Extract:
   - licencias: [{ tipo, autoridad, numero, fecha_concesion, fecha_vencimiento }]
   - subvenciones: [{ organismo, importe, estado, obligaciones_pendientes }]
   - contratos_publicos: [{ licitador, importe, plazo }]

   Add to response: "administrative": { ... }
`;

function getAreaExtensions(areaCodes: string[], docType: string): string {
  const extensions: string[] = [];

  // CA extraction for annual accounts documents
  const caDocTypes = ['cuentas_anuales', 'informe_auditoria', 'certificado_rm', 'einf'];
  if (areaCodes.includes('MERC') && caDocTypes.includes(docType)) {
    extensions.push(CA_EXTRACTION_EXTENSION);
  }

  // LIT extraction
  if (areaCodes.includes('LIT')) {
    extensions.push(LIT_EXTRACTION_EXTENSION);
  }

  // ADM extraction
  if (areaCodes.includes('ADM')) {
    extensions.push(ADM_EXTRACTION_EXTENSION);
  }

  return extensions.join('\n');
}
```

**Step 3: Commit**

```bash
git add src/lib/worker/fact-extractor.ts
git commit -m "feat(extractor): add CA, LIT, ADM extraction schemas"
```

---

## Task 12: Integrate Area Extensions in Extraction

**Files:**
- Modify: `src/lib/worker/fact-extractor.ts:245-250`

**Step 1: Update prompt building logic**

Find line ~245-250 and modify:

```typescript
  // 4. Build extraction prompt with area-specific extensions
  const basePrompt = EXTRACTION_PROMPT
    .replace('{filename}', doc.name)
    .replace('{document_id}', documentId)
    .replace('{page_count}', String(chunks?.length || 0))
    .replace('{chunks_text}', chunksText.slice(0, 50000));

  // Add area-specific extraction extensions based on document classification
  const detectedAreas = doc.area_code ? [doc.area_code] : [];
  const docType = doc.category || 'otro';
  const areaExtensions = getAreaExtensions(detectedAreas, docType);
  const prompt = basePrompt + areaExtensions;
```

**Step 2: Commit**

```bash
git add src/lib/worker/fact-extractor.ts
git commit -m "feat(extractor): integrate area-specific extraction extensions"
```

---

## Task 13: Reorganize Documentation

**Files:**
- Create: `docs/migrations/` directory
- Move: `docs/architecture/CA_CATALOG_SEED.sql` → `docs/migrations/`

**Step 1: Create migrations directory**

```bash
mkdir -p docs/migrations
```

**Step 2: Move CA_CATALOG_SEED.sql**

```bash
mv docs/architecture/CA_CATALOG_SEED.sql docs/migrations/
```

**Step 3: Update cross-references in CA_INTEGRATION_REQUIREMENT.md**

Edit `docs/architecture/CA_INTEGRATION_REQUIREMENT.md` line 16:

```markdown
**Seed file:** `docs/migrations/CA_CATALOG_SEED.sql`
```

**Step 4: Commit**

```bash
git add docs/migrations/ docs/architecture/
git commit -m "docs: reorganize SQL seeds to docs/migrations/"
```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update FO counts**

Find the line with "Finding Objectives (FOs)" and update:

```markdown
| Finding Objectives (FOs) | 69 (54 base + 15 CA) |
```

**Step 2: Update skills count**

```markdown
| Skills en catálogo | 36 (28 FMC + 8 CA) |
```

**Step 3: Update workflow templates count**

```markdown
| Workflow templates | 7 (6 MVP + 1 CA) |
```

**Step 4: Add CA workflow to table**

Add to the workflow templates table:

```markdown
| `cuentas_anuales` | MERC(CA) | 5 fases: obtención → análisis → HITL | Sí |
```

**Step 5: Update expected documents info**

Add after the relevant section:

```markdown
### Expected Documents per Area

| Area | Count | Mandatory |
|------|-------|-----------|
| MERC | 13 | 8 |
| CONT | 5 | 4 |
| FISC | 4 | 3 |
| LAB | 5 | 4 |
| PI | 2 | 2 |
| LIT | 5 | 2 |
| ADM | 5 | 2 |
| **Total** | **39** | **25** |
```

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with consolidated document system totals"
```

---

## Task 15: Final Verification

**Step 1: Run E2E tests**

```bash
npx playwright test e2e/00-setup.spec.ts
```
Expected: All tests pass

**Step 2: Run build**

```bash
npm run build
```
Expected: Build successful, no TypeScript errors

**Step 3: Verify database counts**

```bash
npx supabase db execute "SELECT 'FOs' as entity, COUNT(*) as count FROM dd_finding_objectives WHERE is_active = true UNION ALL SELECT 'Skills', COUNT(*) FROM dd_skills_catalog WHERE is_active = true UNION ALL SELECT 'Expected Docs', COUNT(*) FROM dd_expected_documents UNION ALL SELECT 'Workflows', COUNT(*) FROM dd_workflow_templates WHERE is_active = true"
```

Expected:
- FOs: 69
- Skills: 36
- Expected Docs: ~39
- Workflows: 7

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: document consolidation complete - 7 areas operational"
```

**Step 5: Push to remote**

```bash
git push origin main
```

---

## Summary

| Task | Description | Migrations/Files |
|------|-------------|------------------|
| 1 | Seed CA FOs | `202602280024_seed_ca_fos.sql` |
| 2 | Seed CA Skills | `202602280025_seed_ca_skills.sql` |
| 3 | Seed CA Workflow | `202602280026_seed_ca_workflow.sql` |
| 4 | Seed CA Tool | `202602280027_seed_ca_tool.sql` |
| 5 | FO-Skill Mapping | `202602280028_update_fo_skill_mapping.sql` |
| 6 | LIT/ADM Docs | `202602280029_seed_expected_docs_lit_adm.sql` |
| 7 | CA Docs | `202602280030_seed_expected_docs_ca.sql` |
| 8 | Extra Docs | `202602280031_seed_expected_docs_extras.sql` |
| 9-10 | Classification Patterns | `document-classifier.ts` |
| 11-12 | Extraction Schemas | `fact-extractor.ts` |
| 13 | Docs Reorganization | `docs/migrations/` |
| 14 | CLAUDE.md Update | `CLAUDE.md` |
| 15 | Final Verification | Tests + Build |

**Total:** 8 migrations, 2 code files modified, documentation updated
