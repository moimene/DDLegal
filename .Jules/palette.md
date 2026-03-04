## 2025-05-18 - Accessibility for Collapsible Panels
**Learning:** Collapsible panels, dropdowns, and any element using `aria-expanded` must also have an `aria-controls` attribute pointing to the `id` of the collapsible content to ensure full screen reader accessibility.
**Action:** Always add `aria-controls` bindings with matching `id` attributes to custom collapsible panels/components in this codebase.
