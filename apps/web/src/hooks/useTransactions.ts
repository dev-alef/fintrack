import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface TransactionFilters {
  page?: number
  type?: string
  month?: string
  year?: string
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
      const { data } = await api.get(`/transactions?${params}`)
      return data
    },
  })
}

export function useSummary(month?: string, year?: string) {
  return useQuery({
    queryKey: ['summary', month, year],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (month) params.set('month', month)
      if (year) params.set('year', year)
      const { data } = await api.get(`/transactions/summary?${params}`)
      return data
    },
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/transactions', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
