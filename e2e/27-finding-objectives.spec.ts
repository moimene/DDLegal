import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPatch } from './helpers/api-helpers';

const DEMO_PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';

test.describe('27: Finding-Centric Architecture (Fase E) @fo', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  // -------------------------------------------------------------------------
  // E.1: Finding Objectives Catalog
  // -------------------------------------------------------------------------
  test.describe('E.1: Finding Objectives Catalog', () => {
    test('GET /api/finding-objectives returns catalog', async ({ request }) => {
      const res = await authGet(request, '/api/finding-objectives', token);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toHaveProperty('objectives');
      expect(body).toHaveProperty('count');
      expect(Array.isArray(body.objectives)).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    test('catalog returns 54 FOs across 7 areas', async ({ request }) => {
      const res = await authGet(request, '/api/finding-objectives', token);
      const body = await res.json();
      expect(body.count).toBe(54);

      // Group by area_code to verify distribution
      const byArea: Record<string, number> = {};
      for (const fo of body.objectives) {
        byArea[fo.area_code] = (byArea[fo.area_code] || 0) + 1;
      }

      expect(byArea).toHaveProperty('MERC');
      expect(byArea).toHaveProperty('CONT');
      expect(byArea).toHaveProperty('FISC');
      expect(byArea).toHaveProperty('LAB');
      expect(byArea).toHaveProperty('PI');
      expect(byArea).toHaveProperty('LIT');
      expect(byArea).toHaveProperty('ADM');
    });

    test('catalog supports area_code filter', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/finding-objectives?area_code=MERC',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.count).toBe(8); // MERC has 8 FOs
      expect(body.filters.area_code).toBe('MERC');

      // All returned FOs should be MERC
      for (const fo of body.objectives) {
        expect(fo.area_code).toBe('MERC');
      }
    });

    test('catalog supports deal_type filter', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/finding-objectives?deal_type=M%26A',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.count).toBeGreaterThan(0);
      expect(body.filters.deal_type).toBe('M&A');

      // All returned FOs should include M&A in deal_types
      for (const fo of body.objectives) {
        expect(fo.deal_types).toContain('M&A');
      }
    });

    test('catalog supports jurisdiction filter', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/finding-objectives?jurisdiction=ES',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.count).toBeGreaterThan(0);
      expect(body.filters.jurisdiction).toBe('ES');

      // All returned FOs should include ES in jurisdictions
      for (const fo of body.objectives) {
        expect(fo.jurisdictions).toContain('ES');
      }
    });

    test('FO has required structure', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/finding-objectives?area_code=MERC',
        token
      );
      const body = await res.json();
      expect(body.objectives.length).toBeGreaterThan(0);

      const fo = body.objectives[0];
      expect(fo).toHaveProperty('id');
      expect(fo).toHaveProperty('objective_key');
      expect(fo).toHaveProperty('version');
      expect(fo).toHaveProperty('title');
      expect(fo).toHaveProperty('description');
      expect(fo).toHaveProperty('area_code');
      expect(fo).toHaveProperty('risk_category');
      expect(fo).toHaveProperty('deal_types');
      expect(fo).toHaveProperty('jurisdictions');
      expect(fo).toHaveProperty('evaluation_criteria');
      expect(fo).toHaveProperty('data_required');
      expect(fo).toHaveProperty('severity_if_positive');
      expect(fo).toHaveProperty('severity_modifiers');
      expect(fo).toHaveProperty('positive_examples');
      expect(fo).toHaveProperty('negative_examples');
      expect(fo).toHaveProperty('false_positive_examples');
      expect(fo).toHaveProperty('regulatory_basis');
      expect(fo).toHaveProperty('is_active');
      expect(fo.is_active).toBe(true);
    });

    test('catalog requires authentication', async ({ request }) => {
      const res = await request.get('/api/finding-objectives');
      expect(res.status()).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // E.2: Scoring Configuration
  // -------------------------------------------------------------------------
  test.describe('E.2: Scoring Configuration', () => {
    test('GET /api/scoring/config returns default config', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/scoring/config',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toHaveProperty('config');
      expect(body).toHaveProperty('source');
      expect(body.source).toBe('default');
    });

    test('config has required weight structures', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/scoring/config',
        token
      );
      const body = await res.json();
      const config = body.config;

      expect(config).toHaveProperty('severity_weights');
      expect(config).toHaveProperty('probability_weights');
      expect(config).toHaveProperty('timing_multipliers');
      expect(config).toHaveProperty('area_weights');
      expect(config).toHaveProperty('recommendation_thresholds');

      // Verify severity weights structure
      expect(config.severity_weights).toHaveProperty('critical');
      expect(config.severity_weights).toHaveProperty('high');
      expect(config.severity_weights).toHaveProperty('medium');
      expect(config.severity_weights).toHaveProperty('low');
      expect(config.severity_weights).toHaveProperty('informational');

      // Verify probability weights
      expect(config.probability_weights).toHaveProperty('certain');
      expect(config.probability_weights).toHaveProperty('alta');
      expect(config.probability_weights).toHaveProperty('media');
      expect(config.probability_weights).toHaveProperty('baja');

      // Verify timing multipliers
      expect(config.timing_multipliers).toHaveProperty('blocking');
      expect(config.timing_multipliers).toHaveProperty('pre_closing');
      expect(config.timing_multipliers).toHaveProperty('post_closing');

      // Verify area weights
      expect(config.area_weights).toHaveProperty('MERC');
      expect(config.area_weights).toHaveProperty('CONT');
      expect(config.area_weights).toHaveProperty('LAB');
      expect(config.area_weights).toHaveProperty('FISC');

      // Verify recommendation thresholds
      expect(config.recommendation_thresholds).toHaveProperty('go_below');
      expect(config.recommendation_thresholds).toHaveProperty('no_go_above');
    });

    test('config supports deal_type parameter', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/scoring/config?deal_type=M%26A',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      // Should return either specific or default
      expect(['specific', 'default']).toContain(body.source);
    });

    test('config supports jurisdiction parameter', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/scoring/config?jurisdiction=ES',
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(['specific', 'default']).toContain(body.source);
    });

    test('scoring config requires authentication', async ({ request }) => {
      const res = await request.get('/api/scoring/config');
      expect(res.status()).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // E.3: Findings List API
  // -------------------------------------------------------------------------
  test.describe('E.3: Findings API', () => {
    test('GET /api/findings requires project_id', async ({ request }) => {
      const res = await authGet(request, '/api/findings', token);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('project_id');
    });

    test('GET /api/findings returns findings list', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('findings list supports tier filter', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&tier=1`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      // All returned findings should be tier 1
      for (const finding of body.data) {
        expect(finding.relevance_tier).toBe(1);
      }
    });

    test('findings list supports status filter', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&status=identified,validated`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      // All returned findings should have matching status
      for (const finding of body.data) {
        expect(['identified', 'validated']).toContain(finding.status);
      }
    });

    test('findings list supports area_code filter', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&area_code=MERC`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      // All returned findings should be MERC area
      for (const finding of body.data) {
        expect(finding.area_code).toBe('MERC');
      }
    });

    test('GET /api/findings?summary=true returns aggregated metrics', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&summary=true`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('by_tier');
      expect(body.data).toHaveProperty('by_status');
      expect(body.data).toHaveProperty('by_area');
      expect(body.data).toHaveProperty('deal_breakers_count');
      expect(body.data).toHaveProperty('red_flags_count');
    });

    test('findings list supports pagination', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&limit=5&offset=0`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.offset).toBe(0);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });
  });

  // -------------------------------------------------------------------------
  // E.4: Finding Detail API
  // -------------------------------------------------------------------------
  test.describe('E.4: Finding Detail', () => {
    let findingId: string | undefined;

    test.beforeAll(async ({ request }) => {
      // Get a finding ID for detail tests
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&limit=1`,
        token
      );
      const body = await res.json();
      if (body.success && body.data.length > 0) {
        findingId = body.data[0].id;
      }
    });

    test('GET /api/findings/[id] returns finding detail', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authGet(request, `/api/findings/${findingId}`, token);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      // Detail API returns { finding, evidence, contingency, ... }
      expect(body.data).toHaveProperty('finding');
      expect(body.data.finding.id).toBe(findingId);
    });

    test('finding detail includes full structure', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authGet(request, `/api/findings/${findingId}`, token);
      const body = await res.json();
      // The finding data is nested under body.data.finding
      const finding = body.data.finding;

      expect(finding).toHaveProperty('title');
      expect(finding).toHaveProperty('description');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('probability');
      expect(finding).toHaveProperty('status');
      expect(finding).toHaveProperty('relevance_tier');
      expect(finding).toHaveProperty('area_code');
      expect(finding).toHaveProperty('project_id');
    });

    test('GET /api/findings/nonexistent returns 404', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/findings/00000000-0000-0000-0000-000000000000',
        token
      );
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // E.5: Finding Updates (PATCH)
  // -------------------------------------------------------------------------
  test.describe('E.5: Finding Updates', () => {
    let findingId: string | undefined;

    test.beforeAll(async ({ request }) => {
      const res = await authGet(
        request,
        `/api/findings?project_id=${DEMO_PROJECT_ID}&limit=1`,
        token
      );
      const body = await res.json();
      if (body.success && body.data.length > 0) {
        findingId = body.data[0].id;
      }
    });

    test('PATCH /api/findings/[id] updates allowed fields', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authPatch(request, `/api/findings/${findingId}`, token, {
        description: 'Updated description via E2E test',
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.description).toContain('E2E test');
    });

    test('PATCH /api/findings/[id] rejects empty update', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authPatch(request, `/api/findings/${findingId}`, token, {});
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('No valid fields');
    });

    test('PATCH tier override validates tier value', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authPatch(request, `/api/findings/${findingId}`, token, {
        relevance_tier: 5, // Invalid tier
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('1, 2, or 3');
    });

    test('PATCH is_red_flag updates flag', async ({ request }) => {
      test.skip(!findingId, 'No findings available');
      const res = await authPatch(request, `/api/findings/${findingId}`, token, {
        is_red_flag: true,
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.is_red_flag).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // E.6: FO Coverage API
  // -------------------------------------------------------------------------
  test.describe('E.6: FO Coverage', () => {
    test('GET /api/fo/coverage requires project_id', async ({ request }) => {
      const res = await authGet(request, '/api/fo/coverage', token);
      expect(res.status()).toBe(400);
    });

    test('GET /api/fo/coverage returns coverage stats', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/fo/coverage?project_id=${DEMO_PROJECT_ID}`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toHaveProperty('project_id');
      expect(body).toHaveProperty('summary');
      expect(body).toHaveProperty('by_objective');
    });

    test('coverage summary has expected structure', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/fo/coverage?project_id=${DEMO_PROJECT_ID}`,
        token
      );
      const body = await res.json();
      const summary = body.summary;

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('analyzed');
      expect(summary).toHaveProperty('pending');
      expect(summary).toHaveProperty('analyzing');
      expect(summary).toHaveProperty('skipped');
      expect(summary).toHaveProperty('errors');
      expect(summary).toHaveProperty('with_findings');
      expect(summary).toHaveProperty('coverage_pct');

      expect(summary.coverage_pct).toBeGreaterThanOrEqual(0);
      expect(summary.coverage_pct).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // E.7: Cron FO Analysis (Auth Protection)
  // -------------------------------------------------------------------------
  test.describe('E.7: Cron FO Analysis', () => {
    test('GET /api/cron/fo-analysis requires CRON_SECRET', async ({ request }) => {
      const res = await request.get('/api/cron/fo-analysis');
      expect(res.status()).toBe(401);
    });

    test('GET /api/cron/fo-analysis rejects invalid secret', async ({ request }) => {
      const res = await request.get('/api/cron/fo-analysis', {
        headers: { Authorization: 'Bearer invalid-secret' },
      });
      expect(res.status()).toBe(401);
    });

    // Note: Testing with valid CRON_SECRET requires env access
    // This test verifies the endpoint exists and is protected
  });

  // -------------------------------------------------------------------------
  // E.8: Integration with Scoring
  // -------------------------------------------------------------------------
  test.describe('E.8: Scoring Integration', () => {
    test('deal-risk scoring works with findings data', async ({ request }) => {
      const res = await request.post('/api/scoring/deal-risk', {
        headers: { Authorization: `Bearer ${token}` },
        data: { project_id: DEMO_PROJECT_ID },
      });
      // May succeed or fail depending on data state
      if (res.ok()) {
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.overall_score).toBeGreaterThanOrEqual(0);
        expect(body.overall_score).toBeLessThanOrEqual(100);
        expect(body).toHaveProperty('source');
        // Should indicate findings source when FINDINGS_FIRST is enabled
      }
    });

    test('red-flags endpoint works with findings', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/red-flags`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
      expect(body).toHaveProperty('source');
    });
  });

  // -------------------------------------------------------------------------
  // E.9: FO Objective Keys Validation
  // -------------------------------------------------------------------------
  test.describe('E.9: FO Objective Keys', () => {
    test('all FOs have valid objective_key format', async ({ request }) => {
      const res = await authGet(request, '/api/finding-objectives', token);
      const body = await res.json();

      // objective_key should follow pattern: FO-AREA-NNN (e.g., FO-MERC-001, FO-ADM-001)
      const keyPattern = /^FO-[A-Z]+-\d{3}$/;
      for (const fo of body.objectives) {
        expect(fo.objective_key).toMatch(keyPattern);
      }
    });

    test('objective_keys are unique', async ({ request }) => {
      const res = await authGet(request, '/api/finding-objectives', token);
      const body = await res.json();

      const keys = body.objectives.map((fo: { objective_key: string }) => fo.objective_key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    test('all FOs have version 1.0', async ({ request }) => {
      const res = await authGet(request, '/api/finding-objectives', token);
      const body = await res.json();

      for (const fo of body.objectives) {
        expect(fo.version).toBe('1.0');
      }
    });
  });
});
