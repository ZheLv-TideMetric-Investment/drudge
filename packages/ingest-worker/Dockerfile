# Ingest Worker - News Data Ingestion Service
FROM node:lts-alpine3.21 AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy package files and install all dependencies
COPY package.json ./
COPY tsconfig.json ./
RUN pnpm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN pnpm run build

# Production stage
FROM node:lts-alpine3.21 AS production

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Install curl for health check
RUN apk add --no-cache curl

# Copy package files and install production dependencies
COPY package.json ./
RUN pnpm install --prod && pnpm store prune

# Copy built application
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p logs data/news storage

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ingestworker -u 1001 -G nodejs

# Change ownership
RUN chown -R ingestworker:nodejs /app
USER ingestworker

# Expose port
EXPOSE 39110

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:39110/health || exit 1

# Start
CMD ["pnpm", "start"] 