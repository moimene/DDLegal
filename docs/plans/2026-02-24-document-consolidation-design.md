# Document Consolidation Design — Full 7 Areas

**Date:** 2026-02-24
**Status:** Approved
**Approach:** Sequential Migrations (Enfoque A)
**Scope:** Full 7 areas including CA integration, LIT/ADM completeness

---

## 1. Overview

Consolidación completa del gestor documental de DD Legal PMO para:
- Integrar los 15 FOs de Cuentas Anuales (CA)
- Completar LIT y ADM con documentos esperados
- Expandir patrones de clasificación a ~85% cobertura
- Añadir schemas de extracción por área

**Resultado:** 69 FOs evaluables, 40 documentos esperados, 7/7 áreas con gap analysis completo.

---

## 2. Migration Sequence

| # | Migration | Content | Dependencies |
|---|-----------|---------|--------------|
| 1 | `202602280023_seed_ca_fos.sql` | 15 CA Finding Objectives | None |
| 2 | `202602280024_seed_ca_skills.sql` | 8 CA skills in dd_skills_catalog | M1 |
| 3 | `202602280025_seed_ca_workflow.sql` | 1 workflow template + 5 phases | M2 |
| 4 | `202602280026_seed_ca_tool.sql` | 1 microtool "cuentas-anuales" | M3 |
| 5 | `202602280027_update_fo_skill_mapping.sql` | Link 15 FOs → skills | M2 |
| 6 | `202602280028_seed_expected_docs_lit_adm.sql` | 10 expected docs (5 LIT + 5 ADM) | None |
| 7 | `202602280029_seed_expected_docs_ca.sql` | 9 CA expected docs | None |
| 8 | `202602280030_seed_expected_docs_extras.sql` | 3 extras (LAB, FISC, CONT) | None |

**Total:** 8 migrations, ~150 new rows

---

## 3. Classification Patterns

### 3.1 MERC/CA (8 new patterns)

| Pattern | Type | Confidence |
|---------|------|------------|
| `/cuentas?\s*anuales/i` | cuentas_anuales | 0.92 |
| `/balance\s+(de\s+)?situaci[oó]n/i` | cuentas_anuales | 0.85 |
| `/cuenta\s+de\s+p[eé]rdidas\s+y\s+ganancias/i` | cuentas_anuales | 0.88 |
| `/memoria\s+(anual\|de\s+las?\s+cuentas)/i` | cuentas_anuales | 0.88 |
| `/informe\s+(de\s+)?(los?\s+)?auditor[eí]/i` | informe_auditoria | 0.90 |
| `/certificad[oa]\s+(de\s+)?dep[oó]sito/i` | certificado_rm | 0.88 |
| `/estado\s+de\s+informaci[oó]n\s+no\s+financiera\|EINF/i` | einf | 0.90 |
| `/pol[ií]tica\s+(de\s+)?retribuci[oó]n/i` | politica_retributiva | 0.85 |

### 3.2 LIT (4 new patterns)

| Pattern | Type | Confidence |
|---------|------|------------|
| `/demanda\|querella\|denuncia/i` | demanda | 0.88 |
| `/auto\s+de\s+admisi[oó]n\|providencia/i` | resolucion_judicial | 0.85 |
| `/informe\s+(de\s+)?compliance/i` | informe_compliance | 0.88 |
| `/programa\s+(de\s+)?cumplimiento/i` | programa_compliance | 0.85 |

### 3.3 ADM (3 new patterns)

| Pattern | Type | Confidence |
|---------|------|------------|
| `/licencia\s+(de\s+)?actividad/i` | licencia_actividad | 0.88 |
| `/subvenci[oó]n\|ayuda\s+p[uú]blica/i` | subvencion | 0.88 |
| `/resoluci[oó]n.*inversi[oó]n\s+extranjera\|FDI/i` | fdi_screening | 0.85 |

### 3.4 LAB (2 new patterns)

| Pattern | Type | Confidence |
|---------|------|------------|
| `/plan\s+(de\s+)?igualdad/i` | plan_igualdad | 0.88 |
| `/ERE\|ERTE\|expediente\s+regulaci[oó]n/i` | ere_erte | 0.90 |

**Total:** 17 new patterns → ~85% classification coverage

---

## 4. Extraction Schema Extensions

### 4.1 MERC/CA — Annual Accounts

```typescript
annual_accounts: {
  dates: { fecha_formulacion, fecha_aprobacion, fecha_deposito, ejercicio }
  equity: { patrimonio_neto, capital_social, reserva_legal, reservas_indisponibles, resultado_ejercicio }
  audit: { tipo_opinion, KAM_count, going_concern, enfasis_count }
  distribution: { dividendos_aprobados, dividendos_a_cuenta, aplicacion_resultado }
  related_parties: { operaciones_vinculadas[], saldos_vinculadas }
  contingencies: { garantias_otorgadas, litigios_revelados[], compromisos_fuera_balance }
  treasury_shares: { existencia, importe }
}
```

### 4.2 LIT — Litigation

```typescript
litigios: {
  procedimientos: [{ juzgado, numero_autos, tipo, demandante, demandado, cuantia, estado_procesal }]
  provision_NIC37: { probable, importe_estimado }
  compliance: { programa_existe, canal_denuncias, ultima_revision }
}
```

### 4.3 ADM — Administrative

```typescript
administrativo: {
  licencias: [{ tipo, autoridad, numero, fecha_concesion, fecha_vencimiento }]
  subvenciones: [{ organismo, importe, estado, obligaciones_pendientes }]
  contratos_publicos: [{ licitador, importe, plazo }]
}
```

**Implementation:** Conditional prompts in `fact-extractor.ts` based on detected `area_codes`. All stored in JSONB `metadata` field (no DB schema changes).

---

## 5. Expected Documents

### 5.1 Current State
- MERC: 4, CONT: 4, FISC: 3, LAB: 4, PI: 2, LIT: 0, ADM: 0
- **Total:** 18 documents

### 5.2 New Documents

**LIT (5 new)**
| category | name | is_mandatory |
|----------|------|--------------|
| procedimientos | Relación de procedimientos judiciales pendientes | Yes |
| provisiones | Cuadro de contingencias y provisiones (NIC 37) | Yes |
| compliance | Informe de compliance / Canal de denuncias | No |
| rgpd | Documentación RGPD y protección de datos | No |
| medioambiente | Informes de pasivos medioambientales | No |

**ADM (5 new)**
| category | name | is_mandatory |
|----------|------|--------------|
| licencias | Licencias y autorizaciones administrativas | Yes |
| urbanismo | Documentación urbanística | Yes |
| subvenciones | Expedientes de subvenciones recibidas | No |
| contratos_publicos | Contratos con Administraciones Públicas | No |
| fdi | Documentación FDI screening / merger control | No |

**MERC/CA (9 new)**
| category | name | is_mandatory |
|----------|------|--------------|
| cuentas | Cuentas anuales completas (balance, PyG, memoria) | Yes |
| auditoria | Informe de auditoría | Yes |
| actas | Actas JGA con aprobación de cuentas | Yes |
| registro | Notas simples Registro Mercantil | Yes |
| vinculadas | Contratos con partes vinculadas | No |
| garantias | Pólizas y garantías otorgadas | No |
| escrituras | Escrituras públicas relevantes | No |
| esg | EINF / Informe ESG | No |
| retributiva | Políticas retributivas | No |

**Extras (3 new)**
| area | category | name |
|------|----------|------|
| LAB | igualdad | Plan de igualdad y protocolo de acoso |
| FISC | inspecciones | Actas de inspección y recursos |
| CONT | earn_out | Acuerdos de earn-out / escrow |

### 5.3 Final State
- **Total:** 40 documents (+22 new)
- **Gap analysis:** 7/7 areas complete

---

## 6. Documentation Structure

```
docs/
├── architecture/                    # Technical designs
│   ├── DOCUMENT_STRATEGY_v1.md
│   ├── CA_INTEGRATION_REQUIREMENT.md
│   ├── CA_SKILLS_WORKFLOWS.md
│   └── WORKER_ARCHITECTURE_v1.md
│
├── plans/                           # Implementation plans
│   ├── 2026-02-24-document-consolidation-design.md  ← THIS FILE
│   └── 2026-02-24-document-consolidation-plan.md    ← NEXT
│
└── migrations/                      # SQL seeds (reference)
    ├── CA_CATALOG_SEED.sql         (move from architecture/)
    └── ... (new seeds)
```

**Note:** Reference seeds in `docs/migrations/`, actual migrations in `supabase/migrations/`.

---

## 7. Summary

| Component | Quantity | Detail |
|-----------|----------|--------|
| SQL Migrations | 8 | FOs, skills, workflow, tool, mappings, expected_docs |
| Classification Patterns | 17 | CA(8), LIT(4), ADM(3), LAB(2) |
| Extraction Schemas | 3 | CA, LIT, ADM in fact-extractor.ts |
| Expected Documents | +22 | Total: 40 (from 18) |
| Total FOs | 69 | 54 existing + 15 CA |
| Total Skills | 36 | 28 existing + 8 CA |
| Complete Areas | 7/7 | LIT and ADM with expected docs |

**Coverage Results:**
- Pattern-based classification: ~85% (vs ~50%)
- Gap analysis: 7/7 areas (vs 5/7)
- Evaluable FOs: 69 (vs 54)

---

## 8. Cross-References

| Document | Relation |
|----------|----------|
| `CA_SKILLS_WORKFLOWS.md` | 8 skills, 1 workflow, 1 microtool for CA |
| `DOCUMENT_STRATEGY_v1.md` | Full pipeline strategy, 23 gaps identified |
| `CA_CATALOG_SEED.sql` | 15 FOs ready to apply |
| `CA_INTEGRATION_REQUIREMENT.md` | Integration requirements with dependencies |
| `WORKER_ARCHITECTURE_v1.md` | Worker phases for evaluation |

---

## 9. Next Steps

1. **Create implementation plan** using `writing-plans` skill
2. **Execute migrations** in sequence with verification
3. **Update code** (document-classifier.ts, fact-extractor.ts)
4. **Run E2E tests** to verify integration
5. **Update CLAUDE.md** with new totals
