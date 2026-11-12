import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { LoadingState } from '@/components/loading-state'

/** Covers query refetches and mutations without replacing existing content or intercepting clicks. */
export function LoadingActivity() {
  const fetching = useIsFetching(), mutating = useIsMutating()
  const active = fetching + mutating > 0
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active) { setVisible(false); return }
    const timer = window.setTimeout(() => setVisible(true), 400)
    return () => window.clearTimeout(timer)
  }, [active])
  if (!active || !visible) return null
  return <div className="pv-loading-activity">
    <LoadingState variant="inline" title={mutating ? 'Processando sua solicitação…' : 'Carregando dados…'}
      slowMessage="A resposta está demorando um pouco. Aguarde mais um instante." />
  </div>
}
