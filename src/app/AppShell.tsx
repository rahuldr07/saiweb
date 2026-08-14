import { useEffect, useRef } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useUi } from '@/state/ui'
import { useSession } from '@/state/session'

/** `/orders/4192254-2` and `/orders` are both the Orders screen as far as the nav is concerned. */
const routeIdOf = (pathname: string) => pathname.split('/').filter(Boolean)[0] ?? 'dash'

function Modal() {
  const { modal, closeModal } = useUi()
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (modal) {
      returnFocus.current = document.activeElement as HTMLElement
    } else {
      returnFocus.current?.focus?.()
    }
  }, [modal])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, closeModal])

  return (
    <div
      className={`mask${modal ? ' on' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      {modal ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mdt">
          <div className="mh">
            <h3 id="mdt">{modal.title}</h3>
            <button type="button" className="x" onClick={closeModal} aria-label="Close">
              ×
            </button>
          </div>
          <div className="mb">{modal.body}</div>
          {modal.footer ? <div className="mf">{modal.footer}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

function Toast() {
  const { toastText } = useUi()
  return (
    <div id="toast" className={toastText ? 'on' : ''} role="status" aria-live="polite">
      {toastText}
    </div>
  )
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = routeIdOf(pathname)
  const { setNavOpen } = useSession()
  const main = useRef<HTMLElement>(null)

  /* Each screen change scrolls to the top, re-runs the stagger, and closes the
     mobile drawer — the same three things the design does on every navigation. */
  useEffect(() => {
    window.scrollTo(0, 0)
    setNavOpen(false)
    const el = main.current
    if (!el) return
    el.classList.remove('anim')
    void el.offsetWidth
    el.classList.add('anim')
  }, [pathname, setNavOpen])

  return (
    <>
      <div className="app">
        <Sidebar current={current} />
        <div className="main">
          <a href="#main" className="skip">
            Skip to content
          </a>
          <TopBar current={current} />
          <main className="wrap anim" id="main" ref={main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <Modal />
      <Toast />
    </>
  )
}
