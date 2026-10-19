## 2026-04-17 - Dynamic aria-controls on unmounted panels
**Learning:** When using `aria-controls` on a toggle button that conditionally unmounts its content, pointing to a non-existent DOM ID causes accessibility issues.
**Action:** Set `aria-controls={isExpanded ? panelId : undefined}` and generate a unique `panelId` using React's `useId()` hook.
