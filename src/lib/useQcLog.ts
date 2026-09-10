import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { loadQcLog, type QcEntry } from '@/data/quality'

export function useQcLog(): UseQueryResult<QcEntry[]> {
  return useQuery({
    queryKey: ['qc-log'],
    queryFn: loadQcLog,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
