import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { loadDeliveries, type Delivery } from '@/data/deliveries'

export function useDeliveries(): UseQueryResult<Delivery[]> {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: loadDeliveries,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
