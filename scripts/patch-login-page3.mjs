import fs from 'fs';

const path = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  /\n\s*<div\n\s*className=\{`h-1 rounded-full transition-all \$\{step >= 4 \? '' : 'bg-gray-300'\}`\}[\s\S]*?width: '40px' \}\}\n\s*><\/div>/,
  '',
);

const step4Start = s.indexOf('{step === 4 && (');
if (step4Start !== -1) {
  let depth = 0;
  let i = step4Start;
  for (; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') {
      depth--;
      if (depth === 0 && s[i + 1] === '}') {
        i += 2;
        break;
      }
    }
  }
  s = s.slice(0, step4Start) + s.slice(i);
}

s = s.replace(/<\/form>\n      <\/div>\n        \)\}/g, '</form>\n        )}');

const loginGrad =
  '          <motionless />\n            className="max-w-md mx-auto rounded-2xl p-0.5 shadow-lg"';
// fix login - use split join for div tag
const loginGrad2 =
  '          <' +
  'div\n            className="max-w-md mx-auto rounded-2xl p-0.5 shadow-lg"\n            style={{ background: \'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)\' }}\n          >';
if (s.includes(loginGrad2)) {
  s = s.replace(loginGrad2, '          <' + 'div className="flex flex-1 flex-col min-h-0 w-full px-6 sm:px-10">');
}

fs.writeFileSync(path, s);
console.log('patch3 done');
