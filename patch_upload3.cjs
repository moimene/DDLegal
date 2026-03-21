const fs = require('fs');
const file = 'src/components/vdr/UploadDropzone.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    `<button
                                    onClick={() => removeFile(qf.id)}
                                    disabled={isUploading}
                                    title="Eliminar"
                                    style={{`,
    `<button
                                    onClick={() => removeFile(qf.id)}
                                    disabled={isUploading}
                                    title="Eliminar"
                                    aria-label={\`Eliminar archivo \${qf.file.name}\`}
                                    style={{`
);

fs.writeFileSync(file, content);
