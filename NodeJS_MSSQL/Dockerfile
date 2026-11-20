# syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim

WORKDIR /app

# 依赖层（package.json 在根）
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 应用代码（在 src/ 下）
COPY --chown=node:node src/ ./src/

# 前端静态文件（APM 观测台 + 物业销售页）
COPY --chown=node:node public/ ./public/

USER node
ENV NODE_ENV=production PORT=8080 DATA_MODE=memory
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]