# Plan de Generacion de Skills — DD Legal PMO
**Documento para revision del equipo legal**
**Fecha: Febrero 2025** (actualizado Febrero 2026)

> **NOTA:** Este documento describe la arquitectura general de skills.
> Para el briefing especifico con los workflows FMC mapeados a skills
> y las fichas que debe completar cada area legal, ver:
> **[BRIEFING_EQUIPO_LEGAL_FMC.md](./BRIEFING_EQUIPO_LEGAL_FMC.md)**

---

## 1. Que es un Skill en DD Legal PMO

Un **skill** es una instruccion estructurada que le dice a la IA (Harvey AI) exactamente que hacer, que buscar, como presentar los resultados y que evidencia respalda cada hallazgo.

Cada skill tiene 6 componentes:

| Componente | Que es | Ejemplo |
|---|---|---|
| **area_code** | Area de DD a la que pertenece | `MERC`, `LAB`, `FISC`, `PI` |
| **category** | Tipo de tarea que realiza | `verificacion`, `analisis`, `extraccion`, `generacion`, `monitorizacion` |
| **prompt_template** | Instrucciones detalladas para la IA | Ver seccion 3 |
| **expected_output_schema** | Estructura exacta del resultado esperado | JSON Schema con campos obligatorios |
| **evidence_requirements** | Fuentes que debe consultar y citar | BORME, OEPM, escrituras, contratos |
| **agent_pipeline** | Agentes que validan el resultado | `paranoico` + `validador` + `sanitizer` |

---

## 2. Skills Existentes (4 activos)

Ya estan operativos y sirven como modelo de referencia:

| Skill | Area | Categoria | Que hace |
|---|---|---|---|
| `societario.consulta_borme` | MERC | verificacion | Construye perfil societario completo desde BORME |
| `societario.analisis_organos` | MERC | analisis | Analiza composicion de organos sociales, detecta conflictos |
| `marcas.consulta_oepm` | PI | verificacion | Busca marcas en OEPM, genera matriz completa |
| `marcas.analisis_riesgo_pi` | PI | analisis | Evalua cobertura PI, detecta gaps, conflictos y caducidades |

---

## 3. Skills Pendientes de Generacion

### 3.1 Por Area de DD

A continuacion se listan los skills necesarios para cada area. El equipo legal responsable de cada area debe completar la **Ficha de Skill** (seccion 4) para cada uno.

---

### CONT — Contratos Mercantiles

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 1 | `contratos.extraccion_clausulas` | Extraccion de Clausulas Clave | extraccion | Extrae clausulas de cambio de control, no-competencia, penalizaciones, vencimiento, renovacion automatica, jurisdiccion |
| 2 | `contratos.analisis_riesgo_contractual` | Analisis de Riesgo Contractual | analisis | Evalua exposicion por contratos con clausulas de cambio de control, penalizaciones excesivas, exclusividades |
| 3 | `contratos.verificacion_vigencia` | Verificacion de Vigencia | verificacion | Verifica estado actual de contratos (vigente, vencido, renovado), detecta contratos sin firma o con firmas incompletas |
| 4 | `contratos.mapa_contrapartes` | Mapa de Contrapartes | analisis | Identifica concentracion de riesgo por contraparte, dependencia de clientes/proveedores clave |

### LAB — Laboral y Seguridad Social

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 5 | `laboral.censo_plantilla` | Censo y Estructura de Plantilla | extraccion | Extrae datos de plantilla: numero empleados, categorias, antiguedad, tipos de contrato, convenio aplicable |
| 6 | `laboral.analisis_contingencias_lab` | Analisis de Contingencias Laborales | analisis | Detecta riesgos: despidos improcedentes pendientes, reclamaciones, incumplimientos de convenio, horas extra no compensadas |
| 7 | `laboral.revision_alta_direccion` | Revision Contratos Alta Direccion | extraccion | Extrae clausulas clave de contratos de alta direccion: blindajes, no-competencia, retribucion variable, golden parachutes |
| 8 | `laboral.planes_retribucion` | Planes de Retribucion y Beneficios | extraccion | Cataloga planes de pensiones, stock options, bonus, seguros, beneficios sociales y su impacto financiero |

### FISC — Fiscal

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 9 | `fiscal.analisis_posicion_fiscal` | Analisis de Posicion Fiscal | analisis | Evalua situacion fiscal: ejercicios abiertos, actas de inspeccion, criterios discutibles, bases imponibles negativas |
| 10 | `fiscal.revision_iva_retenciones` | Revision IVA y Retenciones | verificacion | Verifica cumplimiento de obligaciones periodicas: IVA, retenciones IRPF, pagos fraccionados IS |
| 11 | `fiscal.operaciones_vinculadas` | Operaciones Vinculadas | analisis | Analiza precios de transferencia, documentacion de operaciones vinculadas, cumplimiento arm's length |
| 12 | `fiscal.contingencias_fiscales` | Mapa de Contingencias Fiscales | analisis | Cuantifica exposicion fiscal: ajustes probables, provisiones necesarias, riesgo de inspeccion |

### INM — Inmobiliario

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 13 | `inmobiliario.titularidad_cargas` | Verificacion Titularidad y Cargas | verificacion | Consulta Registro de la Propiedad: titularidad, cargas, hipotecas, servidumbres, anotaciones preventivas |
| 14 | `inmobiliario.situacion_urbanistica` | Situacion Urbanistica | verificacion | Verifica calificacion urbanistica, licencias de actividad, certificados de habitabilidad, ITE |
| 15 | `inmobiliario.arrendamientos` | Analisis de Arrendamientos | extraccion | Extrae condiciones de contratos de arrendamiento: renta, duracion, clausulas de actualizacion, subarriendo, obras |

### LIT — Litigios y Procedimientos

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 16 | `litigios.inventario_procedimientos` | Inventario de Procedimientos | extraccion | Cataloga todos los procedimientos judiciales y arbitrales: jurisdiccion, estado procesal, cuantia, probabilidad de exito |
| 17 | `litigios.analisis_riesgo_procesal` | Analisis de Riesgo Procesal | analisis | Evalua probabilidad y cuantia de cada procedimiento, genera provision recomendada segun NIC 37 |
| 18 | `litigios.revision_arbitrajes` | Revision de Arbitrajes | extraccion | Analiza clausulas arbitrales en contratos, procedimientos arbitrales en curso, laudos previos |

### ADMIN — Regulatorio y Licencias

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 19 | `regulatorio.mapa_licencias` | Mapa de Licencias y Autorizaciones | verificacion | Inventaria todas las licencias, permisos y autorizaciones: estado, vigencia, condiciones, autoridad competente |
| 20 | `regulatorio.analisis_concentraciones` | Analisis Control de Concentraciones | analisis | Evalua si la operacion requiere notificacion a CNMC/CE, calcula umbrales, identifica posibles remedies |
| 21 | `regulatorio.cumplimiento_sectorial` | Cumplimiento Sectorial | verificacion | Verifica cumplimiento normativo especifico del sector: banca, energia, telecomunicaciones, sanidad, etc. |

### MA — Medioambiental

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 22 | `medioambiental.riesgos_contaminacion` | Riesgos de Contaminacion | analisis | Evalua riesgo de suelos contaminados, vertidos, emisiones. Revisa AAI, estudios ambientales, sanciones |
| 23 | `medioambiental.licencias_ambientales` | Licencias Ambientales | verificacion | Verifica autorizaciones ambientales integradas, evaluaciones de impacto, planes de gestion de residuos |

### DATOS — Proteccion de Datos y Compliance

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 24 | `datos.evaluacion_rgpd` | Evaluacion RGPD | analisis | Evalua cumplimiento RGPD: registro de actividades, base legal, DPO, transferencias internacionales, brechas notificadas |
| 25 | `datos.programa_compliance` | Programa de Compliance Penal | analisis | Revisa modelo de prevencion penal (art. 31 bis CP): mapa de riesgos, canal de denuncia, formacion, organo de cumplimiento |
| 26 | `datos.revision_politicas` | Revision de Politicas | verificacion | Verifica existencia y adecuacion de politicas: privacidad, cookies, seguridad de la informacion, uso aceptable |

### GENERAL — Transversal

| # | Skill Key | Nombre | Categoria | Descripcion |
|---|---|---|---|---|
| 27 | `general.generacion_red_flags` | Generacion Informe Red Flags | generacion | Genera informe ejecutivo de alertas criticas consolidando hallazgos de todas las areas |
| 28 | `general.generacion_reps_warranties` | Generacion de R&W | generacion | Genera borrador de declaraciones y garantias basado en hallazgos del DD por area |
| 29 | `general.digest_ejecutivo` | Digest Ejecutivo PMO | generacion | Genera resumen ejecutivo del estado del proyecto: progreso, contingencias criticas, proximos hitos |
| 30 | `general.monitorizacion_cambios` | Monitorizacion de Cambios Registrales | monitorizacion | Monitoriza cambios en registros publicos (BORME, RM, OEPM) durante el periodo del DD |

---

## 4. Ficha de Skill — Plantilla para el Equipo Legal

**Para cada skill, el abogado responsable del area debe completar esta ficha:**

```
============================================================
FICHA DE SKILL — DD Legal PMO
============================================================

1. IDENTIFICACION
   - Skill Key: [area].[nombre_corto]     (ej: laboral.censo_plantilla)
   - Nombre completo:                      (ej: Censo y Estructura de Plantilla)
   - Area: [codigo]                        (ej: LAB)
   - Categoria: [una de las siguientes]
     [ ] verificacion  — Comprobacion contra registros/fuentes oficiales
     [ ] analisis      — Evaluacion de riesgos, gaps, conflictos
     [ ] extraccion    — Extraccion estructurada de datos de documentos
     [ ] generacion    — Creacion de documentos/informes
     [ ] monitorizacion — Vigilancia continua de cambios

2. INSTRUCCIONES PARA LA IA (prompt_template)
   Escriba las instrucciones detalladas que la IA debe seguir.

   Reglas para redactar el prompt:
   - Use placeholders entre corchetes: [sociedad_target], [nif_cif], [periodo]
   - Sea especifico: liste EXACTAMENTE que campos debe extraer
   - Indique que hacer cuando no hay dato: "marca como no_comprobable"
   - Indique que NO debe hacer: "no extrapoles", "no inventes datos"
   - Si hay normativa aplicable, citela (LSC, LEC, RGPD, etc.)
   - Indique el nivel de detalle esperado

   Prompt:
   ________________________________________________________
   ________________________________________________________
   ________________________________________________________
   ________________________________________________________

3. ESTRUCTURA DEL RESULTADO ESPERADO
   Liste los campos que debe devolver la IA y su tipo:

   Campo                    | Tipo              | Obligatorio | Descripcion
   -------------------------|-------------------|-------------|--------------------
   ej: denominacion_social  | texto             | Si          | Nombre completo
   ej: administradores      | lista de objetos  | Si          | Nombre, cargo, fecha
   ej: contingencias        | lista de objetos  | No          | Descripcion, severidad
   ________________________ | _________________ | __________ | ____________________
   ________________________ | _________________ | __________ | ____________________
   ________________________ | _________________ | __________ | ____________________
   ________________________ | _________________ | __________ | ____________________
   ________________________ | _________________ | __________ | ____________________
   ________________________ | _________________ | __________ | ____________________

4. FUENTES Y EVIDENCIA
   Que fuentes DEBE consultar la IA y cuales son opcionales:

   Fuente               | Tipo                    | Obligatoria
   ---------------------|-------------------------|------------
   ej: BORME            | registry_scrape         | Si
   ej: Escrituras       | document                | No
   ej: Resultado OEPM   | api_response            | Si
   ____________________ | _______________________ | ___________
   ____________________ | _______________________ | ___________
   ____________________ | _______________________ | ___________

   Tipos disponibles: registry_scrape, document, api_response, manual_entry

5. VALIDACION
   - Que errores comunes debe detectar el validador?
     ________________________________________________________
   - Que datos son especialmente sensibles o propensos a error?
     ________________________________________________________
   - Requiere revision humana obligatoria (HITL)? [ ] Si  [ ] No

6. PRIORIDAD
   [ ] Critica — Necesario para el cierre del DD
   [ ] Alta    — Importante para la calidad del informe
   [ ] Media   — Valor anadido, no bloqueante
   [ ] Baja    — Nice to have, para fases futuras

7. DEPENDENCIAS
   - Este skill necesita el resultado de otro skill previo?
     Si: _______________________ (ej: marcas.consulta_oepm)
     No: [ ]
   - Este skill alimenta a otro skill posterior?
     Si: _______________________ (ej: general.generacion_red_flags)
     No: [ ]

============================================================
Completado por: _________________________ Fecha: ___________
Area: ___________________________________
============================================================
```

---

## 5. Categorias de Skills — Guia de Referencia

| Categoria | Icono | Cuando usarla | Ejemplo |
|---|---|---|---|
| **verificacion** | Comprobacion | La IA consulta un registro o fuente oficial y confirma/desmiente datos | Consultar BORME para verificar domicilio social |
| **analisis** | Evaluacion | La IA evalua informacion ya obtenida, detecta riesgos, gaps o conflictos | Analizar organos sociales y detectar conflictos de interes |
| **extraccion** | Extraccion | La IA extrae datos estructurados de documentos no estructurados | Extraer clausulas de cambio de control de 50 contratos |
| **generacion** | Produccion | La IA genera un documento nuevo basado en datos del DD | Generar borrador de Reps & Warranties |
| **monitorizacion** | Vigilancia | La IA revisa periodicamente fuentes en busca de cambios | Monitorizar BORME durante el periodo del DD |

---

## 6. Pipeline de Agentes — Que Pasa con el Resultado

Cada skill pasa por 3 agentes antes de mostrar el resultado al equipo:

```
[Skill ejecutado] --> [Agente Paranoico] --> [Agente Validador] --> [Agente Sanitizer] --> [Resultado final]
```

| Agente | Funcion | Que verifica |
|---|---|---|
| **paranoico** | Busca problemas | Datos sin evidencia, contradicciones, fuentes dudosas, alucinaciones |
| **validador** | Valida estructura | El resultado cumple el schema esperado, campos obligatorios completos |
| **sanitizer** | Limpia y formatea | Elimina PII innecesaria, normaliza fechas, formato consistente |

**No es necesario que el equipo legal defina los agentes** — se configuran automaticamente. Solo deben describir que errores son mas comunes en su area (seccion 5 de la ficha).

---

## 7. Cronograma Propuesto

| Fase | Periodo | Areas | Skills |
|---|---|---|---|
| **Fase A** (ya completada) | Feb 2025 | MERC, PI | 4 skills operativos |
| **Fase B** | Mar 2025 | CONT, LAB | 8 skills (#1-#8) |
| **Fase C** | Abr 2025 | FISC, INM | 7 skills (#9-#15) |
| **Fase D** | May 2025 | LIT, ADMIN | 6 skills (#16-#21) |
| **Fase E** | Jun 2025 | MA, DATOS | 5 skills (#22-#26) |
| **Fase F** | Jul 2025 | GENERAL | 4 skills (#27-#30) |

**Prioridad sugerida para Fase B:** Contratos Mercantiles y Laboral son las areas con mayor volumen de trabajo manual en un DD tipico. Automatizar la extraccion de clausulas y el censo de plantilla genera el mayor ROI inmediato.

---

## 8. Proceso de Trabajo

```
1. El equipo legal completa la FICHA DE SKILL (seccion 4)
       |
2. El equipo tecnico convierte la ficha en:
   - prompt_template (texto del abogado, formateado)
   - expected_output_schema (JSON Schema)
   - evidence_requirements (array de fuentes)
       |
3. Se configura el workflow en n8n (webhook + agentes)
       |
4. Se inserta el skill en dd_skills_catalog (base de datos)
       |
5. El skill aparece en Configuracion > Gestion de Skills
       |
6. Se ejecuta con datos de prueba y se valida con el abogado
       |
7. Se activa en produccion (toggle ON)
```

---

## 9. Ejemplo Completo — Skill ya Operativo

**Skill:** `societario.consulta_borme`
**Area:** MERC (Mercantil / Societaria)
**Categoria:** verificacion

**Prompt (resumido):**
> "Eres un asistente legal especializado en derecho societario espanol. Construye un perfil societario desde BORME para [sociedad_target]. Devuelve: denominacion, NIF, domicilio, objeto social, capital social, organo de administracion, administradores, apoderamientos, modificaciones, incidencias. Cita evidencia para cada campo. Si hay discrepancias, marca como no_comprobable."

**Campos del resultado:**
- `denominacion_social` (texto, obligatorio)
- `nif_cif` (texto, obligatorio)
- `domicilio_social` (texto, obligatorio)
- `objeto_social` (texto, obligatorio)
- `capital_social` (objeto: importe + moneda)
- `administradores` (lista: nombre, cargo, fecha nombramiento)
- `apoderamientos` (lista: nombre, tipo, alcance)
- `modificaciones_recientes` (lista: tipo, fecha, referencia BORME)
- `incidencias` (lista)
- `evidencias` (lista: doc_id, uri, snippet, page_range)

**Fuentes:**
- BORME (registry_scrape) — Obligatoria

---

## 10. Contacto y Dudas

Para dudas sobre como completar la ficha, contactar al equipo tecnico.
Cada ficha completada se convertira en un skill operativo en un plazo de 1-2 semanas.

**Objetivo final:** 30 skills activos cubriendo todas las areas del Due Diligence, permitiendo automatizar el 70% del trabajo repetitivo de extraccion y verificacion.
