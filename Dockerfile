FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/shopverse.db
WORKDIR /app
COPY --from=build /app /app
VOLUME /data
EXPOSE 4000
CMD ["npm", "start"]
