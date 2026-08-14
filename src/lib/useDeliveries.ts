import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { loadDeliveries, type Delivery } from '@/data/deliveries'

/**
 * The delivery history, fetched on first use and then held.
 *
 * It goes through React Query rather than a bare promise so that two screens
 * mounting at once share one request, and so a screen that needs it can render
 * a skeleton instead of blocking the route transition on 374 KB.
 *
 * `staleTime: Infinity` because this is a fixed dataset: there is nothing to
 * revalidate, and refetching it would be pure cost.
 */
export function useDeliveries(): UseQueryResult<Delivery[]> {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: loadDeliveries,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
