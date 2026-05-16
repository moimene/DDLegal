import { describe, it, expect } from 'vitest';
import { calculateDealRiskScore } from './deal-risk-score';

describe('calculateDealRiskScore', () => {
  it('should run correctly', () => {
    const findings = [
      { id: '1', title: 'Test 1', severity: 'critical', probability: 'certain', timing: 'blocking', area_code: 'MERC' },
      { id: '2', title: 'Test 2', severity: 'high', probability: 'probable', timing: 'post_closing', area_code: 'MERC' }
    ];
    const result = calculateDealRiskScore(findings);
    expect(result.overall_score).toBeDefined();
  });
});
