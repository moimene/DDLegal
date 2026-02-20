# Estrategia de Usabilidad Incrementada y Maxima para DD Legal PMO

## 1) Objetivo
Lograr adopcion rapida por abogados con una experiencia frictionless, intuitiva y confiable, sin romper el flujo real de due diligence legal.

Resultado esperado:
- Menor tiempo desde alta de proyecto hasta primer output util.
- Menos contexto perdido entre areas, PMO y cliente.
- Mayor confianza en IA por evidencia trazable y revision humana clara.

## 2) Principios UX para equipo legal
1. Evidencia antes que opinion: cada finding debe mostrar fuente, pagina y contexto.
2. Menos clics, mas accion: cada pantalla debe cerrar una tarea concreta.
3. Unica verdad operativa: estado unico por proyecto para equipo interno y cliente.
4. IA asistida, no opaca: sugerencias claras, editables y con umbral de confianza.
5. Human-in-the-loop por riesgo: cuanto mayor impacto legal, mayor control humano.
6. Cero sorpresa: estados, bloqueos, deadlines y responsables siempre visibles.

## 3) Fricciones detectadas hoy (base actual)
1. Tabs de Tareas, Documentos y Q&A no operativas.
2. IA mayormente reactiva (boton por proceso) y no proactiva por eventos.
3. Sin capa de evidencia estructurada para validar hallazgos de forma consistente.
4. Sin agenda PMO con ruta critica, SLAs y dependencias visibles.
5. Sin portal cliente operativo para estado accionable y bloqueos.

## 4) Estrategia UX Incrementada (0-8 semanas)
Objetivo: adopcion inmediata sin rediseno radical.

### 4.1 Flujo de entrada sin friccion
1. Wizard de alta en 3 pasos: datos minimos, modo Data Room, plan inicial por area.
2. Plantillas por tipo de operacion: acquisition, merger, jv, carve-out.
3. Campos con autocompletado y defaults legales para evitar data entry manual.

### 4.2 Pantalla "Mi Jornada Legal" (home por rol)
1. Lista unica de "Siguiente mejor accion" por abogado.
2. Bloqueos ordenados por severidad + accion esperada + deadline.
3. Cola "Pendiente de revision humana" para outputs IA.

### 4.3 Workbench de proceso (foco por area)
1. Vista unica por proceso con:
   - checklist de documentos esperados,
   - hallazgos sugeridos por IA,
   - contingencias abiertas,
   - estado de aprobacion.
2. Botones rapidos:
   - "Aceptar y pasar a review",
   - "Editar recomendacion",
   - "Escalar a lider de area".

### 4.4 Documentos y evidencia minima viable
1. Ingestion simple con estados visibles: recibido, OCR, indexado, listo.
2. Modo Data Room por proyecto:
   - espejo controlado,
   - indice referenciado,
   - hibrido contextual.
3. Cada finding muestra:
   - documento fuente,
   - rango de pagina,
   - snippet validado.

### 4.5 PMO operacional visible
1. Timeline con hitos, ruta critica y semaforo on-track / at-risk.
2. SLA por area con alerta temprana de desviaciones.
3. Digest automatico diario para equipo interno.

### 4.6 Portal cliente minimo (frictionless)
1. Vista de progreso por area y proximos hitos.
2. Red flags confirmadas con explicacion corta.
3. Bloqueos con "que esperamos del cliente" y fecha objetivo.

## 5) Estrategia UX Maxima (2-6 meses)
Objetivo: convertir la plataforma en sistema operativo de DD legal.

### 5.1 Copiloto proactivo por eventos
1. Disparadores automaticos:
   - documento nuevo,
   - deadline cercano,
   - inconsistencia detectada,
   - cambio de estado clave.
2. Agentes por skill:
   - societario, contratos, laboral, IP, regulatorio, fiscal, litigios, PMO.
3. Salidas tipadas y validadas antes de llegar al usuario final.

### 5.2 Workspace por area con merges controlados
1. Trabajo aislado por area sin perder consistencia global.
2. Merge con aprobacion de lider de area.
3. Baselines por corte de comite/negociacion.

### 5.3 Cockpit de negociacion
1. Mapa de red flags -> reps/warranties -> cobertura -> owner.
2. Simulacion de impacto por contingencia.
3. Priorizacion de clausulas por materialidad y probabilidad.

### 5.4 UX adaptativa por perfil
1. Vista abogado ejecucion: tareas y evidencia.
2. Vista lider legal: riesgos, aprobaciones, decisiones.
3. Vista PMO: capacidad, SLAs, cuellos de botella.
4. Vista cliente: estado, bloqueos, acciones pendientes.

### 5.5 Knowledge layer reutilizable
1. Biblioteca de playbooks por sector y tipo de deal.
2. Reglas de consistencia reutilizables (BORME, OEPM, RCTIR segun permisos).
3. Memoria de decisiones para acelerar nuevos proyectos.

## 6) Human-in-the-loop (HITL) operativo
### 6.1 Gating por riesgo
1. Bajo impacto: autopromocion a digest PMO con muestreo.
2. Impacto medio: revision obligatoria de abogado de area.
3. Alto impacto: doble validacion (abogado + lider legal).

### 6.2 Bandeja unica de revision
1. Cola priorizada por severidad, deadline y confianza del modelo.
2. Acciones en un clic: aprobar, corregir, rechazar, pedir mas evidencia.
3. Feedback estructurado para mejorar skills y prompts.

### 6.3 Reglas de confianza
1. Umbral minimo de evidencia para proponer hallazgo.
2. Rechazo automatico de outputs sin fuente verificable.
3. Marcado obligatorio de "supuesto" cuando no haya prueba suficiente.

## 7) Recursos de adopcion para abogados
1. Onboarding guiado en producto (10-15 min) con caso real simulado.
2. Plantillas de trabajo por area (checklists, preguntas, formato de findings).
3. "Modo asistido" primeras 2 semanas con tips contextuales.
4. Playbook corto por rol:
   - que hago al iniciar dia,
   - como reviso IA,
   - como cierro bloqueos.
5. Red de champions (1 por area) para soporte funcional semanal.

## 8) KPI de adopcion y usabilidad (con metas)
1. Time to first value:
   - Meta incrementada: < 30 min.
   - Meta maxima: < 10 min.
2. Activacion semanal de abogados:
   - Meta incrementada: > 70%.
   - Meta maxima: > 85%.
3. Ratio de outputs IA aceptados tras revision:
   - Meta incrementada: > 60%.
   - Meta maxima: > 80%.
4. Tiempo medio de cierre de bloqueos:
   - Meta incrementada: -25% vs baseline.
   - Meta maxima: -50% vs baseline.
5. Frecuencia de acceso del cliente al portal:
   - Meta incrementada: 2+ sesiones/semana por proyecto.
   - Meta maxima: 4+ sesiones/semana por proyecto.

## 9) Backlog priorizado para ejecucion
### P0 (adopcion inmediata)
1. Activar tabs Tareas y Documentos con flujos minimos funcionales.
2. Implementar bandeja HITL de revision.
3. Timeline PMO con hitos y bloqueos.
4. Portal cliente minimo con permisos por item.
5. Evidencia estructurada en findings/contingencias.

### P1 (escala operacional)
1. Orquestador de agentes por eventos.
2. Catalogo de skills tipados por area y PMO.
3. Workspaces por area con merge controlado.
4. Observabilidad avanzada (latencia, calidad, fallback).
5. Digest inteligente multicanal (in-app + email).

### P2 (maxima diferenciacion)
1. Cockpit de negociacion con simulacion de impacto.
2. Recomendador de clausulas por perfil de riesgo.
3. Personalizacion de UX por firma/equipo.
4. Benchmark de desempeno por tipo de deal.
5. Motor de mejora continua basado en feedback HITL.

## 10) Criterios de aceptacion UX (obligatorios)
1. Un abogado nuevo completa primer flujo sin formacion externa en menos de 20 minutos.
2. Cada red flag visible tiene evidencia enlazada y estado de revision.
3. Cada bloqueo tiene owner, motivo y fecha comprometida.
4. El cliente ve solo lo autorizado y entiende la accion que se espera de el.
5. La caida temporal de IA no rompe UX: se muestra estado en cola y trazabilidad.

## 11) Implementacion en el producto actual (mapeo directo)
1. Reforzar `/projects/[id]` como cockpit operativo (Resumen + Tareas + Documentos + Q&A).
2. Convertir `/api/harvey` en puerta a ejecucion manual y automatica de skills.
3. Extender `dd_tasks` con revision HITL y enlazado a evidencia.
4. Introducir entidades de Documento/Evidencia/Ejecucion de Agente en fases.
5. Mantener consistencia con el PRD vigente y evolucionar sin ruptura de contrato.

