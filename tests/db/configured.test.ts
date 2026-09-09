import { describe, expect, it } from 'vitest'

/**
 * The other two files in this directory skip themselves when the environment is
 * incomplete, which is right on a laptop and dangerous in CI: drop one of these
 * variables from the workflow and all 28 tenant-isolation tests stop running
 * while the build stays green. This is the assertion that goes red instead.
 *
 * All three, not just the database: `api.test.ts` also needs
 * BETTER_AUTH_SECRET, and losing it would silently skip that whole file.
 */
describe.skipIf(!process.env.CI)('CI', () => {
  it('has a database, so nothing in tests/db can skip itself', () => {
    for (const name of ['DATABASE_URL', 'APP_DATABASE_URL', 'BETTER_AUTH_SECRET']) {
      expect(process.env[name], `${name} is unset — tests/db would skip silently`).toBeTruthy()
    }
  })
})
