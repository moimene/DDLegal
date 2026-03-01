## 2024-05-15 - [Collapsible Regions Accessibility]
**Learning:** Custom collapsible panels (like EventFeed) in this application lack `aria-expanded` and `aria-controls` bindings, which makes it difficult for screen readers to properly interpret the disclosure relationship.
**Action:** Always pair custom toggle buttons with `aria-expanded` corresponding to their collapsed state, and link them to the content container via `aria-controls` and an `id`.
