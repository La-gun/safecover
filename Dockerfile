# SafeCover: one container serves the Express API and static frontend (same-origin demos).
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY frontend/ /app/frontend/

ENV NODE_ENV=production
# Prototype-friendly default; override with SAFECOVER_STRICT=true + API_KEY, QUOTE_SIGNING_SECRET, ALLOWED_ORIGINS for public hardening.
ENV SAFECOVER_STRICT=false
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
