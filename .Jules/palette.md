## 2024-05-24 - Improve keyboard focus and ARIA on User Indicator
**Learning:** Interactive elements with inline styles often lack explicit `focus-visible` rings, harming keyboard accessibility. Decorational icons inside buttons without `aria-hidden` can cause redundant screen reader output.
**Action:** Added explicit `focus-visible` classes and `aria-hidden="true"` to decorative icons in the user indicator.
