#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AnatoView — One-Command Dev Setup
# ═══════════════════════════════════════════════════════════════════
#
# Brings the full AnatoView development stack from zero to running
# in a single command, bypassing Canvas LTI entirely.
#
# Usage:
#   ./scripts/dev-up.sh              Start dev environment
#   ./scripts/dev-up.sh --build     Force rebuild Docker images
#   ./scripts/dev-up.sh --fresh     Clean slate: drop volumes + rebuild
#   ./scripts/dev-up.sh --open      Open browser after startup
#   ./scripts/dev-up.sh --help      Show this help
#
# Flags can be combined:
#   ./scripts/dev-up.sh --build --open
#
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────
info()    { echo -e "${CYAN}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✗${NC}  $1"; }
step()    { echo -e "\n${BOLD}── $1 ──${NC}"; }
die()     { error "$1"; exit 1; }

# ─── Project root ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ─── Show help ─────────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}AnatoView — One-Command Dev Setup${NC}"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "Usage: ./scripts/dev-up.sh [options]"
  echo ""
  echo "Options:"
  echo -e "  ${CYAN}(none)${NC}        Start dev environment (idempotent)"
  echo -e "  ${CYAN}--build${NC}       Force rebuild Docker images"
  echo -e "  ${CYAN}--fresh${NC}       Clean slate: drop volumes, rebuild, migrate, seed"
  echo -e "  ${CYAN}--open${NC}        Open browser after startup"
  echo -e "  ${CYAN}--help${NC}        Show this help"
  echo ""
  echo "Flags can be combined:"
  echo "  ./scripts/dev-up.sh --build --open"
  echo ""
  echo "What this script does:"
  echo "  1. Creates .env from .env.example (first run only)"
  echo "  2. Generates SSL certs for https://localhost (first run only)"
  echo "  3. Starts all Docker services"
  echo "  4. Waits for services to be healthy"
  echo "  5. Runs database migrations"
  echo "  6. Seeds the database with dev data"
  echo "  7. Auto-logs in as Dev Instructor (no Canvas needed)"
  echo ""
}

# ─── Parse args ───────────────────────────────────────────────────
FLAG_BUILD=false
FLAG_FRESH=false
FLAG_OPEN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)  FLAG_BUILD=true ;;
    --fresh)  FLAG_FRESH=true ;;
    --open)   FLAG_OPEN=true ;;
    --help|-h) show_help; exit 0 ;;
    *)
      error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
  shift
done

# ─── Banner ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          AnatoView — Dev Setup                   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

START_TIME=$SECONDS

# ═══════════════════════════════════════════════════════════════════
# 1. Preflight Checks
# ═══════════════════════════════════════════════════════════════════

step "Preflight checks"

if ! docker info &>/dev/null; then
  die "Docker is not running. Please start Docker Desktop and try again."
fi
success "Docker is running"

if ! docker compose version &>/dev/null; then
  die "docker compose v2 not found. Install Docker Desktop or docker-compose-plugin."
fi
success "docker compose available"

# ═══════════════════════════════════════════════════════════════════
# 2. Environment Bootstrap
# ═══════════════════════════════════════════════════════════════════

step "Environment configuration"

if [ ! -f .env ]; then
  info "No .env file found — creating from .env.example"
  cp .env.example .env

  # Generate a random JWT secret
  JWT_SECRET=$(openssl rand -hex 32)

  # Patch .env with dev-appropriate values (handles macOS vs Linux sed)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING|JWT_SECRET=${JWT_SECRET}|" .env
    sed -i '' 's|NODE_ENV=production|NODE_ENV=development|' .env
    sed -i '' 's|S3_ENDPOINT=https://s3.amazonaws.com|S3_ENDPOINT=http://localstack:4566|' .env
    sed -i '' 's|FRONTEND_URL=https://anatoview.youruni.edu|FRONTEND_URL=http://localhost|' .env
    sed -i '' 's|DATABASE_URL=postgresql://anatoview:CHANGE_ME@postgres:5432/anatoview|DATABASE_URL=postgresql://anatoview:secret@postgres:5432/anatoview|' .env
    sed -i '' 's|AWS_ACCESS_KEY_ID=your-access-key|AWS_ACCESS_KEY_ID=test|' .env
    sed -i '' 's|AWS_SECRET_ACCESS_KEY=your-secret-key|AWS_SECRET_ACCESS_KEY=test|' .env
  else
    sed -i "s|JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING|JWT_SECRET=${JWT_SECRET}|" .env
    sed -i 's|NODE_ENV=production|NODE_ENV=development|' .env
    sed -i 's|S3_ENDPOINT=https://s3.amazonaws.com|S3_ENDPOINT=http://localstack:4566|' .env
    sed -i 's|FRONTEND_URL=https://anatoview.youruni.edu|FRONTEND_URL=http://localhost|' .env
    sed -i 's|DATABASE_URL=postgresql://anatoview:CHANGE_ME@postgres:5432/anatoview|DATABASE_URL=postgresql://anatoview:secret@postgres:5432/anatoview|' .env
    sed -i 's|AWS_ACCESS_KEY_ID=your-access-key|AWS_ACCESS_KEY_ID=test|' .env
    sed -i 's|AWS_SECRET_ACCESS_KEY=your-secret-key|AWS_SECRET_ACCESS_KEY=test|' .env
  fi

  success "Created .env with generated JWT_SECRET and dev defaults"
else
  success ".env already exists"
fi

# ═══════════════════════════════════════════════════════════════════
# 3. SSL Certificates
# ═══════════════════════════════════════════════════════════════════

step "SSL certificates"

CERT_DIR="infrastructure/nginx/certs"
CERT_FILE="${CERT_DIR}/localhost.pem"
KEY_FILE="${CERT_DIR}/localhost-key.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  success "SSL certs already exist"
else
  info "SSL certs not found — generating"
  mkdir -p "$CERT_DIR"

  if command -v mkcert &>/dev/null; then
    mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" localhost 127.0.0.1 ::1
    success "Generated trusted SSL certs with mkcert"
  else
    warn "mkcert not installed — generating self-signed certs with openssl"
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout "$KEY_FILE" \
      -out "$CERT_FILE" \
      -days 365 \
      -subj "/CN=localhost" \
      2>/dev/null
    success "Generated self-signed SSL certs (browser will show warning)"
    info "For trusted certs: brew install mkcert && mkcert -install, then delete certs and re-run"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# 4. Docker Services
# ═══════════════════════════════════════════════════════════════════

step "Starting Docker services"

if $FLAG_FRESH; then
  info "Fresh mode: removing volumes first"
  docker compose down -v 2>/dev/null || true
fi

if $FLAG_BUILD; then
  info "Building images (--build)"
  docker compose up -d --build
else
  docker compose up -d
fi

# ═══════════════════════════════════════════════════════════════════
# 5. Health Checks
# ═══════════════════════════════════════════════════════════════════

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

step "Waiting for services to be healthy"

ALL_HEALTHY=true
for svc in postgres redis api web; do
  printf "  Waiting for %-12s" "$svc..."
  if wait_for_healthy "$svc" 90; then
    echo -e " ${GREEN}healthy${NC}"
  else
    echo -e " ${YELLOW}timeout (may still be starting)${NC}"
    ALL_HEALTHY=false
  fi
done

if ! $ALL_HEALTHY; then
  warn "Some services are slow to start. Continuing — check 'docker compose logs' if errors occur."
fi

# ═══════════════════════════════════════════════════════════════════
# 6. Database Migrations
# ═══════════════════════════════════════════════════════════════════

step "Running database migrations"

if docker compose exec -T api npx prisma migrate dev 2>&1 | tail -5; then
  success "Migrations applied"
else
  warn "prisma migrate dev had issues — trying prisma db push as fallback"
  if docker compose exec -T api npx prisma db push 2>&1 | tail -5; then
    success "Schema pushed (fallback)"
  else
    die "Database migration failed. Check: docker compose logs api"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# 7. Database Seeding
# ═══════════════════════════════════════════════════════════════════

step "Seeding database"

if docker compose exec -T api npm run db:seed 2>&1 | tail -10; then
  success "Database seeded (7 animals, 110 structures, dev users)"
else
  warn "Seeding had issues (may be partially applied — safe to re-run)"
fi

if [ -f scripts/upload-models.sh ]; then
  step "Uploading SVG models to LocalStack S3"
  if bash scripts/upload-models.sh 2>&1 | tail -5; then
    success "Models uploaded to S3"
  else
    warn "Model upload had issues (non-fatal — app still works)"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# 8. Summary
# ═══════════════════════════════════════════════════════════════════

ELAPSED=$((SECONDS - START_TIME))

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       AnatoView — Ready for Development          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}App:${NC}          https://localhost"
echo -e "  ${CYAN}App (HTTP):${NC}   http://localhost"
echo -e "  ${CYAN}API Health:${NC}   http://localhost/api/health"
echo -e "  ${CYAN}Adminer:${NC}      http://localhost:8080  ${YELLOW}(start with: docker compose --profile tools up -d adminer)${NC}"
echo -e "  ${CYAN}S3 (local):${NC}   http://localhost:4566"
echo ""
echo -e "  ${BOLD}Dev Users (auto-login bypasses Canvas LTI):${NC}"
echo -e "  ${GREEN}Instructor:${NC}   instructor@anatoview.dev  ${CYAN}(default — auto-logged in)${NC}"
echo -e "  ${GREEN}Student:${NC}      student@anatoview.dev"
echo ""
echo -e "  ${BOLD}Switch to student role:${NC}"
echo -e "  Open browser console and run:"
echo -e "  ${CYAN}fetch('/api/auth/dev-login', {${NC}"
echo -e "  ${CYAN}  method: 'POST',${NC}"
echo -e "  ${CYAN}  headers: { 'Content-Type': 'application/json' },${NC}"
echo -e "  ${CYAN}  body: JSON.stringify({ role: 'student' }),${NC}"
echo -e "  ${CYAN}}).then(r => r.json()).then(console.log);${NC}"
echo -e "  ${CYAN}// Then hard-refresh the page${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  ${CYAN}make logs${NC}       Tail all service logs"
echo -e "  ${CYAN}make shell${NC}      Open bash in API container"
echo -e "  ${CYAN}make restart${NC}    Quick restart (ARGS=\"--rebuild\" for image rebuild)"
echo -e "  ${CYAN}make down${NC}       Stop all services"
echo -e "  ${CYAN}make test${NC}       Run unit tests"
echo ""
success "Dev environment ready in ${ELAPSED}s"

# ═══════════════════════════════════════════════════════════════════
# 9. Open Browser
# ═══════════════════════════════════════════════════════════════════

if $FLAG_OPEN; then
  echo ""
  info "Opening browser..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "https://localhost"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "https://localhost"
  else
    info "Could not detect browser opener — visit https://localhost manually"
  fi
fi
