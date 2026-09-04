## 2024-05-24 - Add aria-labels and expanded state to EventFeed toggle
**Learning:** Collapsible feed components need explicit ARIA states (`aria-expanded`) and descriptive labels for screen readers. Simply hiding the visual indicator is not enough.
**Action:** Always add `aria-expanded` matching the `!collapsed` state, and an `aria-label` or visible text that describes the action on feed headers/toggles.
