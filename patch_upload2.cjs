const fs = require('fs');
const file = 'src/components/vdr/UploadDropzone.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    `<button
                                    onClick={() => toggleConfidential(qf.id)}
                                    disabled={isUploading}
                                    title={qf.isConfidential ? 'Confidencial' : 'No confidencial'}
                                    style={{`,
    `<button
                                    onClick={() => toggleConfidential(qf.id)}
                                    disabled={isUploading}
                                    title={qf.isConfidential ? 'Confidencial' : 'No confidencial'}
                                    aria-label={qf.isConfidential ? 'Marcar como no confidencial' : 'Marcar como confidencial'}
                                    aria-pressed={qf.isConfidential}
                                    style={{`
);

content = content.replace(
    `<button
                        onClick={handleUploadAll}
                        disabled={isUploading || queue.length === 0}
                        style={{`,
    `<button
                        onClick={handleUploadAll}
                        disabled={isUploading || queue.length === 0}
                        aria-label={isUploading ? 'Subiendo archivos' : 'Subir todos los archivos'}
                        style={{`
);

fs.writeFileSync(file, content);
