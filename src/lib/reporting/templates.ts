import type { ReportTemplate } from './report-engine';

/**
 * DD Report Templates — 31 templates across 3 families
 *
 * Transactional (15): Due diligence area reports
 * PMO (8):           Project management reports
 * Compliance (7):    Audit & observability reports
 */

export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
    // ============================================================
    // TRANSACTIONAL — Informes por area
    // ============================================================

    societario_standard: {
        report_type: 'societario_standard',
        family: 'transactional',
        title_template: 'Informe Societario — {sociedad} — {fecha_corte}',
        required_sections: ['datos_generales', 'administradores', 'conclusiones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'societario.consulta_borme',
        export_formats: ['pdf', 'json', 'markdown'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'borme.es', 'registradores.org'],
    },

    red_flags_digest: {
        report_type: 'red_flags_digest',
        family: 'transactional',
        title_template: 'Red Flags Digest — {proyecto} — {fecha_corte}',
        required_sections: ['resumen', 'hallazgos', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        export_formats: ['pdf', 'json', 'html'],
        cadencia: 'weekly',
        audience: ['equipo', 'cliente', 'pm'],
    },

    ip_report: {
        report_type: 'ip_report',
        family: 'transactional',
        title_template: 'Informe Propiedad Industrial — {titular} — {fecha_corte}',
        required_sections: ['titular', 'matriz_marcas', 'diagnostico', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'marcas.analisis_riesgo_pi',
        export_formats: ['pdf', 'json', 'markdown'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['oepm.es', 'euipo.europa.eu', 'wipo.int', 'consultas2.oepm.es'],
    },

    rw_report: {
        report_type: 'rw_report',
        family: 'transactional',
        title_template: 'Informe R&W — {sociedad} — {fecha_corte}',
        required_sections: ['clausulas_clave', 'riesgos', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'contratos.extraccion_clausulas',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
    },

    consents_coc_report: {
        report_type: 'consents_coc_report',
        family: 'transactional',
        title_template: 'Mapa de Consents y CoC — {sociedad} — {fecha_corte}',
        required_sections: ['consentimientos', 'cambio_control', 'impacto'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'contratos.extraccion_clausulas',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
    },

    labor_report: {
        report_type: 'labor_report',
        family: 'transactional',
        title_template: 'Informe Laboral — {sociedad} — {fecha_corte}',
        required_sections: ['plantilla', 'contingencias', 'alta_direccion', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'laboral.contingencias_laborales',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'seg-social.es', 'borme.es'],
    },

    fiscal_report: {
        report_type: 'fiscal_report',
        family: 'transactional',
        title_template: 'Informe Fiscal — {sociedad} — {fecha_corte}',
        required_sections: ['situacion_fiscal', 'contingencias', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'fiscal.situacion_fiscal',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'agenciatributaria.es', 'borme.es'],
    },

    inmobiliario_report: {
        report_type: 'inmobiliario_report',
        family: 'transactional',
        title_template: 'Informe Inmobiliario — {sociedad} — {fecha_corte}',
        required_sections: ['activos', 'cargas', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'inmobiliario.ficha_inmuebles',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'registradores.org', 'catastro.meh.es'],
    },

    litigios_report: {
        report_type: 'litigios_report',
        family: 'transactional',
        title_template: 'Informe Litigios — {sociedad} — {fecha_corte}',
        required_sections: ['procedimientos_activos', 'riesgo_agregado', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'litigios.ficha_procedimientos',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'poderjudicial.es'],
    },

    regulatorio_report: {
        report_type: 'regulatorio_report',
        family: 'transactional',
        title_template: 'Informe Regulatorio — {sociedad} — {fecha_corte}',
        required_sections: ['licencias', 'cumplimiento', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'regulatorio.licencias_autorizaciones',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'cnmc.es'],
    },

    earn_out_report: {
        report_type: 'earn_out_report',
        family: 'transactional',
        title_template: 'Analisis Earn-out — {sociedad} — {fecha_corte}',
        required_sections: ['mecanismo', 'riesgos', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'contratos.extraccion_clausulas',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
    },

    medioambiental_report: {
        report_type: 'medioambiental_report',
        family: 'transactional',
        title_template: 'Informe Medioambiental — {sociedad} — {fecha_corte}',
        required_sections: ['licencias_ambientales', 'contingencias', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'medioambiental.autorizaciones_ambientales',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'miteco.gob.es'],
    },

    datos_report: {
        report_type: 'datos_report',
        family: 'transactional',
        title_template: 'Informe Proteccion de Datos — {sociedad} — {fecha_corte}',
        required_sections: ['tratamientos', 'cumplimiento_rgpd', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'datos.cumplimiento_rgpd',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'aepd.es'],
    },

    antitrust_report: {
        report_type: 'antitrust_report',
        family: 'transactional',
        title_template: 'Informe Antitrust — {sociedad} — {fecha_corte}',
        required_sections: ['analisis_concentracion', 'riesgos', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        harvey_skill_key: 'regulatorio.contingencias_regulatorias',
        export_formats: ['pdf', 'json'],
        cadencia: 'on_demand',
        audience: ['equipo', 'cliente'],
        url_allowlist: ['boe.es', 'cnmc.es', 'ec.europa.eu'],
    },

    executive_digest: {
        report_type: 'executive_digest',
        family: 'transactional',
        title_template: 'Digest Ejecutivo — {proyecto} — {fecha_corte}',
        required_sections: ['resumen', 'hallazgos_criticos', 'recomendaciones', 'proximos_pasos'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        export_formats: ['pdf', 'html'],
        cadencia: 'weekly',
        audience: ['equipo', 'cliente', 'pm'],
    },

    // ============================================================
    // PMO — Informes de gestion
    // ============================================================

    pmo_estado: {
        report_type: 'pmo_estado',
        family: 'pmo',
        title_template: 'Estado PMO por Area — {proyecto} — {fecha}',
        required_sections: ['progreso_areas', 'tareas_pendientes', 'bloqueos'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'html', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    pmo_workload: {
        report_type: 'pmo_workload',
        family: 'pmo',
        title_template: 'Workload y SLAs — {proyecto} — {fecha}',
        required_sections: ['carga_trabajo', 'sla_cumplimiento', 'alertas'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm'],
    },

    pmo_qa_log: {
        report_type: 'pmo_qa_log',
        family: 'pmo',
        title_template: 'Q&A Log — {proyecto} — {fecha}',
        required_sections: ['preguntas_pendientes', 'respuestas_recientes', 'seguimiento'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'daily',
        audience: ['pm', 'equipo'],
    },

    pmo_evidence_matrix: {
        report_type: 'pmo_evidence_matrix',
        family: 'pmo',
        title_template: 'Matriz de Evidencias — {proyecto} — {fecha}',
        required_sections: ['cobertura', 'gaps', 'fuentes'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    pmo_cross_consistency: {
        report_type: 'pmo_cross_consistency',
        family: 'pmo',
        title_template: 'Consistencia Cruzada — {proyecto} — {fecha}',
        required_sections: ['incoherencias', 'validaciones', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: true,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    pmo_burndown: {
        report_type: 'pmo_burndown',
        family: 'pmo',
        title_template: 'Burndown y Prevision — {proyecto} — {fecha}',
        required_sections: ['progreso', 'prevision', 'riesgos_plazo'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'html'],
        cadencia: 'weekly',
        audience: ['pm'],
    },

    pmo_deliverables: {
        report_type: 'pmo_deliverables',
        family: 'pmo',
        title_template: 'Estado Entregables — {proyecto} — {fecha}',
        required_sections: ['entregables_pendientes', 'completados', 'proximos'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    pmo_risk_register: {
        report_type: 'pmo_risk_register',
        family: 'pmo',
        title_template: 'Registro de Riesgos — {proyecto} — {fecha}',
        required_sections: ['riesgos_activos', 'mitigaciones', 'nuevos_riesgos'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    // ============================================================
    // COMPLIANCE — Auditoria y observabilidad
    // ============================================================

    compliance_access_audit: {
        report_type: 'compliance_access_audit',
        family: 'compliance',
        title_template: 'Auditoria de Accesos — {proyecto} — {fecha}',
        required_sections: ['accesos', 'anomalias', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'monthly',
        audience: ['pm'],
    },

    compliance_grounding: {
        report_type: 'compliance_grounding',
        family: 'compliance',
        title_template: 'Grounding y Validacion IA — {proyecto} — {fecha}',
        required_sections: ['scores', 'issues', 'tendencias'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm', 'equipo'],
    },

    compliance_borme_health: {
        report_type: 'compliance_borme_health',
        family: 'compliance',
        title_template: 'BORME Index Health — {fecha}',
        required_sections: ['cobertura', 'errores', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'monthly',
        audience: ['pm'],
    },

    compliance_agent_observability: {
        report_type: 'compliance_agent_observability',
        family: 'compliance',
        title_template: 'Observabilidad Agentes — {fecha}',
        required_sections: ['latencia', 'exito', 'errores'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'daily',
        audience: ['pm'],
    },

    compliance_data_quality: {
        report_type: 'compliance_data_quality',
        family: 'compliance',
        title_template: 'Calidad de Datos — {proyecto} — {fecha}',
        required_sections: ['completitud', 'consistencia', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'weekly',
        audience: ['pm'],
    },

    compliance_gdpr_audit: {
        report_type: 'compliance_gdpr_audit',
        family: 'compliance',
        title_template: 'Auditoria GDPR — {proyecto} — {fecha}',
        required_sections: ['pii_detected', 'retention', 'recomendaciones'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'monthly',
        audience: ['pm'],
    },

    compliance_skill_performance: {
        report_type: 'compliance_skill_performance',
        family: 'compliance',
        title_template: 'Rendimiento Skills IA — {fecha}',
        required_sections: ['uso', 'precision', 'mejoras'],
        evidence_pack_version: '1.1',
        grounding_required: false,
        export_formats: ['pdf', 'json'],
        cadencia: 'monthly',
        audience: ['pm'],
    },
};

// Helper functions
export function getTemplate(reportType: string): ReportTemplate | undefined {
    return REPORT_TEMPLATES[reportType];
}

export function getTemplatesByFamily(family: 'transactional' | 'pmo' | 'compliance'): ReportTemplate[] {
    return Object.values(REPORT_TEMPLATES).filter(t => t.family === family);
}

export function getAllTemplateTypes(): string[] {
    return Object.keys(REPORT_TEMPLATES);
}
