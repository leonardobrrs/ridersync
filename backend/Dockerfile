# API RiderSync (monólito modular NestJS). Contexto de build: raiz do repositório.
FROM docker.io/library/node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# o postinstall do backend executa "prisma generate" e precisa do schema
COPY backend/prisma backend/prisma
RUN npm ci -w backend --include-workspace-root=false
COPY backend backend
RUN cd backend && npx nest build

FROM docker.io/library/node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/dist backend/dist
COPY backend/docker/start.sh backend/docker/start.sh
WORKDIR /app/backend
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3000
CMD ["sh", "docker/start.sh"]
