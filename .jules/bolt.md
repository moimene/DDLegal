## 2024-06-10 - O(N²) Bottleneck in Deal Risk Score Aggregation
**Learning:** Found a nested `.find()` lookup over `activeFindingsAll` inside a loop iterating over mapped arrays (`scoredFindings`) in `calculateDealRiskScore`. This caused an unnecessary O(N²) iteration which is inefficient and scales poorly as findings increase.
**Action:** Combined the `.map()` pass for calculating scores and the subsequent `.reduce`/`.forEach` loop for area aggregations into a single `for` loop, enabling O(1) access to original elements directly without nested lookups.
