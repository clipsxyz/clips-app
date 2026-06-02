/**
 * RN 0.85 + React 19: VirtualizedList can pass layout props (parent, onLayout, style)
 * onto Fragment roots. Fabric logs "Invalid prop `parent` supplied to React.Fragment"
 * and LogBox can block the UI. Allow those props like upstream RN #50833 does for onLayout.
 */
import fs from 'fs';
import path from 'path';

const targets = [
    'node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js',
    'node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-prod.js',
];

const needle = 'if ("children" !== key && "key" !== key) {';
const replacement =
    'if ("children" !== key && "key" !== key && "parent" !== key && "onLayout" !== key && "style" !== key) {';

let patched = 0;
for (const rel of targets) {
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) {
        console.warn('[patch-rn-fragment] skip (missing):', rel);
        continue;
    }
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes(replacement)) {
        console.log('[patch-rn-fragment] already patched:', rel);
        patched += 1;
        continue;
    }
    if (!src.includes(needle)) {
        console.warn('[patch-rn-fragment] pattern not found:', rel);
        continue;
    }
    fs.writeFileSync(file, src.replace(needle, replacement));
    console.log('[patch-rn-fragment] patched:', rel);
    patched += 1;
}

if (patched === 0) {
    process.exitCode = 1;
}
