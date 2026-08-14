/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Opt the no-password identity switcher into a built bundle. Off unless "true". */
  readonly VITE_DEMO_IDENTITY?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
