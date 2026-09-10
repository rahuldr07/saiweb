import { useCallback } from 'react'
import { useNavigate, type NavigateOptions, type RegisteredRouter } from '@tanstack/react-router'

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
