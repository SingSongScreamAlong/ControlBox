# =====================================================================
# ControlBox Multi-Stage Dockerfile
# =====================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/server/package*.json ./packages/server/
COPY packages/dashboard/package*.json ./packages/dashboard/

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY packages/common ./packages/common
COPY packages/server ./packages/server
COPY packages/dashboard ./packages/dashboard

# Build all packages (build common first, then server and dashboard)
RUN npm run build -w packages/common && \
    npm run build -w packages/server && \
    npm run build -w packages/dashboard

# Stage 2: Production Server
FROM node:20-alpine AS server

WORKDIR /app

# Copy built server and common packages
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package*.json ./packages/server/
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/common/package*.json ./packages/common/

# Copy migrations
COPY --from=builder /app/packages/server/src/db/migrations ./packages/server/src/db/migrations

# Install production dependencies only
WORKDIR /app/packages/server
RUN npm ci --only=production

# Set runtime environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]

# Stage 3: Production Dashboard (static files)
FROM nginx:alpine AS dashboard

# Copy built dashboard
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

# Custom nginx config for SPA
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
