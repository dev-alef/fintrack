-- Status de pagamento da fatura do cartao.
--
-- Conta fixa ja tinha isso, em bill_payments: da para marcar o que ja foi pago
-- no mes. Fatura de cartao nao tinha - so o valor. O efeito era o cartao da IA
-- anunciar "todas as contas do mes estao pagas" com a fatura em aberto, que
-- costuma ser o maior compromisso do mes.
--
-- Colunas direto em card_expenses, e nao uma tabela separada como
-- bill_payments: a fatura ja e por mes e por cartao (tem UNIQUE em
-- card_id + month + year), entao o status cabe na propria linha. A conta fixa
-- precisou de tabela a parte porque fixed_bills nao tem mes - a mesma conta
-- vale o ano inteiro.
--
-- Aditiva: DEFAULT false deixa todo lancamento existente como nao pago, que e
-- a verdade que temos. Marcar retroativamente como pago seria inventar.

ALTER TABLE "card_expenses" ADD COLUMN IF NOT EXISTS "paid" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "card_expenses" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
