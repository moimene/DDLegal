## 2024-03-14 - ReportCompare Close Button
**Learning:** Icon-only close buttons in modals/split views often lack `aria-label` attributes by default, rendering them inaccessible to screen readers. In `ReportCompare.tsx`, adding an `aria-label` like "Cerrar comparación" fixes this critical accessibility gap.
**Action:** Always verify that icon-only interactive elements (like `X` from Lucide React) within modals and panels have an explicitly set `aria-label`.
