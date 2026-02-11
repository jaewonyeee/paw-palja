# Build frontend assets
FROM node:20-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Nginx with embedded frontend
FROM nginx:alpine

# Copy built frontend
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
