import fs from 'fs';

const path = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/const interestOptions = \[[\s\S]*?\];\n\n/, '');
s = s.replace(
  'const step = (stepFromUrl >= 1 && stepFromUrl <= 4) ? stepFromUrl : 1;',
  'const step = (stepFromUrl >= 1 && stepFromUrl <= 3) ? stepFromUrl : 1;',
);
s = s.replace("          : 'Step 4: Your interests';", ';');
s = s.replace('if (newStep >= 1 && newStep <= 4) {', 'if (newStep >= 1 && newStep <= 3) {');
s = s.replace('  const [interests, setInterests] = React.useState<string[]>([]);\n', '');

const oldProfileSubmit = `  function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupFieldErrors({});
    setSignupError('');
    updateStep(4);
  }

  async function handleInterestsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupFieldErrors({});
    setSignupError('');
    setSignupSubmitting(true);`;

const newProfileSubmit = `  async function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupFieldErrors({});
    setSignupError('');
    setSignupSubmitting(true);`;

s = s.replace(oldProfileSubmit, newProfileSubmit);
s = s.replace('      interests,\n', '      interests: [],\n');
s = s.replace(
  /  function toggleInterest\(interest: string\) \{[\s\S]*?  \}\n\n  function handleProfilePictureSelect/,
  '  function handleProfilePictureSelect',
);
s = s.replace('step < 4', 'step < 3');

s = s.replace(
  /onSubmit=\{\s*step === 1\s*\? handleAccountSubmit\s*: step === 2\s*\? handleLocationSubmit\s*: step === 3\s*\? handleProfilePictureSubmit\s*: handleInterestsSubmit\s*\}/,
  'onSubmit={\n            step === 1\n              ? handleAccountSubmit\n              : step === 2\n                ? handleLocationSubmit\n                : handleProfilePictureSubmit\n          }',
);

s = s.replace(
  /\s*<div\n\s*className=\{`h-1 rounded-full transition-all \$\{step >= 4 \? '' : 'bg-gray-300'\}`\}[\s\S]*?width: '40px' \}\}\n\s*><\/div>/,
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

fs.writeFileSync(path, s);
console.log('logic patched', path);
