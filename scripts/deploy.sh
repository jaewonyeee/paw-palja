#!/usr/bin/env bash
# deploy.sh — Zero-downtime deployment for Paw-Palja
# Usage:
#   ./scripts/deploy.sh              # production (local infra)
#   ./scripts/deploy.sh --cloud      # cloud (managed DB + Redis)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

COMPOSE_ARGS=("-f" "docker-compose.prod.yml")

if [[ "${1:-}" == "--cloud" ]]; then
    COMPOSE_ARGS+=("-f" "docker-compose.cloud.yml")
    echo "[deploy] Cloud mode: using managed DB + Redis"
fi

echo "[deploy] Working directory: $PROJECT_DIR"

# ── Pre-flight checks ──────────────────────────────────────
if [ ! -f .env ]; then
    echo "[deploy] ERROR: .env file not found. Copy .env.template and fill in values."
    exit 1
fi

# ── Pull latest code (if in a git repo) ────────────────────
if [ -d .git ]; then
    echo "[deploy] Pulling latest code..."
    git pull --ff-only || echo "[deploy] WARN: git pull failed, continuing with local code"
fi

# ── Build images ────────────────────────────────────────────
echo "[deploy] Building Docker images..."
docker compose "${COMPOSE_ARGS[@]}" build --parallel

# ── Rolling restart (zero-downtime) ─────────────────────────
# Restart backend first while nginx keeps serving old version
echo "[deploy] Restarting backend..."
docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps --wait backend

# If worker service exists, restart it too
if docker compose "${COMPOSE_ARGS[@]}" config --services 2>/dev/null | grep -q worker; then
    echo "[deploy] Restarting worker..."
    docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps worker
fi

# Finally restart nginx to pick up any config changes
echo "[deploy] Restarting nginx..."
docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps nginx

# ── Health check ────────────────────────────────────────────
echo "[deploy] Waiting for health check..."
sleep 5
if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "[deploy] Deployment successful! Health check passed."
else
    echo "[deploy] WARNING: Health check failed. Check logs:"
    echo "  docker compose ${COMPOSE_ARGS[*]} logs --tail=50 backend"
    exit 1
fi

# ── Cleanup ─────────────────────────────────────────────────
echo "[deploy] Cleaning up old images..."
docker image prune -f --filter "until=168h" 2>/dev/null || true

echo "[deploy] Done!"
