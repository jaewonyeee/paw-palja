# Multi-stage build for production optimization
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies (devDependencies needed for vite build)
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Backend stage
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy reference data (breeds, personas, etc.)
COPY data/raw/ ./data/raw/

# Copy built frontend from previous stage
COPY --from=frontend-build /frontend/dist ./frontend/dist

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# Create runtime directories with proper ownership
RUN mkdir -p logs data/users data/chroma && chown -R appuser:appuser /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
