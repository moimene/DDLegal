# Finding-Centric Architecture v2.0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement FO-driven analysis with iterative document processing and complete audit trail.

**Architecture:** Three-layer system (Catalog → Rule Engine → Audit Trail) with worker-based iterative execution over documents, integrated with existing workflows and skills.

**Tech Stack:** Next.js 14, Supabase (Postgres + RLS), Harvey AI Gateway, pgvector, Vercel Cron.

---

## Phase E.1: Finding Objectives + Scoring Config

### Task 1: Create dd_finding_objectives table

**Files:**
- Create: `supabase/migrations/202602280012_create_finding_objectives.sql`

**Step 1: Write the migration**

```sql
-- Migration: Create dd_finding_objectives table
-- Finding-Centric Architecture v2.0 — Catalog Layer

BEGIN;

-- Create the finding objectives catalog table
CREATE TABLE IF NOT EXISTS public.dd_finding_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_key VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(10) NOT NULL DEFAULT '1.0',
  title TEXT NOT NULL,
  description TEXT,

  -- Classification
  area_code VARCHAR(10) NOT NULL,
  skill_key VARCHAR(100),
  risk_category VARCHAR(100),
  dd_phase VARCHAR(50),

  -- Applicability
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  materiality_threshold_amount NUMERIC,
  materiality_threshold_currency VARCHAR(3) DEFAULT 'EUR',
  applies_when JSONB DEFAULT '[]',

  -- Evaluation
  evaluation_criteria JSONB NOT NULL DEFAULT '[]',
  data_required JSONB NOT NULL DEFAULT '[]',

  -- Severity
  severity_if_positive VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity_modifiers JSONB DEFAULT '[]',

  -- Examples
  positive_examples TEXT[] DEFAULT '{}',
  negative_examples TEXT[] DEFAULT '{}',
  false_positive_examples TEXT[] DEFAULT '{}',

  -- Audit
  source_standard VARCHAR(100),
  regulatory_basis VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_fo_severity CHECK (severity_if_positive IN ('critical', 'high', 'medium', 'low', 'informational'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fo_area ON dd_finding_objectives(area_code) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_fo_skill ON dd_finding_objectives(skill_key) WHERE is_active AND skill_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fo_deal_types ON dd_finding_objectives USING GIN(deal_types);
CREATE INDEX IF NOT EXISTS idx_fo_jurisdictions ON dd_finding_objectives USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_fo_objective_key ON dd_finding_objectives(objective_key);

-- RLS
ALTER TABLE dd_finding_objectives ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read active FOs
CREATE POLICY "fo_read_active" ON dd_finding_objectives
  FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can modify
CREATE POLICY "fo_admin_all" ON dd_finding_objectives
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid()
      AND pur.role = 'clo'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fo_updated_at
  BEFORE UPDATE ON dd_finding_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_fo_updated_at();

COMMIT;
```

**Step 2: Apply migration**

Run: `cd /Users/moisesmenendez/dropbox/dd_legal/dd-legal-pmo && npx supabase migration up --db-url "$SUPABASE_DB_URL"` or use Supabase MCP tool.

**Step 3: Verify table exists**

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_name = 'dd_finding_objectives';
-- Expected: 1
```

**Step 4: Commit**

```bash
git add supabase/migrations/202602280012_create_finding_objectives.sql
git commit -m "feat(db): create dd_finding_objectives table for FO catalog"
```

---

### Task 2: Seed 54 Finding Objectives

**Files:**
- Create: `supabase/migrations/202602280013_seed_finding_objectives.sql`
- Reference: `docs/architecture/LEGAL_CATALOG_SEED.sql`

**Step 1: Copy seed file as migration**

```bash
cp docs/architecture/LEGAL_CATALOG_SEED.sql supabase/migrations/202602280013_seed_finding_objectives.sql
```

**Step 2: Apply migration**

Run via Supabase MCP or direct SQL execution.

**Step 3: Verify seed**

```sql
-- Count by area
SELECT area_code, count(*) as fo_count
FROM dd_finding_objectives
WHERE is_active = true
GROUP BY area_code
ORDER BY area_code;

-- Expected:
-- ADM: 6, CONT: 10, FISC: 8, LAB: 8, LIT: 8, MERC: 8, PI: 6

-- Total count
SELECT count(*) FROM dd_finding_objectives WHERE is_active = true;
-- Expected: 54
```

**Step 4: Commit**

```bash
git add supabase/migrations/202602280013_seed_finding_objectives.sql
git commit -m "feat(db): seed 54 finding objectives from legal catalog v1.0"
```

---

### Task 3: Create dd_scoring_config table

**Files:**
- Create: `supabase/migrations/202602280014_create_scoring_config.sql`

**Step 1: Write the migration**

```sql
-- Migration: Create dd_scoring_config table
-- Parameterizable scoring weights by deal type/jurisdiction

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),

  -- Weights
  severity_weights JSONB NOT NULL DEFAULT '{"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.15, "informational": 0.0}',
  probability_weights JSONB NOT NULL DEFAULT '{"certain": 1.0, "alta": 0.9, "probable": 0.75, "media": 0.5, "baja": 0.2, "remote": 0.15}',
  timing_multipliers JSONB NOT NULL DEFAULT '{"blocking": 1.5, "pre_closing": 1.2, "post_closing": 1.0, "ongoing": 0.8}',
  area_weights JSONB NOT NULL DEFAULT '{"MERC": 1.0, "CONT": 1.2, "LAB": 0.8, "FISC": 1.0, "PI": 0.7, "LIT": 1.1, "ADM": 0.9, "GENERAL": 0.5}',

  -- Thresholds
  recommendation_thresholds JSONB NOT NULL DEFAULT '{"go_below": 30, "no_go_above": 65}',
  deal_breaker_rules JSONB NOT NULL DEFAULT '{"severity": "critical", "probability_min": "alta", "timing": "blocking"}',
  tier_rules JSONB NOT NULL DEFAULT '{}',

  -- Applicability
  deal_types TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sc_default ON dd_scoring_config(is_default) WHERE is_default = true;

-- RLS
ALTER TABLE dd_scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_read_all" ON dd_scoring_config
  FOR SELECT USING (true);

CREATE POLICY "sc_admin_modify" ON dd_scoring_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.user_id = auth.uid() AND pur.role = 'clo'
    )
  );

-- Seed default config
INSERT INTO dd_scoring_config (config_key, name, is_default)
VALUES ('default', 'Default Scoring Configuration', true)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;
```

**Step 2: Apply and verify**

```sql
SELECT config_key, is_default FROM dd_scoring_config;
-- Expected: default, true
```

**Step 3: Commit**

```bash
git add supabase/migrations/202602280014_create_scoring_config.sql
git commit -m "feat(db): create dd_scoring_config with default weights"
```

---

### Task 4: Add objective_id to dd_findings

**Files:**
- Create: `supabase/migrations/202602280015_findings_objective_fk.sql`

**Step 1: Write migration**

```sql
-- Migration: Add objective_id FK to dd_findings
-- Links findings to their source Finding Objective

BEGIN;

-- Add nullable FK columns
ALTER TABLE dd_findings
ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES dd_finding_objectives(id);

ALTER TABLE dd_findings
ADD COLUMN IF NOT EXISTS rule_execution_id UUID;
-- FK to dd_rule_executions added in E.2 when table exists

-- Index for queries by objective
CREATE INDEX IF NOT EXISTS idx_findings_objective
ON dd_findings(objective_id)
WHERE objective_id IS NOT NULL;

COMMIT;
```

**Step 2: Apply and verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dd_findings' AND column_name = 'objective_id';
-- Expected: objective_id
```

**Step 3: Commit**

```bash
git add supabase/migrations/202602280015_findings_objective_fk.sql
git commit -m "feat(db): add objective_id FK to dd_findings"
```

---

### Task 5: Create Finding Objectives API route

**Files:**
- Create: `src/app/api/finding-objectives/route.ts`
- Create: `src/lib/findings/objective-types.ts`

**Step 1: Write types**

```typescript
// src/lib/findings/objective-types.ts

export interface EvaluationCriterion {
  criterion: string;
  weight: number;
  eval_type: 'document_review' | 'semantic_analysis' | 'threshold_calculation' |
             'litigation_review' | 'compliance_check' | 'document_verification' |
             'jurisdiction_mapping' | 'procedure_analysis' | 'registry_check' | 'timeline_verification';
}

export interface DataRequirement {
  doc_type: string;
  sample: 'all' | 'material';
  extractions: string[];
}

export interface SeverityModifier {
  condition: string;
  action: 'upgrade_to_critical' | 'upgrade_to_high' | 'downgrade_to_medium' |
          'downgrade_to_low' | 'maintain_critical' | 'downgrade_to_informational';
  justification: string;
}

export interface FindingObjective {
  id: string;
  objective_key: string;
  version: string;
  title: string;
  description: string | null;
  area_code: string;
  skill_key: string | null;
  risk_category: string | null;
  dd_phase: string | null;
  deal_types: string[];
  jurisdictions: string[];
  materiality_threshold_amount: number | null;
  materiality_threshold_currency: string;
  applies_when: unknown[];
  evaluation_criteria: EvaluationCriterion[];
  data_required: DataRequirement[];
  severity_if_positive: string;
  severity_modifiers: SeverityModifier[];
  positive_examples: string[];
  negative_examples: string[];
  false_positive_examples: string[];
  source_standard: string | null;
  regulatory_basis: string | null;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Write API route**

```typescript
// src/app/api/finding-objectives/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'can_view_findings');
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const area_code = searchParams.get('area_code');
  const deal_type = searchParams.get('deal_type');
  const jurisdiction = searchParams.get('jurisdiction');
  const skill_key = searchParams.get('skill_key');

  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('is_active', true)
    .order('area_code')
    .order('objective_key');

  if (area_code) {
    query = query.eq('area_code', area_code);
  }

  if (skill_key) {
    query = query.eq('skill_key', skill_key);
  }

  if (deal_type) {
    query = query.contains('deal_types', [deal_type]);
  }

  if (jurisdiction) {
    query = query.contains('jurisdictions', [jurisdiction]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    objectives: data,
    count: data?.length ?? 0,
    filters: { area_code, deal_type, jurisdiction, skill_key }
  });
}
```

**Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "(error|finding-objectives)" | head -10`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/findings/objective-types.ts src/app/api/finding-objectives/route.ts
git commit -m "feat(api): add GET /api/finding-objectives endpoint"
```

---

### Task 6: Create scoring config API route

**Files:**
- Create: `src/app/api/scoring/config/route.ts`

**Step 1: Write API route**

```typescript
// src/app/api/scoring/config/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export interface ScoringConfig {
  config_key: string;
  severity_weights: Record<string, number>;
  probability_weights: Record<string, number>;
  timing_multipliers: Record<string, number>;
  area_weights: Record<string, number>;
  recommendation_thresholds: { go_below: number; no_go_above: number };
  deal_breaker_rules: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'can_view_findings');
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deal_type = searchParams.get('deal_type');
  const jurisdiction = searchParams.get('jurisdiction');

  // Try to find specific config, fallback to default
  let query = supabaseAdmin
    .from('dd_scoring_config')
    .select('*');

  if (deal_type || jurisdiction) {
    // Try specific first
    const specificQuery = supabaseAdmin
      .from('dd_scoring_config')
      .select('*')
      .eq('is_default', false);

    if (deal_type) {
      specificQuery.contains('deal_types', [deal_type]);
    }
    if (jurisdiction) {
      specificQuery.contains('jurisdictions', [jurisdiction]);
    }

    const { data: specific } = await specificQuery.limit(1).single();

    if (specific) {
      return NextResponse.json({ config: specific, source: 'specific' });
    }
  }

  // Fallback to default
  const { data: defaultConfig, error } = await supabaseAdmin
    .from('dd_scoring_config')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: defaultConfig, source: 'default' });
}
```

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/api/scoring/config/route.ts
git commit -m "feat(api): add GET /api/scoring/config endpoint"
```

---

### Task 7: Update deal-risk scoring to use config from DB

**Files:**
- Modify: `src/app/api/scoring/deal-risk/route.ts`

**Step 1: Read current implementation**

Read the existing route to understand current hardcoded weights.

**Step 2: Modify to load config from DB**

Add at the top of the POST handler:

```typescript
// Load scoring config from DB
const { data: configData } = await supabaseAdmin
  .from('dd_scoring_config')
  .select('*')
  .eq('is_default', true)
  .single();

const config = configData ?? {
  severity_weights: { critical: 1.0, high: 0.75, medium: 0.4, low: 0.15, informational: 0.0 },
  probability_weights: { certain: 1.0, alta: 0.9, probable: 0.75, media: 0.5, baja: 0.2, remote: 0.15 },
  timing_multipliers: { blocking: 1.5, pre_closing: 1.2, post_closing: 1.0, ongoing: 0.8 },
  area_weights: { MERC: 1.0, CONT: 1.2, LAB: 0.8, FISC: 1.0, PI: 0.7, LIT: 1.1, ADM: 0.9, GENERAL: 0.5 },
};

// Use config.severity_weights instead of hardcoded SEVERITY_WEIGHTS
// Use config.probability_weights instead of hardcoded PROBABILITY_WEIGHTS
// etc.
```

**Step 3: TypeScript check and test**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/scoring/deal-risk/route.ts
git commit -m "refactor(scoring): load weights from dd_scoring_config instead of hardcoded"
```

---

### Task 8: Add FINDING_OBJECTIVES feature flag

**Files:**
- Modify: `src/lib/workflows/engine.ts`
- Update: `CLAUDE.md`

**Step 1: Add flag check to engine.ts**

At the top of `executeWorkflow`:

```typescript
const FINDING_OBJECTIVES_ENABLED = process.env.FINDING_OBJECTIVES === 'true';

// In executeWorkflow, after existing checks:
if (FINDING_OBJECTIVES_ENABLED && process.env.FINDINGS_FIRST !== 'true') {
  console.warn('[WorkflowEngine] FINDING_OBJECTIVES requires FINDINGS_FIRST=true');
}
```

**Step 2: Update CLAUDE.md environment variables section**

Add to the Environment Variables table:

```markdown
| `FINDING_OBJECTIVES` | Config | Server ONLY | `true` / `false` — when true, uses FO-driven analysis (requires FINDINGS_FIRST=true) |
```

**Step 3: Commit**

```bash
git add src/lib/workflows/engine.ts CLAUDE.md
git commit -m "feat(flags): add FINDING_OBJECTIVES feature flag"
```

---

## Phase E.2: Rule Engine + Audit Trail

### Task 9: Create dd_rule_executions table

**Files:**
- Create: `supabase/migrations/202602280016_create_rule_executions.sql`

**Step 1: Write migration**

```sql
-- Migration: Create dd_rule_executions table
-- Audit trail for FO evaluations

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID REFERENCES vdr_documents(id),
  objective_version VARCHAR(10) NOT NULL,

  -- Context
  deal_context JSONB NOT NULL DEFAULT '{}',
  input_data_hash VARCHAR(64) NOT NULL,

  -- Result
  applicability_result BOOLEAN NOT NULL,
  applicability_reason TEXT,
  evaluation_results JSONB,
  severity_computed VARCHAR(20),
  severity_modifiers_applied JSONB,
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),

  -- Execution
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by VARCHAR(100) DEFAULT 'system',
  execution_duration_ms INTEGER,
  ai_calls_made INTEGER DEFAULT 0,

  -- Audit
  rule_source_hash VARCHAR(64),

  CONSTRAINT chk_re_severity CHECK (
    severity_computed IS NULL OR
    severity_computed IN ('critical', 'high', 'medium', 'low', 'informational')
  )
);

-- Indexes
CREATE INDEX idx_re_project ON dd_rule_executions(project_id);
CREATE INDEX idx_re_objective ON dd_rule_executions(objective_id);
CREATE INDEX idx_re_document ON dd_rule_executions(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_re_finding ON dd_rule_executions(finding_id) WHERE finding_id IS NOT NULL;
CREATE INDEX idx_re_executed ON dd_rule_executions(executed_at DESC);

-- RLS
ALTER TABLE dd_rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_project_access" ON dd_rule_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_rule_executions.project_id
      AND pur.user_id = auth.uid()
    )
  );

-- Now add the FK from dd_findings
ALTER TABLE dd_findings
ADD CONSTRAINT fk_findings_rule_execution
FOREIGN KEY (rule_execution_id) REFERENCES dd_rule_executions(id);

COMMIT;
```

**Step 2: Apply and verify**

```sql
SELECT count(*) FROM information_schema.tables WHERE table_name = 'dd_rule_executions';
-- Expected: 1
```

**Step 3: Commit**

```bash
git add supabase/migrations/202602280016_create_rule_executions.sql
git commit -m "feat(db): create dd_rule_executions audit trail table"
```

---

### Task 10: Create objective-resolver.ts

**Files:**
- Create: `src/lib/findings/objective-resolver.ts`

**Step 1: Write the resolver**

```typescript
// src/lib/findings/objective-resolver.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { FindingObjective } from './objective-types';

export interface DealContext {
  deal_type: string;
  jurisdiction: string;
  project_id: string;
  target_company?: string;
  materiality_threshold?: number;
  [key: string]: unknown;
}

export interface ResolvedObjective {
  objective: FindingObjective;
  applicable: boolean;
  reason?: string;
}

/**
 * Resolve applicable Finding Objectives for a given context
 */
export async function resolveApplicableObjectives(
  dealContext: DealContext,
  options?: {
    area_code?: string;
    skill_key?: string;
  }
): Promise<ResolvedObjective[]> {
  let query = supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('is_active', true);

  if (options?.area_code) {
    query = query.eq('area_code', options.area_code);
  }

  if (options?.skill_key) {
    query = query.eq('skill_key', options.skill_key);
  }

  const { data: objectives, error } = await query;

  if (error || !objectives) {
    console.error('[ObjectiveResolver] Failed to load objectives:', error?.message);
    return [];
  }

  return objectives.map((fo) => {
    const result = evaluateApplicability(fo as FindingObjective, dealContext);
    return {
      objective: fo as FindingObjective,
      applicable: result.applicable,
      reason: result.reason,
    };
  });
}

/**
 * Evaluate if a Finding Objective applies to the given deal context
 */
function evaluateApplicability(
  fo: FindingObjective,
  context: DealContext
): { applicable: boolean; reason?: string } {
  // Check deal_type
  if (fo.deal_types.length > 0 && !fo.deal_types.includes(context.deal_type)) {
    return { applicable: false, reason: `deal_type ${context.deal_type} not in ${fo.deal_types.join(',')}` };
  }

  // Check jurisdiction
  if (fo.jurisdictions.length > 0 && !fo.jurisdictions.includes(context.jurisdiction)) {
    return { applicable: false, reason: `jurisdiction ${context.jurisdiction} not in ${fo.jurisdictions.join(',')}` };
  }

  // Check materiality threshold
  if (fo.materiality_threshold_amount && context.materiality_threshold) {
    if (context.materiality_threshold < fo.materiality_threshold_amount) {
      return { applicable: false, reason: `below materiality threshold ${fo.materiality_threshold_amount}` };
    }
  }

  // Check applies_when rules (JSON rules evaluation)
  if (Array.isArray(fo.applies_when) && fo.applies_when.length > 0) {
    const rulesPass = evaluateJsonRules(fo.applies_when, context);
    if (!rulesPass) {
      return { applicable: false, reason: 'applies_when rules not satisfied' };
    }
  }

  return { applicable: true };
}

/**
 * Evaluate JSON rules against context
 */
function evaluateJsonRules(rules: unknown[], context: DealContext): boolean {
  // Simple rule evaluation - can be extended for complex rules
  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) continue;

    const r = rule as Record<string, unknown>;

    // Handle "all" condition
    if ('all' in r && Array.isArray(r.all)) {
      const allPass = r.all.every((cond) => evaluateSingleCondition(cond, context));
      if (!allPass) return false;
    }

    // Handle "any" condition
    if ('any' in r && Array.isArray(r.any)) {
      const anyPass = r.any.some((cond) => evaluateSingleCondition(cond, context));
      if (!anyPass) return false;
    }
  }

  return true;
}

function evaluateSingleCondition(condition: unknown, context: DealContext): boolean {
  if (typeof condition !== 'object' || condition === null) return true;

  const c = condition as Record<string, unknown>;
  const field = c.field as string;
  const op = c.op as string;
  const value = c.value;

  if (!field || !op) return true;

  // Get value from context using dot notation
  const contextValue = getNestedValue(context, field);

  switch (op) {
    case 'eq': return contextValue === value;
    case 'neq': return contextValue !== value;
    case 'in': return Array.isArray(value) && value.includes(contextValue);
    case 'contains': return Array.isArray(contextValue) && contextValue.includes(value);
    case 'gt': return typeof contextValue === 'number' && contextValue > (value as number);
    case 'gte': return typeof contextValue === 'number' && contextValue >= (value as number);
    case 'lt': return typeof contextValue === 'number' && contextValue < (value as number);
    case 'lte': return typeof contextValue === 'number' && contextValue <= (value as number);
    default: return true;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

export async function getObjectivesForSkill(skillKey: string): Promise<FindingObjective[]> {
  const { data, error } = await supabaseAdmin
    .from('dd_finding_objectives')
    .select('*')
    .eq('skill_key', skillKey)
    .eq('is_active', true);

  if (error) {
    console.error('[ObjectiveResolver] Failed to load objectives for skill:', error.message);
    return [];
  }

  return data as FindingObjective[];
}
```

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/findings/objective-resolver.ts
git commit -m "feat(findings): add objective-resolver for FO applicability evaluation"
```

---

### Task 11: Create rule-evaluator.ts

**Files:**
- Create: `src/lib/findings/rule-evaluator.ts`

**Step 1: Write the evaluator**

```typescript
// src/lib/findings/rule-evaluator.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';
import type { FindingObjective, EvaluationCriterion } from './objective-types';

export interface EvaluationFacts {
  document_id: string;
  document_type: string;
  content_hash: string;
  chunks: Array<{ id: string; content: string; page?: number }>;
  extracted_data?: Record<string, unknown>;
}

export interface CriterionResult {
  criterion_id: string;
  criterion: string;
  result: boolean;
  confidence: number;
  evidence?: string;
  eval_type: string;
}

export interface RuleEvaluationResult {
  objective_id: string;
  objective_key: string;
  document_id: string;
  applicable: boolean;
  applicability_reason?: string;
  criteria_results: CriterionResult[];
  overall_score: number;
  severity_computed: string;
  severity_modifiers_applied: string[];
  finding_generated: boolean;
  finding_data?: {
    title: string;
    description: string;
    evidence_refs: string[];
  };
  execution_duration_ms: number;
  ai_calls_made: number;
}

/**
 * Evaluate a Finding Objective against document facts
 */
export async function evaluateObjective(
  fo: FindingObjective,
  facts: EvaluationFacts,
  dealContext: Record<string, unknown>
): Promise<RuleEvaluationResult> {
  const startTime = Date.now();
  let aiCalls = 0;

  const criteriaResults: CriterionResult[] = [];

  // Evaluate each criterion
  for (let i = 0; i < fo.evaluation_criteria.length; i++) {
    const criterion = fo.evaluation_criteria[i];
    const result = await evaluateCriterion(criterion, facts, fo);

    if (result.usedAi) aiCalls++;

    criteriaResults.push({
      criterion_id: `EC-${String(i + 1).padStart(3, '0')}`,
      criterion: criterion.criterion,
      result: result.passed,
      confidence: result.confidence,
      evidence: result.evidence,
      eval_type: criterion.eval_type,
    });
  }

  // Calculate overall score (weighted)
  const overallScore = criteriaResults.reduce((sum, cr, idx) => {
    const weight = fo.evaluation_criteria[idx]?.weight ?? 0;
    return sum + (cr.result ? weight * cr.confidence : 0);
  }, 0);

  // Determine if finding should be generated (score > 0.5)
  const findingGenerated = overallScore >= 0.5;

  // Compute severity with modifiers
  let severityComputed = fo.severity_if_positive;
  const modifiersApplied: string[] = [];

  if (findingGenerated) {
    for (const mod of fo.severity_modifiers) {
      // Simple condition check - in real impl, evaluate against facts
      if (shouldApplyModifier(mod, facts, dealContext)) {
        severityComputed = applySeverityAction(severityComputed, mod.action);
        modifiersApplied.push(mod.justification);
      }
    }
  }

  const executionDuration = Date.now() - startTime;

  return {
    objective_id: fo.id,
    objective_key: fo.objective_key,
    document_id: facts.document_id,
    applicable: true,
    criteria_results: criteriaResults,
    overall_score: overallScore,
    severity_computed: findingGenerated ? severityComputed : 'none',
    severity_modifiers_applied: modifiersApplied,
    finding_generated: findingGenerated,
    finding_data: findingGenerated ? {
      title: `[${fo.objective_key}] ${fo.title}`,
      description: buildFindingDescription(fo, criteriaResults),
      evidence_refs: criteriaResults
        .filter(cr => cr.evidence)
        .map(cr => cr.evidence!)
        .slice(0, 5),
    } : undefined,
    execution_duration_ms: executionDuration,
    ai_calls_made: aiCalls,
  };
}

async function evaluateCriterion(
  criterion: EvaluationCriterion,
  facts: EvaluationFacts,
  fo: FindingObjective
): Promise<{ passed: boolean; confidence: number; evidence?: string; usedAi: boolean }> {
  // For now, return placeholder - will integrate with Harvey in full implementation
  // This is where semantic_analysis criteria would call Harvey

  switch (criterion.eval_type) {
    case 'document_review':
    case 'document_verification':
      // Check if document exists and has content
      return {
        passed: facts.chunks.length > 0,
        confidence: 0.8,
        evidence: facts.chunks[0]?.content?.slice(0, 200),
        usedAi: false,
      };

    case 'semantic_analysis':
      // TODO: Integrate with Harvey for semantic analysis
      return {
        passed: false,
        confidence: 0.0,
        evidence: undefined,
        usedAi: true, // Would be true when Harvey integration added
      };

    default:
      return { passed: false, confidence: 0.0, usedAi: false };
  }
}

function shouldApplyModifier(
  modifier: { condition: string },
  facts: EvaluationFacts,
  context: Record<string, unknown>
): boolean {
  // Simple keyword matching for now
  const condition = modifier.condition.toLowerCase();
  const factString = JSON.stringify(facts).toLowerCase();

  // Check if condition keywords appear in facts
  const keywords = condition.split(/\s+/).filter(w => w.length > 4);
  return keywords.some(kw => factString.includes(kw));
}

function applySeverityAction(current: string, action: string): string {
  const severityOrder = ['informational', 'low', 'medium', 'high', 'critical'];
  const currentIdx = severityOrder.indexOf(current);

  if (action.includes('upgrade_to_critical')) return 'critical';
  if (action.includes('upgrade_to_high')) return currentIdx < 3 ? 'high' : current;
  if (action.includes('downgrade_to_medium')) return currentIdx > 2 ? 'medium' : current;
  if (action.includes('downgrade_to_low')) return currentIdx > 1 ? 'low' : current;
  if (action.includes('downgrade_to_informational')) return 'informational';

  return current;
}

function buildFindingDescription(fo: FindingObjective, results: CriterionResult[]): string {
  const passedCriteria = results.filter(r => r.result);
  const criteriaText = passedCriteria
    .map(r => `- ${r.criterion} (${Math.round(r.confidence * 100)}% confidence)`)
    .join('\n');

  return `${fo.description}\n\nCriterios evaluados:\n${criteriaText}`;
}

/**
 * Record rule execution in audit trail
 */
export async function recordRuleExecution(
  projectId: string,
  result: RuleEvaluationResult,
  dealContext: Record<string, unknown>,
  findingId?: string
): Promise<string | null> {
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ objective_id: result.objective_id, document_id: result.document_id }))
    .digest('hex')
    .slice(0, 64);

  const { data, error } = await supabaseAdmin
    .from('dd_rule_executions')
    .insert({
      project_id: projectId,
      objective_id: result.objective_id,
      document_id: result.document_id,
      objective_version: '1.0', // TODO: Get from FO
      deal_context: dealContext,
      input_data_hash: inputHash,
      applicability_result: result.applicable,
      applicability_reason: result.applicability_reason,
      evaluation_results: result.criteria_results,
      severity_computed: result.finding_generated ? result.severity_computed : null,
      severity_modifiers_applied: result.severity_modifiers_applied,
      finding_generated: result.finding_generated,
      finding_id: findingId,
      execution_duration_ms: result.execution_duration_ms,
      ai_calls_made: result.ai_calls_made,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[RuleEvaluator] Failed to record execution:', error.message);
    return null;
  }

  return data?.id ?? null;
}
```

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/findings/rule-evaluator.ts
git commit -m "feat(findings): add rule-evaluator with audit trail recording"
```

---

## Phase E.2.5: Iterative Document Processing

### Task 12: Create dd_fo_document_status table

**Files:**
- Create: `supabase/migrations/202602280017_create_fo_document_status.sql`

**Step 1: Write migration**

```sql
-- Migration: Create dd_fo_document_status for iterative tracking
-- Tracks N documents × M Finding Objectives analysis status

BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_fo_document_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES dd_finding_objectives(id),
  document_id UUID NOT NULL REFERENCES vdr_documents(id) ON DELETE CASCADE,

  -- Cache
  content_hash_at_analysis VARCHAR(64),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Result
  finding_generated BOOLEAN DEFAULT false,
  finding_id UUID REFERENCES dd_findings(id),
  rule_execution_id UUID REFERENCES dd_rule_executions(id),

  -- Timestamps
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_fo_doc UNIQUE(project_id, objective_id, document_id),
  CONSTRAINT chk_fods_status CHECK (status IN ('pending', 'analyzing', 'analyzed', 'skipped', 'error'))
);

-- Indexes
CREATE INDEX idx_fods_project ON dd_fo_document_status(project_id);
CREATE INDEX idx_fods_objective ON dd_fo_document_status(objective_id);
CREATE INDEX idx_fods_document ON dd_fo_document_status(document_id);
CREATE INDEX idx_fods_pending ON dd_fo_document_status(project_id, status) WHERE status = 'pending';
CREATE INDEX idx_fods_status ON dd_fo_document_status(status);

-- RLS
ALTER TABLE dd_fo_document_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fods_project_access" ON dd_fo_document_status
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dd_project_user_roles pur
      WHERE pur.project_id = dd_fo_document_status.project_id
      AND pur.user_id = auth.uid()
    )
  );

COMMIT;
```

**Step 2: Apply and verify**

**Step 3: Commit**

```bash
git add supabase/migrations/202602280017_create_fo_document_status.sql
git commit -m "feat(db): create dd_fo_document_status for iterative tracking"
```

---

### Task 13: Create triggers for automatic re-analysis

**Files:**
- Create: `supabase/migrations/202602280018_fo_document_triggers.sql`

**Step 1: Write migration**

```sql
-- Migration: Triggers for automatic FO document analysis
-- 1. Re-analyze when document content changes
-- 2. Create pending entries when new FO added

BEGIN;

-- Trigger: Document content changed → mark for re-analysis
CREATE OR REPLACE FUNCTION trigger_fo_reanalysis_on_doc_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
    UPDATE dd_fo_document_status
    SET status = 'pending',
        content_hash_at_analysis = NULL,
        analyzed_at = NULL,
        finding_generated = false,
        finding_id = NULL,
        rule_execution_id = NULL
    WHERE document_id = NEW.id
      AND status = 'analyzed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vdr_doc_content_change ON vdr_documents;
CREATE TRIGGER trg_vdr_doc_content_change
  AFTER UPDATE OF content_hash ON vdr_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fo_reanalysis_on_doc_update();

-- Trigger: New FO → create pending for existing documents
CREATE OR REPLACE FUNCTION trigger_fo_docs_on_new_objective()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for active projects with documents
  INSERT INTO dd_fo_document_status (project_id, objective_id, document_id, status)
  SELECT DISTINCT
    vd.project_id,
    NEW.id,
    vd.id,
    'pending'
  FROM vdr_documents vd
  INNER JOIN dd_projects p ON p.id = vd.project_id
  WHERE p.status = 'active'
  ON CONFLICT (project_id, objective_id, document_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_finding_objective ON dd_finding_objectives;
CREATE TRIGGER trg_new_finding_objective
  AFTER INSERT ON dd_finding_objectives
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION trigger_fo_docs_on_new_objective();

-- Trigger: New document → create pending for applicable FOs
CREATE OR REPLACE FUNCTION trigger_fo_status_on_new_document()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dd_fo_document_status (project_id, objective_id, document_id, status)
  SELECT
    NEW.project_id,
    fo.id,
    NEW.id,
    'pending'
  FROM dd_finding_objectives fo
  WHERE fo.is_active = true
  ON CONFLICT (project_id, objective_id, document_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vdr_doc_new ON vdr_documents;
CREATE TRIGGER trg_vdr_doc_new
  AFTER INSERT ON vdr_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fo_status_on_new_document();

COMMIT;
```

**Step 2: Apply and verify**

**Step 3: Commit**

```bash
git add supabase/migrations/202602280018_fo_document_triggers.sql
git commit -m "feat(db): add triggers for automatic FO document analysis"
```

---

### Task 14: Create fo-analysis-worker.ts

**Files:**
- Create: `src/lib/findings/fo-analysis-worker.ts`

**Step 1: Write the worker**

```typescript
// src/lib/findings/fo-analysis-worker.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveApplicableObjectives, type DealContext } from './objective-resolver';
import { evaluateObjective, recordRuleExecution, type EvaluationFacts } from './rule-evaluator';
import { persistFindings, type PersistFindingInput } from './findings-service';
import type { FindingObjective } from './objective-types';

export interface WorkerConfig {
  batchSize: number;
  maxAiCallsPerRun: number;
  projectId?: string;
}

export interface WorkerResult {
  processed: number;
  findings_created: number;
  errors: number;
  skipped: number;
  duration_ms: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: 10,
  maxAiCallsPerRun: 5, // Respect Harvey rate limits
};

/**
 * Process pending FO document analyses
 */
export async function runFOAnalysisWorker(
  config: Partial<WorkerConfig> = {}
): Promise<WorkerResult> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const result: WorkerResult = {
    processed: 0,
    findings_created: 0,
    errors: 0,
    skipped: 0,
    duration_ms: 0,
  };

  // Fetch batch of pending items
  let query = supabaseAdmin
    .from('dd_fo_document_status')
    .select(`
      id,
      project_id,
      objective_id,
      document_id,
      content_hash_at_analysis
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(cfg.batchSize);

  if (cfg.projectId) {
    query = query.eq('project_id', cfg.projectId);
  }

  const { data: pendingItems, error: fetchError } = await query;

  if (fetchError) {
    console.error('[FOWorker] Failed to fetch pending items:', fetchError.message);
    result.errors = 1;
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  if (!pendingItems || pendingItems.length === 0) {
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  let aiCallsMade = 0;

  for (const item of pendingItems) {
    if (aiCallsMade >= cfg.maxAiCallsPerRun) {
      console.log('[FOWorker] Reached AI call limit, stopping batch');
      break;
    }

    try {
      // Mark as analyzing
      await supabaseAdmin
        .from('dd_fo_document_status')
        .update({ status: 'analyzing' })
        .eq('id', item.id);

      // Load objective
      const { data: foData } = await supabaseAdmin
        .from('dd_finding_objectives')
        .select('*')
        .eq('id', item.objective_id)
        .single();

      if (!foData) {
        await markAsError(item.id, 'Objective not found');
        result.errors++;
        continue;
      }

      const fo = foData as FindingObjective;

      // Load document with chunks
      const { data: docData } = await supabaseAdmin
        .from('vdr_documents')
        .select('id, content_hash, document_type, project_id')
        .eq('id', item.document_id)
        .single();

      if (!docData) {
        await markAsError(item.id, 'Document not found');
        result.errors++;
        continue;
      }

      // Check if content_hash unchanged (skip if already analyzed with same hash)
      if (item.content_hash_at_analysis === docData.content_hash) {
        await markAsSkipped(item.id);
        result.skipped++;
        continue;
      }

      // Load document chunks
      const { data: chunks } = await supabaseAdmin
        .from('vdr_chunks')
        .select('id, content, page_number')
        .eq('document_id', item.document_id)
        .limit(20);

      const facts: EvaluationFacts = {
        document_id: item.document_id,
        document_type: docData.document_type ?? 'unknown',
        content_hash: docData.content_hash ?? '',
        chunks: (chunks ?? []).map(c => ({
          id: c.id,
          content: c.content,
          page: c.page_number,
        })),
      };

      // Load deal context
      const { data: projectData } = await supabaseAdmin
        .from('dd_projects')
        .select('deal_type, target_jurisdiction, target_company')
        .eq('id', item.project_id)
        .single();

      const dealContext: DealContext = {
        deal_type: projectData?.deal_type ?? 'M&A',
        jurisdiction: projectData?.target_jurisdiction ?? 'ES',
        project_id: item.project_id,
        target_company: projectData?.target_company,
      };

      // Evaluate objective
      const evalResult = await evaluateObjective(fo, facts, dealContext);
      aiCallsMade += evalResult.ai_calls_made;

      let findingId: string | undefined;

      // Create finding if generated
      if (evalResult.finding_generated && evalResult.finding_data) {
        const findingInput: PersistFindingInput = {
          project_id: item.project_id,
          title: evalResult.finding_data.title,
          description: evalResult.finding_data.description,
          severity: evalResult.severity_computed as 'critical' | 'high' | 'medium' | 'low' | 'informational',
          area_code: fo.area_code,
          source_type: 'workflow_ai',
          objective_id: fo.id,
        };

        const findings = await persistFindings(item.project_id, [findingInput]);
        findingId = findings[0]?.id;

        if (findingId) {
          result.findings_created++;
        }
      }

      // Record rule execution
      const ruleExecutionId = await recordRuleExecution(
        item.project_id,
        evalResult,
        dealContext,
        findingId
      );

      // Mark as analyzed
      await supabaseAdmin
        .from('dd_fo_document_status')
        .update({
          status: 'analyzed',
          content_hash_at_analysis: docData.content_hash,
          finding_generated: evalResult.finding_generated,
          finding_id: findingId ?? null,
          rule_execution_id: ruleExecutionId,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      result.processed++;

    } catch (err) {
      console.error('[FOWorker] Error processing item:', err);
      await markAsError(item.id, (err as Error).message);
      result.errors++;
    }
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

async function markAsError(id: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from('dd_fo_document_status')
    .update({ status: 'error' })
    .eq('id', id);
}

async function markAsSkipped(id: string): Promise<void> {
  await supabaseAdmin
    .from('dd_fo_document_status')
    .update({ status: 'skipped', analyzed_at: new Date().toISOString() })
    .eq('id', id);
}
```

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/findings/fo-analysis-worker.ts
git commit -m "feat(findings): add fo-analysis-worker for iterative processing"
```

---

### Task 15: Create cron endpoint for FO analysis

**Files:**
- Create: `src/app/api/cron/fo-analysis/route.ts`

**Step 1: Write the route**

```typescript
// src/app/api/cron/fo-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runFOAnalysisWorker } from '@/lib/findings/fo-analysis-worker';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature flag
  if (process.env.FINDING_OBJECTIVES !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'FINDING_OBJECTIVES feature flag is not enabled'
    });
  }

  try {
    const result = await runFOAnalysisWorker({
      batchSize: 10,
      maxAiCallsPerRun: 5,
    });

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/FOAnalysis] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

**Step 2: Update vercel.json**

Add to crons array:

```json
{
  "path": "/api/cron/fo-analysis",
  "schedule": "*/5 * * * *"
}
```

**Step 3: Commit**

```bash
git add src/app/api/cron/fo-analysis/route.ts vercel.json
git commit -m "feat(cron): add /api/cron/fo-analysis endpoint (every 5 min)"
```

---

### Task 16: Create coverage API endpoint

**Files:**
- Create: `src/app/api/fo/coverage/route.ts`

**Step 1: Write the route**

```typescript
// src/app/api/fo/coverage/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'can_view_findings');
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const project_id = searchParams.get('project_id');

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  // Get coverage stats
  const { data: stats, error } = await supabaseAdmin
    .from('dd_fo_document_status')
    .select('status, objective_id, finding_generated')
    .eq('project_id', project_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = stats?.length ?? 0;
  const analyzed = stats?.filter(s => s.status === 'analyzed').length ?? 0;
  const pending = stats?.filter(s => s.status === 'pending').length ?? 0;
  const analyzing = stats?.filter(s => s.status === 'analyzing').length ?? 0;
  const withFindings = stats?.filter(s => s.finding_generated).length ?? 0;
  const errors = stats?.filter(s => s.status === 'error').length ?? 0;

  // Get by objective
  const byObjective: Record<string, { total: number; analyzed: number; findings: number }> = {};
  for (const s of stats ?? []) {
    const oid = s.objective_id;
    if (!byObjective[oid]) {
      byObjective[oid] = { total: 0, analyzed: 0, findings: 0 };
    }
    byObjective[oid].total++;
    if (s.status === 'analyzed') byObjective[oid].analyzed++;
    if (s.finding_generated) byObjective[oid].findings++;
  }

  return NextResponse.json({
    project_id,
    summary: {
      total,
      analyzed,
      pending,
      analyzing,
      errors,
      with_findings: withFindings,
      coverage_pct: total > 0 ? Math.round((analyzed / total) * 100) : 0,
    },
    by_objective: byObjective,
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/fo/coverage/route.ts
git commit -m "feat(api): add GET /api/fo/coverage endpoint"
```

---

## Phase E.3 and E.4: Deferred

Tasks 17-20 (Data Pipeline and Reporting Coverage) are deferred to a follow-up implementation to stay within the 2-3 week timeline.

---

## Final Task: Update CLAUDE.md and TSC Check

### Task 17: Final verification

**Step 1: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: 0 errors

**Step 2: Update CLAUDE.md**

Add to the Finding-Centric Architecture section:

```markdown
### Fase E.1-E.2.5: Finding Objectives + Iterative Analysis (COMPLETED)

- **dd_finding_objectives**: 54 FOs catalogados por área legal (8 migrations)
- **dd_scoring_config**: Pesos parametrizables por deal_type/jurisdiction
- **dd_rule_executions**: Audit trail completo de cada evaluación FO+documento
- **dd_fo_document_status**: Tracking iterativo N docs × M FOs
- **fo-analysis-worker.ts**: Worker que procesa batch de documentos pendientes
- **Triggers**: Re-análisis automático en content_hash change, pending en nuevo FO/documento
- **Cron**: `/api/cron/fo-analysis` cada 5 min

**Feature flag:** `FINDING_OBJECTIVES=true` (requires `FINDINGS_FIRST=true`)

**APIs:**
- `GET /api/finding-objectives?area_code=...&deal_type=...`
- `GET /api/scoring/config?deal_type=...&jurisdiction=...`
- `GET /api/fo/coverage?project_id=...`
```

**Step 3: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Finding-Centric v2.0 implementation"
```

---

## Summary

| Phase | Tasks | Migrations | Files Created |
|-------|-------|------------|---------------|
| E.1 | 1-8 | 4 | 5 |
| E.2 | 9-11 | 1 | 2 |
| E.2.5 | 12-16 | 2 | 3 |
| Final | 17 | 0 | 0 |
| **Total** | **17** | **7** | **10** |

**Estimated time:** 2-3 weeks

---

**Plan complete and saved to `docs/plans/2026-02-24-finding-centric-v2-implementation.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
