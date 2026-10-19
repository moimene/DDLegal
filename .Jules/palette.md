## 2026-03-05 - Custom Collapsible Components Accessibility
**Learning:** Custom collapsible components must bind their toggle button to their details panel using `aria-controls` and an `id` to ensure screen reader users understand the relationship between the trigger and the content.
**Action:** When implementing custom interactive elements, always verify that ARIA attributes like `aria-expanded` are paired with a corresponding `aria-controls` pointing to the controlled container's ID.
