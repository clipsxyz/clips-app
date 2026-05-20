import fs from 'fs';

const path = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  `        : step === 3
          ? 'Step 3: Profile photo'
;`,
  `        : 'Step 3: Profile photo';`,
);

s = s.replace(
  `  function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupFieldErrors({});
    setSignupError('');
    updateStep(4);
  }

  async function handleInterestsSubmit(e: React.FormEvent) {`,
  `  async function handleProfilePictureSubmit(e: React.FormEvent) {`,
);

s = s.replace('      interests,\n', '      interests: [],\n');

s = s.replace(
  /  function toggleInterest\(interest: string\) \{[\s\S]*?  \}\n\n  function handleProfilePictureSelect/,
  '  function handleProfilePictureSelect',
);

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

s = s.replace('step < 4', 'step < 3');

s = s.replace(
  `        ) : (
        <div
          className="w-full max-w-md mx-auto flex flex-1 flex-col min-h-0 rounded-2xl p-[1.5px] shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
        >
        <form`,
  `        ) : (
        <form`,
);

s = s.replace(
  'className="rounded-2xl bg-black flex flex-1 flex-col min-h-0 overflow-hidden"',
  'className="flex flex-1 flex-col min-h-0 w-full h-full overflow-hidden bg-black"',
);

s = s.replace(
  'className="h-full min-h-0 flex-1 flex-col overflow-hidden items-center px-4 sm:px-6 py-4 sm:py-6 relative"',
  'className="h-full min-h-0 flex-1 flex-col overflow-hidden w-full relative bg-black"',
);

s = s.replace('w-full max-w-md flex-1', 'w-full flex-1');

const loginGradientOpen =
  '          <div\n            className="max-w-md mx-auto rounded-2xl p-0.5 shadow-lg"\n            style={{ background: \'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)\' }}\n          >';
const loginFlatOpen = '          <div className="flex flex-1 flex-col min-h-0 w-full px-6 sm:px-10">';
s = s.replace(loginGradientOpen, loginFlatOpen);

s = s.replace(/<\/form>\n      <\/div>\n        \)\}/g, '</form>\n        )}');

fs.writeFileSync(path, s);
console.log('patched layout', path);
