FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm install --workspace=apps/api
COPY apps/api ./apps/api
COPY apps/api/tsconfig.json ./apps/api/
WORKDIR /app/apps/api
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/migrate-v2.js && node dist/db/migrate-v3.js && node dist/index.js"]