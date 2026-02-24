# Cuentas Anuales (CA) - Integration Requirement Document

**Version:** 1.0
**Date:** 2026-02-24
**Status:** Ready for integration
**Depends on:** LEGAL_CATALOG_SEED.sql (54 FOs), WORKER_ARCHITECTURE_v1.md

---

## 1. Overview

This document specifies the integration requirements for 15 new Finding Objectives (FOs) covering the **legal review of Annual Accounts (Cuentas Anuales)** within M&A due diligence. The FOs have been designed by the legal team and are ready for technical integration into DD Legal PMO.

**Scope:** FO-MERC-CA-001 through FO-MERC-CA-014 + FO-MERC-CA-PatNeto-002
**Area:** MERC (Societario/Mercantil) — sub-category `CA`
**Seed file:** `docs/migrations/CA_CATALOG_SEED.sql`
**Total FO count after integration:** 54 + 15 = **69 FOs**

---

## 2. Integration Strategy

### 2.1 Sub-Category Within MERC (Not a New Area)

The annual accounts FOs belong to the `MERC` area. The legal team's naming convention (`FO-MERC-CA-*`) establishes a sub-category prefix that enables:

- Filtering by sub-category without schema changes (`WHERE objective_key LIKE 'FO-MERC-CA-%'`)
- Consistent area-level aggregation in `dd_area_conclusions` (all MERC FOs contribute to MERC area coverage)
- No changes to the 7-area structure (MERC, CONT, FISC, LAB, PI, LIT, ADM)

### 2.2 Naming Convention

| Pattern | Meaning | Example |
|---------|---------|---------|
| `FO-{AREA}-{NNN}` | General area FO | `FO-MERC-001` |
| `FO-{AREA}-CA-{NNN}` | Cuentas Anuales sub-category | `FO-MERC-CA-007` |
| `FO-{AREA}-CA-{Name}-{NNN}` | Specialized CA FO | `FO-MERC-CA-PatNeto-002` |

This convention is extensible. Future sub-categories (e.g., `FO-MERC-GOV-*` for corporate governance) follow the same pattern.

### 2.3 No Schema Changes Required

All 15 FOs fit the existing `dd_finding_objectives` schema. The INSERT statements in `CA_CATALOG_SEED.sql` use the same column structure as `LEGAL_CATALOG_SEED.sql`.

---

## 3. FO Dependency Graph

The CA FOs have internal dependencies and cross-references to existing MERC FOs. The Worker Architecture's `depends_on` mechanism (Phase F.2) will use this graph for topological evaluation ordering.

### 3.1 Internal CA Dependencies

```
FO-MERC-CA-004 (Patrimonio neto / disolución)
    └──→ FO-MERC-CA-PatNeto-002 (Medidas obligatorias)
         [Activates when CA-004 detects desequilibrio]

FO-MERC-CA-001 (Aprobación y depósito)
    └──→ FO-MERC-CA-005 (Legalidad de dividendos)
         [Requires approved application of results from CA-001]

FO-MERC-CA-002 (Obligación de auditoría)
    └──→ FO-MERC-CA-003 (Opinión de auditoría)
         [Only evaluable if audit exists per CA-002]

FO-MERC-CA-001 (Aprobación y depósito)
    └──→ FO-MERC-CA-014 (Coherencia cuentas-libros-RM)
         [Requires deposit status from CA-001]
```

### 3.2 Cross-Area Dependencies

| CA FO | External FO/Area | Nature of Dependency |
|-------|-----------------|---------------------|
| CA-007 (Partes vinculadas) | CONT-005 (Contratos partes vinculadas) | Conciliation: amounts in memoria vs. contract terms |
| CA-008 (Contingencias) | LIT-001 (Litigios pendientes) | Cross-check: contingencies disclosed vs. active litigation |
| CA-008 (Contingencias) | FISC-* (Fiscal contingencies) | Cross-check: fiscal provisions vs. memoria disclosure |
| CA-003 (Going concern) | CA-004 (Patrimonio neto) | Both assess viability risk from different angles |
| CA-004 (Patrimonio neto) | MERC-001 (Escritura constitución) | Capital social reference from corporate documents |

### 3.3 Evaluation Wave Order

For the Worker's EVALUATE phase, the CA FOs should run in waves:

**Wave 1** (no dependencies): CA-002, CA-006, CA-009, CA-010, CA-011, CA-012
**Wave 2** (depends on Wave 1): CA-001, CA-003, CA-004, CA-007, CA-008, CA-013
**Wave 3** (depends on Wave 2): CA-005, CA-014, CA-PatNeto-002

---

## 4. Document Type Mapping

The CA FOs require specific document types from the VDR. The following mapping connects document types to FOs for the Worker's SENSE phase.

### 4.1 Primary Document Types

| Document Type | FOs That Require It | Priority |
|--------------|-------------------|----------|
| Cuentas anuales (balance, P&L, memoria) | ALL CA FOs | Critical |
| Informe de auditoría | CA-001, CA-002, CA-003, CA-010 | Critical |
| Actas de junta | CA-001, CA-004, CA-005, CA-006, CA-012, CA-013, CA-PatNeto-002 | Critical |
| Notas simples del Registro Mercantil | CA-001, CA-004, CA-006, CA-014, CA-PatNeto-002 | High |
| Contratos con partes vinculadas | CA-007 | High |
| Pólizas y garantías | CA-008 | High |
| Escrituras públicas | CA-PatNeto-002 | High |
| EINF / Informe ESG | CA-011 | Medium |
| Políticas retributivas | CA-012 | Medium |

### 4.2 Extraction Fields for NORMALIZE Phase

The Worker's NORMALIZE phase (`dd_document_facts`) should capture these fields from annual accounts documents:

```json
{
  "annual_accounts_extractions": {
    "dates": {
      "fecha_formulacion": "date",
      "fecha_aprobacion": "date",
      "fecha_deposito": "date",
      "ejercicio": "string"
    },
    "equity": {
      "patrimonio_neto": "amount",
      "capital_social": "amount",
      "reservas_legales": "amount",
      "reservas_indisponibles": "amount",
      "resultado_ejercicio": "amount"
    },
    "audit": {
      "tipo_opinion": "enum(limpia|salvedades|desfavorable|denegada|sin_auditoria)",
      "KAM_count": "integer",
      "going_concern": "boolean",
      "enfasis_count": "integer"
    },
    "distribution": {
      "dividendos_aprobados": "amount",
      "dividendos_a_cuenta": "amount",
      "aplicacion_resultado": "object"
    },
    "related_parties": {
      "operaciones_vinculadas": "array",
      "saldos_vinculadas": "amount"
    },
    "contingencies": {
      "garantias_otorgadas": "amount",
      "litigios_revelados": "array",
      "compromisos_fuera_balance": "amount"
    },
    "treasury_shares": {
      "autocartera_existencia": "boolean",
      "autocartera_importe": "amount"
    },
    "post_closing": {
      "hechos_posteriores": "array"
    }
  }
}
```

---

## 5. Severity Distribution and Risk Profile

### 5.1 By Severity

| Severity | Count | FOs |
|----------|-------|-----|
| CRITICAL | 1 | CA-004 |
| HIGH | 8 | CA-001, CA-003, CA-005, CA-007, CA-008, CA-013, CA-014, CA-PatNeto-002 |
| MEDIUM | 6 | CA-002, CA-006, CA-009, CA-010, CA-011, CA-012 |

### 5.2 HITL Requirements

Human-in-the-loop validation is **mandatory** for:

- **CA-003**: Interpretation of audit opinions, emphasis paragraphs, and going concern uncertainties
- **CA-004**: Determination of whether equity imbalance triggers dissolution duties
- **CA-005**: Assessment of legality of dividend distribution against restrictions
- **CA-007**: Evaluation of arm's-length conditions for related party transactions
- **CA-008**: Probability assessment for contingency materialization
- **CA-PatNeto-002**: Adequacy evaluation of corporate remediation measures

---

## 6. Updated Area Distribution (Post-Integration)

| Area | Before | After | Change |
|------|--------|-------|--------|
| MERC | 8 | 23 | +15 (CA sub-category) |
| CONT | 10 | 10 | — |
| FISC | 8 | 8 | — |
| LAB | 8 | 8 | — |
| PI | 6 | 6 | — |
| LIT | 8 | 8 | — |
| ADM | 6 | 6 | — |
| **Total** | **54** | **69** | **+15** |

---

## 7. Implementation Checklist

### 7.1 Immediate (Fase E.2.5 extension)

- [ ] Apply `CA_CATALOG_SEED.sql` to Supabase (production)
- [ ] Verify 15 new rows in `dd_finding_objectives` with `is_active = true`
- [ ] Confirm `objective_resolver.ts` correctly filters CA FOs by deal_type and jurisdiction
- [ ] Test applicability: CA FOs should only activate for deals with MERC area and relevant document types
- [ ] Update CLAUDE.md to reflect 69 total FOs

### 7.2 Worker Architecture Integration (Phase F)

- [ ] Add `depends_on` column to `dd_finding_objectives` (Phase F.2 migration)
- [ ] Populate dependency graph for CA FOs per Section 3.1
- [ ] Configure document type mapping in `dd_document_facts` extraction pipeline
- [ ] Implement extraction schema per Section 4.2 in NORMALIZE phase
- [ ] Add CA-specific evaluation types: `registry_check`, `cross_area_review`
- [ ] Configure wave-based evaluation order per Section 3.3

### 7.3 Quality Assurance

- [ ] Run `fo-analysis-worker.ts` against test project with annual accounts documents
- [ ] Verify severity modifiers escalate/de-escalate correctly
- [ ] Test false positive filtering with known edge cases
- [ ] Validate cross-area references (CA-007 ↔ CONT-005, CA-008 ↔ LIT-001)
- [ ] Calibrate confidence thresholds for HITL activation

---

## 8. Cross-References

| Document | Purpose |
|----------|---------|
| `LEGAL_CATALOG_SEED.sql` | Original 54 FOs seed |
| `CA_CATALOG_SEED.sql` | This integration's 15 FOs seed |
| `LEGAL_CATALOG_REQUIREMENT.md` | Original catalog requirements |
| `WORKER_ARCHITECTURE_v1.md` | Worker phases F.1-F.5 |
| `IMPLEMENTATION_PROMPT_FASE_E.md` | Current Fase E implementation guide |
| `catalog_v2a.md` | Source: patrimonio neto extension (legal team) |
| `catalog_v2b.md` | Source: complete CA catalog (legal team) |
