const fs = require('fs');
const file = 'src/components/vdr/UploadDropzone.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    `                                    title="Eliminar"
                                    aria-label={\`Eliminar archivo \${qf.file.name}\`}
                                    aria-label={\`Eliminar archivo \${qf.file.name}\`}`,
    `                                    title="Eliminar"
                                    aria-label={\`Eliminar archivo \${qf.file.name}\`}`
);

fs.writeFileSync(file, content);
