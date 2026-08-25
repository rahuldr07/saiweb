/**
 * Whether the demonstration affordances are available.
 *
 * There is no database in this build, so there is nothing for a password to be
 * checked against. This flag is what lets sign-in proceed anyway: the email
 * picks the person off the roster, the password is required but not verified.
 * That keeps the shape of the real flow while the check behind it is missing.
 *
 * It sits at exactly the seam where real authentication goes, and a build that
 * accepts any password is not a demonstration once it holds real records. So it
 * is gated, and the gate is deliberately narrow: on in development, and in a
 * build only when someone has explicitly asked for it. The default is off.
 */
const flag = import.meta.env.VITE_DEMO_IDENTITY

export const DEMO_IDENTITY: boolean = import.meta.env.DEV || flag === 'true'

/*
 * A built bundle carries its flags baked in, and nothing about the running
 * application looks different — which is how a demonstration flag survives into
 * a deployment nobody meant it to reach. This is the one place that can still
 * tell anyone, so it does, once, at startup.
 *
 * Development is silent: the flag is meant to be on there.
 */
if (!import.meta.env.DEV && DEMO_IDENTITY) {
  console.warn(
    '[titlecrm] VITE_DEMO_IDENTITY is on in a production build: sign-in accepts ' +
      'any password for any address on the roster. Remove it from .env.production ' +
      'before this build is put in front of real records.',
  )
}
