import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/client'
import { account, session, user, verification } from './db/schema'

/**
 * Better Auth owns identity — who you are, and whether you are signed in.
 *
 * It does not own permissions. What a person may do comes from our own `roles` /
 * `role_permissions` tables, scoped to the workspace they are inside, because a
 * person can hold different roles in two companies and an identity provider has
 * no way to express that.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      /** Which workspace this session is currently inside. */
      activeTenantId: { type: 'string', required: false, input: false },
    },
  },
  trustedOrigins: [process.env.APP_URL ?? 'http://localhost:5173'],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL ?? 'http://localhost:8787',
})

export type Session = typeof auth.$Infer.Session
