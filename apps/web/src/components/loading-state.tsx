import { useEffect, useState } from 'react'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

type Props = {
  title?: string
  description?: string
  variant?: 'panel' | 'inline' | 'screen'
  slowMessage?: string
  className?: string
}

/** Indeterminate progress: the request, rather than an animation, decides when it ends. */
export function LoadingState({ title = 'Carregando…', description, variant = 'panel',
  slowMessage = 'Está levando um pouco mais de tempo. Aguarde enquanto concluímos a solicitação.', className }: Props) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000)
    return () => window.clearTimeout(timer)
  }, [])

  const content = <div role="status" aria-live="polite" aria-atomic="true" className={cn('pv-loading',
    variant === 'inline' ? 'pv-loading-inline' : 'pv-loading-panel', className)}>
    <div className="pv-loading-mark" aria-hidden="true">
      <span className="pv-loading-orbit" />
      <span className="pv-loading-logo"><Logo size={variant === 'inline' ? 22 : 36} /></span>
    </div>
    <div className="min-w-0">
      <p className="pv-loading-title">{title}</p>
      {(slow ? slowMessage : description) && <p className="pv-loading-description">{slow ? slowMessage : description}</p>}
    </div>
    {variant !== 'inline' && <span className="pv-loading-track" aria-hidden="true"><span /></span>}
  </div>

  return variant === 'screen'
    ? <div className="grid min-h-[100dvh] place-items-center bg-bg px-6 py-12"><div className="w-full max-w-sm">{content}</div></div>
    : content
}
