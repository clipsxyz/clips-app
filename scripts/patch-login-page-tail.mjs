import fs from 'fs';

const path = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  '<motionless />',
  'FULLSCREEN_OUTER',
);

// Fix max-w wrapper
s = s.replace(
  '<motionless />',
  'FULLSCREEN_OUTER',
);
