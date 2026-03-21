
## 2024-05-19 - Missing ARIA labels on Icon-only Action Buttons
**Learning:** Found multiple instances where critical actions (like deleting a file, closing a comparison view, or marking a file as confidential) used purely visual icons with only `title` attributes, lacking appropriate `aria-label` or `aria-pressed` definitions for screen reader accessibility.
**Action:** When working on interactive UI elements, especially icon-only buttons (`<button><Icon /></button>`), proactively check for and implement explicit `aria-label` attributes to define their functionality and state correctly.
