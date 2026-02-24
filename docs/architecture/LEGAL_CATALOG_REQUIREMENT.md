# Requerimiento: Catálogo Legal de Finding Objectives v1.0

## Contexto

El equipo legal ha entregado el **Catálogo de Finding Objectives v1.0** con 54 FOs completos y ejecutables, cubriendo las 7 áreas de revisión del sistema DD Legal PMO. Este documento describe cómo integrar el catálogo en la implementación de la Fase E.1.

## Archivos de referencia

| Archivo | Propósito |
|---------|-----------|
| `docs/architecture/finding-centric-v2-architecture.md` | Arquitectura v2.0 completa (schemas, interfaces, diagramas) |
| `docs/architecture/IMPLEMENTATION_PROMPT_FASE_E.md` | Prompt de implementación Fases E.1-E.4 |
| `docs/architecture/LEGAL_CATALOG_SEED.sql` | **54 INSERTs listos para ejecutar** en `dd_finding_objectives` |
| `docs/architecture/LEGAL_CATALOG_REQUIREMENT.md` | Este documento |

## Distribución de FOs por área

| Área | Código | FOs | Severidades |
|------|--------|-----|-------------|
| Societario / Mercantil | MERC | 8 | 1 CRITICAL, 3 HIGH, 3 MEDIUM, 1 LOW |
| Contratos Materiales | CONT | 10 | 2 CRITICAL, 4 HIGH, 4 MEDIUM |
| Fiscal | FISC | 8 | 4 HIGH, 3 MEDIUM, 1 LOW |
| Laboral y RRHH | LAB | 8 | 1 CRITICAL, 3 HIGH, 3 MEDIUM, 1 LOW |
| Propiedad Intelectual | PI | 6 | 2 CRITICAL, 3 HIGH, 1 MEDIUM |
| Litigios y Compliance | LIT | 8 | 1 CRITICAL, 4 HIGH, 3 MEDIUM |
| Administrativo | ADM | 6 | 2 CRITICAL, 3 HIGH, 1 MEDIUM |
| **Total** | | **54** | **9 CRITICAL, 20 HIGH, 20 MEDIUM, 3 LOW, 2 INFORMATIONAL** |

## Instrucciones para Claude Code

### Paso 1: Crear tabla `dd_finding_objectives`

Usar el schema definido en `finding-centric-v2-architecture.md` sección 3.5. La migración debe:

1. Crear la tabla `dd_finding_objectives` con todos los campos del schema
2. Crear los índices definidos
3. Habilitar RLS con las mismas políticas que `dd_findings` (project-scoped via area_code)
4. Nombre de migración: `202602280012_create_finding_objectives`

### Paso 2: Ejecutar seed

Ejecutar `LEGAL_CATALOG_SEED.sql` como parte de la migración o como migración separada (`202602280013_seed_finding_objectives`).

**Importante**: El seed file usa `gen_random_uuid()` para IDs, es idempotente por `objective_key UNIQUE`.

### Paso 3: Verificar con SQL

```sql
-- Contar FOs por área
SELECT area_code, count(*) as fo_count,
       array_agg(severity_if_positive ORDER BY objective_key) as severities
FROM dd_finding_objectives
WHERE is_active = true
GROUP BY area_code
ORDER BY area_code;

-- Verificar que hay 54 FOs
SELECT count(*) FROM dd_finding_objectives WHERE is_active = true;
-- Esperado: 54

-- Verificar distribución de severidades
SELECT severity_if_positive, count(*)
FROM dd_finding_objectives
WHERE is_active = true
GROUP BY severity_if_positive;
```

## Estructura JSONB de cada FO

### `evaluation_criteria` (array de objetos)
```json
[
  {
    "criterion": "Texto describiendo qué se evalúa",
    "weight": 0.40,
    "eval_type": "document_review | semantic_analysis | threshold_calculation | litigation_review | compliance_check | document_verification | jurisdiction_mapping | procedure_analysis"
  }
]
```
Los pesos suman 1.0 por FO. Los `eval_type` indican el tipo de evaluación que debe realizar el motor de reglas.

### `severity_modifiers` (array de objetos)
```json
[
  {
    "condition": "Descripción de la condición que activa el modificador",
    "action": "upgrade_to_critical | upgrade_to_high | downgrade_to_medium | downgrade_to_low | maintain_critical | downgrade_to_informational",
    "justification": "Razón del ajuste"
  }
]
```

### `data_required` (array de objetos)
```json
[
  {
    "doc_type": "Tipo de documento necesario",
    "sample": "all | material",
    "extractions": ["campo1", "campo2"]
  }
]
```

### Arrays de texto
- `deal_types`: `ARRAY['M&A', 'LBO', 'Merger', 'Asset Purchase', 'VC', 'Financiero', 'Comercial']`
- `jurisdictions`: `ARRAY['ES', 'UE', 'UK', 'US']`
- `positive_examples`, `negative_examples`, `false_positive_examples`: arrays de strings con ejemplos redactados

## Notas de integración

1. **La tabla `dd_areas` debe existir previamente** con los códigos: MERC, CONT, FISC, LAB, PI, LIT, ADM. Si no existe, crear como parte de la misma migración.

2. **El campo `objective_id` en `dd_findings`** (FK nullable) se añade en migración separada para no romper nada existente.

3. **Feature flag `FINDING_OBJECTIVES`**: el seed se ejecuta siempre, pero los FOs solo se usan en el engine cuando el flag está activo.

4. **Versionado**: todos los FOs son v1.0. El campo `version` permite evolucionar FOs sin perder histórico.

5. **`applies_when`**: está vacío (`[]`) en el seed inicial. Se poblará en Fase E.2 cuando se implemente el objective-resolver.

## Catálogo completo de objective_keys

```
MERC: FO-MERC-001 .. FO-MERC-008
CONT: FO-CONT-001 .. FO-CONT-010
FISC: FO-FISC-001 .. FO-FISC-008
LAB:  FO-LAB-001  .. FO-LAB-008
PI:   FO-PI-001   .. FO-PI-006
LIT:  FO-LIT-001  .. FO-LIT-008
ADM:  FO-ADM-001  .. FO-ADM-006
```
