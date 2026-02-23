# DDLegal — Dataset Sintético de Prueba v3.0

**Generado por:** Equipo Legal DDLegal  
**Fecha:** 2026-02-23  
**Versión:** synthetic_e2e_v3  
**Estado:** **VALIDADO — PASS · 0 errores · 342 filas**

---

## Resumen del dataset

Este paquete contiene el dataset sintético completo para pruebas end-to-end del sistema DDLegal. Cubre todos los flujos funcionales del Deal Cockpit con contenido jurídico realista, referencias cruzadas validadas y cobertura exhaustiva de todos los estados límite requeridos.

### Estadísticas v3

| Archivo | Descripción | Filas |
|---------|-------------|-------|
| `00_catalog_values.csv` | Valores válidos del catálogo (incl. `workflow_template_key`, `workflow_instance_status`, `workflow_phase`) | 175 |
| `01_projects.csv` | Proyectos base | 3 |
| `02_project_roles.csv` | Roles por proyecto (incl. 3 inactivos y 6 con `expires_at` vencido para RBAC) | 36 |
| `03_tasks_kanban.csv` | Tareas Kanban con `workflow_key` y `workflow_phase` alineados con catálogo real | 23 |
| `04_contingencies.csv` | Contingencias con todos los estados y severidades (incl. `mitigated`, `resolved`, `accepted`, `low`) | 19 |
| `05_contingencies_ext.csv` | Posición negociadora y parámetros económicos | 19 |
| `06_contingency_clause_map.csv` | Mapeo contingencia → cláusulas SPA | 32 |
| `07_vdr_documents.csv` | Documentos VDR con todos los estados (incl. `archived`, `superseded`, `error` y 2 links expirados) | 26 |
| `08_qa_threads.csv` | Hilos QA (incl. 3 hilos overdue reales con `due_at` anterior a 2026-02-23) | 20 |
| `09_qa_messages.csv` | Mensajes en hilos QA (incl. alertas de sistema para SLA incumplidos) | 63 |
| `10_hitl_decisions.csv` | Decisiones HITL (incl. `decision=correct`) | 16 |
| `11_reports.csv` | Reportes generados (incl. visibilidades `client` y `counterparty`) | 16 |
| `12_war_room_decisions.csv` | Decisiones War Room (incl. `decision_type=transfer`) | 16 |
| `13_war_room_notifications.csv` | Notificaciones War Room con todos los niveles de severidad | 16 |
| `14_deal_risk_scores.csv` | Scores de riesgo del deal | 3 |
| `15_evidence.csv` | Evidencias vinculadas a contingencias, tareas y reportes | 18 |
| `16_workflow_instances_optional.csv` | Instancias de workflow con `template_key` reales y todos los estados válidos | 16 |
| **TOTAL** | | **342 filas** |

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

## Cobertura exhaustiva — 10 requisitos verificados ✅

| # | Requisito | Estado | Detalle |
|---|-----------|--------|---------|
| A | `workflow_key`/`template_key` alineados con catálogo real | ✅ PASS | 7 keys en uso, todos en catálogo (`wf_03`, `wf_04`, `wf_05`, `wf_06`, `wf_08`, `wf_09`, `wf_14`) |
| B | `workflow_instances` sin `status=blocked` | ✅ PASS | Estados válidos: `created`(1), `in_progress`(11), `paused`(1), `completed`(1), `failed`(1), `cancelled`(1) |
| C | Fases válidas en tareas (sin `ia_propuesta` ni `conclusion`) | ✅ PASS | Fases: `obtencion`(8), `analisis`(8), `gestion`(3), `valoracion`(2), `informe`(2) |
| D | Reportes con visibilidad `client` y `counterparty` | ✅ PASS | 5 visibilidades: `internal`, `deal_team`, `committee`, `client`, `counterparty` |
| E | Contingencias con `mitigated`, `resolved`, `accepted` y severidad `low` | ✅ PASS | 5 estados + 4 severidades cubiertas |
| F | Decisión HITL con `decision=correct` | ✅ PASS | 2 decisiones `correct` (HITL_GREEN_005, HITL_AMBER_006) |
| G | Decisión War Room con `decision_type=transfer` | ✅ PASS | 2 decisiones `transfer` (WRD_AMBER_006, WRD_GREEN_005) |
| H | Roles con `is_active=false` y `expires_at` vencido | ✅ PASS | 3 roles inactivos + 6 roles con `expires_at` anterior a 2026-02-23 |
| I | VDR con `archived`, `superseded`, `error` y link expirado | ✅ PASS | 3 estados nuevos + 2 documentos con `link_expires_at` vencido |
| J | Hilos QA con `due_at` pasado (overdue real) | ✅ PASS | 3 hilos overdue: QAT_GREEN_007 (14-Feb), QAT_GREEN_008 (17-Feb), QAT_AMBER_007 (13-Feb) |

---

## Workflow templates utilizados

| Template Key | Descripción |
|-------------|-------------|
| `wf_03_merc_societario` | Mercantil societario |
| `wf_04_cont_material_contracts` | Contratos materiales |
| `wf_05_pi_ip_ownership` | Propiedad intelectual |
| `wf_06_lab_fisc_risk_register` | Laboral y fiscal |
| `wf_08_litigation` | Litigios |
| `wf_09_regulatory_licenses` | Licencias regulatorias |
| `wf_14_red_flag_report` | Red flag report |

---

## Fases de workflow válidas

| Fase | Descripción |
|------|-------------|
| `obtencion` | Obtención de información |
| `gestion` | Gestión documental |
| `analisis` | Análisis legal |
| `valoracion` | Valoración y HITL |
| `informe` | Generación de informe |
| `propuesta_transaccional` | Propuesta transaccional |

---

## Reglas de referencia

- `project_code` → identifica el proyecto en todos los CSV
- `task_code` → definido en `03_tasks_kanban.csv`, referenciado en contingencias, HITL, QA y evidencias
- `contingency_code` → definido en `04_contingencies.csv`, referenciado en ext, cláusulas, war room y evidencias
- `thread_code` → definido en `08_qa_threads.csv`, referenciado en `09_qa_messages.csv`
- `report_code` → definido en `11_reports.csv`, referenciado en evidencias
- `doc_code` → definido en `07_vdr_documents.csv`, referenciado en war room decisions
- `workflow_instance_ref` → definido en `16_workflow_instances_optional.csv`, referenciado en HITL

---

## Casos de prueba RBAC

| Email | Proyecto | Rol | `is_active` | `expires_at` | Caso de prueba |
|-------|----------|-----|-------------|--------------|----------------|
| `former.green@testlegal.com` | PJT_GREEN | abogado_area/LAB | `false` | 2026-01-31 | Usuario desactivado — debe ser rechazado |
| `former.amber@testlegal.com` | PJT_AMBER | abogado_area/PI | `false` | 2026-02-15 | Usuario desactivado — debe ser rechazado |
| `former.red@testlegal.com` | PJT_RED | abogado_area/FISC | `false` | 2026-02-10 | Usuario desactivado — debe ser rechazado |
| `expired.green@testlegal.com` | PJT_GREEN | target_liaison | `true` | 2026-01-15 | Rol expirado — debe ser rechazado |
| `expired.amber@testlegal.com` | PJT_AMBER | stakeholder_negocio | `true` | 2026-02-01 | Rol expirado — debe ser rechazado |
| `expired.red@testlegal.com` | PJT_RED | cliente_externo | `true` | 2026-01-31 | Rol expirado — debe ser rechazado |

---

## Notas del equipo legal

1. **Contenido jurídico:** Todos los datos son sintéticos y no contienen información personal real. Los nombres de personas y empresas son ficticios.
2. **Cláusulas SPA:** Las referencias a cláusulas SPA (`clause_key`) son códigos internos del sistema. El equipo técnico mapeará estos códigos a las plantillas de cláusulas reales.
3. **Importes económicos:** Los importes son estimaciones sintéticas realistas basadas en operaciones de M&A típicas en el mercado español.
4. **Procedimientos legales:** Las referencias a juzgados, expedientes y procedimientos son ficticias y no corresponden a casos reales.
5. **Validación:** El dataset ha sido validado con el script `validate_csv_v3.py` con resultado PASS (0 errores, 342 filas).

---

## Instrucciones de carga para el equipo técnico

1. Cargar `00_catalog_values.csv` primero (tabla de referencia)
2. Cargar `01_projects.csv` y `02_project_roles.csv`
3. Cargar `03_tasks_kanban.csv` y `16_workflow_instances_optional.csv`
4. Cargar `04_contingencies.csv` y `05_contingencies_ext.csv`
5. Cargar `06_contingency_clause_map.csv` y `07_vdr_documents.csv`
6. Cargar `08_qa_threads.csv` y `09_qa_messages.csv`
7. Cargar `10_hitl_decisions.csv`, `11_reports.csv`, `12_war_room_decisions.csv`, `13_war_room_notifications.csv`
8. Cargar `14_deal_risk_scores.csv`, `15_evidence.csv`

El equipo técnico deberá además:
- Convertir estos CSV a SQL idempotente usando los códigos de negocio como claves deterministas
- Mapear `clause_key` a los UUIDs de las plantillas de cláusulas SPA del sistema
- Completar las tablas técnicas derivadas (`vdr_folders`, `vdr_document_versions`, `qa_slas`, etc.)
- Cargar el seed en staging para pruebas E2E

---

*Dataset generado y validado por el Equipo Legal DDLegal · v3.0 · 2026-02-23*
