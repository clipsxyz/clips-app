import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * `FeedScreen.tsx` is the one file in `src/` that opts out of type checking with
 * `// @ts-nocheck`, and `.eslintignore` excludes all of `src/screens/**` on top of
 * that. Between them, neither `npx tsc --noEmit` nor `npx eslint` can see a single
 * line of the largest file in the app, so an undefined identifier there reaches the
 * device as a `ReferenceError` that crashes the feed render.
 *
 * That is not hypothetical: adding a prop to `FeedScreen`'s render while threading it
 * through the `FeedCard` child produced `ReferenceError: Property 'feedFocusEpoch'
 * doesn't exist` at render time, with tsc still reporting only its usual baseline and
 * eslint reporting nothing.
 *
 * This asserts `no-undef` on that file specifically, with two deliberate deviations
 * from the project eslint config:
 *
 * 1. `useEslintrc: false` — the flat project config intentionally relaxes the react
 *    hook rules because large pages opt out locally, and we want only the scope check.
 * 2. The file's own blanket eslint-disable banner (the bare, all-rules form on line 3)
 *    is stripped before linting. ESLint 8 has no `ignoreInlineConfig` option, and that
 *    banner silences every rule including `no-undef`. Stripping it is what makes this
 *    test able to see anything at all.
 *
 * `__DEV__` is declared explicitly as the only React Native global the file needs.
 */
const FEED_SCREEN = 'src/screens/FeedScreen.tsx';

const stripBlanketDisable = (source: string) =>
    source.replace(/^\/\* eslint-disable[^*]*\*\/\s*$/gm, '');

const lintFeedScreen = async () => {
    const eslint = new ESLint({
        useEslintrc: false,
        ignore: false,
        overrideConfig: {
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            env: { browser: true, es2022: true },
            globals: { __DEV__: 'readonly' },
            rules: { 'no-undef': 'error' },
        },
    });

    const source = readFileSync(resolve(process.cwd(), FEED_SCREEN), 'utf8');
    const [result] = await eslint.lintText(stripBlanketDisable(source), {
        filePath: FEED_SCREEN,
    });
    return result.messages;
};

describe(`${FEED_SCREEN} scope safety`, () => {
    it('references no undefined identifiers', async () => {
        const messages = await lintFeedScreen();
        const report = messages
            .map((m) => `  ${FEED_SCREEN}:${m.line}:${m.column} ${m.message}`)
            .join('\n');
        expect(report, `no-undef violations in ${FEED_SCREEN}:\n${report}`).toBe('');
    }, 30_000);

    it('strips the blanket eslint-disable banner so the scope check can see the file', () => {
        const raw = readFileSync(resolve(process.cwd(), FEED_SCREEN), 'utf8');
        expect(raw).toMatch(/^\/\* eslint-disable \*\//m);
        expect(stripBlanketDisable(raw)).not.toMatch(/^\/\* eslint-disable \*\//m);
    });
});
