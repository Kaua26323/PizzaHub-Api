# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ----------------------------------------------
# Base stage  
# ----------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base

WORKDIR /app

# ----------------------------------------------
#  build-dependencies stage  
# ----------------------------------------------
FROM base as build-dependencies

COPY package.json package-lock.json ./

RUN npm ci

# ----------------------------------------------
#  build stage  
# ----------------------------------------------
FROM build-dependencies AS build

COPY . .

RUN npm run build

# ----------------------------------------------
#  production-dependencies stage  
# ----------------------------------------------
FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

# ----------------------------------------------
#  production stage  
# ----------------------------------------------
FROM base as production  

ENV NODE_ENV=production

WORKDIR /app

COPY --from=production-dependencies \
  --chown=node:node \
  /app/node_modules \
  ./node_modules

COPY --from=build \
  --chown=node:node \
  /app/dist \
  ./dist

COPY --chown=node:node package.json ./

RUN mkdir -p \
  /app/uploads/products \
  /app/uploads/tmp/products \
  && chown -R node:node /app/uploads

USER node

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/server.js"]


