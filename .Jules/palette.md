## 2024-04-03 - [Accessibility] Conditional DOM elements and aria-controls
**Learning:** When implementing `aria-controls` on a toggle button that conditionally unmounts its content, accessibility validators will flag a missing reference if `aria-controls` points to an unmounted element's ID.
**Action:** Set `aria-controls` to `undefined` when the content is unmounted (e.g., `aria-controls={collapsed ? undefined : 'panel-id'}`) to prevent pointing to a non-existent DOM ID.
