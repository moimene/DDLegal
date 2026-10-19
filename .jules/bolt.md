
## 2024-05-02 - Array Nested Lookup Anti-Pattern
**Learning:** When aggregating or decorating arrays with related state (like mapping scored findings and calculating critical counts from the original findings), using an inner `.find()` within the aggregation loop creates a hidden O(N²) bottleneck. Even with modest array sizes in scoring calculations, this CPU time scales non-linearly.
**Action:** Always combine the mapping phase and the aggregation phase into a single pass when possible. When iterating through large lists to group or score items, combine operations into a single pass to achieve O(N) complexity.
