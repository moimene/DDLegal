-- Migration: Seed extra expected documents
-- Task 8 of 15: Extra expected documents for LAB, FISC, CONT
-- Adds 3 documents identified in gap analysis

BEGIN;

INSERT INTO dd_expected_documents (area_code, category, name, description, is_mandatory, sort_order)
VALUES
  ('LAB', 'igualdad', 'Plan de igualdad y protocolo de acoso', 'Plan de igualdad obligatorio y protocolo de prevencion del acoso', false, 10),
  ('FISC', 'inspecciones', 'Actas de inspeccion y recursos', 'Actas de inspeccion tributaria y recursos pendientes', false, 10),
  ('CONT', 'earn_out', 'Acuerdos de earn-out / escrow', 'Contratos de earn-out, escrow y cuentas de retencion', false, 10);

COMMIT;
