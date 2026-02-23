# Dataset Sintético DD Legal PMO — v2.0

**Generado por:** Equipo Legal DDLegal  
**Fecha:** 2026-02-23  
**Versión:** synthetic_e2e_v2  
**Estado:** VALIDADO — 0 errores críticos, 0 advertencias

---

## Resumen del dataset

Este paquete contiene el dataset sintético completo para pruebas end-to-end del sistema DDLegal. Cubre todos los flujos funcionales del Deal Cockpit con contenido jurídico realista y referencias cruzadas validadas.

### Estadísticas

| Archivo | Descripción | Filas |
|---------|-------------|-------|
| `00_catalog_values.csv` | Valores válidos del catálogo | 147 |
| `01_projects.csv` | Proyectos base | 3 |
| `02_project_roles.csv` | Roles por proyecto (10 por proyecto) | 30 |
| `03_tasks_kanban.csv` | Tareas Kanban | 23 |
| `04_contingencies.csv` | Contingencias identificadas | 14 |
| `05_contingencies_ext.csv` | Posición negociadora y parámetros económicos | 14 |
| `06_contingency_clause_map.csv` | Mapeo contingencia → cláusulas SPA | 32 |
| `07_vdr_documents.csv` | Documentos VDR | 20 |
| `08_qa_threads.csv` | Hilos de preguntas QA | 17 |
| `09_qa_messages.csv` | Mensajes en hilos QA | 54 |
| `10_hitl_decisions.csv` | Decisiones HITL | 14 |
| `11_reports.csv` | Reportes generados | 14 |
| `12_war_room_decisions.csv` | Decisiones War Room | 14 |
| `13_war_room_notifications.csv` | Notificaciones War Room | 16 |
| `14_deal_risk_scores.csv` | Scores de riesgo del deal | 3 |
| `15_evidence.csv` | Evidencias vinculadas | 18 |
| `16_workflow_instances_optional.csv` | Instancias de workflow | 14 |
| **TOTAL** | | **300 filas** |

---

## Proyectos cubiertos

### PJT_GREEN — Proyecto Green (Synapse AI SL)
- **Estado:** `active` / `standard`
- **Sector:** Software / Tecnología de IA
- **Recomendación:** `conditional_go` (score 74/100)
- **Riesgo principal:** Cláusula COC sin waiver en contrato principal (40% facturación)
- **Áreas cubiertas:** CONT, MERC, FISC, PI
- **Escenario:** Proyecto normal con riesgo medio y negociación en curso

### PJT_AMBER — Proyecto Amber (DataForge SA)
- **Estado:** `active` / `enhanced`
- **Sector:** Industrial / Manufactura
- **Recomendación:** `go` (score 68/100)
- **Riesgo principal:** Dependencia crítica de proveedor exclusivo + acta AEAT pendiente
- **Áreas cubiertas:** MERC, CONT, LAB, FISC
- **Escenario:** Proyecto con múltiples red flags pero resoluble con protecciones adecuadas

### PJT_RED — Proyecto Red (Legacy Systems SL)
- **Estado:** `blocked` / `enhanced`
- **Sector:** Servicios / IT
- **Recomendación:** `no_go` (score 22/100)
- **Riesgo principal:** Demanda colectiva + procedimiento penal + 8 contratos COC sin waiver
- **Áreas cubiertas:** LAB, LIT, CONT, ADM
- **Escenario:** Proyecto bloqueado con múltiples deal breakers irresolubles

---

## Cobertura de escenarios de prueba

| Requisito | Estado | Detalle |
|-----------|--------|---------|
| 3 proyectos con estados distintos | ✅ | active/standard, active/enhanced, blocked/enhanced |
| 10 roles por proyecto (>7 mínimo) | ✅ | clo, pm_transaccion, 4×abogado_area, deal_sponsor, target_liaison, stakeholder_negocio, cliente_externo |
| Tareas en todos los estados Kanban | ✅ | backlog, info_solicitada, info_recibida, lista_para_analisis, en_analisis, ia_propuesta, hitl_revision, conclusion, integrado_en_informe, bloqueado |
| Contingencias con severidades mixtas | ✅ | critical (4), high (7), medium (3) |
| Al menos 1 deal_breaker=true | ✅ | 6 deal breakers identificados |
| HITL con pending_review, approved, rejected | ✅ | + needs_evidence y escalated |
| Al menos 1 reporte frozen | ✅ | 5 reportes congelados |
| Notificaciones War Room en critical, high, medium, low | ✅ | critical (5), high (6), medium (4), low (1) |
| Scoring con go, conditional_go, no_go | ✅ | PJT_AMBER=go, PJT_GREEN=conditional_go, PJT_RED=no_go |
| Visibilidades diferenciadas | ✅ | internal, client, deal_team, counterparty, committee |
| Referencias cruzadas sin errores | ✅ | Validado con script Python — 0 errores |

---

## Áreas legales cubiertas

| Área | Proyectos | Contingencias | Tareas |
|------|-----------|---------------|--------|
| CONT (Contratos) | GREEN, AMBER, RED | 5 | 6 |
| MERC (Mercantil) | GREEN, AMBER | 3 | 5 |
| LAB (Laboral) | AMBER, RED | 3 | 4 |
| FISC (Fiscal) | GREEN, AMBER | 2 | 3 |
| PI (Propiedad Intelectual) | GREEN | 1 | 2 |
| LIT (Litigios) | RED | 2 | 2 |
| ADM (Administrativo) | RED | 1 | 2 |

---

## Reglas de referencia

- `project_code` → identifica el proyecto en todos los CSV
- `task_code` → definido en `03_tasks_kanban.csv`, referenciado en contingencias, HITL, QA y evidencias
- `contingency_code` → definido en `04_contingencies.csv`, referenciado en ext, clausulas, war room y evidencias
- `thread_code` → definido en `08_qa_threads.csv`, referenciado en `09_qa_messages.csv`
- `report_code` → definido en `11_reports.csv`, referenciado en evidencias
- `doc_code` → definido en `07_vdr_documents.csv`, referenciado en war room decisions
- `workflow_instance_ref` → definido en `16_workflow_instances_optional.csv`, referenciado en HITL

---

## Notas del equipo legal

1. **Contenido jurídico:** Todos los datos son sintéticos y no contienen información personal real. Los nombres de personas y empresas son ficticios.
2. **Clausulas SPA:** Las referencias a cláusulas SPA (`clause_key`) son códigos internos del sistema. El equipo técnico mapeará estos códigos a las plantillas de cláusulas reales.
3. **Importes económicos:** Los importes son estimaciones sintéticas realistas basadas en operaciones de M&A típicas en el mercado español.
4. **Procedimientos legales:** Las referencias a juzgados, expedientes y procedimientos son ficticias y no corresponden a casos reales.
5. **Validación:** El dataset ha sido validado con el script `validate_csv.py` con resultado PASS (0 errores, 0 advertencias).

---

## Entrega al equipo técnico

El equipo técnico deberá:
1. Convertir estos CSV a SQL idempotente usando los códigos de negocio como claves deterministas
2. Mapear `clause_key` a los UUIDs de las plantillas de cláusulas SPA del sistema
3. Completar las tablas técnicas derivadas (`vdr_folders`, `vdr_document_versions`, `qa_slas`, etc.)
4. Cargar el seed en staging para pruebas E2E
