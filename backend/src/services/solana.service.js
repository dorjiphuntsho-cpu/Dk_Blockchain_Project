const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  approve: approveDelegate,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} = require('@solana/spl-token');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const projectRoot = path.resolve(__dirname, '../../..');

let cachedIdl;
let cachedProgramId;
let cachedConnection;
const signerCache = new Map();

function resolveConfiguredPath(configuredPath) {
  if (!configuredPath) {
    return null;
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(projectRoot, configuredPath);
}

function loadIdl() {
  if (cachedIdl) {
    return cachedIdl;
  }

  const idlPath = resolveConfiguredPath(env.SOLANA_PROGRAM_IDL_PATH);

  if (!fs.existsSync(idlPath)) {
    throw new ApiError(500, `Anchor IDL not found at ${idlPath}`);
  }

  cachedIdl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  return cachedIdl;
}

function getProgramId() {
  if (cachedProgramId) {
    return cachedProgramId;
  }

  const idl = loadIdl();

  try {
    cachedProgramId = new PublicKey(env.SOLANA_PROGRAM_ID || idl.address);
    return cachedProgramId;
  } catch (error) {
    throw new ApiError(500, `Invalid Solana program id configuration: ${error.message}`);
  }
}

function getConnection() {
  if (cachedConnection) {
    return cachedConnection;
  }

  cachedConnection = new anchor.web3.Connection(env.SOLANA_RPC_URL, env.SOLANA_COMMITMENT);
  return cachedConnection;
}

function loadKeypair(label, configuredPath) {
  if (!configuredPath) {
    throw new ApiError(500, `${label} keypair path is not configured`);
  }

  const resolvedPath = resolveConfiguredPath(configuredPath);

  if (signerCache.has(resolvedPath)) {
    return signerCache.get(resolvedPath);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new ApiError(500, `${label} keypair file not found at ${resolvedPath}`);
  }

  try {
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(resolvedPath, 'utf8')));
    const keypair = Keypair.fromSecretKey(secretKey);
    signerCache.set(resolvedPath, keypair);
    return keypair;
  } catch (error) {
    throw new ApiError(500, `Failed to load ${label} keypair: ${error.message}`);
  }
}

function getAdminKeypair() {
  return loadKeypair('Admin', env.SOLANA_ADMIN_KEYPAIR_PATH);
}

function getConfigKeypair() {
  if (!env.SOLANA_CONFIG_KEYPAIR_PATH) {
    return null;
  }

  const resolvedPath = resolveConfiguredPath(env.SOLANA_CONFIG_KEYPAIR_PATH);

  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    const keypair = Keypair.generate();
    fs.writeFileSync(resolvedPath, JSON.stringify(Array.from(keypair.secretKey)));
    signerCache.set(resolvedPath, keypair);
    return keypair;
  }

  return loadKeypair('Config', env.SOLANA_CONFIG_KEYPAIR_PATH);
}

function getMakerKeypair() {
  return loadKeypair('Maker', env.SOLANA_MAKER_KEYPAIR_PATH);
}

function getCheckerKeypair() {
  return loadKeypair('Checker', env.SOLANA_CHECKER_KEYPAIR_PATH);
}

function getWallet(keypair) {
  return new anchor.Wallet(keypair);
}

function getProvider(keypair) {
  return new anchor.AnchorProvider(
    getConnection(),
    getWallet(keypair),
    {
      commitment: env.SOLANA_COMMITMENT,
      preflightCommitment: env.SOLANA_COMMITMENT,
    },
  );
}

function getProgram(keypair) {
  const idl = loadIdl();
  return new anchor.Program(idl, getProvider(keypair));
}

function requireConfigAddress() {
  const configKeypair = getConfigKeypair();
  if (configKeypair) {
    return configKeypair.publicKey;
  }

  if (!env.SOLANA_CONFIG_ADDRESS) {
    throw new ApiError(
      500,
      'SOLANA_CONFIG_ADDRESS or SOLANA_CONFIG_KEYPAIR_PATH must be configured for backend execution',
    );
  }

  try {
    return new PublicKey(env.SOLANA_CONFIG_ADDRESS);
  } catch (error) {
    throw new ApiError(500, `Invalid SOLANA_CONFIG_ADDRESS: ${error.message}`);
  }
}

function parsePublicKey(value, label) {
  try {
    return new PublicKey(value);
  } catch (error) {
    throw new ApiError(400, `${label} is not a valid Solana address`);
  }
}

function toRawAmount(value) {
  const normalized = String(value).trim();

  if (!/^\d+(\.0+)?$/.test(normalized)) {
    throw new ApiError(
      400,
      'Only whole-number token amounts are supported by the current local-validator integration',
    );
  }

  return normalized.split('.')[0];
}

function toAnchorAmount(value) {
  return new anchor.BN(toRawAmount(value));
}

function toBigIntAmount(value) {
  return BigInt(toRawAmount(value));
}

function getTokenAuthority(configAddress) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token-authority'), configAddress.toBuffer()],
    getProgramId(),
  )[0];
}

function buildExplorerUrl(signature) {
  const customUrl = encodeURIComponent(env.SOLANA_RPC_URL);
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${customUrl}`;
}

async function ensureDestinationAta(payerKeypair, mintAddress, ownerAddress) {
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    payerKeypair,
    mintAddress,
    ownerAddress,
  );

  return tokenAccount.address;
}

function getOwnerAta(mintAddress, ownerAddress) {
  return getAssociatedTokenAddressSync(mintAddress, ownerAddress);
}

async function assertCheckerConfigured(configAddress, checkerKeypair) {
  const checkerProgram = getProgram(checkerKeypair);
  const config = await checkerProgram.account.config.fetch(configAddress);

  const hasChecker = config.checkers.some((checker) => checker.equals(checkerKeypair.publicKey));
  if (!hasChecker) {
    throw new ApiError(
      500,
      `Configured checker wallet ${checkerKeypair.publicKey.toBase58()} is not registered on chain`,
    );
  }

  return config;
}

async function bootstrapOnChainConfig() {
  const adminKeypair = getAdminKeypair();
  const checkerKeypair = getCheckerKeypair();
  const configKeypair = getConfigKeypair();
  const adminProgram = getProgram(adminKeypair);

  if (!configKeypair && !env.SOLANA_CONFIG_ADDRESS) {
    throw new ApiError(
      500,
      'SOLANA_CONFIG_KEYPAIR_PATH or SOLANA_CONFIG_ADDRESS is required for Solana bootstrap',
    );
  }

  const configAddress = configKeypair ? configKeypair.publicKey : requireConfigAddress();
  const existingConfig = await adminProgram.account.config.fetchNullable(configAddress);

  if (!existingConfig) {
    if (!configKeypair) {
      throw new ApiError(
        500,
        'Config account does not exist on chain and no SOLANA_CONFIG_KEYPAIR_PATH was provided to create it',
      );
    }

    await adminProgram.methods
      .initialize()
      .accounts({
        config: configAddress,
        admin: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminKeypair, configKeypair])
      .rpc();
  }

  const config = await adminProgram.account.config.fetch(configAddress);
  const checkerExists = config.checkers.some((existingChecker) =>
    existingChecker.equals(checkerKeypair.publicKey),
  );

  if (!checkerExists && !checkerKeypair.publicKey.equals(adminKeypair.publicKey)) {
    await adminProgram.methods
      .addChecker(checkerKeypair.publicKey)
      .accounts({
        config: configAddress,
        admin: adminKeypair.publicKey,
      })
      .signers([adminKeypair])
      .rpc();
  }

  return {
    configAddress: configAddress.toBase58(),
    adminAddress: adminKeypair.publicKey.toBase58(),
    checkerAddress: checkerKeypair.publicKey.toBase58(),
  };
}

async function approveSourceDelegation({ sourceTokenAccount, tokenAuthority, makerKeypair, payerKeypair, amount }) {
  return approveDelegate(
    getConnection(),
    payerKeypair,
    sourceTokenAccount,
    tokenAuthority,
    makerKeypair,
    amount,
  );
}

async function executeOnChainRequest(tokenRequest) {
  const makerKeypair = getMakerKeypair();
  const checkerKeypair = getCheckerKeypair();
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(tokenRequest.tokenMintAddress, 'tokenMintAddress');
  const amountBn = toAnchorAmount(tokenRequest.amount);
  const amountBigInt = toBigIntAmount(tokenRequest.amount);
  const makerProgram = getProgram(makerKeypair);
  const checkerProgram = getProgram(checkerKeypair);
  const requestKeypair = Keypair.generate();

  await assertCheckerConfigured(configAddress, checkerKeypair);

  let createSignature;
  let approveSignature;
  let sourceTokenAccount = null;
  let destinationTokenAccount = null;

  if (tokenRequest.requestType === 'MINT') {
    if (!tokenRequest.destinationWallet?.walletAddress) {
      throw new ApiError(400, 'Mint request is missing destination wallet address');
    }

    destinationTokenAccount = await ensureDestinationAta(
      checkerKeypair,
      mintAddress,
      parsePublicKey(tokenRequest.destinationWallet.walletAddress, 'destination wallet address'),
    );

    createSignature = await makerProgram.methods
      .createMintRequest(amountBn)
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        destinationTokenAccount,
        maker: makerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([makerKeypair, requestKeypair])
      .rpc();

    approveSignature = await checkerProgram.methods
      .approveRequest()
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        sourceTokenAccount: null,
        destinationTokenAccount,
        tokenAuthority,
        checker: checkerKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checkerKeypair])
      .rpc();
  }

  if (tokenRequest.requestType === 'TRANSFER') {
    if (!tokenRequest.sourceWallet?.walletAddress || !tokenRequest.destinationWallet?.walletAddress) {
      throw new ApiError(400, 'Transfer request is missing source or destination wallet address');
    }

    const configuredMakerAddress = makerKeypair.publicKey.toBase58();
    if (tokenRequest.sourceWallet.walletAddress !== configuredMakerAddress) {
      throw new ApiError(
        400,
        `Transfer source wallet must match the configured backend maker wallet ${configuredMakerAddress}`,
      );
    }

    sourceTokenAccount = getOwnerAta(
      mintAddress,
      parsePublicKey(tokenRequest.sourceWallet.walletAddress, 'source wallet address'),
    );
    destinationTokenAccount = await ensureDestinationAta(
      checkerKeypair,
      mintAddress,
      parsePublicKey(tokenRequest.destinationWallet.walletAddress, 'destination wallet address'),
    );

    await approveSourceDelegation({
      sourceTokenAccount,
      tokenAuthority,
      makerKeypair,
      payerKeypair: checkerKeypair,
      amount: amountBigInt,
    });

    createSignature = await makerProgram.methods
      .createTransferRequest(amountBn)
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        sourceTokenAccount,
        destinationTokenAccount,
        maker: makerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([makerKeypair, requestKeypair])
      .rpc();

    approveSignature = await checkerProgram.methods
      .approveRequest()
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        sourceTokenAccount,
        destinationTokenAccount,
        tokenAuthority,
        checker: checkerKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checkerKeypair])
      .rpc();
  }

  if (tokenRequest.requestType === 'BURN') {
    if (!tokenRequest.sourceWallet?.walletAddress) {
      throw new ApiError(400, 'Burn request is missing source wallet address');
    }

    const configuredMakerAddress = makerKeypair.publicKey.toBase58();
    if (tokenRequest.sourceWallet.walletAddress !== configuredMakerAddress) {
      throw new ApiError(
        400,
        `Burn source wallet must match the configured backend maker wallet ${configuredMakerAddress}`,
      );
    }

    sourceTokenAccount = getOwnerAta(
      mintAddress,
      parsePublicKey(tokenRequest.sourceWallet.walletAddress, 'source wallet address'),
    );

    await approveSourceDelegation({
      sourceTokenAccount,
      tokenAuthority,
      makerKeypair,
      payerKeypair: checkerKeypair,
      amount: amountBigInt,
    });

    createSignature = await makerProgram.methods
      .createBurnRequest(amountBn)
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        sourceTokenAccount,
        maker: makerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([makerKeypair, requestKeypair])
      .rpc();

    approveSignature = await checkerProgram.methods
      .approveRequest()
      .accounts({
        request: requestKeypair.publicKey,
        config: configAddress,
        mint: mintAddress,
        sourceTokenAccount,
        destinationTokenAccount: null,
        tokenAuthority,
        checker: checkerKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([checkerKeypair])
      .rpc();
  }

  if (!approveSignature) {
    throw new ApiError(400, `Unsupported token request type: ${tokenRequest.requestType}`);
  }

  return {
    createSignature,
    approveSignature,
    txSignature: approveSignature,
    explorerUrl: buildExplorerUrl(approveSignature),
    onChainRequestAddress: requestKeypair.publicKey.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    sourceTokenAccount: sourceTokenAccount?.toBase58() || null,
    destinationTokenAccount: destinationTokenAccount?.toBase58() || null,
  };
}

function getExecutionContext(tokenRequest) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(tokenRequest.tokenMintAddress, 'tokenMintAddress');

  const payload = {
    integrationReady: true,
    executionMode: 'server-managed-local-validator',
    rpcUrl: env.SOLANA_RPC_URL,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    tokenMintAddress: mintAddress.toBase58(),
    amount: toRawAmount(tokenRequest.amount),
    makerSignerAddress: getMakerKeypair().publicKey.toBase58(),
    checkerSignerAddress: getCheckerKeypair().publicKey.toBase58(),
  };

  if (tokenRequest.sourceWallet?.walletAddress) {
    payload.sourceWalletAddress = tokenRequest.sourceWallet.walletAddress;
    payload.sourceTokenAccount = getOwnerAta(
      mintAddress,
      parsePublicKey(tokenRequest.sourceWallet.walletAddress, 'source wallet address'),
    ).toBase58();
  }

  if (tokenRequest.destinationWallet?.walletAddress) {
    payload.destinationWalletAddress = tokenRequest.destinationWallet.walletAddress;
    payload.destinationTokenAccount = getOwnerAta(
      mintAddress,
      parsePublicKey(tokenRequest.destinationWallet.walletAddress, 'destination wallet address'),
    ).toBase58();
  }

  return payload;
}

module.exports = {
  bootstrapOnChainConfig,
  executeOnChainRequest,
  getAdminKeypair,
  getExecutionContext,
  getProgramId,
};
