const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity } = require('@metaplex-foundation/umi');
const { fromWeb3JsKeypair, fromWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
const {
  createMetadataAccountV3,
  fetchMetadataFromSeeds,
  findMetadataPda,
  mplTokenMetadata,
  TokenStandard,
} = require('@metaplex-foundation/mpl-token-metadata');
const {
  TOKEN_PROGRAM_ID,
  approve: approveDelegate,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
} = require('@solana/spl-token');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { EXECUTION_MODES, TOKEN_REQUEST_TYPES } = require('../utils/enums');

const projectRoot = path.resolve(__dirname, '../../..');
const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

let cachedIdl;
let cachedProgramId;
let cachedConnection;
let cachedUmi;
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

function getUmi() {
  if (cachedUmi) {
    return cachedUmi;
  }

  cachedUmi = createUmi(getConnection()).use(mplTokenMetadata());
  return cachedUmi;
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

function getOptionalMakerKeypair() {
  if (!env.SOLANA_MAKER_KEYPAIR_PATH) {
    return null;
  }

  return getMakerKeypair();
}

function getCheckerKeypair() {
  return loadKeypair('Checker', env.SOLANA_CHECKER_KEYPAIR_PATH);
}

function getOptionalCheckerKeypair() {
  if (!env.SOLANA_CHECKER_KEYPAIR_PATH) {
    return null;
  }

  return getCheckerKeypair();
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

async function fetchConfigAccount(configAddress, keypair = getAdminKeypair()) {
  return getProgram(keypair).account.config.fetchNullable(configAddress);
}

function mapOnChainRequestStatus(status) {
  if (!status || typeof status !== 'object') {
    return null;
  }

  const [variant] = Object.keys(status);
  return variant ? variant.toUpperCase() : null;
}

async function fetchTokenRequestAccount(requestAddress, keypair = getAdminKeypair()) {
  const publicKey = parsePublicKey(requestAddress, 'onChainRequestAddress');
  const account = await getProgram(keypair).account.tokenRequest.fetchNullable(publicKey);

  if (!account) {
    return null;
  }

  return {
    address: publicKey.toBase58(),
    maker: account.maker?.toBase58?.() || null,
    checker: account.checker?.toBase58?.() || null,
    mint: account.mint?.toBase58?.() || null,
    sourceTokenAccount: account.sourceTokenAccount?.toBase58?.() || null,
    destinationTokenAccount: account.destinationTokenAccount?.toBase58?.() || null,
    amount: account.amount?.toString?.() || null,
    requestType: account.requestType ? Object.keys(account.requestType)[0]?.toUpperCase() || null : null,
    status: mapOnChainRequestStatus(account.status),
  };
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

function getTokenAuthorityAddress(configAddress) {
  const parsedConfigAddress = parsePublicKey(configAddress, 'configAddress');
  return getTokenAuthority(parsedConfigAddress).toBase58();
}

function buildExplorerUrl(signature) {
  const customUrl = encodeURIComponent(env.SOLANA_RPC_URL);
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${customUrl}`;
}

function resolvePdaAddress(pdaOrPublicKey) {
  if (Array.isArray(pdaOrPublicKey)) {
    return String(pdaOrPublicKey[0]);
  }

  return String(pdaOrPublicKey);
}

function buildMetadataAddress(mintAddress) {
  return resolvePdaAddress(findMetadataPda(getUmi(), {
    mint: fromWeb3JsPublicKey(mintAddress),
  }));
}

async function createMintMetadata({ adminKeypair, mintAddress, name, symbol, uri }) {
  const umi = createUmi(getConnection())
    .use(mplTokenMetadata())
    .use(keypairIdentity(fromWeb3JsKeypair(adminKeypair)));
  const mintPublicKey = fromWeb3JsPublicKey(mintAddress);
  const metadataAddress = findMetadataPda(umi, { mint: mintPublicKey });

  const metadataBuilder = createMetadataAccountV3(umi, {
    metadata: metadataAddress,
    mint: mintPublicKey,
    mintAuthority: umi.identity,
    payer: umi.identity,
    updateAuthority: umi.identity.publicKey,
    data: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    isMutable: true,
    collectionDetails: null,
  });

  const result = await metadataBuilder.sendAndConfirm(umi);

  return {
    metadataAddress: resolvePdaAddress(metadataAddress),
    metadataTxSignature: String(result.signature),
    metadataUpdateAuthority: adminKeypair.publicKey.toBase58(),
    metadataUri: uri,
    name,
    symbol,
    tokenStandard: TokenStandard.Fungible,
  };
}

function supportsBrowserWalletExecution(requestType) {
  // Phase A: All request types now support browser wallet execution
  return (
    requestType === TOKEN_REQUEST_TYPES.TRANSFER ||
    requestType === TOKEN_REQUEST_TYPES.BURN ||
    requestType === TOKEN_REQUEST_TYPES.MINT
  );
}

function getExpectedMakerWalletAddress(tokenRequest) {
  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.MINT) {
    return tokenRequest.makerWalletAddress || null;
  }

  return tokenRequest.sourceWallet?.walletAddress || tokenRequest.makerWalletAddress || null;
}

function canServerManagedCreateRequest(tokenRequest) {
  const makerKeypair = getOptionalMakerKeypair();

  if (tokenRequest.requestType === TOKEN_REQUEST_TYPES.MINT) {
    return Boolean(makerKeypair);
  }

  const expectedMakerWalletAddress = getExpectedMakerWalletAddress(tokenRequest);
  if (!expectedMakerWalletAddress) {
    return false;
  }

  if (!makerKeypair) {
    return false;
  }

  return expectedMakerWalletAddress === makerKeypair.publicKey.toBase58();
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
  const checkerKeypair = getOptionalCheckerKeypair();
  const configKeypair = getConfigKeypair();
  const adminProgram = getProgram(adminKeypair);

  if (!configKeypair && !env.SOLANA_CONFIG_ADDRESS) {
    throw new ApiError(
      500,
      'SOLANA_CONFIG_KEYPAIR_PATH or SOLANA_CONFIG_ADDRESS is required for Solana bootstrap',
    );
  }

  const configAddress = configKeypair ? configKeypair.publicKey : requireConfigAddress();
  const existingConfig = await fetchConfigAccount(configAddress, adminKeypair);

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
  const adminSignerMatchesOnChain = config.admin.equals(adminKeypair.publicKey);
  const checkerExists = checkerKeypair
    ? config.checkers.some((existingChecker) => existingChecker.equals(checkerKeypair.publicKey))
    : false;

  if (
    checkerKeypair &&
    adminSignerMatchesOnChain &&
    !checkerExists &&
    !checkerKeypair.publicKey.equals(adminKeypair.publicKey)
  ) {
    await adminProgram.methods
      .addChecker(checkerKeypair.publicKey)
      .accounts({
        config: configAddress,
        admin: adminKeypair.publicKey,
      })
      .signers([adminKeypair])
      .rpc();
  }

  return getConfigStatus();
}

async function getConfigStatus() {
  const configAddress = requireConfigAddress();
  const adminKeypair = getAdminKeypair();
  const makerKeypair = getOptionalMakerKeypair();
  const checkerKeypair = getOptionalCheckerKeypair();
  const config = await fetchConfigAccount(configAddress, adminKeypair);

  const configuredSigners = {
    admin: adminKeypair.publicKey.toBase58(),
    maker: makerKeypair?.publicKey.toBase58() || null,
    checker: checkerKeypair?.publicKey.toBase58() || null,
  };

  const status = {
    rpcUrl: env.SOLANA_RPC_URL,
    commitment: env.SOLANA_COMMITMENT,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    idlPath: resolveConfiguredPath(env.SOLANA_PROGRAM_IDL_PATH),
    autoBootstrapEnabled: env.SOLANA_AUTO_BOOTSTRAP,
    bootstrapMode: env.SOLANA_BOOTSTRAP_MODE,
    configExists: Boolean(config),
    configuredSigners,
    onChain: null,
    adminSignerMatchesOnChain: false,
    checkerSignerConfiguredOnChain: false,
    canManageOnChainConfig: false,
    warnings: [],
  };

  if (!config) {
    status.warnings.push('On-chain config account does not exist yet.');
    return status;
  }

  const onChainAdmin = config.admin.toBase58();
  const onChainCheckers = config.checkers.map((checker) => checker.toBase58());

  status.onChain = {
    admin: onChainAdmin,
    checkers: onChainCheckers,
  };
  status.adminSignerMatchesOnChain = onChainAdmin === configuredSigners.admin;
  status.checkerSignerConfiguredOnChain = configuredSigners.checker
    ? onChainCheckers.includes(configuredSigners.checker)
    : false;
  status.canManageOnChainConfig = status.adminSignerMatchesOnChain;

  if (!status.adminSignerMatchesOnChain) {
    status.warnings.push(
      `Configured backend admin signer ${configuredSigners.admin} does not match on-chain admin ${onChainAdmin}.`,
    );
  }

  if (configuredSigners.checker && !status.checkerSignerConfiguredOnChain) {
    status.warnings.push(
      `Configured backend checker signer ${configuredSigners.checker} is not registered on chain.`,
    );
  }

  if (!configuredSigners.maker) {
    status.warnings.push(
      'No backend maker signer is configured. Maker initiation must come from a browser wallet.',
    );
  }

  if (!configuredSigners.checker) {
    status.warnings.push(
      'No backend checker signer is configured. Checker approval will use the browser wallet flow for normal operations.',
    );
  }

  return status;
}

async function requireAdminManagedConfig() {
  const configAddress = requireConfigAddress();
  const adminKeypair = getAdminKeypair();
  const adminProgram = getProgram(adminKeypair);
  const config = await adminProgram.account.config.fetchNullable(configAddress);

  if (!config) {
    throw new ApiError(404, `On-chain config account ${configAddress.toBase58()} does not exist`);
  }

  if (!config.admin.equals(adminKeypair.publicKey)) {
    throw new ApiError(
      409,
      `Configured admin signer ${adminKeypair.publicKey.toBase58()} is not the current on-chain admin ${config.admin.toBase58()}`,
    );
  }

  return {
    adminKeypair,
    adminProgram,
    configAddress,
    config,
  };
}

async function addChecker(checkerAddress) {
  const checkerPublicKey = parsePublicKey(checkerAddress, 'checkerAddress');
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();

  await adminProgram.methods
    .addChecker(checkerPublicKey)
    .accounts({
      config: configAddress,
      admin: adminKeypair.publicKey,
    })
    .signers([adminKeypair])
    .rpc();

  return getConfigStatus();
}

async function removeChecker(checkerAddress) {
  const checkerPublicKey = parsePublicKey(checkerAddress, 'checkerAddress');
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();

  await adminProgram.methods
    .removeChecker(checkerPublicKey)
    .accounts({
      config: configAddress,
      admin: adminKeypair.publicKey,
    })
    .signers([adminKeypair])
    .rpc();

  return getConfigStatus();
}

async function setAdmin(newAdminAddress) {
  const newAdminPublicKey = parsePublicKey(newAdminAddress, 'newAdminAddress');
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();

  await adminProgram.methods
    .setAdmin(newAdminPublicKey)
    .accounts({
      config: configAddress,
      admin: adminKeypair.publicKey,
    })
    .signers([adminKeypair])
    .rpc();

  return getConfigStatus();
}

async function createTokenMint({ decimals, name, symbol, uri }) {
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();
  const mintKeypair = Keypair.generate();
  const tokenAuthority = getTokenAuthority(configAddress);
  const metadataAddress = buildMetadataAddress(mintKeypair.publicKey);

  const txSignature = await adminProgram.methods
    .createTokenMint(decimals, name, symbol, uri)
    .accounts({
      config: configAddress,
      mint: mintKeypair.publicKey,
      tokenAuthority,
      metadata: metadataAddress,
      admin: adminKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      metadataProgram: new PublicKey(METADATA_PROGRAM_ID),
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([adminKeypair, mintKeypair])
    .rpc();

  const mintAccount = await getMint(getConnection(), mintKeypair.publicKey, env.SOLANA_COMMITMENT);

  return {
    name,
    symbol,
    metadataUri: uri,
    metadataAddress,
    metadataUpdateAuthority: adminKeypair.publicKey.toBase58(),
    metadataTxSignature: txSignature,
    mintAddress: mintKeypair.publicKey.toBase58(),
    decimals: mintAccount.decimals,
    mintAuthority: mintAccount.mintAuthority?.toBase58() || null,
    freezeAuthority: mintAccount.freezeAuthority?.toBase58() || null,
    supply: mintAccount.supply.toString(),
    tokenAuthority: tokenAuthority.toBase58(),
    txSignature,
    explorerUrl: buildExplorerUrl(txSignature),
  };
}

async function ensureManagedTokenMetadata({
  mintAddress,
  name,
  symbol,
  uri,
  adminWalletAddress = null,
}) {
  const adminKeypair = getAdminKeypair();
  const configuredAdminWalletAddress = adminKeypair.publicKey.toBase58();

  if (adminWalletAddress && adminWalletAddress !== configuredAdminWalletAddress) {
    throw new ApiError(
      409,
      `Configured backend admin signer ${configuredAdminWalletAddress} does not match the provided admin wallet ${adminWalletAddress}`,
    );
  }

  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');

  try {
    const metadata = await fetchMetadataFromSeeds(getUmi(), {
      mint: fromWeb3JsPublicKey(mintPublicKey),
    });

    return {
      metadataAddress: buildMetadataAddress(mintPublicKey),
      metadataTxSignature: null,
      metadataUpdateAuthority: String(metadata.updateAuthority),
      metadataUri: metadata.uri || uri || null,
      name: metadata.name || name,
      symbol: metadata.symbol || symbol,
    };
  } catch (metadataError) {
    throw new ApiError(
      409,
      `Metadata account for mint ${mintAddress} is missing after mint creation. ${metadataError.message}`,
    );
  }
}

async function hydrateManagedToken(token) {
  let onChain = null;
  let warning = null;

  try {
    const mintAccount = await getMint(
      getConnection(),
      parsePublicKey(token.mintAddress, 'mintAddress'),
      env.SOLANA_COMMITMENT,
    );

    onChain = {
      supply: mintAccount.supply.toString(),
      decimals: mintAccount.decimals,
      mintAuthority: mintAccount.mintAuthority?.toBase58() || null,
      freezeAuthority: mintAccount.freezeAuthority?.toBase58() || null,
      isInitialized: mintAccount.isInitialized,
    };

    try {
      const metadata = await fetchMetadataFromSeeds(getUmi(), {
        mint: fromWeb3JsPublicKey(parsePublicKey(token.mintAddress, 'mintAddress')),
      });

      onChain.metadata = {
        address: token.metadataAddress || buildMetadataAddress(parsePublicKey(token.mintAddress, 'mintAddress')),
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        updateAuthority: metadata.updateAuthority,
      };
    } catch (metadataError) {
      warning = metadataError.message;
    }
  } catch (error) {
    warning = error.message;
  }

  return {
    ...token,
    onChain,
    warning,
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

function resolveSourceTokenAccountAddress(tokenRequest, mintAddress) {
  if (tokenRequest.sourceTokenAccountAddress) {
    return parsePublicKey(tokenRequest.sourceTokenAccountAddress, 'sourceTokenAccountAddress');
  }

  if (!tokenRequest.sourceWallet?.walletAddress) {
    return null;
  }

  return getOwnerAta(
    mintAddress,
    parsePublicKey(tokenRequest.sourceWallet.walletAddress, 'source wallet address'),
  );
}

function resolveDestinationTokenAccountAddress(tokenRequest, mintAddress) {
  if (tokenRequest.destinationTokenAccountAddress) {
    return parsePublicKey(tokenRequest.destinationTokenAccountAddress, 'destinationTokenAccountAddress');
  }

  if (!tokenRequest.destinationWallet?.walletAddress) {
    return null;
  }

  return getOwnerAta(
    mintAddress,
    parsePublicKey(tokenRequest.destinationWallet.walletAddress, 'destination wallet address'),
  );
}

async function approveRecordedOnChainRequest(tokenRequest) {
  if (!tokenRequest.onChainRequestAddress) {
    throw new ApiError(400, 'onChainRequestAddress is required for recorded browser-wallet execution');
  }

  const checkerKeypair = getCheckerKeypair();
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const checkerProgram = getProgram(checkerKeypair);
  const mintAddress = parsePublicKey(tokenRequest.tokenMintAddress, 'tokenMintAddress');
  const requestAddress = parsePublicKey(tokenRequest.onChainRequestAddress, 'onChainRequestAddress');

  await assertCheckerConfigured(configAddress, checkerKeypair);

  const sourceTokenAccount = resolveSourceTokenAccountAddress(tokenRequest, mintAddress);
  const destinationTokenAccount = resolveDestinationTokenAccountAddress(tokenRequest, mintAddress);

  const approveSignature = await checkerProgram.methods
    .approveRequest()
    .accounts({
      request: requestAddress,
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

  return {
    createSignature: tokenRequest.initiationTxSignature || null,
    approveSignature,
    txSignature: approveSignature,
    explorerUrl: buildExplorerUrl(approveSignature),
    onChainRequestAddress: requestAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    sourceTokenAccount: sourceTokenAccount?.toBase58() || null,
    destinationTokenAccount: destinationTokenAccount?.toBase58() || null,
  };
}

async function executeOnChainRequest(tokenRequest) {
  // Normal flow: checker signs in browser wallet, backend records via record-execution.
  if (tokenRequest.executionMode === EXECUTION_MODES.BROWSER_WALLET) {
    if (!tokenRequest.onChainRequestAddress) {
      throw new ApiError(
        400,
        'Browser wallet initiation is required before this request can be executed on chain. Please initiate the request from the maker wallet.',
      );
    }

    throw new ApiError(
      400,
      'Checker browser-wallet approval is required. Use the checker preparation payload and record-execution endpoint after the on-chain signature is confirmed.',
    );
  }

  // Legacy fallback: allow backend checker signer if explicitly configured.
  const checkerKeypair = getOptionalCheckerKeypair();
  if (!checkerKeypair) {
    throw new ApiError(
      400,
      'Backend checker signer is not configured. Checker approval must be signed in browser and then recorded with record-execution.',
    );
  }

  if (!tokenRequest.onChainRequestAddress) {
    throw new ApiError(
      400,
      'No on-chain request address found for backend fallback approval.',
    );
  }

  return approveRecordedOnChainRequest(tokenRequest);
}

function getExecutionContext(tokenRequest) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(tokenRequest.tokenMintAddress, 'tokenMintAddress');
  const supportsWalletExecution = supportsBrowserWalletExecution(tokenRequest.requestType);
  const walletExecutionRecorded = Boolean(tokenRequest.onChainRequestAddress && tokenRequest.initiationTxSignature);
  const checkerKeypair = getOptionalCheckerKeypair();

  // Phase A: Always use browser wallet model - backend no longer signs normal operations
  const payload = {
    integrationReady: true,
    executionBoundaryVersion: 1,
    executionMode: EXECUTION_MODES.BROWSER_WALLET,
    runtimeMode: 'browser-wallet',
    rpcUrl: env.SOLANA_RPC_URL,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    tokenMintAddress: mintAddress.toBase58(),
    amount: toRawAmount(tokenRequest.amount),
    // Exposed only for optional legacy fallback and diagnostics.
    backendMakerSignerAddress: null,
    backendCheckerSignerAddress: checkerKeypair?.publicKey.toBase58() || null,
    // Normal flow is browser-first.
    serverManagedCreateSupported: false,
    walletInitiation: {
      supported: supportsWalletExecution,
      recorded: walletExecutionRecorded,
      expectedMakerWalletAddress: getExpectedMakerWalletAddress(tokenRequest),
      makerWalletAddress: tokenRequest.makerWalletAddress || null,
      onChainRequestAddress: tokenRequest.onChainRequestAddress || null,
      initiationTxSignature: tokenRequest.initiationTxSignature || null,
      initiationExplorerUrl: tokenRequest.initiationExplorerUrl || null,
      makerInitiatedAt: tokenRequest.makerInitiatedAt || null,
    },
  };

  if (tokenRequest.sourceWallet?.walletAddress) {
    payload.sourceWalletAddress = tokenRequest.sourceWallet.walletAddress;
    payload.sourceTokenAccount = resolveSourceTokenAccountAddress(
      tokenRequest,
      mintAddress,
    )?.toBase58() || null;
  }

  if (tokenRequest.destinationWallet?.walletAddress) {
    payload.destinationWalletAddress = tokenRequest.destinationWallet.walletAddress;
    payload.destinationTokenAccount = resolveDestinationTokenAccountAddress(
      tokenRequest,
      mintAddress,
    )?.toBase58() || null;
  }

  return payload;
}

async function getWalletTokenBalances(ownerAddress) {
  const ownerPublicKey = parsePublicKey(ownerAddress, 'walletAddress');
  const response = await getConnection().getParsedTokenAccountsByOwner(
    ownerPublicKey,
    { programId: TOKEN_PROGRAM_ID },
    env.SOLANA_COMMITMENT,
  );

  return response.value
    .map(({ pubkey, account }) => {
      const parsedInfo = account.data.parsed?.info;
      const tokenAmount = parsedInfo?.tokenAmount;

      return {
        tokenAccountAddress: pubkey.toBase58(),
        mintAddress: parsedInfo?.mint || null,
        rawAmount: tokenAmount?.amount || '0',
        decimals: tokenAmount?.decimals ?? 0,
        amount: tokenAmount?.uiAmountString || '0',
      };
    })
    .filter((item) => item.mintAddress)
    .sort((left, right) => left.mintAddress.localeCompare(right.mintAddress));
}

module.exports = {
  addChecker,
  bootstrapOnChainConfig,
  createTokenMint,
  executeOnChainRequest,
  fetchTokenRequestAccount,
  getConfigStatus,
  getAdminKeypair,
  getCheckerKeypair,
  getExecutionContext,
  getProgram,
  getTokenAuthorityAddress,
  getMetadataProgramId: () => METADATA_PROGRAM_ID,
  getProgramId,
  hydrateManagedToken,
  getWalletTokenBalances,
  buildExplorerUrl,
  ensureManagedTokenMetadata,
  supportsBrowserWalletExecution,
  removeChecker,
  setAdmin,
};
