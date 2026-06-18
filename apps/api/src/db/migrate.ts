import 'dotenv/config'
import pool from './client'

const schema = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    color      VARCHAR(7) DEFAULT '#6366f1',
    icon       VARCHAR(50) DEFAULT 'tag',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title       VARCHAR(200) NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    date        DATE NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS goals (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    target_amount  NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) DEFAULT 0,
    deadline       DATE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_categories_user_id  ON categories(user_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Executando migrations...')
    await client.query(schema)
    console.log('Migrations concluidas com sucesso!')
  } catch (err) {
    console.error('Erro na migration:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
