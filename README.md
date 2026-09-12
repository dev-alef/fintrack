# 💰 Provisão

> Gestão financeira pessoal com análise por Inteligência Artificial — login com Google, 2FA e sessões protegidas contra roubo.

**🔗 [Acesse o app ao vivo](https://provisao.space)** · **[API em produção](https://fintrack-api-oyjx.onrender.com/health)**

![CI](https://github.com/dev-alef/fintrack/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/dev-alef/fintrack/actions/workflows/codeql.yml/badge.svg)
![Segurança](https://github.com/dev-alef/fintrack/actions/workflows/seguranca.yml/badge.svg)

---

## 📸 Preview

![Dashboard da Provisão](docs/dashboard.png)

## ✨ Funcionalidades

- 🔐 **Autenticação completa** — cadastro, login, **login com Google** (com vinculação de conta), verificação de e-mail e recuperação de senha
- 🔒 **2FA por TOTP** — QR code, aplicativo autenticador, códigos de backup com regeneração
- 🛡️ **Proteção contra roubo de sessão** — alerta por e-mail em acesso de dispositivo novo, tela de sessões ativas com opção de encerrar, sessão curta com renovação automática no uso
- 📊 **Dashboard financeiro** — receita estimada, saldo calculado automaticamente, patrimônio total, gráfico anual de entradas e saídas
- 💳 **Controle de cartões** — cartões personalizáveis com faturas mensais e totais anuais
- 📋 **Despesas fixas** — controle de contas com status pago/pendente por mês
- 💸 **Transações** — CRUD completo com filtros, paginação e categorias
- 💎 **Carteira de investimentos** — tipos personalizados, rentabilidade, distribuição
- 🎯 **Metas financeiras** — progresso automático com barra visual
- 🤖 **Insights com IA** — análise financeira personalizada via Google Gemini, persistente durante a navegação
- 🎨 **Quatro temas** — claro, escuro, rosa e um tema "tech" inspirado em terminal
- 💬 **Canal de suporte** — formulário dentro do app, enviado por e-mail
- 📱 **Design responsivo** — funciona em desktop e mobile

## 🔒 Segurança

Área de maior investimento do projeto:

- **Better Auth** — sessão server-side em cookie `httpOnly` + `Secure`, com revogação real (nada de refresh token que sobrevive ao logout)
- **Rate limiting em duas camadas** — por IP (resolvendo a cadeia real de proxies, imune a cabeçalho forjado) e **por conta** (bloqueia após falhas repetidas de login, independente de quantos IPs o atacante usar)
- **`helmet`** com política de cabeçalhos ajustada para API cross-origin
- **CodeQL, Dependabot, `npm audit` e gitleaks** rodando no CI a cada PR
- Alertas de segurança tratados como código: cada falso positivo é investigado e corrigido, não silenciado

## 🛠️ Stack

**Backend**
- Node.js + TypeScript + Express
- PostgreSQL, com queries SQL nativas + agregações
- **Drizzle Kit** — migrations versionadas, com lock e histórico
- **Better Auth** — sessões, OAuth com Google, 2FA, verificação de e-mail e recuperação de senha
- **Zod** — validação em transações e metas
- **Resend** — e-mail transacional (verificação, recuperação, alertas, suporte)
- **Sentry** — monitoramento de erro, com filtro de dado sensível antes do envio
- Google Gemini AI — análise financeira
- Redis provisionado para cache (middleware pronto, ainda não plugado nas rotas)

**Frontend**
- React 18 + TypeScript + Vite
- **Tailwind CSS v4 + shadcn/ui** (Radix primitives) — sistema de tokens de design, quatro temas
- React Query (sincronização com API)
- Zustand (estado global)
- Recharts (gráficos)
- React Router (navegação SPA)
- Sentry (erros do frontend)

**DevOps**
- Docker + Docker Compose (ambiente local)
- **Vitest + Supertest** — testes de integração contra Postgres real
- GitHub Actions — CI, CodeQL, gitleaks e `npm audit`, Dependabot semanal
- Render (deploy backend) · Neon (PostgreSQL serverless) · Vercel (deploy frontend, com proxy para cookies de primeira-parte)

## 🏗️ Arquitetura

```
fintrack/
├── apps/
│   ├── api/                     # Backend Node.js
│   │   └── src/
│   │       ├── auth.ts              # Configuração central do Better Auth
│   │       ├── ip-cliente.ts        # Resolução de IP real por trás de proxy
│   │       ├── limite-por-conta.ts  # Rate limiting por conta
│   │       ├── acesso-novo.ts       # Alerta de login em dispositivo novo
│   │       ├── emails/              # Templates de e-mail transacional
│   │       ├── controllers/         # Camada de requisição/resposta
│   │       ├── services/            # Lógica de negócio
│   │       ├── routes/              # Definição de endpoints
│   │       ├── middlewares/         # Auth, cache (pronto, ainda não plugado)
│   │       ├── db/                  # Cliente PostgreSQL + schema
│   │       ├── drizzle/             # Migrations versionadas
│   │       └── __tests__/           # Testes com Vitest + Supertest
│   └── web/                     # Frontend React
│       └── src/
│           ├── pages/         # Telas da aplicação
│           ├── components/    # Componentes reutilizáveis + shadcn/ui
│           ├── hooks/         # React Query hooks
│           ├── lib/           # Cliente do Better Auth
│           ├── services/      # Cliente HTTP (axios)
│           └── store/         # Estado global (Zustand)
├── .github/
│   ├── workflows/                # CI, CodeQL, Segurança
│   └── dependabot.yml
└── docker-compose.yml            # PostgreSQL + Redis + pgAdmin
```

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 20+
- Docker e Docker Compose

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/dev-alef/fintrack.git
cd fintrack

# 2. Suba o banco e o Redis
docker compose up -d

# 3. Configure as variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Gere o segredo do Better Auth e cole em apps/api/.env:
openssl rand -base64 32

# 4. Instale as dependências
npm install

# 5. Rode as migrations
cd apps/api
npm run migrate
cd ../..

# 6. Inicie o projeto (API + Web juntos)
npm run dev
```

- **API:** http://localhost:3001
- **Web:** http://localhost:5173
- **pgAdmin:** http://localhost:5050

Login com Google, e-mail transacional e IA são opcionais localmente — sem as credenciais correspondentes, cada recurso desliga sozinho com uma mensagem clara, sem quebrar o resto do app (e-mail cai no log do terminal, com o link clicável).

## 🧪 Testes

```bash
cd apps/api
npm test
```

67 testes automatizados (Vitest + Supertest, contra Postgres real em container) cobrindo autenticação, login com Google com vinculação de conta, 2FA, verificação de e-mail, recuperação de senha, resolução de IP e rate limiting (por IP e por conta), sessões ativas, alerta de acesso novo, suporte e transações — finanças, investimentos, metas e insights ainda sem cobertura automatizada.

## 📡 Principais endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/sign-up/email` | Criar conta |
| POST | `/api/auth/sign-in/email` | Login (sessão em cookie `httpOnly`) |
| POST | `/api/auth/sign-in/social` | Login com Google (`{ provider: "google" }`) |
| POST | `/api/auth/two-factor/enable` | Ativar 2FA |
| GET | `/api/auth/list-sessions` | Sessões ativas |
| GET | `/transactions` | Listar com filtros e paginação |
| GET | `/transactions/summary` | Resumo com agregações SQL |
| GET | `/finance/cards` | Cartões de crédito |
| GET | `/finance/payments` | Contas fixas com status |
| GET | `/investments/portfolio` | Resumo da carteira |
| GET | `/goals` | Metas financeiras |
| GET | `/insights` | Análise financeira com IA |
| POST | `/suporte` | Enviar mensagem de suporte |

## 👨‍💻 Autor

**Alerson** — Fullstack Developer

- LinkedIn: [Alerson Ferreira](https://www.linkedin.com/in/alersonferreira/)
- GitHub: [@dev-alef](https://github.com/dev-alef)
- Genesis Code — Desenvolvimento de sistemas web

---

⭐ Se este projeto te ajudou de alguma forma, considere deixar uma estrela!
