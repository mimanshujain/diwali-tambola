FROM node:26-bookworm-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm ci

COPY apps/server ./apps/server
RUN npm run build --workspace @diwali-tambola/server

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /workspace/apps/server/dist ./apps/server/dist

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace", "@diwali-tambola/server"]
