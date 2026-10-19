## 2026-03-11 - Accessibility: Connect Toggle Buttons to Content Containers
**Learning:** It's a key accessibility standard in this codebase to ensure any custom collapsible panels or components (like `SkillCard`) connect their toggle buttons to their collapsible content containers.
**Action:** Always pair `aria-expanded={isExpanded}` with an `aria-controls={contentId}` attribute on the button, and ensure the collapsible content container has a matching `id={contentId}`. Use React's `useId()` hook to safely and cleanly generate these IDs.
