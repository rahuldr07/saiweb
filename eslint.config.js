import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  /* All output, none of it source: `dist` and `drizzle` are built, `.vercel`
     holds the deployed bundles, and `coverage` and `shots` are what a test or
     screenshot run leaves behind. */
  { ignores: ['dist', 'drizzle', '.vercel', 'coverage', 'shots'] },
  /* Seed data, not logic. The bulk of it is transcribed from the design export
     by script, which is why `.gitattributes` marks those files
     linguist-generated; the rest are hand-written fixtures in the same shape.
     `types.ts` is the exception — the hand-maintained domain model, so it is
     held to the same rules as the rest of the source. */
  { ignores: ['src/data/*.ts', '!src/data/types.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      /* Type-aware linting. The project files between them cover every
         `.ts`/`.tsx` in the repo, so the service resolves each one without a
         per-file `project` list to keep in step. `src/lib` is in two of them —
         the app project and the stricter `tsconfig.lib.json` — and the service
         picks one; nothing here depends on which. */
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      /* A click handler has nothing to wait with, and TanStack's `navigate` is
         async — `useGo` in `src/lib/nav.ts` is where that promise ends. */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      /* Off until `noUncheckedIndexedAccess` is on. Without it TypeScript
         believes `record[key]` and `array[i]` always hold a value, so the rule
         reads the guards around them as dead code: 201 warnings here against 29
         with the flag set, and most of the difference is a guard that stops a
         real crash. Setting the flag is 587 type errors — its own change, and
         the one that has to land first. */
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      /* The clock is injected, and every countdown, overdue flag, SLA
         checkpoint and payroll period is measured against it. One screen had
         already drifted back to the wall clock, which stamped a payroll
         approval with a date the rest of the register disagreed with and made
         the value untestable. `src/lib/clock.ts` is the exception below. */
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Read the clock through `now()` from @/lib/clock, not `new Date()`.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Read the clock through `now()` from @/lib/clock, not `Date.now()`.',
        },
      ],
    },
  },
  {
    /* Where the clock itself is defined, and the places allowed to say what real
       time is: the entry point that points it at the wall clock, the server,
       which has no seed clock to pin, and the database fixtures, whose keys must
       be unique per run rather than reproducible. */
    files: ['src/lib/clock.ts', 'src/main.tsx', 'server/**/*.ts', 'tests/db/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    /* This file and the command-line scripts are plain Node modules, outside the
       application and its build. Without a block of their own they match no
       `files` glob, and a config that matches nothing lints nothing. */
    extends: [js.configs.recommended],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    /* These drive Playwright, so parts of them are browser code: the callbacks
       handed to `page.evaluate` and `page.addInitScript` are serialised and run
       inside the page, where `window` and `document` are the real ones. Nothing
       in the file's own scope may use them, but eslint cannot see the boundary,
       so the globals are granted for the whole file. */
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.browser } },
  },
)
