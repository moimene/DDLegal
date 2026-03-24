1. **Analyze UX/A11y opportunity**: `src/components/layout/sidebar.tsx` has groups that can be toggled to expand/collapse (e.g., `aria-expanded={!isGroupCollapsed}`). However, they are conditionally rendered using `{!isGroupCollapsed && ...}` instead of using CSS classes like `hidden`. Also, they are missing `aria-controls` bindings to their respective content panels, and the content panels are missing `id` attributes that match `aria-controls`.

Wait, the prompt memory mentions:
"Always add `aria-expanded` and `aria-controls` bindings with matching `id` attributes to custom collapsible panels/components. Use React's `useId()` hook (at the top level, avoiding `.map()` loops to respect Rules of Hooks) or stable unique properties (like `group.id`) to generate these IDs. Transition content visibility using CSS (e.g., Tailwind's `hidden` vs `block`) rather than conditional rendering (unmounting) so `aria-controls` always references an existing element in the DOM."

This is a perfect micro-UX/A11y task. I will implement this exact enhancement for the collapsible groups in `sidebar.tsx`.

Let's read the current group rendering in `src/components/layout/sidebar.tsx`.
