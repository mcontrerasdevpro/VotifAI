FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./server/

RUN pnpm install --frozen-lockfile
RUN pnpm install --dir server --frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]