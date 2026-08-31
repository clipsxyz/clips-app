const fs = require('fs');
const path = require('path');

const screensDir = path.join('src', 'screens');
const files = fs.readdirSync(screensDir).filter((f) => f.endsWith('.tsx'));
const IMPORT_LINE = "import { ox } from '../constants/nativeOpticalScale';";

const STYLE_KEYS = [
  'fontSize',
  'lineHeight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingHorizontal',
  'paddingVertical',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'minHeight',
  'letterSpacing',
];

let updated = 0;

for (const file of files) {
  const fp = path.join(screensDir, file);
  let src = fs.readFileSync(fp, 'utf8');
  const original = src;

  // Drop local ox helpers that used FEED_OPTICAL_SCALE
  src = src.replace(
    /\r?\nfunction ox\(n: number\): number \{\r?\n\s*return Math\.round\(n \* FEED_OPTICAL_SCALE\);\r?\n\}/g,
    '',
  );
  src = src.replace(
    /import \{ FEED_OPTICAL_SCALE \} from '\.\.\/constants\/feedUiTokens';\r?\n/,
    '',
  );

  if (!src.includes("nativeOpticalScale")) {
    const importMatches = [...src.matchAll(/^import .+;$/gm)];
    if (importMatches.length) {
      const last = importMatches[importMatches.length - 1];
      const idx = last.index + last[0].length;
      src = `${src.slice(0, idx)}\n${IMPORT_LINE}${src.slice(idx)}`;
    }
  } else if (!/import\s*\{[^}]*\box\b/.test(src)) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/constants\/nativeOpticalScale['"];/,
      (_m, inner) => `import { ox, ${inner.trim()} } from '../constants/nativeOpticalScale';`,
    );
  }

  for (const key of STYLE_KEYS) {
    const re = new RegExp(`(${key}\\s*:\\s*)(?!ox\\()(-?\\d+(?:\\.\\d+)?)`, 'g');
    src = src.replace(re, (m, prefix, num) => {
      const n = Number(num);
      if (n === 0 || n === 1 || n === -1) return m;
      return `${prefix}ox(${num})`;
    });
  }

  // Common fixed icon/avatar boxes in styles
  src = src.replace(
    /\b(width|height|minWidth|maxWidth)\s*:\s*(?!ox\()(\d{2,3})(?!\d)/g,
    (m, key, num) => {
      const n = Number(num);
      // Scale chrome sizes, not full-bleed layout widths.
      if (n < 12 || n > 96) return m;
      return `${key}: ox(${num})`;
    },
  );

  src = src.replace(/\bsize=\{(?!ox\()(\d+)\}/g, 'size={ox($1)}');
  src = src.replace(/ox\(ox\(([^)]+)\)\)/g, 'ox($1)');

  if (src !== original) {
    fs.writeFileSync(fp, src);
    updated += 1;
    console.log('updated', file);
  }
}

console.log('done', updated, 'files');
