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

s = s.replace(
  `        ) : (
        <motionless />
          className="w-full max-w-md mx-auto flex flex-1 flex-col min-h-0 rounded-2xl p-[1.5px] shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
        >
        <form`,
  `        ) : (
        <form`,
);
