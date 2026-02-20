-- Skill quality gates: domain enumerations, confidence levels, HITL requirements
-- Recommended by legal team review (Feb 2026)

-- 1. Add quality columns to dd_skills_catalog
ALTER TABLE dd_skills_catalog
  ADD COLUMN IF NOT EXISTS confidence_output_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS evidence_minimum_count int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS domain_enums jsonb DEFAULT '{}';

-- 2. Canonical domain enumerations (reference table)
CREATE TABLE IF NOT EXISTS public.dd_domain_enums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  enum_name text NOT NULL,
  enum_values jsonb NOT NULL,
  description text,
  version int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dd_domain_enums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_domain_enums_all" ON dd_domain_enums FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed closed enumerations per legal domain
INSERT INTO dd_domain_enums (domain, enum_name, enum_values, description) VALUES
-- Contratos
('CONT', 'tipo_contrato', '["suministro","distribucion","servicios","arrendamiento","franquicia","agencia","obra","prestamo","credito","leasing","renting","prestamo_participativo","poliza_seguro","intragrupo","otros"]', 'Tipos de contrato mercantil'),
('CONT', 'tipo_garantia', '["prenda","hipoteca","fianza","aval","garantia_demanda","deposito","otros"]', 'Tipos de garantía real/personal'),
('CONT', 'tipo_clausula_limitacion', '["cap_agregado","cap_por_reclamacion","basket_deductible","basket_tipping","time_limit","exclusion","otros"]', 'Tipos de cláusula de limitación de responsabilidad'),
('CONT', 'efecto_coc', '["terminacion","consentimiento_previo","notificacion","sin_efecto","opcion_compra","aceleracion"]', 'Efectos de change of control'),
-- Laboral
('LAB', 'categoria_personal', '["directivo","mando_intermedio","tecnico","administrativo","operario","temporal","externo"]', 'Categorías de personal'),
('LAB', 'tipo_incentivo', '["stock_options","phantom_shares","bonus","variable","pension","seguro_vida","vehiculo","otros"]', 'Tipos de plan de incentivos'),
-- Fiscal
('FISC', 'tipo_impuesto', '["IS","IVA","IRPF_retenciones","IAE","ITP_AJD","aduanas","otros"]', 'Tipos impositivos principales'),
('FISC', 'estado_ejercicio', '["declarado","inspeccionado","prescrito","recurrido","abierto"]', 'Estado por ejercicio fiscal'),
-- Inmobiliario
('INM', 'tipo_carga', '["hipoteca","embargo","anotacion_preventiva","servidumbre","usufructo","condicion_resolutoria","arrendamiento_inscrito","otros"]', 'Tipos de cargas registrales'),
('INM', 'tipo_arrendamiento', '["oficinas","industrial","local_comercial","vivienda","terreno","parking","otros"]', 'Tipos de arrendamiento inmobiliario'),
-- PI
('PI', 'estado_marca', '["solicitada","publicada","registrada","renovada","expirada","denegada","opuesta","retirada","anulada","en_litigio"]', 'Estados de registro de marca'),
-- Litigios
('LIT', 'fase_procesal', '["demanda","contestacion","prueba","conclusiones","sentencia_primera","apelacion","casacion","ejecucion","archivo"]', 'Fases procesales'),
('LIT', 'tipo_organo', '["juzgado_primera_instancia","audiencia_provincial","tribunal_superior","tribunal_supremo","arbitraje","mediacion"]', 'Tipos de órgano judicial'),
-- Transversal
('GENERAL', 'severidad_contingencia', '["critical","high","medium","low","informativo"]', 'Severidad de contingencia (con informativo del informe legal)'),
('GENERAL', 'probabilidad_contingencia', '["certain","probable","possible","remote","not_verifiable"]', 'Probabilidad incluyendo no comprobable')
ON CONFLICT DO NOTHING;

-- 4. Mark CONT, LAB, FISC, LIT skills as HITL-required (legal team recommendation)
UPDATE dd_skills_catalog SET hitl_required = true WHERE area_code IN ('CONT', 'LAB', 'FISC', 'LIT');
