import 'dotenv/config'
import pool from './client'

const schema = `
  CREATE TABLE IF NOT EXISTS credit_cards (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    due_day      INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    color        VARCHAR(7) DEFAULT '#6366f1',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS card_expenses (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id      UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year         INTEGER NOT NULL,
    amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS fixed_bills (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    amount       NUMERIC(12,2) NOT NULL,
    due_day      INTEGER CHECK (due_day BETWEEN 1 AND 31),
    active       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS bill_payments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    bill_id      UUID REFERENCES fixed_bills(id) ON DELETE CASCADE,
    month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year         INTEGER NOT NULL,
    paid         BOOLEAN DEFAULT FALSE,
    paid_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bill_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS monthly_config (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
    month             INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year              INTEGER NOT NULL,
    estimated_income  NUMERIC(12,2) DEFAULT 0,
    balance           NUMERIC(12,2) DEFAULT 0,
    investments       NUMERIC(12,2) DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
  );

  CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
  CREATE INDEX IF NOT EXISTS idx_card_expenses_card_id ON card_expenses(card_id);
  CREATE INDEX IF NOT EXISTS idx_fixed_bills_user_id ON fixed_bills(user_id);
  CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id ON bill_payments(bill_id);
  CREATE INDEX IF NOT EXISTS idx_monthly_config_user ON monthly_config(user_id, month, year);
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Executando migration v2...')
    await client.query(schema)
    console.log('Migration v2 concluida!')
  } catch (err) {
    console.error('Erro:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
