FROM node:20-alpine

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_network_timeout=300000 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --prefer-offline

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
