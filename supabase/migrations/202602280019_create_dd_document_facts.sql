-- F.1.1: Create dd_document_facts table
-- Worker Architecture v1.0 - Document Facts Pipeline
-- Stores structured facts extracted from VDR documents via AI/rules

-- ==================================================================
-- Helper function for updated_at trigger (if not exists)
-- ==================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================================================================
-- Table: dd_document_facts
-- Structured fact extraction from VDR documents
-- ==================================================================
CREATE TABLE dd_document_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,

  -- Clasificación automática
  document_type VARCHAR(50),           -- contrato_material, acta_junta, escritura...
  document_subtype VARCHAR(50),        -- suministro, servicios, laboral...
  area_codes TEXT[] DEFAULT '{}',      -- ["CONT", "LAB"]
  jurisdiction VARCHAR(10),            -- ES, UE, UK, US
  language VARCHAR(5) DEFAULT 'es',

  -- Entidades extraídas
  parties JSONB DEFAULT '[]',
  -- [{ name, role, normalized_id, is_target, is_counterparty }]

  -- Fechas clave
  effective_date DATE,
  expiration_date DATE,
  signing_date DATE,
  key_dates JSONB DEFAULT '[]',
  -- [{ type, date, description }]

  -- Importes
  amounts JSONB DEFAULT '[]',
  -- [{ type, amount, currency, description, annualized }]
  total_value NUMERIC,
  total_value_currency VARCHAR(3) DEFAULT 'EUR',

  -- Cláusulas identificadas
  clauses JSONB DEFAULT '[]',
  -- [{ clause_type, present, page, excerpt, confidence }]
  -- clause_type: coc, non_compete, indemnity, warranty, termination, ip_assignment...

  -- Obligaciones y restricciones
  obligations JSONB DEFAULT '[]',
  -- [{ type, description, party, deadline, consequence }]

  -- Metadatos de extracción
  extraction_method VARCHAR(30),        -- ai_harvey, rule_based, manual, hybrid
  extraction_confidence NUMERIC(3,2),
  extraction_model VARCHAR(50),         -- modelo Harvey usado
  extracted_at TIMESTAMPTZ DEFAULT now(),
  source_content_hash VARCHAR(64),      -- cache key (SHA-256 del documento)

  -- Versionado
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES dd_document_facts(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_confidence CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  CONSTRAINT uq_doc_project UNIQUE (document_id, project_id),
  CONSTRAINT chk_extraction_method CHECK (
    extraction_method IS NULL OR
    extraction_method IN ('ai_harvey', 'rule_based', 'manual', 'hybrid')
  ),
  CONSTRAINT chk_document_type CHECK (
    document_type IS NULL OR
    document_type IN (
      'contrato_material', 'contrato_menor', 'acta_junta', 'escritura_constitucion',
      'certificado_registro', 'informe_fiscal', 'nomina', 'convenio_colectivo',
      'patente', 'marca', 'licencia', 'poliza_seguro', 'permiso_administrativo',
      'resolucion_judicial', 'otro'
    )
  )
);

-- ==================================================================
-- Indexes for query performance
-- ==================================================================
CREATE INDEX idx_df_project ON dd_document_facts(project_id);
CREATE INDEX idx_df_document ON dd_document_facts(document_id);
CREATE INDEX idx_df_type ON dd_document_facts(document_type);
CREATE INDEX idx_df_area ON dd_document_facts USING GIN(area_codes);
CREATE INDEX idx_df_clauses ON dd_document_facts USING GIN(clauses);
CREATE INDEX idx_df_hash ON dd_document_facts(source_content_hash);
CREATE INDEX idx_df_extracted_at ON dd_document_facts(extracted_at);

-- ==================================================================
-- Enable RLS
-- ==================================================================
ALTER TABLE dd_document_facts ENABLE ROW LEVEL SECURITY;

-- Policy: Users with project access can view document facts
CREATE POLICY dd_document_facts_select_policy ON dd_document_facts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_document_facts.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
    )
  );

-- Policy: PM, CLO, Abogados can insert document facts
CREATE POLICY dd_document_facts_insert_policy ON dd_document_facts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_document_facts.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm', 'abogado')
    )
  );

-- Policy: PM, CLO can update document facts
CREATE POLICY dd_document_facts_update_policy ON dd_document_facts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_document_facts.project_id
        AND pur.user_id = auth.uid()
        AND pur.is_active = true
        AND pur.role IN ('clo', 'pm')
    )
  );

-- Policy: Service role can do everything (for worker operations)
CREATE POLICY dd_document_facts_service_role ON dd_document_facts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ==================================================================
-- Updated_at trigger
-- ==================================================================
CREATE TRIGGER set_dd_document_facts_updated_at
  BEFORE UPDATE ON dd_document_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==================================================================
-- Comments for documentation
-- ==================================================================
COMMENT ON TABLE dd_document_facts IS 'Structured facts extracted from VDR documents via AI/rules - Worker Architecture v1.0';
COMMENT ON COLUMN dd_document_facts.document_type IS 'Document classification: contrato_material, acta_junta, escritura_constitucion, etc.';
COMMENT ON COLUMN dd_document_facts.area_codes IS 'Legal areas this document applies to: MERC, CONT, LAB, FISC, PI, LIT, ADM';
COMMENT ON COLUMN dd_document_facts.parties IS 'Extracted parties: [{ name, role, normalized_id, is_target, is_counterparty }]';
COMMENT ON COLUMN dd_document_facts.clauses IS 'Identified clauses: [{ clause_type, present, page, excerpt, confidence }]';
COMMENT ON COLUMN dd_document_facts.extraction_method IS 'How facts were extracted: ai_harvey, rule_based, manual, hybrid';
COMMENT ON COLUMN dd_document_facts.source_content_hash IS 'SHA-256 of source document for cache invalidation';
