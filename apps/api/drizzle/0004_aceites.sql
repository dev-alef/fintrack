-- Registro de aceite dos documentos legais.
--
-- A tela de cadastro diz "ao criar sua conta, voce concorda com os Termos de
-- Uso e a Politica de Privacidade". Sem esta tabela isso e so uma frase: nao
-- havia como responder "quando essa pessoa aceitou, e qual texto estava no ar
-- naquele dia" - que e exatamente a pergunta que aparece numa disputa ou numa
-- fiscalizacao.
--
-- Aditiva, como as anteriores: nenhum DROP, nenhum ALTER destrutivo. Quem ja
-- tem conta nao ganha registro retroativo de proposito - inventar uma data de
-- aceite que nunca existiu seria pior que nao ter registro nenhum.

CREATE TABLE IF NOT EXISTS "aceites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE CASCADE de proposito, e a escolha merece explicacao.
  --
  -- Guardar o aceite depois da conta apagada teria valor defensivo, mas a
  -- Politica de Privacidade promete remover os dados em ate 30 dias. Manter um
  -- registro nominal de quem pediu exclusao contradiz o proprio documento que
  -- esta tabela existe para comprovar. Entre as duas, vale o que foi prometido.
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- 'termos' ou 'privacidade'. Texto solto em vez de enum: documento novo
  -- (politica de cookies, por exemplo) nao deveria exigir migration.
  "documento" text NOT NULL,

  -- A data de vigencia do texto que estava no ar, no formato AAAA-MM-DD.
  -- Guardar a versao e o ponto todo: sem ela sabemos que a pessoa aceitou
  -- algo, mas nao O QUE ela aceitou.
  "versao" text NOT NULL,

  "aceito_em" timestamp with time zone NOT NULL DEFAULT now(),

  -- Evidencia de contexto. Sao os mesmos dados que a sessao ja guarda, e
  -- ficam aqui porque o aceite precisa se sustentar sozinho, mesmo depois de a
  -- sessao daquele dia ter expirado e sumido.
  "ip" text,
  "user_agent" text
);--> statement-breakpoint

-- A consulta real e sempre "os aceites desta pessoa", para responder a um
-- pedido de titular ou montar a tela de privacidade da conta.
CREATE INDEX IF NOT EXISTS "aceites_user_id_idx" ON "aceites" USING btree ("user_id");
