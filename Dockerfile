# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM mcr.microsoft.com/playwright:v1.60.0-noble
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmjs.org --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY web ./web
USER pwuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
