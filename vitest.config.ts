import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Two suites, and they need different things.
 *
 *  - `tests/rules` covers the pure domain functions — the assignment engine, the
 *    SLA planner, payroll. No database, no browser, runs everywhere.
 *  - `tests/db` covers tenant isolation, which can only be tested against a real
 *    Postgres because the thing under test *is* Postgres. It skips itself when
 *    APP_DATABASE_URL is unset, so `npm test` still works with no database.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    /* The isolation tests share one database; running the files in parallel would
       have them truncating each other's fixtures. */
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      /* Only the code these two suites are meant to cover: the domain rules, the
         stores behind them — several of which sit beside the screen they serve,
         under `src/screens` — and the API. Components are left out because
         nothing renders them here, and counting them would bury the number that
         matters. No thresholds until there is a measurement worth holding to. */
      include: ['src/lib/**', 'src/state/**', 'src/screens/**/*.ts', 'server/**'],
      exclude: ['**/*.tsx', 'src/lib/use*.ts', 'server/db/seed.ts', 'server/db/reset.ts'],
    },
  },
})
