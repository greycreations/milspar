FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --no-frozen-lockfile
COPY apps/api apps/api
COPY packages/contracts packages/contracts
EXPOSE 3001
CMD ["pnpm", "--filter", "@milspar/api", "start"]
