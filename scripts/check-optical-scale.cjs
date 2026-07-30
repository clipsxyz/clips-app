const fs = require('fs');
const path = require('path');
const dir = path.join('src', 'screens');
const bad = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.tsx')) continue;
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  if ((s.match(/ox\(ox\(/g) || []).length) bad.push(`${f}: double ox`);
  const usesOx = (s.match(/\box\(/g) || []).length > 0;
  const hasImport = s.includes("from '../constants/nativeOpticalScale'");
  if (usesOx && !hasImport) bad.push(`${f}: ox without import`);
}
console.log(bad.length ? bad.join('\n') : 'screens look ok');
