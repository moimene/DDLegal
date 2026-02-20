-- Migration: seed_tools_skills
-- Purpose: Seed initial microtools and skills catalog entries
-- Date: 2026-02-20

begin;

-- ============================================================
-- Seed dd_tools — Microtools registry
-- ============================================================
insert into public.dd_tools (slug, name, description, icon, area_codes, skills_used, requires_project, sort_order) values
  ('societario', 'Situacion Societaria',
   'Consulta BORME y construye perfil corporativo completo: organos sociales, capital, apoderamientos y modificaciones estatutarias',
   'Building2', '{"MERC","MA"}',
   '{"societario.consulta_borme","societario.analisis_organos"}',
   false, 1),
  ('marcas', 'Radar de Marcas',
   'Consulta registros de marcas (OEPM/EUIPO) y construye matriz de propiedad intelectual con gaps y riesgos',
   'Shield', '{"PI"}',
   '{"marcas.consulta_oepm","marcas.analisis_riesgo_pi"}',
   false, 2),
  ('reps-warranties', 'Parser Reps & Warranties',
   'Extrae y clasifica clausulas de manifestaciones y garantias, limitaciones de responsabilidad, caps y baskets de contratos',
   'FileSearch', '{"CONT","MERC"}',
   '{}',
   true, 3),
  ('digest-pmo', 'Digest PMO Red Flags',
   'Genera digest diario de red flags por severidad, cambios desde ultimo corte, con enlaces a evidencia y responsables',
   'AlertTriangle', '{"GENERAL"}',
   '{}',
   true, 4)
on conflict (slug) do nothing;

-- ============================================================
-- Seed dd_skills_catalog — Initial skills for Phase 1 tools
-- ============================================================
insert into public.dd_skills_catalog (area_code, skill_key, name, description, category, prompt_template, expected_output_schema, evidence_requirements, agent_pipeline) values
  -- Societario: BORME lookup
  ('MERC', 'societario.consulta_borme', 'Consulta BORME',
   'Busca y extrae informacion corporativa del Boletin Oficial del Registro Mercantil para una sociedad target',
   'verificacion',
   E'Eres un asistente legal especializado en derecho societario espanol. Debes construir un perfil societario a partir de anuncios oficiales recuperados del BORME y otros documentos societarios aportados. Tu salida debe cumplir estrictamente el esquema "perfil_societario". No inventes datos. Cita evidencia minima suficiente para cada campo con referencia a publicacion y pagina o seccion. Si hay discrepancias entre fuentes, marcalas como "no_comprobable" y adjunta ambas evidencias.\n\nObjetivo: [sociedad_target] — Identificador fiscal: [nif_cif] — Periodo: ultimos [periodo] anios.\n\nTarea: Construye el perfil_societario con los campos:\n* denominacion_social_completa\n* nif_cif\n* domicilio_social\n* objeto_social\n* capital_social (importe y moneda)\n* organo_administracion_vigente\n* administradores_y_cargos[]\n* apoderamientos_relevantes[]\n* modificaciones_estatutarias_recientes[]\n* incidencias_relevantes[]\n\nIncluye "evidencias[]" con doc_id, uri, page_range o seccion, snippet y hash cuando este disponible. Senala "no_comprobable" si las fuentes difieren o no existe dato publico reciente.',
   '{"type":"object","properties":{"denominacion_social":{"type":"string"},"nif_cif":{"type":"string"},"domicilio_social":{"type":"string"},"objeto_social":{"type":"string"},"capital_social":{"type":"object","properties":{"importe":{"type":"number"},"moneda":{"type":"string"}}},"organo_administracion":{"type":"string"},"administradores":{"type":"array","items":{"type":"object","properties":{"nombre":{"type":"string"},"cargo":{"type":"string"},"fecha_nombramiento":{"type":"string"}}}},"apoderamientos":{"type":"array","items":{"type":"object","properties":{"nombre":{"type":"string"},"tipo":{"type":"string"},"alcance":{"type":"string"}}}},"modificaciones_recientes":{"type":"array","items":{"type":"object","properties":{"tipo":{"type":"string"},"fecha":{"type":"string"},"referencia_borme":{"type":"string"}}}},"incidencias":{"type":"array"},"evidencias":{"type":"array","items":{"type":"object","properties":{"doc_id":{"type":"string"},"uri":{"type":"string"},"page_range":{"type":"string"},"snippet":{"type":"string"}}}}}}',
   '[{"type":"registry_scrape","source":"BORME","required":true}]',
   '{"paranoico","validador","sanitizer"}'),

  -- Societario: governance analysis
  ('MERC', 'societario.analisis_organos', 'Analisis de Organos Sociales',
   'Analiza composicion y potenciales conflictos en organos de gobierno corporativo',
   'analisis',
   E'Para la sociedad [sociedad_target], analiza la composicion de sus organos sociales. Identifica: tipo de organo de administracion, miembros actuales con cargos y fechas, posibles conflictos de interes, vinculaciones con otras sociedades (administrador comun, participaciones cruzadas), caducidad de cargos segun LSC. Cruza informacion con registros publicos disponibles.\n\nGenera alertas para: cargos caducados, administradores con incompatibilidades potenciales, apoderamientos excesivos sin limites claros, ausencia de secretario o consejero independiente donde aplique.',
   '{"type":"object","properties":{"tipo_organo":{"type":"string"},"miembros":{"type":"array","items":{"type":"object","properties":{"nombre":{"type":"string"},"cargo":{"type":"string"},"fecha_nombramiento":{"type":"string"},"caducidad":{"type":"string"}}}},"conflictos_potenciales":{"type":"array","items":{"type":"object","properties":{"descripcion":{"type":"string"},"severidad":{"type":"string"},"evidencia":{"type":"string"}}}},"vinculaciones":{"type":"array"},"alertas":{"type":"array","items":{"type":"object","properties":{"tipo":{"type":"string"},"descripcion":{"type":"string"},"recomendacion":{"type":"string"}}}}}}',
   '[{"type":"registry_scrape","source":"BORME","required":true},{"type":"document","source":"escrituras","required":false}]',
   '{"paranoico","validador","sanitizer"}'),

  -- Marcas: OEPM lookup
  ('PI', 'marcas.consulta_oepm', 'Consulta OEPM',
   'Busca marcas registradas en la Oficina Espanola de Patentes y Marcas para una sociedad o denominacion',
   'verificacion',
   E'Eres un analista de propiedad industrial. Busca en la Oficina Espanola de Patentes y Marcas (OEPM) todas las marcas registradas, solicitadas o caducadas asociadas a [sociedad_target] o a las denominaciones [denominaciones_adicionales].\n\nPara cada marca devuelve: numero de registro, denominacion, tipo (denominativa, grafica, mixta), clases de Niza, estado legal (solicitada, concedida, renovada, caducada, denegada), titular actual, fecha de solicitud, fecha de concesion, proxima fecha de renovacion.\n\nTu salida debe cumplir el esquema "matriz_marcas". Cita siempre el expediente y la fuente oficial. No extrapoles similitudes foneticas mas alla de coincidencias claras.',
   '{"type":"object","properties":{"marcas":{"type":"array","items":{"type":"object","properties":{"numero_registro":{"type":"string"},"denominacion":{"type":"string"},"tipo":{"type":"string"},"clases_niza":{"type":"array","items":{"type":"integer"}},"estado_legal":{"type":"string"},"titular":{"type":"string"},"fecha_solicitud":{"type":"string"},"fecha_concesion":{"type":"string"},"fecha_renovacion":{"type":"string"},"expediente":{"type":"string"}}}},"resumen":{"type":"object","properties":{"total":{"type":"integer"},"activas":{"type":"integer"},"caducadas":{"type":"integer"},"en_tramite":{"type":"integer"}}}}}',
   '[{"type":"registry_scrape","source":"OEPM","required":true}]',
   '{"paranoico","validador","sanitizer"}'),

  -- Marcas: PI risk analysis
  ('PI', 'marcas.analisis_riesgo_pi', 'Analisis de Riesgo PI',
   'Evalua riesgos de propiedad intelectual basado en portfolio de marcas y gaps de proteccion',
   'analisis',
   E'Analiza el portfolio de marcas y propiedad intelectual de [sociedad_target]. Basandote en los resultados de la consulta OEPM:\n\n1. Evalua cobertura de proteccion por clases de Niza relevantes para el sector [sector]\n2. Identifica gaps criticos de proteccion (clases no cubiertas que deberian estarlo)\n3. Detecta marcas proximas a caducidad (< 12 meses)\n4. Senala posibles conflictos con marcas de terceros en las mismas clases\n5. Genera recomendaciones priorizadas de proteccion\n\nDevuelve "diagnostico_pi" con: matriz_riesgo, gaps_proteccion, proximas_caducidad, conflictos_potenciales, recomendaciones. Marca items como "en_revision" si detectas posibles cesiones u oposiciones recientes sin confirmacion documental.',
   '{"type":"object","properties":{"matriz_riesgo":{"type":"array","items":{"type":"object","properties":{"clase":{"type":"integer"},"cobertura":{"type":"string"},"riesgo":{"type":"string"},"recomendacion":{"type":"string"}}}},"gaps_proteccion":{"type":"array","items":{"type":"object","properties":{"clase":{"type":"integer"},"justificacion":{"type":"string"},"prioridad":{"type":"string"}}}},"proximas_caducidad":{"type":"array","items":{"type":"object","properties":{"marca":{"type":"string"},"fecha_caducidad":{"type":"string"},"accion":{"type":"string"}}}},"conflictos_potenciales":{"type":"array"},"recomendaciones":{"type":"array","items":{"type":"object","properties":{"accion":{"type":"string"},"prioridad":{"type":"string"},"justificacion":{"type":"string"}}}}}}',
   '[{"type":"registry_scrape","source":"OEPM","required":true},{"type":"api_response","source":"marcas.consulta_oepm","required":true}]',
   '{"paranoico","validador","sanitizer"}')
on conflict (skill_key) do nothing;

commit;
