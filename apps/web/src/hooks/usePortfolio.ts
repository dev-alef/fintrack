import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

export interface PortfolioEntry {
  type_id: string
  type_name: string
  color: string
  icon: string
  total_invested: string
  total_current: string
  total_profit: string
  count: string
}

export function usePortfolio(userId: string) {
  return useQuery({
    queryKey: ['portfolio', userId],
    enabled: !!userId,
    queryFn: () => api.get<PortfolioEntry[]>('/investments/portfolio').then(response => response.data),
  })
}
