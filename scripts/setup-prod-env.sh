#!/usr/bin/env bash
#
# setup-prod-env.sh — Interactive production .env generator for AnatoView.
#
# Prompts for all required environment variables, validates each value,
# and writes a .env.prod file ready for docker compose.
#
# Usage:
#   bash scripts/setup-prod-env.sh
#
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Resolve project root ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.prod"

# ─── Header ─────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  AnatoView — Production Environment Setup       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ -f "${ENV_FILE}" ]; then
  echo -e "${YELLOW}⚠  ${ENV_FILE} already exists.${NC}"
  read -rp "   Overwrite? (y/N): " overwrite
  if [[ ! "${overwrite}" =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 0
  fi
  echo ""
fi

# ─── Helper functions ───────────────────────────────────────────────

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="${3:-}"
  local value

  if [ -n "${default_value}" ]; then
    read -rp "  ${prompt_text} [${default_value}]: " value
    value="${value:-${default_value}}"
  else
    read -rp "  ${prompt_text}: " value
  fi
  eval "${var_name}='${value}'"
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local value

  read -rsp "  ${prompt_text}: " value
  echo ""
  eval "${var_name}='${value}'"
}

validate_url() {
  local url="$1"
  local label="$2"
  if [[ ! "${url}" =~ ^https?:// ]]; then
    echo -e "${RED}  ✗ ${label} must start with http:// or https://${NC}"
    return 1
  fi
  return 0
}

validate_not_empty() {
  local value="$1"
  local label="$2"
  if [ -z "${value}" ]; then
    echo -e "${RED}  ✗ ${label} cannot be empty${NC}"
    return 1
  fi
  return 0
}

validate_postgres_url() {
  local url="$1"
  if [[ ! "${url}" =~ ^postgres(ql)?:// ]]; then
    echo -e "${RED}  ✗ DATABASE_URL must start with postgresql:// or postgres://${NC}"
    return 1
  fi
  return 0
}

validate_redis_url() {
  local url="$1"
  if [[ ! "${url}" =~ ^redis(s)?:// ]]; then
    echo -e "${RED}  ✗ REDIS_URL must start with redis:// or rediss://${NC}"
    return 1
  fi
  return 0
}

# ─── Canvas / LTI Configuration ─────────────────────────────────────

echo -e "${BOLD}Canvas / LTI Configuration${NC}"
echo -e "  ${CYAN}(Get these values from your Canvas admin → Developer Keys)${NC}"
echo ""

while true; do
  prompt CANVAS_BASE_URL "Canvas instance URL" "https://canvas.instructure.com"
  validate_url "${CANVAS_BASE_URL}" "CANVAS_BASE_URL" && break
done

while true; do
  prompt LTI_CLIENT_ID "LTI Developer Key Client ID (numeric)"
  validate_not_empty "${LTI_CLIENT_ID}" "LTI_CLIENT_ID" && break
done

prompt LTI_KEY_ID "LTI Key ID (identifier for the RSA key)" "anatoview-prod-key"

echo ""

# ─── Secrets ─────────────────────────────────────────────────────────

echo -e "${BOLD}Secrets${NC}"
echo -e "  ${CYAN}Generate with: openssl rand -hex 32${NC}"
echo ""

while true; do
  prompt_secret JWT_SECRET "JWT signing secret (min 32 chars)"
  if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}  ✗ JWT_SECRET must be at least 32 characters${NC}"
    continue
  fi
  break
done

echo ""

# ─── Database ────────────────────────────────────────────────────────

echo -e "${BOLD}Database${NC}"
echo ""

while true; do
  prompt DATABASE_URL "PostgreSQL connection URL" "postgresql://anatoview:secret@postgres:5432/anatoview"
  validate_postgres_url "${DATABASE_URL}" && break
done

while true; do
  prompt REDIS_URL "Redis connection URL" "redis://redis:6379"
  validate_redis_url "${REDIS_URL}" && break
done

echo ""

# ─── AWS / S3 ────────────────────────────────────────────────────────

echo -e "${BOLD}AWS / S3 Storage${NC}"
echo -e "  ${CYAN}For production, use real AWS S3. Leave endpoint blank for AWS.${NC}"
echo ""

prompt S3_ENDPOINT "S3 endpoint (blank for AWS, or custom URL)" ""
prompt S3_BUCKET "S3 bucket name" "anatoview-assets"
prompt AWS_REGION "AWS region" "us-east-1"

while true; do
  prompt AWS_ACCESS_KEY_ID "AWS Access Key ID"
  validate_not_empty "${AWS_ACCESS_KEY_ID}" "AWS_ACCESS_KEY_ID" && break
done

while true; do
  prompt_secret AWS_SECRET_ACCESS_KEY "AWS Secret Access Key"
  validate_not_empty "${AWS_SECRET_ACCESS_KEY}" "AWS_SECRET_ACCESS_KEY" && break
done

echo ""

# ─── Production Host ─────────────────────────────────────────────────

echo -e "${BOLD}Production Host${NC}"
echo ""

prompt PROD_HOST "Production domain (for nginx/SSL)" "anatoview.youruni.edu"

echo ""

# ─── Write .env.prod ─────────────────────────────────────────────────

cat > "${ENV_FILE}" <<ENVFILE
# ═══════════════════════════════════════════════════════════════════════
# AnatoView — Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml \\
#     --env-file .env.prod up -d
# ═══════════════════════════════════════════════════════════════════════

# ── Canvas / LTI ───────────────────────────────────────────────────
CANVAS_BASE_URL=${CANVAS_BASE_URL}
LTI_CLIENT_ID=${LTI_CLIENT_ID}
LTI_KEY_ID=${LTI_KEY_ID}

# ── Secrets ────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Database ───────────────────────────────────────────────────────
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

# ── AWS / S3 ───────────────────────────────────────────────────────
S3_ENDPOINT=${S3_ENDPOINT}
S3_BUCKET=${S3_BUCKET}
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}

# ── Production ─────────────────────────────────────────────────────
NODE_ENV=production
PROD_HOST=${PROD_HOST}
ENVFILE

# Secure the file permissions
chmod 600 "${ENV_FILE}"

echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓  .env.prod written successfully               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  File: ${CYAN}${ENV_FILE}${NC}"
echo -e "  Permissions: ${CYAN}600 (owner read/write only)${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Generate LTI keys:   bash scripts/generate-lti-keys.sh"
echo "  2. Generate SSL certs:  certbot certonly --standalone -d ${PROD_HOST}"
echo "  3. Start production:"
echo ""
echo "     docker compose -f docker-compose.yml -f docker-compose.prod.yml \\"
echo "       --env-file .env.prod up -d"
echo ""
echo -e "${RED}IMPORTANT: Never commit .env.prod to version control.${NC}"
echo ""
