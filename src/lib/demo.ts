/**
 * Whether the demonstration affordances are available.
 *
 * Switching identity from a list of people, with no password, is how the
 * permission model is inspected — a lead really does get a different sidebar and
 * a different register, which is worth being able to show. But it sits at
 * exactly the seam where real authentication goes, and a switcher that reaches a
 * deployed build is not a demo, it is a way to become somebody else.
 *
 * So it is gated, and the gate is deliberately narrow: on in development, and in
 * a build only when someone has explicitly asked for it. The default for any
 * build is off.
 */
const flag = import.meta.env.VITE_DEMO_IDENTITY

export const DEMO_IDENTITY: boolean = import.meta.env.DEV || flag === 'true'

/**
 * Said out loud on the screen itself, so nobody has to infer it from the absence
 * of a control.
 */
export const DEMO_IDENTITY_NOTE =
  'Choosing a person swaps the session without a password. This is available in ' +
  'development only — a deployed build authenticates with Better Auth, and ' +
  'permissions come from the database either way, so what each role can reach is ' +
  'identical.'
