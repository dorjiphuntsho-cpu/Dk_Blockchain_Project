const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');
const { Keypair } = require('@solana/web3.js');

function printUsage() {
  console.log([
    'Usage:',
    '  node backend/scripts/convert-phantom-secret-key.js "<phantom-secret-key>" "<output-file>"',
    '',
    'Examples:',
    '  node backend/scripts/convert-phantom-secret-key.js "3n8...base58..." "C:\\Users\\itand\\.config\\solana\\admin-devnet.json"',
    '  node backend/scripts/convert-phantom-secret-key.js "[1,2,3,...]" "C:\\Users\\itand\\.config\\solana\\admin-devnet.json"',
  ].join('\n'));
}

function readSecretInput(rawInput) {
  if (!rawInput) {
    throw new Error('Missing Phantom secret key input.');
  }

  const trimmed = String(rawInput).trim();

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON input must be an array of numbers.');
    }

    return Uint8Array.from(parsed.map((value) => Number(value)));
  }

  return bs58.decode(trimmed);
}

function toSecretKeyBytes(inputBytes) {
  if (inputBytes.length === 64) {
    return Uint8Array.from(inputBytes);
  }

  if (inputBytes.length === 32) {
    return Keypair.fromSeed(Uint8Array.from(inputBytes)).secretKey;
  }

  throw new Error(`Unsupported secret key length: ${inputBytes.length}. Expected 32 or 64 bytes.`);
}

function main() {
  const [, , rawSecret, rawOutputPath] = process.argv;

  if (!rawSecret || rawSecret === '--help' || rawSecret === '-h') {
    printUsage();
    process.exit(rawSecret ? 0 : 1);
  }

  const outputPath = rawOutputPath
    ? path.resolve(rawOutputPath)
    : path.resolve(process.cwd(), 'solana-wallet.json');

  const decodedInput = readSecretInput(rawSecret);
  const secretKey = toSecretKeyBytes(decodedInput);
  const keypair = Keypair.fromSecretKey(secretKey);
  const walletJson = JSON.stringify(Array.from(keypair.secretKey));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, walletJson);

  console.log(`Wrote wallet file: ${outputPath}`);
  console.log(`Public key: ${keypair.publicKey.toBase58()}`);
}

try {
  main();
} catch (error) {
  console.error(`Conversion failed: ${error.message}`);
  process.exit(1);
}
