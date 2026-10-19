## 2024-05-24 - Deal Risk Score Optimization
**Learning:** Found an O(N^2) complexity issue inside `calculateDealRiskScore` when aggregating area scores and matching critical severity due to `activeFindingsAll.find()`. Consolidating loop operations improves performance significantly without losing functionality.
**Action:** Always combine array filtering, mapping, and aggregate accumulations when iterating through the same list, avoiding multiple passes and inner lookups.
