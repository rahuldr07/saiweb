import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Two pieces of chrome that any screen may reach for: the single modal the shell
 * owns, and the quiet toast the design uses instead of confirmation dialogs.
 */
export interface ModalSpec {
  title: string
  body: ReactNode
  footer?: ReactNode
}

interface UiValue {
  modal: ModalSpec | null
  openModal: (spec: ModalSpec) => void
  closeModal: () => void
  toastText: string | null
  toast: (message: string) => void
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalSpec | null>(null)
  const [toastText, setToastText] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const toast = useCallback((message: string) => {
    setToastText(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToastText(null), 2600)
  }, [])

  const value = useMemo<UiValue>(
    () => ({
      modal,
      openModal: setModal,
      closeModal: () => setModal(null),
      toastText,
      toast,
    }),
    [modal, toastText, toast],
  )

  return <UiContext value={value}>{children}</UiContext>
}

export function useUi(): UiValue {
  const ctx = use(UiContext)
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>')
  return ctx
}
