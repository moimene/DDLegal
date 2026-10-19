const fs = require('fs');
const file = 'src/components/reports/ReportCompare.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    `<button
                    onClick={onClose}
                    style={{`,
    `<button
                    onClick={onClose}
                    aria-label="Cerrar comparacion"
                    title="Cerrar"
                    style={{`
);

content = content.replace(
    `<button
                    onClick={onClose}
                    style={{`,
    `<button
                    onClick={onClose}
                    aria-label="Cerrar"
                    title="Cerrar"
                    style={{`
);

fs.writeFileSync(file, content);
