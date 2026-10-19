## 2024-05-07 - Missing aria-controls on collapsible elements
**Learning:** Collapsible groups and dropdowns in layout components lack `aria-controls` bindings which are crucial for screen readers to associate the toggle button with the collapsible content.
**Action:** When using `aria-expanded`, ensure it is accompanied by a matching `aria-controls` attribute linking the toggle button to the `id` of the content panel.
