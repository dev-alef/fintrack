-- Tabela do plugin de dois fatores do Better Auth, mais a coluna que marca
-- quem ativou. Aditiva: nenhum DROP, nenhum ALTER destrutivo, e quem nao usa
-- 2FA nao percebe diferenca nenhuma.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean DEFAULT false;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" text PRIMARY KEY NOT NULL,
  -- O segredo TOTP e os codigos de recuperacao. Quem le estas duas colunas
  -- consegue gerar codigos validos, entao elas nunca saem em resposta de API -
  -- o plugin marca as duas como returned: false.
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  -- uuid, nao text: users.id e UUID, e o Postgres recusa chave estrangeira
  -- entre tipos diferentes. Foi exatamente onde o PR 1 tropecou.
  "userId" uuid NOT NULL,
  "verified" boolean DEFAULT true,
  -- Trava contra forca bruta no proprio codigo de 6 digitos: sem ela, 1 milhao
  -- de combinacoes e pouco para quem ja tem a senha.
  "failedVerificationCount" integer DEFAULT 0,
  "lockedUntil" timestamp with time zone,
  CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint

-- O plugin busca por userId no login e por secret na verificacao.
CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor" USING btree ("secret");
