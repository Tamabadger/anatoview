#!/usr/bin/env bash
#
# upload-models.sh — Upload all SVG dissection models to LocalStack S3.
#
# Scans infrastructure/models/ for SVGs and uploads each one to the
# s3://anatoview-assets/models/ prefix, preserving the directory structure.
#
# Usage:
#   bash scripts/upload-models.sh
#
# Prerequisites:
#   - AWS CLI installed (brew install awscli / pip install awscli)
#   - LocalStack running (docker compose up -d localstack)
#   - Bucket created by infrastructure/localstack/init-s3.sh
#
# Environment:
#   S3_ENDPOINT — LocalStack endpoint (default: http://localhost:4566)
#   S3_BUCKET   — Target bucket        (default: anatoview-assets)
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────

S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:4566}"
S3_BUCKET="${S3_BUCKET:-anatoview-assets}"
MODELS_DIR="infrastructure/models"
S3_PREFIX="models"

# Resolve script location → project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Preflight checks ────────────────────────────────────────────

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  AnatoView — Model Upload to LocalStack S3   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check AWS CLI
if ! command -v aws &>/dev/null; then
  echo -e "${RED}✗ AWS CLI not found.${NC}"
  echo "  Install: brew install awscli  OR  pip install awscli"
  exit 1
fi

# Check LocalStack is reachable
if ! curl -sf "${S3_ENDPOINT}/_localstack/health" &>/dev/null; then
  echo -e "${YELLOW}⚠ LocalStack not reachable at ${S3_ENDPOINT}${NC}"
  echo "  Make sure the Docker stack is running: docker compose up -d"
  echo "  Trying anyway..."
fi

# Check models directory exists
FULL_MODELS_DIR="${PROJECT_ROOT}/${MODELS_DIR}"
if [ ! -d "${FULL_MODELS_DIR}" ]; then
  echo -e "${RED}✗ Models directory not found: ${FULL_MODELS_DIR}${NC}"
  exit 1
fi

# Common AWS args for LocalStack
AWS_ARGS="--endpoint-url ${S3_ENDPOINT} --no-sign-request"

# ─── Ensure bucket exists ────────────────────────────────────────

echo -e "  Bucket:   ${CYAN}s3://${S3_BUCKET}${NC}"
echo -e "  Endpoint: ${CYAN}${S3_ENDPOINT}${NC}"
echo ""

aws s3 mb "s3://${S3_BUCKET}" ${AWS_ARGS} 2>/dev/null || true

# ─── Upload SVG files ────────────────────────────────────────────

UPLOADED=0
FAILED=0

echo -e "${YELLOW}Scanning ${MODELS_DIR}/ for model files...${NC}"
echo ""

# Find all SVG files in the models directory
while IFS= read -r -d '' svg_file; do
  # Compute the relative path within models/
  rel_path="${svg_file#"${FULL_MODELS_DIR}/"}"
  s3_key="${S3_PREFIX}/${rel_path}"

  echo -n "  Uploading ${rel_path} ... "

  if aws s3 cp "${svg_file}" "s3://${S3_BUCKET}/${s3_key}" \
       ${AWS_ARGS} \
       --content-type "image/svg+xml" \
       --acl public-read \
       2>/dev/null; then

    url="${S3_ENDPOINT}/${S3_BUCKET}/${s3_key}"
    echo -e "${GREEN}✓${NC}"
    echo -e "    → ${CYAN}${url}${NC}"
    UPLOADED=$((UPLOADED + 1))
  else
    echo -e "${RED}✗ FAILED${NC}"
    FAILED=$((FAILED + 1))
  fi

done < <(find "${FULL_MODELS_DIR}" -type f \( -name "*.svg" -o -name "*.json" -o -name "*.png" \) -print0 | sort -z)

# ─── Summary ─────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}───────────────────────────────────────────────${NC}"
echo -e "  Uploaded: ${GREEN}${UPLOADED}${NC} file(s)"
if [ ${FAILED} -gt 0 ]; then
  echo -e "  Failed:   ${RED}${FAILED}${NC} file(s)"
fi
echo ""

# List all objects in the bucket models prefix
echo -e "${YELLOW}Current models in S3:${NC}"
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" ${AWS_ARGS} --recursive 2>/dev/null || echo "  (none)"
echo ""

# Print the URLs accessible from within Docker network
echo -e "${YELLOW}URLs accessible from Docker containers (use in API):${NC}"
while IFS= read -r -d '' svg_file; do
  rel_path="${svg_file#"${FULL_MODELS_DIR}/"}"
  echo -e "  http://localstack:4566/${S3_BUCKET}/${S3_PREFIX}/${rel_path}"
done < <(find "${FULL_MODELS_DIR}" -type f -name "*.svg" -print0 | sort -z)

echo ""
echo -e "${YELLOW}URLs accessible from host browser:${NC}"
while IFS= read -r -d '' svg_file; do
  rel_path="${svg_file#"${FULL_MODELS_DIR}/"}"
  echo -e "  ${S3_ENDPOINT}/${S3_BUCKET}/${S3_PREFIX}/${rel_path}"
done < <(find "${FULL_MODELS_DIR}" -type f -name "*.svg" -print0 | sort -z)

echo ""
echo -e "${GREEN}Done.${NC}"
