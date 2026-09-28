FROM node:22-alpine
WORKDIR /app
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/contracts packages/contracts
EXPOSE 3001
CMD ["pnpm", "--filter", "@milspar/api", "start"]
