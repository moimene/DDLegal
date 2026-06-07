## 2024-06-07 - Add accessibility labels and focus states to folder tree items

**Learning:** When expanding an app with complex UI like a file/folder tree, components like folders often lack screen-reader accessible names and semantic focus management. Interactive list items mapped as buttons need both aria-expanded states when acting as toggles, and proper textual context for screen readers when handling complex internal elements.
**Action:** Always ensure that interactive elements behaving as tree nodes receive appropriate `aria-expanded` and `aria-label` tags to guarantee keyboard/screen reader navigability, and maintain the existing styling approach while improving usability.
