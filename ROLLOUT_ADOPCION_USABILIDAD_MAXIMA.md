# Rollout de Adopcion - Usabilidad Incrementada y Maxima

## 1. Objetivo de rollout
Desplegar la estrategia de adopcion en fases, con responsables claros, criterios de salida y control de riesgo operativo/legal.

Fecha de inicio propuesta: 23-Feb-2026.

## 2. Equipo y owners (propuestos)
Roles base:
1. `PO Legaltech` - owner de alcance y priorizacion.
2. `Legal Lead DD` - owner de validacion funcional legal.
3. `Engineering Lead` - owner de entrega tecnica.
4. `Design Lead UX` - owner de experiencia y usabilidad.
5. `Data/AI Lead` - owner de skills, calidad IA y observabilidad.
6. `PMO Lead` - owner de agenda, SLAs y coordinacion.
7. `Security/Compliance Lead` - owner de permisos, auditoria y cumplimiento.
8. `Customer Success Lead` - owner de adopcion cliente y training.

## 3. RACI simplificado por bloque
1. Activacion abogados:
- Responsible: Design Lead UX + Engineering Lead
- Accountable: PO Legaltech
- Consulted: Legal Lead DD
- Informed: PMO Lead

2. HITL y evidencia:
- Responsible: Data/AI Lead + Engineering Lead
- Accountable: Legal Lead DD
- Consulted: Security/Compliance Lead
- Informed: PO Legaltech

3. PMO timeline y bloqueos:
- Responsible: PMO Lead + Engineering Lead
- Accountable: PO Legaltech
- Consulted: Legal Lead DD
- Informed: Customer Success Lead

4. Portal cliente:
- Responsible: Design Lead UX + Engineering Lead
- Accountable: PO Legaltech
- Consulted: Security/Compliance Lead + Legal Lead DD
- Informed: Customer Success Lead

## 4. Fases de rollout (con fechas)

## Fase 0 - Foundation y baseline (23-Feb-2026 a 06-Mar-2026)
Objetivo:
- fijar metricas base,
- preparar instrumentacion y criterios de QA legal.

Entregables:
1. Baseline de metricas actuales (time to first value, adoption, bloqueos).
2. Esquema de eventos de producto y naming unico.
3. Plantilla de QA legal para features HITL/evidencia.
4. Plan de formacion interna (champions por area).

Owners:
- Principal: PO Legaltech.
- Ejecucion: Engineering Lead + Data/AI Lead + PMO Lead.

Gate de salida:
1. Dashboard de baseline publicado.
2. Eventos principales capturados en entorno staging.
3. Checklist QA legal aprobado por Legal Lead DD.

## Fase 1 - Usabilidad incrementada (09-Mar-2026 a 03-Apr-2026)
Objetivo:
- reducir friccion inicial y activar uso diario de abogados.

Scope:
1. Wizard alta 3 pasos + plantillas deal.
2. Home "Mi Jornada Legal".
3. Bandeja HITL minima (aprobar/corregir/rechazar).
4. Tab Documentos MVP (estados operativos).
5. Timeline PMO basico + bloqueos accionables.

Owners:
- Principal: Engineering Lead.
- Producto/UX: PO Legaltech + Design Lead UX.
- Validacion legal: Legal Lead DD.

Gate de salida:
1. 80% de abogados piloto completan onboarding.
2. Time to first value <= 30 min en piloto.
3. 100% de findings nuevos muestran estado de evidencia.

## Fase 2 - PMO y cliente frictionless (06-Apr-2026 a 01-May-2026)
Objetivo:
- visibilidad end-to-end para equipo y cliente sin aumentar carga operativa.

Scope:
1. Portal cliente minimo con permisos por item.
2. Red flags confirmadas y bloqueos con accion esperada.
3. Digest interno diario y cliente semanal.
4. SLA por area + semaforo on-track / at-risk.

Owners:
- Principal: PMO Lead.
- Ejecucion: Engineering Lead + Design Lead UX.
- Compliance: Security/Compliance Lead.

Gate de salida:
1. Portal activo para proyectos piloto.
2. Cero incidencias de permiso critico en UAT.
3. >= 2 sesiones/semana por cliente piloto.

## Fase 3 - Usabilidad maxima con IA proactiva (04-May-2026 a 12-Jun-2026)
Objetivo:
- automatizacion gobernada por eventos con control HITL robusto.

Scope:
1. Trigger de skills por evento documental.
2. Catalogo de skills versionado por area y PMO.
3. Validacion de payload IA + observabilidad de corridas.
4. Feedback loop HITL para mejora continua.

Owners:
- Principal: Data/AI Lead.
- Ejecucion: Engineering Lead.
- Validacion: Legal Lead DD + PO Legaltech.

Gate de salida:
1. >= 70% corridas sin fallback tecnico.
2. >= 60% outputs aceptados tras revision humana.
3. Dashboard de latencia/error/calidad en uso semanal.

## Fase 4 - Escalado controlado (15-Jun-2026 a 10-Jul-2026)
Objetivo:
- consolidar adopcion multiequipo y preparar expansion.

Scope:
1. Extender rollout a todos los equipos DD objetivo.
2. Ajustes de UX por feedback cuantitativo y cualitativo.
3. Hardening operativo y runbook de soporte.

Owners:
- Principal: PO Legaltech.
- Soporte: Customer Success Lead + PMO Lead.

Gate de salida:
1. Activacion semanal > 85%.
2. Cierre de bloqueos -50% vs baseline inicial.
3. Runbook operativo validado por soporte y producto.

## 5. Cadencias de gobierno
1. Daily operativo (15 min): Engineering Lead + PMO Lead + Design Lead UX.
2. Weekly de producto (60 min): PO Legaltech + Legal Lead DD + Data/AI Lead.
3. Weekly de riesgos (45 min): Security/Compliance Lead + PMO Lead.
4. Bi-weekly con stakeholders (60 min): estado KPIs, riesgos, decisiones.

## 6. Gestion de riesgos del rollout
Riesgos criticos y mitigacion:
1. Sobrecarga del equipo legal piloto.
- Mitigacion: limite de features por semana + champions por area.

2. Baja confianza en IA.
- Mitigacion: evidencia obligatoria, gating por riesgo, fallback transparente.

3. Fugas de visibilidad en portal cliente.
- Mitigacion: permisos por item + auditoria + UAT legal obligatoria.

4. Integraciones inestables (n8n/IA).
- Mitigacion: colas, reintentos, estado en cola visible al usuario.

## 7. Plan de adopcion y cambio
1. Semana previa a cada fase: demo guiada de 30 min.
2. Material corto por rol: 1 pagina por flujo.
3. Soporte hypercare: primeros 10 dias de cada fase.
4. Encuesta flash quincenal: friccion, confianza, utilidad.

## 8. KPI de exito por fase
1. Fase 1:
- Time to first value <= 30 min.
- Activacion semanal >= 70%.

2. Fase 2:
- Frecuencia portal cliente >= 2 sesiones/semana.
- Tiempo de resolucion de bloqueos: -25% vs baseline.

3. Fase 3:
- Outputs IA aceptados >= 60%.
- Corridas IA exitosas >= 70%.

4. Fase 4:
- Activacion semanal >= 85%.
- Resolucion de bloqueos: -50% vs baseline.

## 9. Criterios de no-go
No avanzar de fase si se cumple cualquiera:
1. Incidente severo de permisos/visibilidad no resuelto.
2. Caida de adopcion > 20% durante 2 semanas seguidas.
3. Error funcional en HITL que afecte decisiones legales criticas.

