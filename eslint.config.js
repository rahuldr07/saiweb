import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'drizzle', 'src/data/*.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /* The design's own short field names (n, d, k, st) read the same way the
         seed data does; renaming them would make the two disagree. */
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
    files: [
      'src/lib/clock.ts',
      'src/main.tsx',
      'server/**/*.ts',
      'scripts/**/*.mjs',
      'tests/db/**/*.ts',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
)
