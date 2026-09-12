# Política de Segurança

A Provisão guarda dado financeiro pessoal. Relato de vulnerabilidade é levado a sério, e quem reporta de boa-fé não será perseguido por isso.

## Como reportar

Use o **[relatório privado de vulnerabilidade do GitHub](https://github.com/dev-alef/fintrack/security/advisories/new)**.

Ele abre uma conversa fechada entre você e o mantenedor — a falha não fica pública enquanto não houver correção.

**Não use** issue pública, pull request ou o formulário de suporte do app para isso. Issue pública expõe a falha para todo mundo antes do conserto; o formulário de suporte exige uma conta, que quem encontra a falha geralmente não tem.

## O que esperar

Este é um projeto mantido por uma pessoa, em ritmo de projeto paralelo — então o compromisso aqui é com o que dá para cumprir, não com um SLA de empresa:

| Etapa | Prazo |
| --- | --- |
| Confirmação de que o relato chegou | até 5 dias |
| Avaliação inicial e resposta sobre a procedência | até 15 dias |
| Correção de falha crítica | o quanto antes, com aviso do andamento |

Não há programa de recompensa (bug bounty) — não há orçamento para isso. O crédito público no aviso de segurança é oferecido a quem quiser.

## Escopo

**Dentro do escopo:**

- `https://provisao.space` — aplicação web
- A API que atende essa aplicação
- O código deste repositório

**Fora do escopo:**

- Falha em serviço de terceiro (Vercel, Render, Neon, Google, Resend, Sentry) — reporte direto ao provedor
- Ataque que exija acesso físico ao dispositivo da vítima, ou engenharia social contra pessoas
- Ausência de cabeçalho de segurança sem impacto demonstrável
- Relato automatizado de scanner sem prova de exploração

## O que já existe

Para calibrar o relato, estas defesas são deliberadas e já estão no ar:

- Sessão em cookie `httpOnly` + `Secure`, com revogação real
- 2FA por TOTP, com códigos de backup
- Rate limiting em duas camadas: por IP (lendo a cadeia real de proxies) e por conta, que não é contornável trocando de IP
- `helmet` nos cabeçalhos de resposta
- Alerta por e-mail em acesso de dispositivo novo, e tela de sessões ativas
- CodeQL, gitleaks e auditoria de dependências a cada pull request

Limitações conhecidas e assumidas estão documentadas no código, com o motivo — em especial `apps/api/src/ip-cliente.ts`, que explica por que o IP de saída da Vercel não é tratado como prova de origem.
