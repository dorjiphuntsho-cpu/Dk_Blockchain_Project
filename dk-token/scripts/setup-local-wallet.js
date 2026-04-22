#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const [, , walletNameArg = "user", amountArg = "100"] = process.argv;
const walletName = walletNameArg.trim();
const amount = amountArg.trim();
const clusterUrl = "http://127.0.0.1:8899";

if (!/^[A-Za-z0-9_-]+$/.test(walletName)) {
  console.error(
    "Wallet name must contain only letters, numbers, hyphens, or underscores.",
  );
  process.exit(1);
}

if (!/^\d+(\.\d+)?$/.test(amount)) {
  console.error("Airdrop amount must be a number.");
  process.exit(1);
}

const walletDir = path.join(os.homedir(), ".config", "solana");
const walletPath = path.join(walletDir, `${walletName}.json`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status || 1);
  }

  return result.stdout.trim();
}

function ensureCommand(command, installHint) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    console.error(`${command} is required. ${installHint}`);
    process.exit(1);
  }
}

ensureCommand(
  "solana",
  "Install the Solana CLI before running this script.",
);
ensureCommand(
  "solana-keygen",
  "Install the Solana CLI before running this script.",
);

fs.mkdirSync(walletDir, { recursive: true });

if (!fs.existsSync(walletPath)) {
  console.log(`Creating wallet ${walletName} at ${walletPath}`);
  run("solana-keygen", [
    "new",
    "--no-bip39-passphrase",
    "--silent",
    "--outfile",
    walletPath,
  ]);
} else {
  console.log(`Wallet ${walletName} already exists at ${walletPath}`);
}

const publicKey = run("solana-keygen", ["pubkey", walletPath]);

console.log(`Requesting ${amount} SOL on local validator for ${publicKey}`);
const airdropResult = spawnSync(
  "solana",
  ["airdrop", amount, publicKey, "--url", clusterUrl],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (airdropResult.error || airdropResult.status !== 0) {
  if (airdropResult.stderr) {
    process.stderr.write(airdropResult.stderr);
  }
  console.error(
    "Airdrop failed. Make sure solana-test-validator is running on localhost:8899.",
  );
  process.exit(airdropResult.status || 1);
}

if (airdropResult.stdout) {
  process.stdout.write(airdropResult.stdout);
}

const balance = run("solana", ["balance", publicKey, "--url", clusterUrl]);

console.log(`Wallet file: ${walletPath}`);
console.log(`Public key: ${publicKey}`);
console.log(`Balance: ${balance}`);
