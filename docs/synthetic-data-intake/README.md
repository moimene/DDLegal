# Plantillas de captura para datos sinteticos (equipo legal)

Este paquete permite que el equipo legal construya datasets de prueba sin acceso a Supabase ni conocimiento tecnico de la topologia interna.

## Como usar (no tecnico)
1. Abrir los CSV en Excel/Sheets.
2. Completar solo las tablas `OBLIGATORIAS`.
3. Respetar los valores permitidos de `00_catalog_values.csv`.
4. Mantener las claves de referencia (`project_code`, `task_code`, `contingency_code`, etc.) consistentes entre archivos.
5. Entregar los CSV completos al equipo tecnico para conversion a SQL.

## Archivos OBLIGATORIOS
- `01_projects.csv`
- `02_project_roles.csv`
- `03_tasks_kanban.csv`
- `04_contingencies.csv`
- `05_contingencies_ext.csv`
- `06_contingency_clause_map.csv`
- `07_vdr_documents.csv`
- `08_qa_threads.csv`
- `09_qa_messages.csv`
- `10_hitl_decisions.csv`
- `11_reports.csv`
- `12_war_room_decisions.csv`
- `13_war_room_notifications.csv`
- `14_deal_risk_scores.csv`
- `15_evidence.csv`

## Archivo de apoyo
- `00_catalog_values.csv`: lista de valores validos para evitar errores de carga.
- `16_workflow_instances_optional.csv`: opcional si quereis fijar estado de workflows de forma explicita.

## Reglas de referencia (muy importante)
- `project_code` identifica el proyecto y se reutiliza en todos los CSV.
- `task_code` se define en `03_tasks_kanban.csv` y se referencia desde contingencias/HITL/QA/evidence.
- `contingency_code` se define en `04_contingencies.csv` y se referencia en negociacion/war room/evidence.
- `thread_code` se define en `08_qa_threads.csv` y se usa en `09_qa_messages.csv`.
- `report_code` se define en `11_reports.csv` y puede usarse en evidencias o enlaces QA.

## Cobertura minima recomendada para test exhaustivo
- 3 proyectos: `PJT_GREEN`, `PJT_AMBER`, `PJT_RED`.
- 7 roles por proyecto: `clo`, `pm_transaccion`, `abogado_area`, `deal_sponsor`, `target_liaison`, `stakeholder_negocio`, `cliente_externo`.
- Tareas en varios estados: `backlog`, `en_analisis`, `hitl_revision`, `bloqueado`, `integrado_en_informe`.
- Contingencias con severidades mezcladas y al menos 1 `is_deal_breaker=true`.
- HITL con casos `pending_review`, `approved`, `rejected`.
- Reportes con al menos 1 `is_frozen=true`.
- Notificaciones de war room en severidad `critical`, `high`, `medium`, `low`.
- Deal risk score con recomendaciones `go`, `conditional_go`, `no_go`.

## Campos tipo JSON
Cuando un campo termine en `_json`, usar JSON valido. Ejemplos:
- `{}` (objeto vacio)
- `[]` (array vacio)
- `{"MERC":72,"CONT":55}`

## Nota para el equipo tecnico
Estas plantillas estan pensadas como capa de captura negocio. El equipo tecnico mapea a UUID/FK y completa tablas tecnicas derivadas (por ejemplo `vdr_folders`, `vdr_document_versions`, `qa_slas`, etc.) durante la conversion SQL.
