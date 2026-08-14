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
    environment: 'node',
    /* The isolation tests share one database; running the files in parallel would
       have them truncating each other's fixtures. */
    fileParallelism: false,
  },
})
