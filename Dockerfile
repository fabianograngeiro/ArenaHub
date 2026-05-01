# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is injected at build time; defaults to same-origin empty string
# so the frontend calls /api/* on whatever host/port serves it.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# tsx is needed to run TypeScript directly
RUN npm install -g tsx

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Backend source
COPY backend/ ./backend/

# Built frontend (served as static files by Express)
COPY --from=builder /app/dist ./dist

# Persistent data directory — mount a named volume here
RUN mkdir -p /app/data

# Point DB to the persistent volume
ENV DB_PATH=/app/data/db.json
ENV BACKEND_PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["tsx", "backend/server.ts"]
