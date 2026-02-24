# DD Legal PMO — Estrategia de Gestión Documental v1.0
## VDR, Ingesta, Vectorización, Completitud, Clasificación, Extracción y Activación del Worker

**Fecha**: 24 febrero 2026
**Estado**: Análisis arquitectónico — Propuesta de mejoras
**Prerequisitos**: Fases A-E.2.5, WORKER_ARCHITECTURE_v1.md, LEGAL_CATALOG_SEED.sql, CA_INTEGRATION_REQUIREMENT.md
**Scope**: Pipeline documental completo de la plataforma DD Legal PMO — 7 áreas, 69 FOs, 12 n8n workflows

---

## 1. Resumen Ejecutivo

DD Legal PMO gestiona el ciclo de vida completo de los documentos de due diligence: desde su carga en el Virtual Data Room (VDR), pasando por la ingesta, vectorización y clasificación automática, hasta la extracción de hechos estructurados y la activación del Worker autónomo que evalúa los 69 Finding Objectives del catálogo legal.

Este documento analiza cada capa del pipeline, mapea el estado actual por cada una de las 7 áreas de revisión, identifica 23 gaps y propone mejoras organizadas en 3 horizontes de implementación.

**Ciclo de vida documental — Visión global:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE DOCUMENTAL DD LEGAL PMO — 7 ÁREAS                     │
│                                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐            │
│  │  UPLOAD   │─→│ INGEST   │─→│ VECTORIZE │─→│ CLASSIFY │─→│ EXTRACT │            │
│  │  (VDR)   │  │ (SHA-256)│  │ (pgvector)│  │(2-stage) │  │(Harvey) │            │
│  └──────────┘  └──────────┘  └───────────┘  └──────────┘  └─────────┘            │
│       │                                                          │                 │
│       │   ┌────────────────────────────────────────────────────┐ │                 │
│       │   │              DD WORKER LOOP                         │ │                 │
│       │   │  ┌──────┐  ┌─────────┐  ┌────────┐  ┌──────────┐ │ │                 │
│       │   │  │SENSE │─→│NORMALIZE│─→│EVALUATE│─→│ CONCLUDE │ │ │                 │
│       │   │  └──────┘  └─────────┘  └────────┘  └──────────┘ │ │                 │
│       │   └────────────────────────────────────────────────────┘ │                 │
│       │          ↑                        │                      │                 │
│       └─triggers─┘          findings ─────┘                      │                 │
│                                                                   │                 │
│  PERSISTENCE LAYER                                                │                 │
│  ├─ vdr_documents · vdr_chunks · vdr_ingestion_jobs              │                 │
│  ├─ dd_document_facts · dd_fo_document_status                    │                 │
│  ├─ dd_findings · dd_rule_executions · dd_evidence               │                 │
│  └─ dd_area_conclusions · dd_expected_documents                  │                 │
│                                                                                    │
│  ÁREAS: MERC(23 FOs) · CONT(10) · FISC(8) · LAB(8) · PI(6) · LIT(8) · ADM(6)   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Números clave del sistema:**

| Métrica | Valor |
|---------|-------|
| Áreas de revisión | 7 (MERC, CONT, FISC, LAB, PI, LIT, ADM) |
| Finding Objectives (FOs) | 69 (54 base + 15 CA) |
| Documentos esperados (seed) | 18 base + 9 CA = 27 tipos |
| Skills en catálogo | 28 FMC + 8 CA = 36 |
| Workflow templates | 6 MVP + 1 CA = 7 |
| n8n workflows | 12 |
| Patrones de clasificación | 30+ regex (7 áreas) |
| Campos de extracción | 6 grupos (parties, dates, amounts, clauses, obligations, classification) |

---

## 2. Mapa del Ecosistema Documental por Área

### 2.1 Estado de Madurez por Área

```
┌──────────┬────────────┬──────────────┬──────────┬────────────┬──────────────────┐
│   ÁREA   │   FOs      │ Docs Expect. │  Skills  │  Workflow  │  Classification  │
├──────────┼────────────┼──────────────┼──────────┼────────────┼──────────────────┤
│ MERC     │ 8+15(CA)=23│    4+9=13    │  0+8=8   │ societario │  3+8 patterns    │
│          │            │              │          │ +ctas_anuales               │
│ CONT     │    10      │      4       │    6     │ contratos  │  2 patterns      │
│ FISC     │     8      │      3       │    4     │ lab&fiscal │  2 patterns      │
│ LAB      │     8      │      4       │    6     │ lab&fiscal │  3 patterns      │
│ PI       │     6      │      2       │    0     │ ip_titul.  │  3 patterns      │
│ LIT      │     8      │      0       │    2     │  —NINGUNO  │  1 pattern       │
│ ADM      │     6      │      0       │    2     │  —NINGUNO  │  2 patterns      │
├──────────┼────────────┼──────────────┼──────────┼────────────┼──────────────────┤
│ TOTAL    │    69      │     27       │   36     │     7      │  ~30 patterns    │
│ Generals │     —      │      —       │    —     │ arranque+  │                  │
│          │            │              │          │ data_room  │                  │
└──────────┴────────────┴──────────────┴──────────┴────────────┴──────────────────┘
```

### 2.2 Análisis de Brechas por Área

**MERC (Societario + Cuentas Anuales)** — Área más madura tras integración CA.
- 23 FOs proporcionan la cobertura más exhaustiva de la plataforma
- Los 8 FOs societarios (escritura, órganos, poderes, cargas, pactos) están operativos
- Los 15 FOs CA (auditoría, patrimonio, distribución, memoria) pendientes de activación
- Gap principal: patrones de clasificación CA y schema de extracción CA no implementados
- Workflow `societario` operativo; `cuentas_anuales` diseñado pero no desplegado

**CONT (Contractual)** — Bien cubierto operativamente.
- 10 FOs: CoC, termination, exclusividad, garantías, subarrendamiento, cessión, seguros
- 6 skills + workflow `contratos_materiales` con HITL
- 4 doc types esperados: contratos financieros, mercantiles, pólizas, intragrupo
- Gap: sin extracción específica de campos contractuales complejos (drag-along, tag-along, earn-out)

**FISC (Fiscal)** — Cobertura funcional, compartiendo workflow con LAB.
- 8 FOs: declaraciones, inspecciones, precios transferencia, consolidación, provisiones, BINs
- 4 skills (situación fiscal, precios transferencia, contingencias, inspecciones)
- 3 doc types esperados (declaraciones, certificados corriente pago, documentación PT)
- Gap: el classifier detecta modelos fiscales españoles (200, 202, 303, 347, 390) pero no formatos internacionales

**LAB (Laboral)** — Buen nivel de cobertura.
- 8 FOs: plantilla, alta dirección, contingencias, litigios, prestaciones, convenios, SCOR, formación
- 6 skills (censo, contingencias, alta dirección, incentivos, litigios, convenio)
- 4 doc types esperados (cuadro plantilla, contratos alta dirección, convenio, litigios)
- Gap: sin patrones para ERE, ERTE, planes de igualdad

**PI (Propiedad Intelectual)** — Funcional pero sin skills dedicadas.
- 6 FOs: marcas, patentes, licencias in/out, conflictos, know-how
- 0 skills en dd_skills_catalog (depende de workflow `ip_titularidad` + Harvey directo)
- 2 doc types esperados (certificados marcas, licencias PI)
- Gap: sin extracción de campos específicos PI (números de registro, clases Niza, fecha de prioridad)

**LIT (Litigios)** — Sin workflow ni documentos esperados.
- 8 FOs: procedimientos, NIC 37, compliance, RGPD, medioambiente, sectorial, reguladores, subvenciones
- 2 skills (ficha_procedimientos, contingencias_litigiosas)
- 0 doc types esperados — **brecha significativa**
- Gap: sin workflow dedicado, sin expected_documents, evaluación FOs depende enteramente de extracción genérica

**ADM (Administrativo)** — Sin workflow ni documentos esperados.
- 6 FOs: licencias, contratos públicos, subvenciones, urbanismo, FDI screening, merger control
- 2 skills (licencias_autorizaciones, contingencias_regulatorias)
- 0 doc types esperados — **brecha significativa**
- Gap: mismo problema que LIT; no hay completeness tracking

---

## 3. Capa 1: Virtual Data Room (VDR) y Carga Documental

### 3.1 Esquema de Datos

El VDR se estructura en 6 tablas principales:

| Tabla | Función | Relaciones clave |
|-------|---------|------------------|
| `vdr_folders` | Estructura jerárquica de carpetas | self-ref `parent_id`, `project_id`, `area_code` |
| `vdr_documents` | Metadatos documentales + estado de embedding | FK `folder_id`, status enum (8 estados) |
| `vdr_document_versions` | Versionado de ficheros (storage_path, checksum) | FK `document_id`, unique (document_id, version_number) |
| `vdr_acl` | Control de acceso por rol/área/permiso | Scope: folder OR document |
| `vdr_links` | Enlaces compartibles con expiración | Token-based, download counting |
| `dd_documents_compat` | Vista legacy read-only | Backward compatibility |

**Ciclo de estados de un documento:**

```
draft → staged → uploaded → processing → indexed → [superseded | archived | error]
```

### 3.2 Rutas API (19 endpoints)

| Endpoint Group | Función |
|---------------|---------|
| `/api/vdr/documents` | CRUD de documentos |
| `/api/vdr/ingest` | Disparar ingesta |
| `/api/vdr/bulk` | Operaciones masivas (multi-doc) |
| `/api/vdr/folders` | Gestión de carpetas |
| `/api/vdr/search/semantic` | Búsqueda vectorial |
| `/api/vdr/gap-analysis` | Análisis de completitud |
| `/api/vdr/rag/query` | RAG endpoint |
| `/api/vdr/vault/sync` | Sincronización con VDR externos |

### 3.3 Almacenamiento

Supabase Storage para ficheros binarios. Cada versión incluye `checksum_sha256` para integridad y deduplicación.

### 3.4 Estructura de Carpetas

El VDR no tiene una estructura de carpetas por defecto seeded, pero `vdr_folders.area_code` permite organización por las 7 áreas. La estructura recomendada:

```
Proyecto/
├── 01 - Mercantil (MERC)/
│   ├── Escrituras y Estatutos/
│   ├── Libros de Actas/
│   └── Cuentas Anuales/         ← NUEVO (CA)
├── 02 - Contractual (CONT)/
│   ├── Contratos Financieros/
│   ├── Contratos Mercantiles/
│   └── Pólizas de Seguros/
├── 03 - Fiscal (FISC)/
│   ├── Declaraciones/
│   ├── Precios de Transferencia/
│   └── Certificados/
├── 04 - Laboral (LAB)/
│   ├── Plantilla/
│   ├── Alta Dirección/
│   └── Convenios y Litigios/
├── 05 - Propiedad Intelectual (PI)/
│   ├── Marcas y Patentes/
│   └── Licencias/
├── 06 - Litigios (LIT)/           ← SIN ESTRUCTURA DEFINIDA
│   ├── Procedimientos Activos/
│   ├── Resoluciones/
│   └── Compliance/
└── 07 - Administrativo (ADM)/      ← SIN ESTRUCTURA DEFINIDA
    ├── Licencias y Permisos/
    ├── Contratos Públicos/
    └── Subvenciones/
```

---

## 4. Capa 2: Ingesta y Deduplicación

### 4.1 Pipeline de Ingesta

```
startIngestion(documentId)
│
├─ 1. Crear vdr_ingestion_jobs (status: pending)
│
└─ processIngestion(jobId, documentId, versionId)
   │
   ├─ 2. Marcar job como 'processing'
   ├─ 3. Obtener metadatos (name, description, category, area_code)
   ├─ 4. Concatenar texto: description + version.change_notes
   │
   ├─ 5. CACHE LEVEL-1: SHA-256 content_hash
   │     └─ Si hash coincide + embedding_status='done' → SKIP
   │
   ├─ 6. Eliminar chunks existentes del documento
   ├─ 7. chunkText() → chunks (500 tokens target, 50 overlap)
   ├─ 8. generateEmbeddings() → vectores 1536-dim (OpenAI)
   ├─ 9. Batch INSERT en vdr_chunks
   ├─ 10. UPDATE vdr_documents: content_hash, embedding_status='done'
   │
   └─ 11. POST-INGESTION HOOK (si DD_WORKER activo)
         ├─ classifyDocument() → pattern-based (sin AI)
         ├─ Si confidence ≥ 0.7 → update area_code + metadata
         └─ Queue extractDocumentFacts() → Harvey AI
```

### 4.2 Sistema de Caché Multinivel

| Nivel | Mecanismo | Alcance | Ahorro estimado |
|-------|-----------|---------|-----------------|
| **Level-1** (Ingesta) | SHA-256 texto completo | Evita re-chunking + re-embedding | ~$0.02/doc |
| **Level-2** (Extracción) | SHA-256 en dd_document_facts | Evita re-extracción Harvey | ~$0.10-0.30/doc |
| **Level-3** (Evaluación) | content_hash_at_analysis en dd_fo_document_status | Evita re-evaluación de FOs | Variable |

**Invalidación:** El trigger `trigger_fo_reanalysis_on_doc_update` marca todos los FO-status del documento como `pending` cuando `content_hash` cambia.

### 4.3 Estrategias de Chunking

**Estrategia A: Section-Aware (`chunker.ts`)** — Usada actualmente.
- 500 tokens target, 50 tokens overlap
- Detección de secciones por regex
- Sliding window con buffer de párrafos

**Estrategia B: Document-Type Adaptive (`adaptive-chunking.ts`)** — Implementada pero NO integrada.
- Configuración por tipo: contrato (1500), acta (1000), escritura (2000), financiero (800), default (1200)
- Corte en límites de frase
- Fallback a whitespace

### 4.4 Pipeline n8n de Ingesta

El workflow `dd_ingest_pipeline.workflow.json` (229 líneas) replica y extiende el pipeline programático:

```
Webhook POST /dd-ingest-pipeline
  → Validate project_id + documents[]
    → Split into individual items
      → Compute SHA-256 hash
        → Check existing hash in DB
          → IF changed: update status → chunk → embed → store
          → IF unchanged: skip (cache hit)
```

---

## 5. Capa 3: Vectorización y Búsqueda

### 5.1 Modelo de Embeddings

| Parámetro | Valor |
|-----------|-------|
| Modelo | OpenAI `text-embedding-3-small` |
| Dimensiones | 1536 |
| Batch size | 100 chunks/llamada |
| Índice | HNSW (m=16, ef_construction=64) |
| Distancia | Coseno |
| Extensión | pgvector |

### 5.2 Tres Modalidades de Búsqueda

**Semántica Pura** (`semantic-search.ts`): query → embedding → `match_vdr_chunks` RPC → top-K coseno. Threshold 0.7, filtro por project_id + area_code.

**Híbrida BM25 + Vector** (`hybrid-search.ts`): ejecuta BM25 y vector en paralelo, fusiona con Reciprocal Rank Fusion (k=60, pesos configurables).

**Multi-Query** (`multi-query-retrieval.ts`): expansión de query → búsquedas paralelas → merge → dedupe → rank.

### 5.3 Evidence Linking

`POST /api/evidence/link-chunks` conecta findings con chunks:
- Modo explícito (chunk_ids) o semántico (finding_title, threshold 0.6)
- Persiste en `dd_kanban_tasks.evidence_refs` (JSONB)
- Audit trail en `dd_evidence`

---

## 6. Capa 4: Clasificación Documental

### 6.1 Arquitectura de Dos Fases

**Fase 1 — Pattern-Based (sin AI, latencia <50ms):**
- 30+ patrones regex por área con confidence 0.85-0.95
- Detección de jurisdicción (ES, UE, UK, US)
- Detección de idioma (ES, EN, DE, FR)

**Fase 2 — AI Fallback (Harvey, solo si confidence < 0.7):**
- Prompt estructurado → JSON: document_type, document_subtype, area_codes[], jurisdiction, language

### 6.2 Catálogo Completo de Patrones por Área

**MERC — Mercantil/Societario (3 patrones existentes + 8 CA propuestos)**

| Pattern | Tipo Detectado | Confidence | Estado |
|---------|---------------|------------|--------|
| `/acta\s+(de\s+)?(junta\|consejo\|reunión)/i` | acta_junta | 0.90 | Operativo |
| `/escritura\s+(de\s+)?constitución/i` | escritura_constitucion | 0.92 | Operativo |
| `/certificado\s+(del\s+)?registro\s+mercantil/i` | certificado_registro | 0.88 | Operativo |
| `/cuentas?\s*anuales/i` | cuentas_anuales | 0.92 | **PROPUESTO** |
| `/balance\s+(de\s+)?situaci[oó]n/i` | cuentas_anuales | 0.85 | **PROPUESTO** |
| `/cuenta\s+de\s+p[eé]rdidas\s+y\s+ganancias/i` | cuentas_anuales | 0.88 | **PROPUESTO** |
| `/memoria\s+(anual\|de\s+las?\s+cuentas)/i` | cuentas_anuales | 0.88 | **PROPUESTO** |
| `/informe\s+(de\s+)?(los?\s+)?auditor[eí]/i` | informe_auditoria | 0.90 | **PROPUESTO** |
| `/certificad[oa]\s+(de\s+)?dep[oó]sito/i` | certificado_rm | 0.88 | **PROPUESTO** |
| `/estado\s+de\s+informaci[oó]n\s+no\s+financiera\|EINF/i` | einf | 0.90 | **PROPUESTO** |
| `/pol[ií]tica\s+(de\s+)?retribuci[oó]n/i` | politica_retributiva | 0.85 | **PROPUESTO** |

**CONT — Contractual (2 patrones)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/contrato\s+(de\s+)?(suministro\|distribución\|servicios\|licencia\|arrendamiento)/i` | contrato_material | 0.90 |
| `/contrato\s+(de\s+)?(compraventa\|cesión\|traspaso)/i` | compraventa | 0.90 |
| `/(share\|asset)\s+purchase\s+agreement/i` | compraventa | 0.92 |
| `/master\s+(service\s+)?agreement/i` | contrato_material | 0.88 |

**FISC — Fiscal (2 patrones)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/informe\s+(de\s+)?(auditoría\|fiscal\|tributario)/i` | informe_fiscal | 0.88 |
| `/declaración\s+(de\s+)?(impuestos\|renta\|iva)/i` | declaracion_fiscal | 0.90 |
| `/modelo\s+(200\|202\|303\|347\|390)/i` | modelo_fiscal | 0.95 |

**LAB — Laboral (3 patrones)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/nómina\|payslip\|payroll/i` | nomina | 0.92 |
| `/convenio\s+colectivo/i` | convenio_colectivo | 0.90 |
| `/contrato\s+(de\s+)?trabajo/i` | contrato_trabajo | 0.88 |

**PI — Propiedad Intelectual (3 patrones)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/patente\|patent/i` | patente | 0.90 |
| `/marca\s+(registrada\|comercial)\|trademark/i` | marca | 0.90 |
| `/licencia\s+(de\s+)?(software\|uso\|explotación)/i` | licencia | 0.88 |

**LIT — Litigios (1 patrón)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/sentencia\|judgment\|ruling\|resolución\s+judicial\|demanda\|complaint/i` | resolucion_judicial | 0.88 |

**ADM — Administrativo (2 patrones)**

| Pattern | Tipo Detectado | Confidence |
|---------|---------------|------------|
| `/permiso\s+(de\s+)?(obra\|actividad\|ambiental)/i` | permiso_administrativo | 0.88 |
| `/póliza\s+(de\s+)?seguro\|insurance\s+policy/i` | poliza_seguro | 0.90 |

### 6.3 Análisis de Cobertura de Clasificación

```
Cobertura por área (patterns operativos / doc types en el catálogo FO):

MERC  ████████░░░░░░░░ 27%  (3/11 tipos) → 100% tras CA patterns
CONT  ██████████████░░ 80%  (4/5 tipos)
FISC  ██████████████░░ 75%  (3/4 tipos)
LAB   ████████████░░░░ 60%  (3/5 tipos)
PI    ██████████████░░ 75%  (3/4 tipos)
LIT   ████░░░░░░░░░░░░ 20%  (1/5 tipos)
ADM   ██████░░░░░░░░░░ 40%  (2/5 tipos)
```

**Patrones faltantes prioritarios (más allá de CA):**

| Área | Tipo Documental | Pattern Propuesto | Impacto |
|------|----------------|-------------------|---------|
| LIT | Demanda/querella | `/demanda\|querella\|denuncia\|auto\s+de\s+admisión/i` | 4 FOs (LIT-001 a 004) |
| LIT | Informe compliance | `/informe\s+(de\s+)?compliance\|programa\s+cumplimiento/i` | LIT-003, LIT-004 |
| LIT | Certificado antecedentes | `/certificado\s+(de\s+)?antecedentes\|compliance\s+certificate/i` | LIT-003 |
| ADM | Licencia actividad | `/licencia\s+(de\s+)?actividad\|licencia\s+ambiental/i` | ADM-001, ADM-004 |
| ADM | Subvención | `/subvenci[oó]n\|ayuda\s+p[uú]blica\|grant/i` | ADM-003 |
| ADM | Resolución FDI | `/resoluci[oó]n.*inversi[oó]n\s+extranjera\|FDI\s+screening/i` | ADM-005 |
| LAB | Plan de igualdad | `/plan\s+(de\s+)?igualdad\|protocolo\s+acoso/i` | LAB-007 |
| LAB | ERE/ERTE | `/ERE\|ERTE\|expediente\s+regulaci[oó]n/i` | LAB-003, LAB-004 |
| CONT | Earn-out/escrow | `/earn[\s-]?out\|escrow\|cuenta\s+retenida/i` | CONT-007, CONT-008 |

---

## 7. Capa 5: Extracción de Hechos (dd_document_facts)

### 7.1 Schema Universal de Extracción

El `fact-extractor.ts` (565 líneas) utiliza Harvey AI para extraer 6 grupos de datos de cualquier documento:

| Grupo | Campos | Aplicabilidad |
|-------|--------|---------------|
| **Classification** | document_type, document_subtype, area_codes[], jurisdiction, language | Todos |
| **Parties** | name, role, is_target, is_counterparty, normalized_id | CONT, MERC, LAB |
| **Key Dates** | effective_date, expiration_date, signing_date, key_dates[] | Todos |
| **Amounts** | type (contract_value/penalty/cap/salary/fee), amount, currency | CONT, FISC, LAB |
| **Clauses** | 13 tipos: coc, non_compete, termination, indemnity, warranty, ip_assignment, confidentiality, exclusivity, mfn, liquidated_damages, force_majeure, governing_law, arbitration | CONT, MERC |
| **Obligations** | type, description, party, deadline, consequence | Todos |

### 7.2 Extensiones de Extracción Necesarias por Área

El schema actual está orientado a contratos (parties, clauses, obligations). Cada área requiere extensiones específicas en `dd_document_facts.metadata`:

**MERC/CA — Cuentas Anuales (NO IMPLEMENTADO)**

```json
{
  "annual_accounts": {
    "dates": { "fecha_formulacion", "fecha_aprobacion", "fecha_deposito", "ejercicio" },
    "equity": { "patrimonio_neto", "capital_social", "reserva_legal", "reservas_indisponibles", "resultado_ejercicio" },
    "audit": { "tipo_opinion", "KAM_count", "going_concern", "enfasis_count" },
    "distribution": { "dividendos_aprobados", "dividendos_a_cuenta", "aplicacion_resultado" },
    "related_parties": { "operaciones_vinculadas[]", "saldos_vinculadas" },
    "contingencies": { "garantias_otorgadas", "litigios_revelados[]", "compromisos_fuera_balance" },
    "treasury_shares": { "existencia", "importe" },
    "post_closing": { "hechos_posteriores[]" }
  }
}
```

**FISC — Fiscal (PARCIALMENTE CUBIERTO)**

```json
{
  "fiscal": {
    "modelo": "string (200, 202, 303...)",
    "ejercicio": "string",
    "resultado_fiscal": "number",
    "bases_imponibles_negativas": "number",
    "creditos_fiscales": "number",
    "provisiones_fiscales": "number",
    "precios_transferencia": { "existe_documentacion": "boolean", "entidades_vinculadas[]" },
    "inspecciones": { "abiertas[]", "actas_firmadas[]", "recursos_pendientes[]" }
  }
}
```

**LAB — Laboral (NO IMPLEMENTADO)**

```json
{
  "laboral": {
    "plantilla": { "total", "fijos", "temporales", "directivos" },
    "convenio": { "vigente", "fecha_vencimiento", "ultraactividad" },
    "litigios": [{ "tipo", "demandante", "cuantia", "estado", "provision" }],
    "alta_direccion": [{ "nombre", "cargo", "blindaje", "non_compete_meses" }],
    "ERE_ERTE": { "vigente", "tipo", "afectados", "fecha_fin" }
  }
}
```

**PI — Propiedad Intelectual (NO IMPLEMENTADO)**

```json
{
  "pi": {
    "registros": [{ "tipo", "numero_registro", "clases_niza[]", "territorio", "fecha_concesion", "fecha_renovacion", "titular" }],
    "licencias": [{ "tipo", "licenciante", "licenciatario", "exclusiva", "territorio", "royalty", "duracion" }],
    "conflictos": [{ "tipo", "contraparte", "estado", "riesgo" }]
  }
}
```

**LIT — Litigios (NO IMPLEMENTADO)**

```json
{
  "litigios": {
    "procedimientos": [{
      "juzgado", "numero_autos", "tipo_procedimiento",
      "demandante", "demandado", "cuantia",
      "estado_procesal", "fecha_proxima_actuacion",
      "provision_NIC37": { "probable", "importe_estimado" }
    }],
    "compliance": { "programa_existe", "canal_denuncias", "ultima_revision" }
  }
}
```

**ADM — Administrativo (NO IMPLEMENTADO)**

```json
{
  "administrativo": {
    "licencias": [{ "tipo", "autoridad", "numero", "fecha_concesion", "fecha_vencimiento", "condiciones_especiales" }],
    "subvenciones": [{ "organismo", "importe", "estado", "obligaciones_pendientes" }],
    "contratos_publicos": [{ "licitador", "importe", "plazo", "penalizaciones" }]
  }
}
```

### 7.3 Estrategia de Implementación para Extensiones

**Patrón recomendado: Conditional Prompt Extension**

```typescript
// En fact-extractor.ts — después de clasificar el documento
const basePrompt = buildBaseExtractionPrompt(document);
const areaExtensions = getAreaExtensions(classification.area_codes, classification.type);
const fullPrompt = basePrompt + areaExtensions;

function getAreaExtensions(areas: string[], docType: string): string {
  const extensions: string[] = [];
  if (areas.includes('MERC') && isCADocType(docType)) extensions.push(CA_EXTRACTION_PROMPT);
  if (areas.includes('FISC')) extensions.push(FISCAL_EXTRACTION_PROMPT);
  if (areas.includes('LAB')) extensions.push(LABORAL_EXTRACTION_PROMPT);
  if (areas.includes('PI')) extensions.push(PI_EXTRACTION_PROMPT);
  if (areas.includes('LIT')) extensions.push(LIT_EXTRACTION_PROMPT);
  if (areas.includes('ADM')) extensions.push(ADM_EXTRACTION_PROMPT);
  return extensions.join('\n');
}
```

Los datos extendidos se almacenan en `dd_document_facts.metadata` como campos JSONB específicos por área, evitando cambios de schema hasta que se estabilice el modelo.

---

## 8. Capa 6: Completitud Documental (dd_expected_documents)

### 8.1 Catálogo Actual de Documentos Esperados

La tabla `dd_expected_documents` tiene 18 entradas seeded para 5 de las 7 áreas:

**MERC (4 documentos base)**

| category | name | is_mandatory |
|----------|------|-------------|
| escrituras | Escritura de constitución | Sí |
| escrituras | Estatutos vigentes | Sí |
| registro | Nota simple actualizada | Sí |
| titularidad | Certificado de titularidad real | Sí |

**CONT (4 documentos)**

| category | name | is_mandatory |
|----------|------|-------------|
| financieros | Contratos financieros (pólizas crédito, préstamos) | Sí |
| mercantiles | Contratos mercantiles principales | Sí |
| seguros | Pólizas de seguros vigentes | Sí |
| intragrupo | Contratos intragrupo | Sí |

**FISC (3 documentos)**

| category | name | is_mandatory |
|----------|------|-------------|
| declaraciones | Declaraciones fiscales últimos 4 ejercicios | Sí |
| certificados | Certificados corriente de pago (AEAT, SS) | Sí |
| precios | Documentación de precios de transferencia | Sí |

**LAB (4 documentos)**

| category | name | is_mandatory |
|----------|------|-------------|
| plantilla | Cuadro de plantilla actualizado | Sí |
| directivos | Contratos de alta dirección | Sí |
| convenios | Convenio colectivo aplicable | Sí |
| litigios | Relación de litigios laborales pendientes | Sí |

**PI (2 documentos)**

| category | name | is_mandatory |
|----------|------|-------------|
| registros | Certificados de marcas y patentes | Sí |
| licencias | Licencias de PI inbound/outbound | Sí |

**LIT (0 documentos)** — Sin entries

**ADM (0 documentos)** — Sin entries

### 8.2 Documentos Esperados Propuestos — Ampliación Global

Para alcanzar completitud en las 7 áreas + la subcategoría CA, se necesitan 22 nuevas entradas:

**MERC/CA — Cuentas Anuales (9 nuevos)**

| category | name | is_mandatory | review_depth |
|----------|------|-------------|-------------|
| cuentas | Cuentas anuales completas (balance, PyG, memoria) | Sí | standard |
| auditoria | Informe de auditoría | Sí | standard |
| actas | Actas JGA con aprobación de cuentas | Sí | standard |
| registro | Notas simples Registro Mercantil | Sí | standard |
| vinculadas | Contratos con partes vinculadas | No | deep |
| garantias | Pólizas y garantías otorgadas | No | deep |
| escrituras | Escrituras públicas relevantes | No | deep |
| esg | EINF / Informe ESG | No | deep |
| retributiva | Políticas retributivas | No | deep |

**LIT — Litigios (5 nuevos)**

| category | name | is_mandatory | review_depth |
|----------|------|-------------|-------------|
| procedimientos | Relación de procedimientos judiciales pendientes | Sí | standard |
| provisiones | Cuadro de contingencias y provisiones (NIC 37) | Sí | standard |
| compliance | Informe de compliance / Canal de denuncias | No | standard |
| rgpd | Documentación RGPD y protección de datos | No | deep |
| medioambiente | Informes de pasivos medioambientales | No | deep |

**ADM — Administrativo (5 nuevos)**

| category | name | is_mandatory | review_depth |
|----------|------|-------------|-------------|
| licencias | Licencias y autorizaciones administrativas | Sí | standard |
| urbanismo | Documentación urbanística | Sí | standard |
| subvenciones | Expedientes de subvenciones recibidas | No | deep |
| contratos_publicos | Contratos con Administraciones Públicas | No | deep |
| fdi | Documentación FDI screening / merger control | No | deep |

**Extensiones para áreas existentes (3 nuevos)**

| Área | category | name | is_mandatory | review_depth |
|------|----------|------|-------------|-------------|
| LAB | igualdad | Plan de igualdad y protocolo de acoso | No | deep |
| FISC | inspecciones | Actas de inspección y recursos | No | deep |
| CONT | earn_out | Acuerdos de earn-out / escrow | No | deep |

### 8.3 Gap Analysis: Lógica de Completitud

`GET /api/vdr/gap-analysis?project_id=...`

1. Obtener `review_depth` del proyecto (standard/enhanced/deep)
2. Consultar `dd_expected_documents` filtrado por review_depth
3. Consultar `vdr_documents` (excluye archived/error)
4. Matching por `area_code:category`
5. Resultado:

```json
{
  "stats": {
    "total_expected": 40,
    "total_uploaded": 28,
    "gaps_count": 12,
    "coverage_pct": 70.0
  },
  "by_area": {
    "MERC": { "expected": 13, "uploaded": 8, "coverage": 61.5 },
    "CONT": { "expected": 5, "uploaded": 5, "coverage": 100.0 },
    "FISC": { "expected": 4, "uploaded": 3, "coverage": 75.0 },
    "LAB":  { "expected": 5, "uploaded": 4, "coverage": 80.0 },
    "PI":   { "expected": 2, "uploaded": 2, "coverage": 100.0 },
    "LIT":  { "expected": 5, "uploaded": 3, "coverage": 60.0 },
    "ADM":  { "expected": 5, "uploaded": 3, "coverage": 60.0 }
  },
  "gaps": [...]
}
```

### 8.4 FO Blocking por Documentos Faltantes

Cuando un FO no puede evaluarse porque faltan documentos requeridos, el sistema debería:

1. Marcar `dd_fo_document_status.status = 'blocked'` (nuevo estado propuesto)
2. Registrar `blocked_reason = 'missing_required_documents'`
3. Listar los `doc_type_keys` faltantes
4. Excluir del work_queue del Worker hasta que se resuelva
5. Incluir en el gap-analysis report como "FOs bloqueados por documentación"

**Mapping FO → Document Requirements (global):**

Cada FO define sus documentos requeridos en `dd_finding_objectives.data_required`:

```json
{
  "doc_types": ["escritura_constitucion", "nota_simple"],
  "sample": "últimos 3 ejercicios",
  "extractions": ["parties", "dates", "clauses"]
}
```

El Worker SENSE debería cruzar `data_required.doc_types` con `vdr_documents` clasificados para determinar evaluabilidad.

---

## 9. Capa 7: Worker — Activación y Ciclos de Revisión

### 9.1 Arquitectura del Worker

```
┌───────────────────────────────────────────────────────────────────────┐
│                        WORKER STATE MACHINE                           │
│                                                                       │
│  idle ──→ SENSE ──→ NORMALIZE ──→ EVALUATE ──→ CONCLUDE ──→ idle    │
│    │         │          │            │            │           │       │
│    └─ paused ┘          └── error ───┘            └── completed      │
│                                                                       │
│  Presupuesto AI por ciclo: 15 llamadas Harvey (configurable)         │
│  Docs por ciclo: 20 (configurable)                                   │
│  Coverage threshold: 80% (configurable)                              │
│  Modos: continuous | targeted | full_sweep | on_demand               │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.2 SENSE — Detección de Cambios y Priorización

**Work Queue Priority Score:**
- Peso severidad: critical(40), high(30), medium(20), low(10), informational(5)
- Gap de cobertura: (1 - coverage/100) × 30
- Antigüedad documento: min(días × 2, 20)
- Bonus documento nuevo: +10
- Score capped a 100, sorted descending

**Cobertura por área:** El SENSE calcula `coverage_snapshot` que alimenta el dashboard y determina si el Worker ha convergido.

### 9.3 NORMALIZE — Clasificación + Extracción

Para cada documento en el work queue:
1. `classifyDocument()` → pattern-based (cost: $0)
2. `extractDocumentFacts()` → Harvey AI con cache Level-2 (cost: ~$0.15/doc)
3. `createPendingFOStatuses()` → N×M entries en dd_fo_document_status

### 9.4 EVALUATE — Evaluación por Waves

1. `resolveEvaluationOrder()` → topological sort de dependencias → waves
2. Tipos de evaluación: threshold_calculation, compliance_check, document_review, jurisdiction_mapping
3. Respeta AI budget; para si se agota
4. Persiste findings en `dd_findings` + audit trail

**Waves por área:**

| Área | Wave 0 (independientes) | Wave 1+ (dependientes) |
|------|------------------------|------------------------|
| MERC (base) | MERC-001 a 008 | Sin dependencias internas |
| MERC (CA) | CA-002,006,009,010,011,012 | Wave 2: CA-001,003,004,007,008,013 → Wave 3: CA-005,014,PatNeto-002 |
| CONT | CONT-001 a 004 | CONT-005 a 010 (dependen de cláusulas extraídas) |
| FISC | FISC-001 a 003 | FISC-004 a 008 (dependen de datos fiscales base) |
| LAB | LAB-001 a 004 | LAB-005 a 008 |
| PI | PI-001 a 003 | PI-004 a 006 (dependen de titularidad) |
| LIT | LIT-001 a 004 | LIT-005 a 008 |
| ADM | ADM-001 a 003 | ADM-004 a 006 |

### 9.5 CONCLUDE — Síntesis por Área

Para cada área con findings:
1. Risk score: critical×25 + high×15 + medium×8 + low×3 + dealBreakers×20
2. Patrones: multiple_blocking, concentrated_deal_breakers, high_economic_exposure
3. Recomendaciones: mitigation, negotiation, condition_precedent, indemnity
4. Narrativa Harvey AI o template fallback → `dd_area_conclusions`

**Las 7 áreas generan conclusiones independientes.** MERC integra findings de societario (8 FOs) + CA (15 FOs) en una única área conclusion.

### 9.6 Triggers Automáticos

| Trigger | Evento | Acción |
|---------|--------|--------|
| `trigger_fo_reanalysis_on_doc_update` | UPDATE vdr_documents.content_hash | Marca FO-status como 'pending' |
| `trigger_fo_docs_on_new_objective` | INSERT dd_finding_objectives (active) | Crea status pending para todos los docs |
| `trigger_fo_status_on_new_document` | INSERT vdr_documents | Crea status pending para todos los FOs |

---

## 10. Capa 8: Workflows, Skills y n8n

### 10.1 Catálogo de Workflow Templates (7)

| Template | Áreas | Fases | HITL |
|----------|-------|-------|------|
| `arranque_dd` | General | Kickoff, data request, initial review | No |
| `data_room_gap` | General | Gap analysis, document classification | No |
| `societario` | MERC | BORME, estructura, red flags | No |
| `contratos_materiales` | CONT | CoC, cláusulas, HITL review | Sí |
| `ip_titularidad` | PI | Registry, risk analysis | No |
| `laboral_fiscal` | LAB, FISC | Contingencias, HITL review | Sí |
| `cuentas_anuales` | MERC(CA) | 5 fases: obtención → análisis → HITL | Sí |

**Áreas sin workflow dedicado:** LIT, ADM — usan evaluación directa via Worker sin orquestación de fases.

### 10.2 Catálogo de Skills (36)

| Área | Skills | Ejemplos |
|------|--------|----------|
| CONT | 6 | extraccion_clausulas, analisis_riesgo, ficha_financiero, ficha_garantias, acuerdos_intragrupo, ficha_seguros |
| LAB | 6 | censo_plantilla, contingencias_laborales, alta_direccion, incentivos_pensiones, litigios_laborales, convenio_colectivo |
| FISC | 4 | situacion_fiscal, precios_transferencia, contingencias_fiscales, inspecciones_actas |
| MERC/CA | 8 | ca.extraccion_cuentas, ca.analisis_auditoria, ca.patrimonio_neto, ca.aplicacion_resultado, ca.partes_vinculadas, ca.contingencias_memoria, ca.compliance_revelaciones, ca.medidas_reequilibrio |
| INM | 4 | ficha_inmuebles, arrendamientos, licencias_urbanisticas, contingencias_inmobiliarias |
| LIT | 2 | ficha_procedimientos, contingencias_litigiosas |
| ADM | 2 | licencias_autorizaciones, contingencias_regulatorias |
| MA | 2 | autorizaciones_ambientales, contingencias_ambientales |
| DATOS | 2 | cumplimiento_rgpd, compliance_penal |

Cada skill incluye: `prompt_template`, `expected_output_schema` (JSONB), `evidence_requirements`, `agent_pipeline` {paranoico, validador, sanitizer}.

### 10.3 n8n Workflows (12)

| Workflow | Líneas | Función |
|----------|--------|---------|
| `dd_ingest_pipeline` | 229 | Ingesta: hash → chunk → embed → store |
| `dd_skill_executor` | 99 | Ejecución de skills Harvey |
| `dd_harvey_adapter` | 29 | Adaptador genérico Harvey API |
| `dd_agent_paranoico` | 48 | Validación de citas y fuentes |
| `dd_agent_sanitizer` | 48 | Eliminación PII, normalización |
| `dd_agent_validador` | 48 | Validación contra JSON Schema |
| `dd_report_generate` | 125 | Generación de informes multi-template |
| `dd_report_orchestrator` | 125 | Orquestación de secciones de informe |
| `dd_report_render` | 33 | Rendering final (PDF/DOCX) |
| `dd_societario_report` | 98 | Informe específico societario |
| `dd_tool_ip_report` | 86 | Informe específico PI |
| `dd_tool_generic` | 86 | Ejecutor genérico de herramientas |

### 10.4 Pipeline de Calidad: Triple Validación

```
Skill Output → Paranoico (citations, sources) → Validador (JSON Schema) → Sanitizer (PII, format)
```

Este pipeline se aplica a todos los outputs de Harvey AI, asegurando trazabilidad de evidencia, conformidad de schema y limpieza de datos sensibles.

---

## 11. Inventario Completo de Gaps

### 11.1 Tabla Consolidada (23 gaps)

| # | Capa | Gap | Severidad | Esfuerzo | Áreas afectadas |
|---|------|-----|-----------|----------|-----------------|
| **VDR** |
| G-01 | VDR | Sin validación tipos fichero | MEDIUM | S | Todas |
| G-02 | VDR | Sin límite tamaño documento | MEDIUM | S | Todas |
| G-03 | VDR | Sin sync bidireccional VDR externo | HIGH | L | Todas |
| G-04 | VDR | Sin notificación push de nuevos docs | HIGH | M | Todas |
| G-05 | VDR | Sin estructura de carpetas por defecto seeded | LOW | S | Todas |
| **Ingesta** |
| G-06 | Ingesta | Sin escalado horizontal | HIGH | L | Todas |
| G-07 | Ingesta | Sin retry embeddings fallidos | HIGH | M | Todas |
| G-08 | Ingesta | Adaptive chunking no integrado en pipeline | MEDIUM | S | Todas |
| G-09 | Ingesta | Sin extracción de texto de PDFs | CRITICAL | L | Todas |
| **Búsqueda** |
| G-10 | Búsqueda | BM25 no integrado en API routes | MEDIUM | S | Todas |
| G-11 | Búsqueda | Evidence threshold hardcoded (0.6) | MEDIUM | S | Todas |
| G-12 | Búsqueda | Sin re-indexación programada | LOW | M | Todas |
| **Clasificación** |
| G-13 | Clasificación | Sin patrones CA (8 tipos) | HIGH | M | MERC |
| G-14 | Clasificación | Patrones insuficientes en LIT (4 tipos faltan) | HIGH | M | LIT |
| G-15 | Clasificación | Patrones insuficientes en ADM (3 tipos faltan) | MEDIUM | M | ADM |
| G-16 | Clasificación | Sin patrones para ERE/ERTE, plan igualdad | MEDIUM | S | LAB |
| **Extracción** |
| G-17 | Extracción | Sin schema CA en fact extractor | CRITICAL | L | MERC/CA |
| G-18 | Extracción | Sin extensiones de extracción para LIT, ADM, PI, LAB | HIGH | L | LIT, ADM, PI, LAB |
| G-19 | Extracción | Sin validación completitud facts vs FO.data_required | HIGH | M | Todas |
| **Completitud** |
| G-20 | Completitud | LIT y ADM sin dd_expected_documents | HIGH | S | LIT, ADM |
| G-21 | Completitud | Sin estado 'blocked' en dd_fo_document_status | MEDIUM | M | Todas |
| **Worker** |
| G-22 | Worker | Sin trigger automático SENSE post-ingesta | CRITICAL | M | Todas |
| G-23 | Worker | Sin queue system externo (BullMQ/Redis) | HIGH | L | Todas |

### 11.2 Distribución por Severidad

- **CRITICAL (3):** G-09, G-17, G-22 — bloquean operación del pipeline
- **HIGH (9):** G-03, G-04, G-06, G-07, G-13, G-14, G-18, G-19, G-20, G-23 — degradan significativamente
- **MEDIUM (8):** G-01, G-02, G-08, G-10, G-11, G-15, G-16, G-21 — mejoras deseables
- **LOW (2):** G-05, G-12 — optimización futura

---

## 12. Plan de Mejoras: 3 Horizontes

### 12.1 Horizonte 1 — Activación Completa (4 semanas)

Objetivo: Todas las áreas con documentos esperados, clasificación funcional y Worker activado automáticamente.

| Acción | Gap | Componente | Entregable |
|--------|-----|------------|------------|
| **H1.1** Patrones CA al classifier | G-13 | document-classifier.ts | 8 nuevos patterns MERC/CA |
| **H1.2** Patrones LIT al classifier | G-14 | document-classifier.ts | 4 nuevos patterns LIT |
| **H1.3** Schema extracción CA | G-17 | fact-extractor.ts | Prompt condicional CA |
| **H1.4** Seed expected_documents LIT + ADM | G-20 | Migración SQL | 10 rows (5 LIT + 5 ADM) |
| **H1.5** Seed expected_documents CA | — | Migración SQL | 9 rows MERC/CA |
| **H1.6** Aplicar CA_CATALOG_SEED.sql | — | Migración SQL | 15 FOs activos |
| **H1.7** Trigger automático SENSE | G-22 | n8n + worker-controller | Cron 2 min o pg_notify → SENSE |
| **H1.8** Integrar adaptive chunking | G-08 | ingest.ts | Routing por document_type detectado |
| **H1.9** Patrones ADM + LAB extra | G-15, G-16 | document-classifier.ts | 6 nuevos patterns |
| **H1.10** Seed carpetas por defecto | G-05 | Migración SQL | 7 carpetas base por proyecto |

**Resultado H1:** Las 7 áreas con documentos esperados, clasificación pattern-based, y el Worker ejecutándose automáticamente tras cada ingesta. 69 FOs evaluables.

### 12.2 Horizonte 2 — Robustez y Profundidad (1-2 meses)

| Acción | Gap | Entregable |
|--------|-----|------------|
| **H2.1** PDF text extraction | G-09 | Integración pdf-parse/pdfjs-dist pre-chunking |
| **H2.2** Extensiones extracción LIT/ADM/PI/LAB | G-18 | 5 prompts condicionales por área |
| **H2.3** Retry embeddings con backoff | G-07 | 3 retries exponential (1s, 4s, 16s) |
| **H2.4** Validación completitud facts | G-19 | Cruce FO.data_required vs dd_document_facts |
| **H2.5** Queue system (BullMQ) | G-23 | Cola para ingesta + extracción + evaluación |
| **H2.6** Push notifications VDR | G-04 | Supabase Realtime / webhook post-ingesta |
| **H2.7** Dashboard Worker | — | UI: cobertura, queue depth, budget, errores |
| **H2.8** BM25 en API routes | G-10 | GET /api/vdr/search/fulltext |
| **H2.9** Threshold evidence configurable | G-11 | Por área/FO desde evaluation_criteria |
| **H2.10** Estado 'blocked' en fo_status | G-21 | Nuevo status + lógica de blocking por docs faltantes |

### 12.3 Horizonte 3 — Escala y Optimización (3-6 meses)

| Acción | Gap | Entregable |
|--------|-----|------------|
| **H3.1** Escalado horizontal ingesta | G-06 | Workers paralelos BullMQ |
| **H3.2** Sync bidireccional VDR | G-03 | Polling + webhooks VDR externo |
| **H3.3** Validación tipos fichero + límites | G-01, G-02 | Whitelist MIME, max file size |
| **H3.4** Re-indexación programada | G-12 | Job periódico re-vectorización |
| **H3.5** Workflows dedicados LIT y ADM | — | Templates con fases específicas |

---

## 13. Métricas y Observabilidad

### 13.1 KPIs del Pipeline

| KPI | Fórmula | Target | Scope |
|-----|---------|--------|-------|
| **Ingestion Latency** | avg(completed_at - created_at) de ingestion_jobs | < 30s/doc | Global |
| **Classification Fast-Path Rate** | % docs con confidence ≥ 0.7 sin AI | > 85% | Por área |
| **Extraction Cache Hit Rate** | % extractDocumentFacts con cached=true | > 40% ciclo 2+ | Global |
| **FO Coverage** | % fo_document_status = 'analyzed' | > 80% a 24h | Por área |
| **Gap Closure Rate** | % expected_documents satisfechos | > 90% pre-eval | Por área |
| **AI Budget Efficiency** | findings / AI calls | > 0.3 | Por ciclo |
| **HITL Turnaround** | avg(hitl_decided_at - created_at) | < 48h | Por workflow |
| **Worker Convergence** | Ciclos hasta overall_coverage > 80% | < 5 ciclos | Por proyecto |

### 13.2 Alertas

| Alerta | Condición | Acción |
|--------|-----------|--------|
| `ingestion_stuck` | Job 'processing' > 5 min | Retry / escalado |
| `worker_stalled` | heartbeat > 10 min | Restart Worker |
| `coverage_regression` | coverage baja > 5% entre ciclos | Investigar |
| `ai_budget_exhausted` | budget agotado sin convergencia | Incrementar / priorizar |
| `critical_fo_unresolved` | FOs critical sin evaluar > 24h | Notificar CLO |
| `area_zero_docs` | Área con 0 documentos uploaded > 48h | Notificar PM |
| `high_fallback_rate` | > 30% docs usando AI classification fallback | Añadir patrones |

---

## 14. Cross-References

| Documento | Relación |
|-----------|----------|
| `WORKER_ARCHITECTURE_v1.md` | Define las 4 fases del Worker; este doc analiza su implementación y gaps |
| `CA_INTEGRATION_REQUIREMENT.md` | Define 15 FOs CA; este doc traza cómo fluyen por el pipeline global |
| `CA_SKILLS_WORKFLOWS.md` | Define skills y workflows CA; este doc contextualiza dentro del ecosistema completo |
| `CA_CATALOG_SEED.sql` | 15 INSERTs CA; pendiente de aplicación (H1.6) |
| `LEGAL_CATALOG_SEED.sql` | 54 FOs originales; ya aplicados |
| `IMPLEMENTATION_PROMPT_FASE_E.md` | Guía Fase E; este doc propone extensiones para Fase F |

---

## 15. Conclusión

El pipeline documental de DD Legal PMO tiene una arquitectura sólida de 8 capas (VDR → Ingesta → Vectorización → Clasificación → Extracción → Completitud → Worker → Workflows/Skills) que soporta las 7 áreas de due diligence. Sin embargo, el nivel de madurez varía significativamente entre áreas:

**Áreas maduras (cobertura > 75%):** CONT, FISC, LAB — con skills, workflows y documentos esperados operativos.

**Áreas en desarrollo (50-75%):** MERC (societario operativo; CA diseñado pero no desplegado), PI (workflow pero sin skills dedicadas).

**Áreas con brechas significativas (< 50%):** LIT y ADM — sin workflows dedicados, sin documentos esperados, con clasificación mínima.

Los 3 gaps críticos que afectan a **toda** la plataforma son:
1. **G-09**: Extracción de texto de PDFs (sin esto, los documentos reales no entran al pipeline)
2. **G-17**: Schema de extracción CA (bloquea el módulo de 15 FOs más complejo)
3. **G-22**: Trigger automático del Worker SENSE (sin esto, el ciclo de revisión no arranca)

El Horizonte 1 (4 semanas) lleva las 7 áreas a operatividad completa con 69 FOs evaluables. Los Horizontes 2 y 3 añaden robustez, profundidad de extracción por área, y escalabilidad del pipeline.

**El objetivo final:** un Worker autónomo que, dado un proyecto de DD, detecte automáticamente cada documento cargado, lo clasifique, extraiga hechos relevantes para su área, evalúe los 69 FOs aplicables, y genere conclusiones negociables por área — todo ello con trazabilidad completa y control humano-en-el-loop donde la complejidad lo requiera.
