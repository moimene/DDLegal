## 2024-05-24 - Deal Risk Score Optimization
**Learning:** When iterating through large lists to group or score items (as in calculateDealRiskScore), separate filter, map, and loop operations with nested lookups (like Array.prototype.find) can cause severe O(N²) performance degradation.
**Action:** Always combine operations into a single pass to achieve O(N) complexity and avoid performance bottlenecks from nested lookups.
