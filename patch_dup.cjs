const fs = require('fs');
let content = fs.readFileSync('src/components/layout/sidebar.tsx', 'utf8');

content = content.replace(
    /aria-expanded=\{\!isGroupCollapsed\}\n                    aria-controls=\{\`nav-group-content-\$\{group\.id\}\`\}\n                    aria-controls=\{\`nav-group-content-\$\{group\.id\}\`\}/g,
    'aria-expanded={!isGroupCollapsed}\n                    aria-controls={`nav-group-content-${group.id}`}'
);

fs.writeFileSync('src/components/layout/sidebar.tsx', content);
