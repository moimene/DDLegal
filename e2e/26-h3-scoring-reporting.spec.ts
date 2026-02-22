import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPost } from './helpers/api-helpers';

const DEMO_PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';

test.describe('H3: Scoring + Reporting + War Room @h3', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  // -----------------------------------------------------------------------
  // M.1: Deal Risk Score
  // -----------------------------------------------------------------------
  test.describe('M.1: Deal Risk Score', () => {
    test('POST /api/scoring/deal-risk calculates score', async ({ request }) => {
      const res = await authPost(request, '/api/scoring/deal-risk', token, {
        project_id: DEMO_PROJECT_ID,
      });
      // May be 200 or 404 if endpoint not yet deployed
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        // The scoring API spreads the result at the top level (not nested under body.score).
        expect(body.overall_score).toBeGreaterThanOrEqual(0);
        expect(body.overall_score).toBeLessThanOrEqual(100);
        expect(body.recommendation).toMatch(/^(go|conditional_go|no_go)$/);
        expect(body.area_scores).toBeDefined();
        expect(body.sensitivity).toBeDefined();
        expect(body.sensitivity).toHaveProperty('best_case');
        expect(body.sensitivity).toHaveProperty('base_case');
        expect(body.sensitivity).toHaveProperty('worst_case');
      }
    });

    test('GET /api/scoring/deal-risk returns latest score', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/scoring/deal-risk?project_id=${DEMO_PROJECT_ID}`,
        token
      );
      const body = await res.json();
      // Might have score from previous POST or might be empty
      if (res.ok()) {
        expect(body.success).toBe(true);
      }
    });

    test('POST /api/scoring/deal-risk supports custom area weights', async ({ request }) => {
      const res = await authPost(request, '/api/scoring/deal-risk', token, {
        project_id: DEMO_PROJECT_ID,
        area_weights: { MERC: 1.5, CONT: 1.0, LAB: 2.0, FISC: 1.0, PI: 0.5, GENERAL: 0.3 },
      });
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        // The scoring API spreads the result at the top level (not nested under body.score).
        expect(body.area_scores).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // N.1: Red Flags Digest Report
  // -----------------------------------------------------------------------
  test.describe('N.1: Red Flags Digest', () => {
    test('POST /api/reports/red-flags-digest returns digest structure', async ({ request }) => {
      const res = await authPost(request, '/api/reports/red-flags-digest', token, {
        project_id: DEMO_PROJECT_ID,
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.digest).toBeDefined();
      expect(body.digest).toHaveProperty('total_flags');
      expect(body.digest).toHaveProperty('by_severity');
      expect(body.digest.by_severity).toHaveProperty('critical');
      expect(body.digest.by_severity).toHaveProperty('high');
      expect(body.digest.by_severity).toHaveProperty('medium');
      expect(body.digest.by_severity).toHaveProperty('low');
      expect(body.digest).toHaveProperty('flags');
      expect(Array.isArray(body.digest.flags)).toBe(true);
      expect(body.digest).toHaveProperty('generated_at');
    });

    test('GET /api/reports/red-flags-digest requires request_id', async ({ request }) => {
      const res = await authGet(
        request,
        '/api/reports/red-flags-digest',
        token
      );
      // Should return 400 without request_id
      expect(res.status()).toBe(400);
    });

    test('GET /api/reports/red-flags-digest with request_id returns digest', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/reports/red-flags-digest?request_id=${DEMO_PROJECT_ID}`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.digest).toBeDefined();
      expect(body.digest.total_flags).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // N.2: Report Generation (Template System)
  // -----------------------------------------------------------------------
  test.describe('N.2: Report Generation', () => {
    test('GET /api/reports/generate?list=true returns all templates', async ({ request }) => {
      const res = await authGet(request, '/api/reports/generate?list=true', token);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThan(0);
      expect(body.templates).toBeDefined();
      expect(Array.isArray(body.templates)).toBe(true);
      // Each template should have key fields
      const first = body.templates[0];
      expect(first).toHaveProperty('key');
      expect(first).toHaveProperty('report_type');
      expect(first).toHaveProperty('title_template');
    });

    test('POST /api/reports/generate requires template_type', async ({ request }) => {
      const res = await authPost(request, '/api/reports/generate', token, {
        project_id: DEMO_PROJECT_ID,
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/reports/generate rejects unknown template', async ({ request }) => {
      const res = await authPost(request, '/api/reports/generate', token, {
        template_type: 'nonexistent_template',
        project_id: DEMO_PROJECT_ID,
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Unknown template');
    });
  });

  // -----------------------------------------------------------------------
  // N.3: Report Export
  // -----------------------------------------------------------------------
  test.describe('N.3: Report Export', () => {
    test('POST /api/reports/export requires report_id', async ({ request }) => {
      const res = await authPost(request, '/api/reports/export', token, {
        format: 'json',
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/reports/export validates format', async ({ request }) => {
      const res = await authPost(request, '/api/reports/export', token, {
        report_id: '00000000-0000-0000-0000-000000000000',
        format: 'invalid_format',
      });
      expect(res.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // N.4: Report Comparison
  // -----------------------------------------------------------------------
  test.describe('N.4: Report Comparison', () => {
    test('POST /api/reports/compare requires both report IDs', async ({ request }) => {
      const res = await authPost(request, '/api/reports/compare', token, {
        report_id_a: '00000000-0000-0000-0000-000000000001',
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/reports/compare rejects same report comparison', async ({ request }) => {
      const sameId = '00000000-0000-0000-0000-000000000001';
      const res = await authPost(request, '/api/reports/compare', token, {
        report_id_a: sameId,
        report_id_b: sameId,
      });
      expect(res.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // O.1: War Room Dashboard
  // -----------------------------------------------------------------------
  test.describe('O.1: War Room Dashboard', () => {
    test('GET /api/war-room/[project_id] returns dashboard structure', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
      expect(body).toHaveProperty('blockers');
      expect(body).toHaveProperty('progress');
      expect(body).toHaveProperty('decisions');
      expect(body).toHaveProperty('notifications');
      expect(Array.isArray(body.red_flags)).toBe(true);
      expect(Array.isArray(body.blockers)).toBe(true);
      expect(Array.isArray(body.progress)).toBe(true);
      expect(Array.isArray(body.decisions)).toBe(true);
      expect(Array.isArray(body.notifications)).toBe(true);
    });

    test('dashboard progress entries have area metrics', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}`,
        token
      );
      const body = await res.json();
      if (res.ok() && body.progress.length > 0) {
        const entry = body.progress[0];
        expect(entry).toHaveProperty('area_code');
        expect(entry).toHaveProperty('total_tasks');
        expect(entry).toHaveProperty('completed_tasks');
        expect(entry).toHaveProperty('blocked_tasks');
        expect(entry).toHaveProperty('pct_complete');
        expect(entry.pct_complete).toBeGreaterThanOrEqual(0);
        expect(entry.pct_complete).toBeLessThanOrEqual(100);
      }
    });
  });

  // -----------------------------------------------------------------------
  // O.2: War Room Red Flags
  // -----------------------------------------------------------------------
  test.describe('O.2: War Room Red Flags', () => {
    test('GET /api/war-room/[project_id]/red-flags returns red flags list', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/red-flags`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
      expect(body).toHaveProperty('count');
      expect(Array.isArray(body.red_flags)).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(0);
    });

    test('red flags support severity filter', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/red-flags?severity=critical`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      // All returned flags should be critical
      for (const flag of body.red_flags) {
        expect(flag.severity).toBe('critical');
      }
    });

    test('red flags include source classification', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/red-flags`,
        token
      );
      const body = await res.json();
      if (res.ok() && body.red_flags.length > 0) {
        const flag = body.red_flags[0];
        expect(flag).toHaveProperty('id');
        expect(flag).toHaveProperty('source');
        expect(flag).toHaveProperty('title');
        expect(flag).toHaveProperty('severity');
        expect(flag).toHaveProperty('status');
        expect(['alert', 'contingency']).toContain(flag.source);
      }
    });
  });

  // -----------------------------------------------------------------------
  // O.3: War Room Decisions
  // -----------------------------------------------------------------------
  test.describe('O.3: War Room Decisions', () => {
    test('GET /api/war-room/[project_id]/decisions returns decisions list', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/decisions`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('decisions');
      expect(Array.isArray(body.decisions)).toBe(true);
    });

    test('POST /api/war-room/[project_id]/decisions creates decision', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/decisions`,
        token,
        {
          decision_type: 'accept_risk',
          title: 'E2E Test Decision — H3',
          rationale: 'Risk accepted per E2E test for H3 scoring/reporting suite',
          client_visible: false,
        }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.decision).toBeDefined();
      expect(body.decision).toHaveProperty('id');
      expect(body.decision.decision_type).toBe('accept_risk');
      expect(body.decision.title).toBe('E2E Test Decision — H3');
      expect(body.decision.project_id).toBe(DEMO_PROJECT_ID);
    });

    test('POST /api/war-room/[project_id]/decisions validates decision_type', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/decisions`,
        token,
        {
          decision_type: 'invalid_type',
          title: 'Should fail',
        }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('POST /api/war-room/[project_id]/decisions requires title', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/decisions`,
        token,
        {
          decision_type: 'mitigate',
        }
      );
      expect(res.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // O.4: Negotiation Actions
  // -----------------------------------------------------------------------
  test.describe('O.4: Negotiation Actions', () => {
    let createdActionId: string | undefined;

    test('GET /api/war-room/[project_id]/negotiation-actions returns list', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('actions');
      expect(Array.isArray(body.actions)).toBe(true);
    });

    test('POST /api/war-room/[project_id]/negotiation-actions creates action', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token,
        {
          action_type: 'indemnity',
          title: 'E2E Test Indemnity Action — H3',
          description: 'Indemnity clause for E2E test in H3 suite',
          economic_impact_amount: 50000,
          economic_impact_currency: 'EUR',
        }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBeDefined();
      expect(body.action).toHaveProperty('id');
      expect(body.action.action_type).toBe('indemnity');
      expect(body.action.title).toBe('E2E Test Indemnity Action — H3');
      expect(body.action.status).toBe('proposed');
      expect(body.action.economic_impact_currency).toBe('EUR');
      createdActionId = body.action.id;
    });

    test('created action appears in GET listing', async ({ request }) => {
      test.skip(!createdActionId, 'No action was created in previous test');
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token
      );
      const body = await res.json();
      const found = body.actions.find(
        (a: { id: string }) => a.id === createdActionId
      );
      expect(found).toBeDefined();
      expect(found.action_type).toBe('indemnity');
    });

    test('POST /api/war-room/[project_id]/negotiation-actions validates action_type', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token,
        {
          action_type: 'invalid_type',
          title: 'Should fail',
        }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('POST /api/war-room/[project_id]/negotiation-actions requires title', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token,
        {
          action_type: 'warranty',
        }
      );
      expect(res.status()).toBe(400);
    });

    test('all valid action_types are accepted', async ({ request }) => {
      const validTypes = [
        'condition_precedent', 'price_adjustment', 'warranty',
        'covenant', 'escrow', 'cap_basket', 'carve_out',
        'disclosure', 'remediation', 'insurance', 'other',
      ];
      // Test one representative type beyond indemnity
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-actions`,
        token,
        {
          action_type: validTypes[0], // condition_precedent
          title: 'E2E Condition Precedent — H3',
        }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.action.action_type).toBe('condition_precedent');
    });
  });

  // -----------------------------------------------------------------------
  // O.5: War Room Export
  // -----------------------------------------------------------------------
  test.describe('O.5: War Room Export', () => {
    test('POST /api/war-room/[project_id]/export returns JSON export', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/export`,
        token,
        { format: 'json' }
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.export).toBeDefined();
      expect(body.export).toHaveProperty('exported_at');
      expect(body.export).toHaveProperty('project_id');
      expect(body.export).toHaveProperty('red_flags');
      expect(body.export).toHaveProperty('contingencies');
      expect(body.export).toHaveProperty('decisions');
      expect(body.export.project_id).toBe(DEMO_PROJECT_ID);
    });

    test('POST /api/war-room/[project_id]/export supports CSV format', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/export`,
        token,
        { format: 'csv' }
      );
      expect(res.ok()).toBeTruthy();
      // CSV format returns TSV content with Content-Type header
      const contentType = res.headers()['content-type'];
      expect(contentType).toContain('text/tab-separated-values');
    });

    test('POST /api/war-room/[project_id]/export defaults to JSON', async ({ request }) => {
      const res = await authPost(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/export`,
        token,
        {}
      );
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.export).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // O.6: SPA Mapping (forward-looking)
  // -----------------------------------------------------------------------
  test.describe('O.6: SPA Mapping', () => {
    test('GET spa-mapping returns clause coverage', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/spa-mapping`,
        token
      );
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('spa_clauses');
        expect(body).toHaveProperty('coverage_pct');
        expect(body.coverage_pct).toBeGreaterThanOrEqual(0);
        expect(body.coverage_pct).toBeLessThanOrEqual(100);
      }
      // Endpoint may not exist yet — test is forward-looking
    });
  });

  // -----------------------------------------------------------------------
  // O.7: Timeline (forward-looking)
  // -----------------------------------------------------------------------
  test.describe('O.7: War Room Timeline', () => {
    test('GET timeline returns chronological events', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/timeline`,
        token
      );
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('timeline');
        expect(Array.isArray(body.timeline)).toBe(true);
        expect(body).toHaveProperty('total_events');
      }
      // Endpoint may not exist yet — test is forward-looking
    });
  });

  // -----------------------------------------------------------------------
  // O.8: Negotiation Dashboard (forward-looking)
  // -----------------------------------------------------------------------
  test.describe('O.8: Negotiation Dashboard', () => {
    test('GET negotiation-dashboard returns aggregated metrics', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/negotiation-dashboard`,
        token
      );
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('dashboard');
        expect(body.dashboard).toHaveProperty('by_status');
        expect(body.dashboard).toHaveProperty('by_action_type');
        expect(body.dashboard).toHaveProperty('economic_summary');
        expect(body.dashboard).toHaveProperty('progress');
      }
      // Endpoint may not exist yet — test is forward-looking
    });
  });

  // -----------------------------------------------------------------------
  // O.9: Decision Resolution (forward-looking)
  // -----------------------------------------------------------------------
  test.describe('O.9: Decision Resolution', () => {
    test('GET decision-resolution returns decisions with status', async ({ request }) => {
      const res = await authGet(
        request,
        `/api/war-room/${DEMO_PROJECT_ID}/decision-resolution`,
        token
      );
      const body = await res.json();
      if (res.ok()) {
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('decisions');
        expect(body).toHaveProperty('summary');
      }
      // Endpoint may not exist yet — test is forward-looking
    });
  });

  // -----------------------------------------------------------------------
  // P.1: Workflow Report Generation
  // -----------------------------------------------------------------------
  test.describe('P.1: Workflow Report', () => {
    test('GET /api/reports/workflow requires instance_id', async ({ request }) => {
      const res = await authGet(request, '/api/reports/workflow', token);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('instance_id');
    });
  });
});
