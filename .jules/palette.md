## 2025-03-03 - Missing ARIA label on icon-only close button in ReportCompare
**Learning:** Icon-only buttons used for closing modals or panels frequently miss `aria-label` or `title` attributes, which hurts accessibility for screen reader users. The "X" button in `ReportCompare` is an example.
**Action:** Consistently add descriptive `aria-label` and `title` to icon-only buttons to ensure they are accessible.
