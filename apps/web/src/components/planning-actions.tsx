import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AnnualPlanning } from '@/hooks/useAnnualPlanning'

export function PlanningActions({ planning }: { planning: AnnualPlanning }) {
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="button" onClick={planning.aplicar} disabled={!planning.mexeu || planning.salvando}>
      {planning.salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {planning.salvando ? 'Aplicando…' : 'Aplicar alterações'}
    </Button>
    <span role="status" aria-live="polite" className="text-sm text-muted">
      {planning.salvando ? 'Salvando o planejamento…' : planning.mexeu ? 'Alterações ainda não aplicadas' : planning.salvo ? <span className="flex items-center gap-1.5 text-success"><Check className="h-4 w-4" aria-hidden="true" />Alterações salvas</span> : 'Sem alterações pendentes'}
    </span>
    {planning.erro && <p role="alert" className="basis-full text-sm text-danger">{planning.erro}</p>}
  </div>
}
