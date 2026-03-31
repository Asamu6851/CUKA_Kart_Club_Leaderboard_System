FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    npm_config_registry=${NPM_REGISTRY} \
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
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
