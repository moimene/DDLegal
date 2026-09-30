## 2026-03-01 - UX/Accessibility Insight
**Learning:** Found explicit mouse event handlers (`onMouseEnter`, `onMouseLeave`) used for hover effects on project list items in the sidebar project selector. This violates standard Tailwind UI practices where CSS utility classes like `hover:bg-opacity-80` should be preferred for better rendering performance and maintainability.
**Action:** Replace inline JS event listeners with native CSS class implementations (e.g. `className="..."` with Tailwind hover variants) when working on list items to improve code robustness and performance.
