# syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim

WORKDIR /app

# 依赖层（package.json 在根）
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 应用代码（在 src/ 下）
COPY --chown=node:node src/ ./src/

USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]