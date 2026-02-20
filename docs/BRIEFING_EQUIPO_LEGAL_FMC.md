# Briefing Equipo Legal — Skills Pendientes FMC
**DD Legal PMO × Harvey AI**
**Fecha: Febrero 2026**

---

## Contexto

El Excel "Due Diligence FMC (Feb 2026)" define **64 workflows** en **11 areas** que necesitamos automatizar con Harvey AI. Cada workflow necesita un **skill** — una instruccion estructurada que le dice a Harvey que hacer.

**Estado actual:**
- 4 skills operativos (Societario BORME + Marcas OEPM)
- 26 skills pendientes de definicion por el equipo legal
- Arquitectura lista: 31 report templates, agent pipeline, evidence pack, grounding validation

**Objetivo:** Que cada area legal complete las fichas de los skills que le corresponden para poder activarlos en produccion.

---

## Como Funciona el Flujo Skill → Harvey

```
1. Usuario lanza herramienta en DD Legal PMO
2. El sistema carga el skill (prompt + schema + fuentes)
3. El sistema construye un Evidence Pack con fuentes indexadas [SRC-001]...[SRC-NNN]
4. Se envia TODO a Harvey AI via n8n:
   - System prompt: rol del abogado + reglas de citacion
   - User prompt: evidence pack + instrucciones del skill
   - Schema esperado: campos obligatorios del resultado
5. Harvey responde
6. 3 agentes validan automaticamente:
   - PARANOICO: verifica que las citas [SRC-XXX] existen
   - VALIDADOR: verifica que el resultado cumple el schema
   - SANITIZER: elimina PII, normaliza fechas
7. Resultado validado se muestra al equipo
```

**IMPORTANTE**: Harvey recibe TODA la informacion via prompt. No tiene acceso a documentos por si solo. El prompt debe ser AUTOCONTENIDO — todo lo que Harvey necesita saber debe estar en el prompt.

---

## Modelo de Referencia: Skill Operativo

**`societario.consulta_borme`** — Ya funciona en produccion:

**Prompt (version operativa):**
```
Eres un asistente legal especializado en derecho societario espanol.
Debes construir un perfil societario a partir de anuncios oficiales
recuperados del BORME y otros documentos societarios aportados.

Tu salida debe cumplir estrictamente el esquema "perfil_societario".
No inventes datos. Cita evidencia minima suficiente para cada campo
con referencia a publicacion y pagina o seccion. Si hay discrepancias
entre fuentes, marcalas como "no_comprobable" y adjunta ambas evidencias.

Objetivo: [sociedad_target] — Identificador fiscal: [nif_cif]
Periodo: ultimos [periodo] anios.

Tarea: Construye el perfil_societario con los campos:
* denominacion_social_completa
* nif_cif
* domicilio_social
* objeto_social
* capital_social (importe y moneda)
* organo_administracion_vigente
* administradores_y_cargos[]
* apoderamientos_relevantes[]
* modificaciones_estatutarias_recientes[]
* incidencias_relevantes[]

Incluye "evidencias[]" con doc_id, uri, page_range o seccion, snippet
y hash cuando este disponible. Senala "no_comprobable" si las fuentes
difieren o no existe dato publico reciente.
```

**Fuentes:** BORME (obligatoria), Escrituras (opcional)
**Agentes:** paranoico + validador + sanitizer

---

## Skills Pendientes por Area

A continuacion se lista CADA skill que necesita definicion, con el **workflow FMC** que cubre, el **responsable** del FMC, y lo que falta.

---

### AREA: CONT — Contratos Mercantiles
**Responsable FMC:** Felipe Martinez-Caballero / Sofia Rubiales
**Workflows FMC cubiertos:** #3, #4, #6, #7, #9, #10, #11, #12, #13

#### Skill 1: `contratos.extraccion_clausulas`
- **Nombre:** Extraccion de Clausulas Clave
- **Categoria:** extraccion
- **Workflow FMC:** #12 (Fichas contratos mercantiles), #5 parcial
- **Que debe hacer Harvey:** Recibir un contrato mercantil y extraer en formato de ficha: partes, objeto, duracion, contraprestacion, clausula de cambio de control, vencimiento anticipado, exclusividades, garantias, penalidades, jurisdiccion, contingencias, recomendacion
- **Prompt FMC de referencia:** "Actua como abogado mercantilista experto en M&A. Revisa el siguiente contrato de [tipo] y extrae: (1) partes; (2) objeto; (3) duracion y renovacion; (4) precio; (5) cambio de control; (6) vencimiento anticipado; (7) exclusividades; (8) garantias; (9) penalidades; (10) jurisdiccion; (11) contingencias; (12) recomendacion"
- **Fuentes:** Contrato (document, obligatorio)
- **Output esperado:** Ficha de contrato con 12 campos
- **Prioridad FMC:** Media (workflow #12), Alta (workflows #3, #4)

**QUE NECESITAMOS DEL EQUIPO LEGAL:**
1. ¿El prompt FMC de referencia es suficiente o hay que ajustarlo?
2. ¿Hay campos adicionales especificos para contratos financieros (#3) vs mercantiles (#12)?
3. ¿Los campos de la ficha Garrigues son exactamente estos 12 o hay mas?
4. ¿Que errores comunes comete Harvey con contratos?

#### Skill 2: `contratos.analisis_riesgo_contractual`
- **Nombre:** Analisis de Riesgo Contractual / Contingencias
- **Categoria:** analisis
- **Workflow FMC:** #4 (Contingencias contractuales)
- **Que debe hacer Harvey:** Analizar contratos revisados e identificar contingencias: exposicion por cambio de control, penalizaciones excesivas, exclusividades problematicas, vencimientos proximos
- **Fuentes:** Resultado de extraccion_clausulas (api_response), Contratos originales (document)
- **Prioridad FMC:** Alta

**QUE NECESITAMOS:**
1. ¿Cual es el modelo de contingencia Garrigues? (campos de la ficha red flag)
2. ¿Criterios de clasificacion: red flag / yellow flag / informativo?
3. ¿Como se cuantifica la exposicion economica?

#### Skill 3: `contratos.ficha_financiero`
- **Nombre:** Ficha Contrato Financiero (Prestamo/Credito)
- **Categoria:** extraccion
- **Workflow FMC:** #3 (Ficha contrato financiero)
- **Que debe hacer Harvey:** Extraer ficha especifica de contrato de prestamo/credito: principal, tipo interes, vencimiento, garantias, covenants, ratios financieros, eventos de incumplimiento, clausulas MAC
- **Fuentes:** Contrato financiero (document, obligatorio)
- **Prioridad FMC:** Alta

**QUE NECESITAMOS:**
1. Modelo exacto de ficha de contrato financiero Garrigues
2. ¿Campos especificos que diferencian prestamo vs credito vs linea?

#### Skill 4: `contratos.ficha_garantias`
- **Nombre:** Ficha Garantias (Reales/Personales)
- **Categoria:** extraccion
- **Workflow FMC:** #6 (Contragarantia), #7 (Garantias)
- **Fuentes:** Contrato de garantia (document)
- **Prioridad FMC:** Baja

#### Skill 5: `contratos.acuerdos_intragrupo`
- **Nombre:** Ficha Acuerdos Intragrupo
- **Categoria:** extraccion
- **Workflow FMC:** #9
- **Fuentes:** Contratos intragrupo (document)
- **Prioridad FMC:** Media

#### Skill 6: `contratos.ficha_seguros`
- **Nombre:** Ficha de Seguros
- **Categoria:** extraccion
- **Workflow FMC:** #13
- **Fuentes:** Polizas de seguros (document)
- **Prioridad FMC:** Media

---

### AREA: LAB — Laboral y Seguridad Social
**Responsable FMC:** Carlos Nacenta / Laura Garcia
**Workflows FMC cubiertos:** #14, #19, #20, #21, #22, #23, #24, #25

#### Skill 7: `laboral.censo_plantilla`
- **Nombre:** Censo y Estructura de Plantilla
- **Categoria:** extraccion
- **Workflow FMC:** #19 (Cuadro plantilla)
- **Que debe hacer Harvey:** Extraer cuadro resumen: numero empleados por categoria, antiguedad media, coste salarial, tipos de contrato, distribuciones
- **Prompt FMC referencia:** "Genera cuadro resumen de plantilla con numero de empleados por categoria, antiguedad media, y coste salarial"
- **Fuentes:** Documentacion laboral (document), nominas (document)
- **Prioridad FMC:** No definida (pero Review Table)

#### Skill 8: `laboral.contingencias_laborales`
- **Nombre:** Contingencias Laborales
- **Categoria:** analisis
- **Workflow FMC:** #14 (Prioridad: Siempre)
- **Fuentes:** Documentacion laboral, litigios, convenios
- **Prioridad FMC:** SIEMPRE (maxima)

#### Skill 9: `laboral.alta_direccion`
- **Nombre:** Contratos Alta Direccion
- **Categoria:** extraccion
- **Workflow FMC:** #21
- **Que debe hacer Harvey:** Extraer condiciones esenciales: retribucion fija/variable, blindajes, no-competencia, golden parachute, stock options
- **Fuentes:** Contratos alta direccion (document)

#### Skill 10: `laboral.incentivos_pensiones`
- **Nombre:** Planes de Incentivos y Compromisos
- **Categoria:** extraccion
- **Workflow FMC:** #22 (stock options), #23 (pensiones)
- **Fuentes:** Planes de incentivos, compromisos de pensiones (document)

#### Skill 11: `laboral.litigios_laborales`
- **Nombre:** Litigios Laborales
- **Categoria:** extraccion
- **Workflow FMC:** #24
- **Fuentes:** Documentacion procesal laboral (document)

#### Skill 12: `laboral.convenio_colectivo`
- **Nombre:** Resumen Convenio Colectivo
- **Categoria:** extraccion
- **Workflow FMC:** #25
- **Fuentes:** Convenio colectivo aplicable (document)

---

### AREA: FISC — Fiscal
**Responsable FMC:** Javier Alvarez / Nicolas Cremades / Ines Blanch
**Workflows FMC cubiertos:** #26, #27, #28, #29, #30, #31

#### Skill 13: `fiscal.situacion_fiscal`
- **Workflow FMC:** #26 (Cuadro resumen fiscal)
- **Prompt FMC referencia:** "Genera cuadro resumen de situacion fiscal: (1) impuestos y ejercicios; (2) inspecciones; (3) creditos y BINs; (4) contingencias; (5) certificados; (6) recomendaciones"
- **Prioridad:** Confirmar con Fiscal

#### Skill 14: `fiscal.precios_transferencia`
- **Workflow FMC:** #27

#### Skill 15: `fiscal.contingencias_fiscales`
- **Workflow FMC:** #28

#### Skill 16: `fiscal.inspecciones_actas`
- **Workflow FMC:** #29

---

### AREA: INM — Inmobiliario
**Responsable FMC:** Blanca Jimenez / Alejandro Mariscal
**Workflows FMC cubiertos:** #15, #16, #17, #18

#### Skill 17: `inmobiliario.ficha_inmuebles`
- **Workflow FMC:** #15 (Review Table, modelo pendiente)

#### Skill 18: `inmobiliario.arrendamientos`
- **Workflow FMC:** #16

#### Skill 19: `inmobiliario.licencias_urbanisticas`
- **Workflow FMC:** #17

#### Skill 20: `inmobiliario.contingencias_inmobiliarias`
- **Workflow FMC:** #18

---

### AREA: PI — Propiedad Industrial (complementar)
**Responsable FMC:** Cristina Mesa / Angela Lopez Valcarcer
**Workflows FMC cubiertos:** #32-#39

Skills existentes (ya operativos): `marcas.consulta_oepm`, `marcas.analisis_riesgo_pi`

#### Skill 21: `pi.ficha_patentes`
- **Workflow FMC:** #36 (Patentes/modelos utilidad)

#### Skill 22: `pi.nombres_dominio`
- **Workflow FMC:** #33

#### Skill 23: `pi.licencias_ip`
- **Workflow FMC:** #32

---

### AREA: LIT — Litigios y Procedimientos
**Responsable FMC:** Antonio Fabregat / Maria de Heras
**Workflows FMC cubiertos:** #40, #41

#### Skill 24: `litigios.ficha_procedimientos`
- **Workflow FMC:** #40
- **Prompt FMC referencia:** "Genera cuadro de procedimientos: (1) tipo; (2) organo y autos; (3) partes; (4) materia; (5) cuantia; (6) estado; (7) riesgo (probable/posible/remoto); (8) provision; (9) recomendacion"

#### Skill 25: `litigios.contingencias_litigiosas`
- **Workflow FMC:** #41

---

### AREA: ADMIN — Regulatorio
**Responsable FMC:** Rocio Jodra / Alvaro Cuesta
**Workflows FMC cubiertos:** #42-#45

#### Skill 26: `regulatorio.licencias_autorizaciones`
- **Workflow FMC:** #42

#### Skill 27: `regulatorio.contingencias`
- **Workflow FMC:** #45

---

### AREA: MA — Medioambiental
**Responsable FMC:** Rocio Jodra / Alvaro Cuesta
**Workflows FMC cubiertos:** #46-#49

#### Skill 28: `medioambiental.autorizaciones`
- **Workflow FMC:** #46

#### Skill 29: `medioambiental.contingencias`
- **Workflow FMC:** #49

---

### AREA: DATOS — Proteccion de Datos y Compliance
**Responsable FMC:** Katiana Otero / Ignacio Suarez
**Workflows FMC cubiertos:** #50-#54

#### Skill 30: `datos.cumplimiento_rgpd`
- **Workflow FMC:** #50, #51, #52

#### Skill 31: `datos.compliance_penal`
- **Workflow FMC:** #53

#### Skill 32: `datos.contingencias_datos`
- **Workflow FMC:** #54

---

### AREA: GENERAL — Transversal
**No requiere input del equipo legal** — estos skills se generan automaticamente consolidando resultados de las areas.

- `general.red_flags_report` (FMC #55-#58)
- `general.reps_warranties` (FMC #61)
- `general.matriz_riesgos` (FMC #59)
- `general.recomendaciones_spa` (FMC #60, #62, #63, #64)

---

## Ficha de Skill — QUE DEBE COMPLETAR CADA AREA

Para cada skill listado arriba, el abogado responsable debe completar:

```
============================================================
FICHA DE SKILL — [skill_key]
============================================================

1. PROMPT PARA HARVEY
   Escriba las instrucciones EXACTAS que Harvey debe seguir.
   Use [sociedad_target], [nif_cif], [sector] como placeholders.
   Sea lo mas especifico posible — Harvey solo sabe lo que le diga el prompt.

   Prompt:
   ________________________________________________________


2. CAMPOS DEL RESULTADO
   Liste los campos que Harvey debe devolver:

   Campo                    | Tipo              | Obligatorio
   -------------------------|-------------------|------------
   ________________________ | texto/lista/obj   | Si/No
   ________________________ | _________________ | ________


3. FUENTES QUE HARVEY DEBE USAR
   ¿Que documentos/registros son la fuente de verdad?

   Fuente               | Obligatoria
   ---------------------|------------
   ________________________ | Si/No


4. ERRORES COMUNES
   ¿Que errores tipicos comete Harvey en esta area?
   ________________________________________________________


5. MODELO DE REFERENCIA
   ¿Hay una ficha/modelo Garrigues existente que debamos seguir?
   [ ] Si → Adjuntar o describir
   [ ] No


6. PRIORIDAD
   [ ] Critica  [ ] Alta  [ ] Media  [ ] Baja

============================================================
Completado por: _________________ Fecha: ___________
============================================================
```

---

## Calendario Propuesto

| Semana | Accion | Responsable |
|--------|--------|-------------|
| S1 | Distribuir briefing a responsables FMC | PMO |
| S1-S2 | Cada area completa fichas de sus skills | Equipo legal |
| S2 | Equipo tecnico convierte fichas en skills operativos | Tech |
| S3 | Testing con datos reales | Legal + Tech |
| S3 | Activacion en produccion | Tech |

**Prioridad de areas:**
1. **CONT + LAB** (workflows Alta prioridad en FMC, mayor volumen)
2. **FISC + INM** (confirmar con departamentos)
3. **LIT + ADMIN + MA + DATOS** (completar cobertura)
4. **GENERAL** (transversales, se generan solos)

---

## Contacto

Para dudas sobre como completar la ficha: equipo tecnico PMO
Cada ficha completada se convierte en skill operativo en **1-2 semanas**.
