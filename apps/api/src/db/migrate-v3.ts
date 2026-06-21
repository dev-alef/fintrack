import 'dotenv/config'
import pool from './client'

const schema = `
  CREATE TABLE IF NOT EXISTS investment_types (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    color        VARCHAR(7) DEFAULT '#6366f1',
    icon         VARCHAR(10) DEFAULT '📈',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS investments (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
    type_id           UUID REFERENCES investment_types(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    invested_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_value     NUMERIC(12,2) NOT NULL DEFAULT 0,
    monthly_rate      NUMERIC(8,4) DEFAULT 0,
    target_percent    NUMERIC(5,2) DEFAULT 0,
    month             INTEGER CHECK (month BETWEEN 1 AND 12),
    year              INTEGER,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
  CREATE INDEX IF NOT EXISTS idx_investment_types_user_id ON investment_types(user_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Executando migration v3...')
    await client.query(schema)
    console.log('Migration v3 concluida!')
  } catch (err) {
    console.error('Erro:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
