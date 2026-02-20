-- ============================================================
-- Migration: Seed Societario Enhanced Config
-- Updates the societario tool record with pipeline schemas
-- ============================================================

-- Update societario tool with enhanced input/output schemas
UPDATE dd_tools SET
  description = 'Pipeline completo de Due Diligence Societaria: BORME indexing, resolución de identidad, snapshot, informe Harvey con Evidence Pack v1.1 y validación de grounding.',
  input_schema = '{
    "type": "object",
    "required": ["sociedad_target"],
    "properties": {
      "sociedad_target": {
        "type": "string",
        "description": "Denominación social completa de la sociedad target"
      },
      "nif_hint": {
        "type": "string",
        "description": "NIF/CIF opcional para resolución exacta"
      },
      "periodo_anios": {
        "type": "integer",
        "default": 5,
        "enum": [3, 5, 10],
        "description": "Período de análisis en años"
      },
      "project_id": {
        "type": "string",
        "format": "uuid",
        "description": "UUID del proyecto DD para vincular"
      }
    }
  }'::jsonb,
  output_schema = '{
    "type": "object",
    "properties": {
      "request_id": { "type": "string", "format": "uuid" },
      "sociedad_id": { "type": "string", "format": "uuid" },
      "snapshot": {
        "type": "object",
        "properties": {
          "datos_generales": { "type": "object" },
          "administradores": { "type": "array" },
          "apoderamientos": { "type": "array" },
          "modificaciones": { "type": "array" },
          "capital_history": { "type": "array" },
          "timeline_eventos": { "type": "array" },
          "red_flags": { "type": "array" }
        }
      },
      "report": {
        "type": "object",
        "properties": {
          "status": { "type": "string" },
          "grounding_score": { "type": "number" },
          "harvey_response": { "type": "object" }
        }
      }
    }
  }'::jsonb,
  skills_used = ARRAY[
    'societario.consulta_borme',
    'societario.analisis_organos'
  ]
WHERE slug = 'societario';

-- Update skills with Evidence Pack v1.1 references
UPDATE dd_skills_catalog SET
  prompt_template = 'Eres un abogado especialista en derecho mercantil/societario español. Realiza una consulta exhaustiva del BORME para la sociedad {{sociedad_target}} (NIF: {{nif_cif}}) para el período de los últimos {{periodo_analisis}} años.

INSTRUCCIONES DE CITACIÓN (Evidence Pack v1.1):
- CITA cada afirmación factual usando el formato [SRC-XXX]
- Las fuentes están enumeradas en el evidence_pack adjunto
- NO inventes fuentes — solo usa las proporcionadas
- Si no hay evidencia para una afirmación, indica "Sin evidencia BORME disponible"

SECCIONES REQUERIDAS:
1. datos_generales: Denominación, NIF, domicilio, objeto social, capital, órgano de administración
2. administradores: Lista completa de administradores vigentes con cargo y fecha de nombramiento
3. apoderamientos: Poderes generales y especiales vigentes
4. modificaciones: Cambios estatutarios relevantes del período
5. incidencias: Situaciones concursales, disoluciones, o irregularidades
6. red_flags: Mandatos expirados, cambios frecuentes, inconsistencias

Extrae: denominación social, NIF, domicilio, objeto social, capital social, órgano de administración, historial de administradores, apoderamientos, modificaciones estatutarias.',
  grounding_description = 'Evidence Pack v1.1 — Todas las citas deben referenciar [SRC-XXX] del evidence pack. URLs solo de boe.es y borme.es. Coverage >= 95%.'
WHERE skill_key = 'societario.consulta_borme';

UPDATE dd_skills_catalog SET
  prompt_template = 'Analiza en profundidad la estructura del órgano de gobierno de {{sociedad_target}} basándote en los datos del BORME y el snapshot proporcionado.

INSTRUCCIONES DE CITACIÓN (Evidence Pack v1.1):
- CITA cada afirmación factual usando el formato [SRC-XXX]
- Las fuentes están enumeradas en el evidence_pack adjunto
- NO inventes fuentes

ANÁLISIS REQUERIDO:
1. Composición actual del órgano de administración
2. Historial de cambios en los últimos {{periodo_analisis}} años
3. Poderes otorgados y revocados
4. Detección de posibles conflictos de interés
5. Cumplimiento de plazos legales de mandato (art. 221 LSC: 6 años max SL, variable SA)
6. Análisis de red flags en gobierno corporativo

Evalúa: composición del consejo/administración, cambios recientes, posibles conflictos de interés, cumplimiento de plazos legales de mandato, poderes vigentes y su alcance.',
  grounding_description = 'Evidence Pack v1.1 — Análisis basado exclusivamente en datos BORME del snapshot. Cada hallazgo debe citar fuente [SRC-XXX].'
WHERE skill_key = 'societario.analisis_organos';
