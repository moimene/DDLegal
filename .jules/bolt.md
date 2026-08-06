## 2024-07-05 - Avoid Regex String Replacement Inside .find() Loops
**Learning:** Performing regex string replacements (e.g., `replace(/[^a-z0-9]+/g, '-')`) inside nested `.find()` loops over mapped arrays causes severe performance bottlenecks.
**Action:** When matching workflow finding references across arrays, pre-compute normalized title slugs or keys into an O(1) Map outside the iteration.
