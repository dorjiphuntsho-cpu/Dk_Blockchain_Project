#!/usr/bin/env bash
set -euo pipefail

KEYPAIR="/home/tandin/.config/solana/dk-token-devnet-v2.json"
SOLANA_KEYGEN="/home/tandin/.local/share/solana/install/active_release/bin/solana-keygen"
SOLANA="/home/tandin/.local/share/solana/install/active_release/bin/solana"

if [ -f "$KEYPAIR" ]; then
  echo "exists:$KEYPAIR"
else
  "$SOLANA_KEYGEN" new --no-bip39-passphrase -o "$KEYPAIR" >/tmp/dk-token-keygen.log
  echo "created:$KEYPAIR"
fi

"$SOLANA" address -k "$KEYPAIR"
