# Graph Worker - Knowledge Graph Processing Service
FROM node:lts-alpine3.21 AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:lts-alpine3.21 AS production

WORKDIR /app

# Install curl for health check
RUN apk add --no-cache curl

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p logs backup data/news

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S graphworker -u 1001 -G nodejs

# Change ownership
RUN chown -R graphworker:nodejs /app
USER graphworker

# Expose port
EXPOSE 39111

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:39111/health || exit 1

# Start
CMD ["npm", "start"] 