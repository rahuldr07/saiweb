const flag = import.meta.env.VITE_DEMO_IDENTITY

export const DEMO_IDENTITY: boolean = import.meta.env.DEV || flag === 'true'

if (!import.meta.env.DEV && DEMO_IDENTITY) {
  console.warn(
    '[titlecrm] VITE_DEMO_IDENTITY is on in a production build: sign-in accepts ' +
      'any password for any address on the roster. Remove it from .env.production ' +
      'before this build is put in front of real records.',
  )
}
