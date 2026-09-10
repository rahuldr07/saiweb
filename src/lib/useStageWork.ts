import { useMemo } from 'react'
import { stageWorkOf, type StageWorkResult } from './quality'
import { inRange, type Span } from './range'
import { useDeliveries } from './useDeliveries'

const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export function useStageWork(range: Span): StageWorkResult {
  const { data } = useDeliveries()
  const from = dayKey(range.from)
  const to = dayKey(range.to)

  return useMemo(() => {
    const span: Span = { from: new Date(from), to: new Date(to) }
    return stageWorkOf((data ?? []).filter((x) => inRange(x.d, span)))
  }, [data, from, to])
}
