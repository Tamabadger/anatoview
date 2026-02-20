#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AnatoView — Dev Restart Script
# ═══════════════════════════════════════════════════════════════════
#
# Restarts the dev environment with various levels of cleanup.
#
# Usage:
#   ./scripts/dev-restart.sh              Quick restart (containers only)
#   ./scripts/dev-restart.sh --rebuild    Rebuild images then restart
#   ./scripts/dev-restart.sh --fresh-db   Reset database, re-migrate, re-seed
#   ./scripts/dev-restart.sh --full       Nuke everything and start from scratch
#   ./scripts/dev-restart.sh --help       Show this help
#
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Helpers ───────────────────────────────────────────────────────

info()    { echo -e "${CYAN}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
step()    { echo -e "\n${BOLD}── $1 ──${NC}"; }

show_help() {
  echo ""
  echo -e "${BOLD}AnatoView Dev Restart${NC}"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "Usage: ./scripts/dev-restart.sh [option]"
  echo ""
  echo "Options:"
  echo -e "  ${CYAN}(none)${NC}        Quick restart — restarts containers in-place"
  echo -e "  ${CYAN}--rebuild${NC}     Recreate containers with fresh image builds"
  echo -e "  ${CYAN}--fresh-db${NC}    Reset database + re-seed (keeps images)"
  echo -e "  ${CYAN}--full${NC}        Nuke volumes, rebuild images, migrate, seed"
  echo -e "  ${CYAN}--help${NC}        Show this help"
  echo ""
  echo "Examples:"
  echo "  ./scripts/dev-restart.sh              # Code change, just need restart"
  echo "  ./scripts/dev-restart.sh --rebuild    # Changed a Dockerfile or deps"
  echo "  ./scripts/dev-restart.sh --fresh-db   # Schema changed, need re-seed"
  echo "  ./scripts/dev-restart.sh --full       # Something is broken, start over"
  echo ""
}

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ─── Parse args ────────────────────────────────────────────────────

MODE="quick"

case "${1:-}" in
  --rebuild)   MODE="rebuild" ;;
  --fresh-db)  MODE="fresh-db" ;;
  --full)      MODE="full" ;;
  --help|-h)   show_help; exit 0 ;;
  "")          MODE="quick" ;;
  *)
    echo -e "${RED}Unknown option: $1${NC}"
    show_help
    exit 1
    ;;
esac

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       AnatoView — Dev Restart            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
info "Mode: ${BOLD}$MODE${NC}"

START_TIME=$SECONDS

# ─── Wait for healthy services ─────────────────────────────────────

wait_for_healthy() {
  local service=$1
  local max_wait=${2:-60}
  local waited=0

  while [ $waited -lt $max_wait ]; do
    status=$(docker compose ps --format '{{.Health}}' "$service" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

wait_for_services() {
  step "Waiting for services to be healthy"

  for svc in postgres redis api web; do
    printf "  Waiting for %-12s" "$svc..."
    if wait_for_healthy "$svc" 90; then
      echo -e " ${GREEN}healthy${NC}"
    else
      echo -e " ${YELLOW}timeout (may still be starting)${NC}"
    fi
  done
}

# ═══════════════════════════════════════════════════════════════════
# Quick Restart — just restart containers
# ═══════════════════════════════════════════════════════════════════

if [ "$MODE" = "quick" ]; then
  step "Restarting containers"
  docker compose restart
  wait_for_services
fi

# ═══════════════════════════════════════════════════════════════════
# Rebuild — recreate containers with fresh images
# ═══════════════════════════════════════════════════════════════════

if [ "$MODE" = "rebuild" ]; then
  step "Stopping containers"
  docker compose down

  step "Rebuilding images and starting"
  docker compose up -d --build

  wait_for_services

  step "Regenerating Prisma client"
  docker compose exec api npx prisma generate
  success "Prisma client regenerated"
fi

# ═══════════════════════════════════════════════════════════════════
# Fresh DB — reset database + re-seed (keeps images/volumes intact)
# ═══════════════════════════════════════════════════════════════════

if [ "$MODE" = "fresh-db" ]; then
  step "Restarting containers"
  docker compose restart
  wait_for_services

  step "Resetting database schema"
  docker compose exec api npx prisma db push --force-reset
  success "Schema pushed"

  step "Seeding database"
  docker compose exec api npx prisma db seed
  success "Database seeded"

  if [ -f scripts/upload-models.sh ]; then
    step "Uploading SVG models to LocalStack S3"
    bash scripts/upload-models.sh
    success "Models uploaded"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# Full — nuclear option: nuke everything, rebuild, migrate, seed
# ═══════════════════════════════════════════════════════════════════

if [ "$MODE" = "full" ]; then
  step "Stopping containers and nuking volumes"
  docker compose down -v

  step "Rebuilding images and starting"
  docker compose up -d --build

  wait_for_services

  step "Running Prisma migrate"
  if docker compose exec api npx prisma migrate dev --name init 2>/dev/null; then
    success "Migrations applied"
  else
    warn "Migrate failed, falling back to db push"
    docker compose exec api npx prisma db push
    success "Schema pushed"
  fi

  step "Seeding database"
  docker compose exec api npx prisma db seed
  success "Database seeded"

  if [ -f scripts/upload-models.sh ]; then
    step "Uploading SVG models to LocalStack S3"
    bash scripts/upload-models.sh
    success "Models uploaded"
  fi
fi

# ─── Summary ───────────────────────────────────────────────────────

ELAPSED=$((SECONDS - START_TIME))

echo ""
step "Done"
success "Dev environment restarted in ${ELAPSED}s"
echo ""
echo -e "  ${CYAN}App:${NC}       http://localhost"
echo -e "  ${CYAN}API:${NC}       http://localhost/api/health"
echo -e "  ${CYAN}Adminer:${NC}   http://localhost:8080"
echo -e "  ${CYAN}S3 (local):${NC} http://localhost:4566"
echo ""
