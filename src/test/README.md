# Frontend tests

Tests use [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/react).

## Run tests

From the project root:

```bash
npm run test        # watch mode
npm run test:run    # single run
```

## Config

- **vite.config.ts**: `test` block sets `globals`, `environment: 'jsdom'`, and `include: ['src/**/*.{test,spec}.{ts,tsx}']`.
- Add test files next to the code they test, e.g. `timeAgo.test.ts` next to `timeAgo.ts`.

## Current tests

- **src/utils/timeAgo.test.ts** – `timeAgo()` for "Just now", minutes, hours, days, weeks, years.

To add more: create `*.test.ts` or `*.spec.ts` under `src/` and run `npm run test:run`.
