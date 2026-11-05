/**
 * react-native-compressor 1.19 still uses the AGP 7 `lintOptions` block.
 * AGP 8 (this app) only accepts `lint { }`, which otherwise fails the native build.
 */
import fs from 'node:fs';
import path from 'node:path';

const gradlePath = path.join(
    process.cwd(),
    'node_modules/react-native-compressor/android/build.gradle',
);
if (!fs.existsSync(gradlePath)) {
    process.exit(0);
}
const text = fs.readFileSync(gradlePath, 'utf8');
const next = text.replace(
    /lintOptions\s*\{\s*disable "GradleCompatible"\s*\}/,
    'lint {\n    disable "GradleCompatible"\n  }',
);
if (next !== text) {
    fs.writeFileSync(gradlePath, next);
    console.log('Patched react-native-compressor android/build.gradle for AGP 8');
}
