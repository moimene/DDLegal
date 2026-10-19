## 2024-05-14 - Initialize Bolt journal
**Learning:** Initialized the journal.
**Action:** Ready to track critical learnings.
## 2024-05-14 - Optimize Intl instances
**Learning:** Instantiating `Intl.DateTimeFormat` and `Intl.NumberFormat` inside render loops or frequently called utility functions causes performance bottlenecks as they are expensive to recreate.
**Action:** Always extract `Intl` formatters to the module scope as constants or use a cache Map for dynamic parameters like currency.
