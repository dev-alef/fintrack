import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { CartaoDoAno, LinhaDoAno } from '@/components/planejamento-anual'

type MonthDraft = { receita?: string; saldo?: string; cartoes?: Record<string, string> }
type YearDraft = Record<number, MonthDraft>
type Config = { estimated_income: string | null; balance: string | null }
type MonthPayload = { month: number; estimated_income?: number | null; balance?: number | null; cards?: { cardId: string; amount: number }[] }
const monthName = (month: number) => new Date(2031, month - 1).toLocaleDateString('pt-BR', { month: 'long' })
const inputValue = (value: string | number | null | undefined) => value == null ? '' : String(Number(value))

function toPayload(draft: YearDraft): MonthPayload[] {
  const amount = (value: string, label: string, negative = false) => {
    if (!value.trim() || !Number.isFinite(Number(value)) || (!negative && Number(value) < 0)) {
      throw new Error(`Confira ${label}. Informe um valor válido; use 0 quando não houver valor.`)
    }
    return Number(value)
  }
  return Object.entries(draft).map(([key, row]) => {
    const month = Number(key)
    return {
      month,
      ...(row.receita !== undefined && { estimated_income: row.receita === '' ? null : amount(row.receita, `a receita de ${monthName(month)}`) }),
      ...(row.saldo !== undefined && { balance: row.saldo === '' ? null : amount(row.saldo, `o saldo de ${monthName(month)}`, true) }),
      ...(row.cartoes && { cards: Object.entries(row.cartoes).map(([cardId, value]) => ({ cardId, amount: amount(value, `a fatura de ${monthName(month)}`) })) }),
    }
  })
}

/** One draft for the monthly fields and annual table, retained separately for each year. */
export function useAnnualPlanning({ userId, ano, mesAtual, config, linhas, cartoes, fixedBills }: {
  userId: string; ano: number; mesAtual: number; config?: Config | null; linhas: LinhaDoAno[]; cartoes: CartaoDoAno[]; fixedBills: number
}) {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<number, YearDraft>>({})
  const [savedYear, setSavedYear] = useState<number | null>(null)
  const draft = drafts[ano] ?? {}

  function edit(update: (current: YearDraft) => YearDraft) {
    setSavedYear(null)
    if (!save.isPending) save.reset()
    setDrafts(current => ({ ...current, [ano]: update(current[ano] ?? {}) }))
  }
  function editaReceita(month: number, value: string) {
    edit(current => {
      const next = { ...current }
      for (let m = month; m <= 12; m++) next[m] = { ...next[m], receita: value }
      return next
    })
  }
  function editaSaldo(month: number, value: string) {
    edit(current => ({ ...current, [month]: { ...current[month], saldo: value } }))
  }
  function editaCartao(month: number, cardId: string, value: string) {
    edit(current => ({ ...current, [month]: { ...current[month], cartoes: { ...current[month]?.cartoes, [cardId]: value } } }))
  }
  function valorAtual(month: number) {
    const row = linhas.find(line => line.month === month)
    const income = month === mesAtual ? config?.estimated_income ?? row?.estimated_income : row?.estimated_income
    return {
      receita: draft[month]?.receita ?? inputValue(income),
      saldo: draft[month]?.saldo ?? inputValue(month === mesAtual ? config?.balance : row?.balance),
      cartoes: Object.fromEntries(cartoes.map(card => [card.id, draft[month]?.cartoes?.[card.id] ?? inputValue(card.monthly_breakdown?.find(b => b.month === month)?.amount)])),
    }
  }
  function repetirParaBaixo(month: number) {
    const source = valorAtual(month)
    edit(current => {
      const next = { ...current }
      for (let m = month + 1; m <= 12; m++) {
        next[m] = { ...next[m], receita: source.receita,
          cartoes: { ...next[m]?.cartoes, ...Object.fromEntries(Object.entries(source.cartoes).filter(([, value]) => value !== '')) } }
      }
      return next
    })
  }
  function removeCard(cardId: string) {
    setDrafts(current => Object.fromEntries(Object.entries(current).map(([year, rows]) => [year,
      Object.fromEntries(Object.entries(rows).flatMap(([month, values]) => {
        const row = { ...values }, cards = { ...values.cartoes }
        delete cards[cardId]
        if (Object.keys(cards).length) row.cartoes = cards
        else delete row.cartoes
        return Object.keys(row).length ? [[month, row]] : []
      })),
    ])))
  }

  const save = useMutation({
    mutationFn: async ({ year, snapshot }: { year: number; snapshot: YearDraft }) => {
      const meses = toPayload(snapshot)
      await api.post('/finance/planejamento', { year, meses })
      return meses
    },
    onSuccess: async (meses, { year, snapshot }) => {
      // Publish the acknowledged values before refetching so slow/offline reads
      // cannot make successfully saved edits appear to revert.
      const previousAnnual = qc.getQueryData<LinhaDoAno[]>(['annualSummary', userId, year])
      qc.setQueryData<LinhaDoAno[]>(['annualSummary', userId, year], current => {
        if (!current) return current
        const next = [...current]
        for (const row of meses) {
          const index = next.findIndex(item => item.month === row.month)
          const previous = next[index] ?? { month: row.month, estimated_income: null, total_fixed_bills: String(fixedBills), total_card_expenses: '0' }
          const merged = { ...previous,
            ...(row.estimated_income !== undefined && { estimated_income: row.estimated_income == null ? null : String(row.estimated_income) }),
            ...(row.balance !== undefined && { balance: row.balance == null ? null : String(row.balance) }),
          }
          if (index < 0) next.push(merged)
          else next[index] = merged
        }
        return next.sort((a, b) => a.month - b.month)
      })
      for (const row of meses) {
        const previous = previousAnnual?.find(item => item.month === row.month)
        qc.setQueryData<Config>(['config', userId, row.month, year], current => ({
          estimated_income: current ? current.estimated_income : previous?.estimated_income ?? null,
          balance: current ? current.balance : previous?.balance ?? null,
          ...current,
          ...(row.estimated_income !== undefined && { estimated_income: row.estimated_income == null ? null : String(row.estimated_income) }),
          ...(row.balance !== undefined && { balance: row.balance == null ? null : String(row.balance) }),
        }))
      }
      qc.setQueryData<CartaoDoAno[]>(['annual', userId, year], current => current?.map(card => {
        const breakdown = [...(card.monthly_breakdown ?? [])]
        for (const row of meses) {
          const updated = row.cards?.find(item => item.cardId === card.id)
          if (!updated) continue
          const index = breakdown.findIndex(item => item.month === row.month)
          const value = { ...breakdown[index], month: row.month, amount: String(updated.amount) }
          if (index < 0) breakdown.push(value)
          else breakdown[index] = value
        }
        return { ...card, monthly_breakdown: breakdown }
      }))
      await Promise.all(['annualSummary', 'annual', 'config', 'expenses', 'cardPayoff', 'threeMonthForecast'].map(key =>
        qc.invalidateQueries({ queryKey: [key, userId] }),
      ))
      setDrafts(current => {
        const remaining = { ...current[year] }
        for (const [month, sent] of Object.entries(snapshot)) {
          const m = Number(month), row = { ...remaining[m] }
          if (row.receita === sent.receita) delete row.receita
          if (row.saldo === sent.saldo) delete row.saldo
          const cards = { ...row.cartoes }
          for (const [id, value] of Object.entries(sent.cartoes ?? {})) if (cards[id] === value) delete cards[id]
          if (Object.keys(cards).length) row.cartoes = cards
          else delete row.cartoes
          if (Object.keys(row).length) remaining[m] = row
          else delete remaining[m]
        }
        return { ...current, [year]: remaining }
      })
      setSavedYear(year)
    },
  })

  return {
    valorAtual, editaReceita, editaSaldo, editaCartao, repetirParaBaixo, removeCard,
    editado: (month: number) => draft[month] !== undefined,
    mexeu: Object.keys(draft).length > 0,
    salvo: savedYear === ano,
    salvando: save.isPending,
    erro: save.isError && save.variables?.year === ano
      ? save.error instanceof Error && !('isAxiosError' in save.error) ? save.error.message : 'Não foi possível confirmar o salvamento. Suas alterações continuam aqui; tente aplicar novamente.'
      : null,
    aplicar: () => save.mutate({ year: ano, snapshot: draft }),
  }
}

export type AnnualPlanning = ReturnType<typeof useAnnualPlanning>
