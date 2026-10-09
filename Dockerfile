# Multi-stage production Dockerfile for CareerOS Frontend SPA
# ------------------------------------------------------------------------------
# Stage 1: Build Frontend Assets
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for Vite & Tailwind)
RUN npm ci

# Copy source code and build configs
COPY src ./src
COPY public ./public
COPY index.html vite.config.js ./

# Build arguments: VITE_API_URL defaults to /api when served behind Nginx reverse proxy
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Run Vite production build (outputs to /app/dist)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web server port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
