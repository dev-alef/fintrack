CREATE TABLE professional_clients (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
  contact varchar(200) NOT NULL DEFAULT '',
  notes varchar(500) NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);--> statement-breakpoint
CREATE INDEX professional_clients_user_idx ON professional_clients(user_id);--> statement-breakpoint
CREATE TABLE service_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  service_name varchar(150) NOT NULL CHECK (length(trim(service_name)) > 0),
  amount numeric(12,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999.99),
  interval_months integer NOT NULL CHECK (interval_months IN (1,3,12)),
  start_date date NOT NULL CHECK (start_date BETWEEN '1900-01-01' AND '2100-12-31'),
  end_date date CHECK (end_date BETWEEN '1900-01-01' AND '2100-12-31'),
  notes varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, user_id) REFERENCES professional_clients(id, user_id)
);--> statement-breakpoint
CREATE INDEX service_subscriptions_user_idx ON service_subscriptions(user_id);--> statement-breakpoint
CREATE TABLE professional_receipts (
  id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES service_subscriptions(id) ON DELETE CASCADE,
  due_on date NOT NULL,
  paid_on date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999.99),
  client_name varchar(120) NOT NULL,
  service_name varchar(150) NOT NULL,
  notes varchar(500) NOT NULL DEFAULT '',
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX professional_receipts_period_idx ON professional_receipts(subscription_id, due_on) WHERE voided_at IS NULL;--> statement-breakpoint
CREATE TABLE professional_expenses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(150) NOT NULL CHECK (length(trim(title)) > 0),
  category varchar(80) NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999.99),
  spent_on date NOT NULL,
  deleted_at timestamptz,
  notes varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX professional_expenses_user_idx ON professional_expenses(user_id, spent_on);
