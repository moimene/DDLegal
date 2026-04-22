import { semanticSearchWithEmbedding, type SemanticSearchResult } from './semantic-search';
import { REPORT_TEMPLATES } from '@/lib/reporting/templates';
import { generateEmbeddings } from '@/lib/embeddings';

/**
 * Section-to-query mapping.
 * Maps report section names to semantic search queries in Spanish.
 * Covers all required_sections across the 35 report templates.
 */
const SECTION_QUERY_MAP: Record<string, string> = {
  // ── Societario ──
  datos_generales: 'datos generales sociedad denominacion CIF domicilio capital social constitucion',
  administradores: 'organo administracion administradores nombramientos apoderados retribucion',

  // ── IP ──
  titular: 'titular derechos propiedad industrial intelectual marcas patentes',
  matriz_marcas: 'marcas registradas clases Niza estado jurisdiccion renovacion',
  diagnostico: 'diagnostico vencimientos gaps cobertura incoherencias titularidad',

  // ── Common ──
  conclusiones: 'conclusiones red flags riesgos contingencias recomendaciones hallazgos',
  recomendaciones: 'recomendaciones acciones prioritarias siguiente paso remediation',
  resumen: 'resumen ejecutivo principales hallazgos resultados clave',
  hallazgos: 'hallazgos findings descubrimientos problemas detectados issues',
  hallazgos_criticos: 'hallazgos criticos alto impacto red flags material findings',
  riesgos: 'riesgos identificados amenazas impacto probabilidad',

  // ── Laboral ──
  plantilla: 'plantilla empleados trabajadores convenio colectivo',
  alta_direccion: 'alta direccion directivos ejecutivos pactos retribucion',
  contingencias: 'contingencias riesgos laborales litigios reclamaciones',

  // ── Fiscal ──
  situacion_fiscal: 'situacion fiscal impuestos tributos declaraciones inspecciones',

  // ── Contratos / R&W ──
  clausulas_clave: 'clausulas clave contratos obligaciones restricciones covenants',
  consentimientos: 'consentimientos autorizaciones permisos aprobaciones',
  cambio_control: 'cambio control change of control vesting aceleracion',
  impacto: 'impacto economico financiero operativo consecuencias',

  // ── Inmobiliario ──
  activos: 'activos inmuebles propiedades fincas registrales',
  cargas: 'cargas gravamenes hipotecas servidumbres limitaciones',

  // ── Litigios ──
  procedimientos_activos: 'procedimientos activos litigios demandas reclamaciones judiciales',
  riesgo_agregado: 'riesgo agregado exposicion total cuantificacion contingencias',

  // ── Regulatorio ──
  licencias: 'licencias autorizaciones permisos concesiones administrativas',
  cumplimiento: 'cumplimiento normativo compliance requisitos legales',

  // ── Earn-out ──
  mecanismo: 'mecanismo earn-out formula calculo hitos objetivos',

  // ── Medioambiental ──
  licencias_ambientales: 'licencias ambientales autorizaciones medio ambiente emisiones residuos',

  // ── Datos / GDPR ──
  tratamientos: 'tratamientos datos personales propositos bases legales responsable',
  cumplimiento_rgpd: 'cumplimiento RGPD GDPR proteccion datos privacy',
  pii_detected: 'datos personales PII detectados identificados categorias especiales',
  retention: 'retencion datos plazos conservacion politica borrado',

  // ── Antitrust ──
  analisis_concentracion: 'analisis concentracion fusion adquisicion control competencia',

  // ── PMO ──
  progreso_areas: 'progreso avance por area estado completion porcentaje',
  tareas_pendientes: 'tareas pendientes por completar backlog bloqueadas',
  bloqueos: 'bloqueos impedimentos problemas sin resolver dependencias',
  carga_trabajo: 'carga trabajo workload asignaciones capacidad equipo',
  sla_cumplimiento: 'SLA cumplimiento plazos vencimientos alertas',
  alertas: 'alertas avisos warnings notificaciones urgentes',
  preguntas_pendientes: 'preguntas pendientes Q&A sin respuesta consultas',
  respuestas_recientes: 'respuestas recientes Q&A contestadas resueltas',
  seguimiento: 'seguimiento follow-up tracking estado actualizacion',
  cobertura: 'cobertura documentos areas evidencias completitud',
  gaps: 'gaps vacios faltantes documentacion incompleta',
  fuentes: 'fuentes origen documentos evidencias referencias',
  incoherencias: 'incoherencias inconsistencias contradicciones discrepancias',
  validaciones: 'validaciones checks verificaciones cruzadas confirmaciones',
  progreso: 'progreso avance general completion estado',
  prevision: 'prevision estimacion forecast timeline proyeccion',
  riesgos_plazo: 'riesgos plazo retrasos deadline vencimientos incumplimiento',
  entregables_pendientes: 'entregables pendientes deliverables sin entregar',
  completados: 'completados terminados entregados finalizados',
  proximos: 'proximos entregables siguientes planificados',
  riesgos_activos: 'riesgos activos vigentes identificados registrados',
  mitigaciones: 'mitigaciones acciones correctivas planes contingencia',
  nuevos_riesgos: 'nuevos riesgos identificados recientes emergentes',

  // ── Compliance ──
  accesos: 'accesos usuarios permisos login sesiones',
  anomalias: 'anomalias irregularidades comportamiento inusual',
  scores: 'scores puntuaciones grounding validacion calidad',
  issues: 'issues errores problemas incidencias',
  tendencias: 'tendencias evolucion historico comparativa',
  errores: 'errores fallos failures exceptions incidencias',
  latencia: 'latencia tiempo respuesta performance rendimiento',
  exito: 'exito tasa acierto success rate efectividad',
  completitud: 'completitud datos completos campos vacios',
  consistencia: 'consistencia datos coherencia validacion cruzada',
  uso: 'uso utilizacion frecuencia invocaciones skills',
  precision: 'precision accuracy exactitud calidad resultados',
  mejoras: 'mejoras sugerencias optimizacion improvements',

  // ── Negotiation ──
  contingencias_overview: 'contingencias resumen overview todas las areas',
  posiciones_buy_sell: 'posiciones comprador vendedor negociacion buyer seller',
  clausulas_spa: 'clausulas SPA acuerdo compraventa share purchase agreement',
  pendientes: 'pendientes abiertos sin resolver outstanding items',
  r_and_w_disclosures: 'representations warranties disclosures revelaciones garantias',
  specific_indemnities: 'indemnizaciones especificas specific indemnities responsabilidad',
  permitted_leakage: 'leakage permitido distribuciones autorizadas dividendos',
  material_contracts: 'contratos materiales significativos principales acuerdos',
  cap_basket_summary: 'cap basket limites responsabilidad franquicia threshold',
  survival_periods: 'periodos supervivencia plazos reclamacion warranty',
  special_indemnities: 'indemnidades especiales cobertura especifica garantias',
  conditions_precedent: 'condiciones precedentes suspensivas CP closing',
  definitions: 'definiciones conceptos clave terminos SPA glosario',
  resumen_impacto: 'resumen impacto economico cuantificacion contingencias',
  contingencias_por_area: 'contingencias por area desglose laboral fiscal societario',
  escenarios_tratamiento: 'escenarios tratamiento opciones resolucion negociacion',

  // ── Consolidated ──
  overview_deal: 'overview deal resumen transaccion operacion',
  metricas_clave: 'metricas clave KPI indicadores principales cifras',
  contingencias_criticas: 'contingencias criticas alto riesgo material red flags',
  estado_negociacion: 'estado negociacion posiciones acuerdos pendientes',
  proximos_pasos: 'proximos pasos next steps acciones siguientes timeline',

  // ── Fallback for unmapped sections ──
  _default: 'informacion relevante evidencia datos clave hallazgos',
};

/**
 * Execute multi-query semantic retrieval for a report type.
 * Runs one query per required_section, de-duplicates, and ranks results.
 */
export async function multiQueryRetrieval(opts: {
  projectId: string;
  reportType: string;
  areaCode?: string;
  topKPerQuery?: number;
}): Promise<{
  results: SemanticSearchResult[];
  queriesExecuted: number;
  sectionsQueried: string[];
}> {
  const { projectId, reportType, areaCode, topKPerQuery = 10 } = opts;

  const template = REPORT_TEMPLATES[reportType];
  if (!template) {
    throw new Error(`Unknown report_type: ${reportType}`);
  }

  const sections = template.required_sections;
  const allResults: SemanticSearchResult[] = [];
  const seenChunkIds = new Set<string>();

  // 1. Gather all queries
  const queries = sections.map(
    section => SECTION_QUERY_MAP[section] || SECTION_QUERY_MAP._default
  );

  // 2. Batch generate embeddings for all queries at once
  const embeddings = await generateEmbeddings(queries);

  // 3. Run all vector searches in parallel
  const searchPromises = embeddings.map(embedding =>
    semanticSearchWithEmbedding(projectId, embedding, {
      threshold: 0.6,
      limit: topKPerQuery,
      areaCode: areaCode || undefined,
    })
  );

  const resultsArrays = await Promise.all(searchPromises);

  // 4. De-duplicate results
  for (const sectionResults of resultsArrays) {
    for (const result of sectionResults) {
      if (!seenChunkIds.has(result.chunk_id)) {
        seenChunkIds.add(result.chunk_id);
        allResults.push(result);
      }
    }
  }

  // Sort by similarity descending
  allResults.sort((a, b) => b.similarity - a.similarity);

  return {
    results: allResults,
    queriesExecuted: sections.length,
    sectionsQueried: sections,
  };
}
