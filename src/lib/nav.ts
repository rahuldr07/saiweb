import { useCallback } from 'react'
import { useNavigate, type NavigateOptions, type RegisteredRouter } from '@tanstack/react-router'

/**
 * `useNavigate`, with the promise dealt with once instead of at every call site.
 *
 * TanStack's `navigate` is async: it resolves when the destination has finished
 * loading. Nothing here waits for that — a click handler hands over and returns
 * — so the promise is left dangling at every one of the ~90 places we navigate
 * from, and an unhandled rejection is the only reason a failure is visible at
 * all today. `void` would take even that away, and awaiting it would make every
 * handler async, which is the same dangling promise one frame further out.
 *
 * So the promise ends here, in a rejection handler. It can only reject on a
 * destination the router cannot build or a history call the browser refuses —
 * both bugs rather than conditions a user can hit, and both worth seeing.
 *
 * The signature mirrors `UseNavigateResult`, so every option is checked exactly
 * as `useNavigate` checks it; only the return type differs.
 */
export type Go = <
  TRouter extends RegisteredRouter = RegisteredRouter,
  TTo extends string | undefined = undefined,
  TFrom extends string = string,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
>(
  opts: NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
) => void

export function useGo(): Go {
  const navigate = useNavigate()
  return useCallback<Go>(
    (opts) => {
      navigate(opts).catch((error: unknown) => {
        console.error('Navigation failed:', error)
      })
    },
    [navigate],
  )
}
