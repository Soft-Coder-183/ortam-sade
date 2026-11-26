// Demo paketinde (tanitim/demo.mjs) veri.mjs'in kullandığı Node modüllerinin tarayıcı karşılıkları.
// fs.readFileSync yalnızca örnek PDF'ler için çağrılır: tek sayfalık küçük bir PDF döner.
const pdf = metin => {
  const icerik = `BT /F1 20 Tf 72 720 Td (${metin}) Tj ET`;
  const nesneler = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let s = '%PDF-1.4\n';
  const yer = [];
  nesneler.forEach((n, i) => { yer.push(s.length); s += `${i + 1} 0 obj\n${n}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n` + yer.map(y => `${String(y).padStart(10, '0')} 00000 n \n`).join('');
  s += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(s);
};
export const readFileSync = () => pdf('ETU Ortam demo - ornek belge (uydurma)');
export const fileURLToPath = u => String(u);
export default { readFileSync };
