import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { loadQcLog, type QcEntry } from '@/data/quality'

/**
 * The QC log, fetched on first use and then held.
 *
 * Same arrangement as the deliveries: one shared request, a skeleton rather than
 * a blocked route transition, and `staleTime: Infinity` because a fixed dataset
 * has nothing to revalidate.
 */
export function useQcLog(): UseQueryResult<QcEntry[]> {
  return useQuery({
    queryKey: ['qc-log'],
    queryFn: loadQcLog,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
