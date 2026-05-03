import { test, expect } from "bun:test";
import { calculateDealRiskScore, ScoringInput } from "../deal-risk-score";

test("calculateDealRiskScore correctly calculates scores with single pass optimization", () => {
  const mockFindings: ScoringInput[] = [
    {
      id: "1",
      title: "Finding 1",
      severity: "critical",
      probability: "certain",
      timing: "blocking",
      area_code: "MERC",
      economic_impact_amount: 1000
    },
    {
      id: "2",
      title: "Finding 2",
      severity: "high",
      probability: "probable",
      timing: "post_closing",
      area_code: "CONT",
      economic_impact_amount: 500
    }
  ];

  const result = calculateDealRiskScore(mockFindings);

  expect(result.scored_findings.length).toBe(2);
  expect(result.deal_breakers.length).toBe(1);
  expect(result.deal_breakers[0].id).toBe("1");
  expect(result.total_economic_exposure).toBe(1500);
  expect(Object.keys(result.area_scores).length).toBe(2);
  expect(result.area_scores["MERC"].critical_count).toBe(1);
  expect(result.area_scores["CONT"].critical_count).toBe(0);
});
