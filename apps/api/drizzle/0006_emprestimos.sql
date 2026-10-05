CREATE TABLE "loans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "direction" varchar(10) NOT NULL CHECK ("direction" IN ('payable', 'receivable')),
  "person" varchar(120) NOT NULL CHECK (length(trim("person")) > 0),
  "description" varchar(300) NOT NULL DEFAULT '',
  "amount" numeric(12, 2) NOT NULL CHECK ("amount" > 0 AND "amount" <= 999999999.99),
  "due_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "loans_user_id_idx" ON "loans" ("user_id");--> statement-breakpoint
CREATE TABLE "loan_payments" (
  -- O cliente reutiliza este UUID ao repetir uma requisicao cujo resultado
  -- nao chegou. Assim uma falha de rede nao registra o pagamento duas vezes.
  "id" uuid PRIMARY KEY,
  "loan_id" uuid NOT NULL REFERENCES "loans"("id") ON DELETE CASCADE,
  "amount" numeric(12, 2) NOT NULL CHECK ("amount" > 0 AND "amount" <= 999999999.99),
  "paid_on" date NOT NULL,
  "notes" varchar(300) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "loan_payments_loan_id_idx" ON "loan_payments" ("loan_id");
