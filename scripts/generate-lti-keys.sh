#!/bin/bash
# Generate RSA key pair for LTI 1.3 JWT signing
# Run once during initial project setup

set -e

KEYS_DIR="$(dirname "$0")/../infrastructure/keys"

mkdir -p "$KEYS_DIR"

echo "Generating LTI RSA 4096-bit key pair..."

# Generate private key
openssl genrsa -out "$KEYS_DIR/private.pem" 4096

# Extract public key
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

# Ensure private key is gitignored
GITIGNORE="$(dirname "$0")/../.gitignore"
if ! grep -q "infrastructure/keys/private.pem" "$GITIGNORE" 2>/dev/null; then
  echo "infrastructure/keys/private.pem" >> "$GITIGNORE"
  echo "Added private.pem to .gitignore"
fi

echo ""
echo "Keys generated successfully:"
echo "  Private: $KEYS_DIR/private.pem"
echo "  Public:  $KEYS_DIR/public.pem"
echo ""
echo "IMPORTANT: The private key is gitignored. Never commit it to version control."
