import path from 'path'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Executor de migrations para producao.
//
// Existe separado do drizzle-kit de proposito: o kit e devDependency e depende
// do drizzle.config.ts e do TypeScript, enquanto este runner usa apenas
// drizzle-orm e pg, que sao dependencias de runtime. Assim o boot da API nao
// depende de devDependencies estarem instaladas no servidor.
//
// A pasta de migrations e resolvida a partir deste arquivo, e nao do
// diretorio de trabalho, para funcionar igual sendo chamado de onde for.
async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL nao definida - migrations nao podem rodar')
    process.exit(1)
  }

  const migrationsFolder = path.resolve(__dirname, '../../drizzle')
  const pool = new Pool({ connectionString })

  try {
    console.log('Aplicando migrations...')
    await migrate(drizzle(pool), { migrationsFolder })
    console.log('Migrations aplicadas com sucesso.')
  } catch (err) {
    console.error('Falha ao aplicar migrations:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()
