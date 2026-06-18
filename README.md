# FinTrack

Sistema de financas pessoais fullstack — projeto de portfolio.

## Stack

**Backend:** Node.js · TypeScript · Express · PostgreSQL · Redis · JWT  
**Frontend:** React · TypeScript · Vite · React Query · Zustand · Recharts  
**Infra:** Docker · GitHub Actions · Railway/Render + Vercel

## Como rodar localmente

**1. Pre-requisitos:** Node.js 20+ e Docker

**2. Subir banco e Redis**
```bash
docker-compose up -d
```

**3. Variaveis de ambiente**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**4. Instalar e migrar**
```bash
npm install
cd apps/api && npm run migrate
```

**5. Iniciar**
```bash
npm run dev
```

- API: http://localhost:3001  
- Web: http://localhost:5173  
- pgAdmin: http://localhost:5050

## Estrutura

```
fintrack/
├── apps/
│   ├── api/          # Backend
│   │   └── src/
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── routes/
│   │       ├── middlewares/
│   │       ├── db/
│   │       └── types/
│   └── web/          # Frontend
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           ├── services/
│           └── store/
├── docker-compose.yml
└── package.json
```
