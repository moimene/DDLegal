## 2026-04-12 - Icon-Only Button Accessibility in Spanish
**Learning:** Icon-only buttons often lack both `aria-label` and `title`. Both are necessary to support both screen reader users and mouse hover users, and these labels should use appropriate Spanish phrasing (e.g., 'Cerrar comparación').
**Action:** Always provide both an `aria-label` for screen readers and a `title` attribute for hover tooltips on icon-only buttons, ensuring the text is in Spanish to match the UI's primary language.
