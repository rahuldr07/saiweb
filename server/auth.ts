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

/**
 * Refuses to continue without a signing secret.
 *
 * Better Auth signs session cookies with this. Unset, it is left to whatever the
 * library falls back to — which is not stable across a restart, and not shared
 * between the instances of a deployment, so sessions stop verifying for reasons
 * that look like anything except a missing environment variable. The row-level
 * security check in `db/connect` refuses to start for the same class of reason:
 * a misconfiguration with no symptom is worse than one that stops the server.
 */
export function assertAuthSecretIsSet(): void {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET is missing or shorter than 32 characters. Sessions cannot ' +
        'be signed safely without it. Generate one with: openssl rand -base64 32',
    )
  }
}

export type Session = typeof auth.$Infer.Session
