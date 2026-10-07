import { useId } from 'react'
import { cn } from '@/lib/utils'

// These values are user data stored in VARCHAR(7), not theme tokens.
const colors = [
  ['Terracota', '#c67139'], ['Coral', '#e76f51'], ['Vermelho', '#dc2626'],
  ['Rosa', '#db2777'], ['Pink', '#ec4899'], ['Vinho', '#9f1239'],
  ['Laranja', '#ea580c'], ['Âmbar', '#d97706'], ['Dourado', '#ca8a04'],
  ['Oliva', '#7a8a5e'], ['Verde', '#16a34a'], ['Esmeralda', '#059669'],
  ['Petróleo', '#0f766e'], ['Ciano', '#0891b2'], ['Azul claro', '#0284c7'],
  ['Azul', '#2563eb'], ['Índigo', '#4f46e5'], ['Violeta', '#7c3aed'],
  ['Roxo', '#9333ea'], ['Magenta', '#c026d3'], ['Marrom', '#8f4d24'],
  ['Cinza', '#64748b'], ['Grafite', '#334155'], ['Preto', '#18181b'],
] as const

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const id = useId()
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-medium text-text">Cor</legend>
      <div className="flex max-w-xs flex-wrap gap-2">
        {colors.map(([name, color]) => (
          <button
            key={color} type="button" title={name}
            aria-label={`Cor ${name}`} aria-pressed={value.toLowerCase() === color}
            onClick={() => onChange(color)}
            className={cn('h-7 w-7 shrink-0 rounded-full border border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', value.toLowerCase() === color && 'ring-2 ring-ring ring-offset-2 ring-offset-surface')}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#c67139'} onChange={event => onChange(event.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-1" />
        <label htmlFor={id} className="cursor-pointer text-xs text-muted">Escolher outra cor</label>
        <span className="font-mono text-xs text-muted">{value}</span>
      </div>
    </fieldset>
  )
}
