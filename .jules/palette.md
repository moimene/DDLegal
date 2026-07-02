## 2024-07-02 - Missing aria-labels on Toggle Headers
**Learning:** Found that custom toggle buttons used as headers (e.g. for "Actividad en Tiempo Real" panel) are missing dynamic `aria-expanded` and `aria-label` attributes, which makes it hard for screen readers to understand the current state or function of the header section.
**Action:** Always ensure that custom accordion-style toggle buttons get `aria-expanded={!collapsed}` and a dynamic `aria-label` that explicitly describes the expand/collapse action for the section.
