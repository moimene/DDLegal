## 2025-04-07 - Add ARIA labels to icon-only buttons
**Learning:** Icon-only buttons often rely on `title` attributes for visual tooltips, but these are insufficient for screen readers. Explicit `aria-label` attributes are needed for accessibility, and must be localized to the primary application language (Spanish).
**Action:** Always verify that buttons containing only icons (like `X`, `RefreshCw`, etc.) explicitly include an `aria-label` attribute describing their function in Spanish.
