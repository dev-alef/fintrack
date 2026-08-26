CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL,
	CONSTRAINT "session_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_monthly_config_user";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_monthly_config_user" ON "monthly_config" USING btree ("user_id","month","year");--> statement-breakpoint
-- Backfill das credenciais existentes.
--
-- O Better Auth procura a senha na tabela account, com providerId 'credential'.
-- Os hashes bcrypt de quem ja tem conta estao em users.password, entao sem esta
-- copia o usuario continuaria existindo e simplesmente nao conseguiria entrar -
-- sem mensagem util, porque para o Better Auth ele nao teria credencial alguma.
--
-- O NOT EXISTS torna a operacao repetivel: rodar de novo nao duplica linha.
-- O issuer precisa ser 'local:credential', e nao nulo. A partir do Better Auth
-- 1.7 a identidade da conta e escopada por emissor, entao uma linha sem issuer
-- simplesmente nao e encontrada na hora do login: a resposta e "User not
-- found", como se o usuario nao existisse. Verificado comparando com a linha
-- que o proprio Better Auth cria num cadastro novo.
INSERT INTO "account" ("id", "issuer", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT
  uuid_generate_v4()::text,
  'local:credential',
  u.id::text,
  'credential',
  u.id,
  u.password,
  NOW(),
  NOW()
FROM "users" u
WHERE u.password IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "account" a
    WHERE a."userId" = u.id AND a."providerId" = 'credential'
  );
