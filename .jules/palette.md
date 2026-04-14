## 2025-02-28 - EventFeed Collapsible State
**Learning:** Found a custom collapsible component (`EventFeed`) that was conditionally hiding content natively but failed to expose its visual expanded/collapsed state or ID references to assistive technologies.
**Action:** When working on collapsible panels, ensure `useId()` is used to map `aria-controls` reliably, and accurately toggle `aria-expanded` based on component state to ensure screen readers match the visual UX.
