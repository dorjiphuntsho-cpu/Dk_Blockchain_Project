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
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  transfer: transferTokens,
} = require('@solana/spl-token');
const env = require('../config/env');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { BANK_TOKEN_ACCOUNT_PURPOSES, EXECUTION_MODES, TOKEN_REQUEST_TYPES } = require('../utils/enums');

const projectRoot = path.resolve(__dirname, '../../..');
const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const DK_BANK_CODE = '1060';

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

function getOptionalTreasuryOwnerKeypair() {
  if (!env.SOLANA_TREASURY_OWNER_KEYPAIR_PATH) {
    return null;
  }

  return loadKeypair('Treasury owner', env.SOLANA_TREASURY_OWNER_KEYPAIR_PATH);
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
    config: account.config?.toBase58?.() || null,
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

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new ApiError(400, 'Token amount must be a valid positive number');
  }

  const rounded = Math.round(Number(normalized));

  if (!Number.isFinite(rounded) || rounded < 0) {
    throw new ApiError(400, 'Token amount must be a valid positive number');
  }

  return String(rounded);
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

function getExpectedRequestAccounts(tokenRequest) {
  const mintAddress = parsePublicKey(tokenRequest.tokenMintAddress, 'tokenMintAddress');

  return {
    sourceTokenAccount:
      resolveSourceTokenAccountAddress(tokenRequest, mintAddress)?.toBase58() || null,
    destinationTokenAccount:
      resolveDestinationTokenAccountAddress(tokenRequest, mintAddress)?.toBase58() || null,
  };
}

async function validateRecordedOnChainRequest(tokenRequest, payload = {}, options = {}) {
  const onChainRequestAddress = payload.onChainRequestAddress || tokenRequest.onChainRequestAddress;

  if (!onChainRequestAddress) {
    throw new ApiError(400, 'onChainRequestAddress is required');
  }

  const onChainRequest = await fetchTokenRequestAccount(onChainRequestAddress);
  if (!onChainRequest) {
    throw new ApiError(404, 'On-chain request not found');
  }

  if (options.requirePendingStatus && onChainRequest.status !== 'PENDING') {
    throw new ApiError(
      409,
      `On-chain request status must be PENDING before recording initiation. Current status is ${onChainRequest.status || 'UNKNOWN'}.`,
    );
  }

  const configAddress = requireConfigAddress().toBase58();
  if (onChainRequest.config !== configAddress) {
    throw new ApiError(
      409,
      `Recorded on-chain request belongs to config ${onChainRequest.config}, expected ${configAddress}.`,
    );
  }

  if (onChainRequest.requestType !== tokenRequest.requestType) {
    throw new ApiError(
      409,
      `Recorded on-chain request type ${onChainRequest.requestType} does not match ${tokenRequest.requestType}.`,
    );
  }

  if (onChainRequest.mint !== tokenRequest.tokenMintAddress) {
    throw new ApiError(
      409,
      `Recorded on-chain mint ${onChainRequest.mint} does not match ${tokenRequest.tokenMintAddress}.`,
    );
  }

  const expectedAmount = toRawAmount(tokenRequest.amount);
  if (onChainRequest.amount !== expectedAmount) {
    throw new ApiError(
      409,
      `Recorded on-chain amount ${onChainRequest.amount} does not match ${expectedAmount}.`,
    );
  }

  if (payload.makerWalletAddress && onChainRequest.maker !== payload.makerWalletAddress) {
    throw new ApiError(
      409,
      `Recorded on-chain maker ${onChainRequest.maker} does not match ${payload.makerWalletAddress}.`,
    );
  }

  const expectedAccounts = getExpectedRequestAccounts(tokenRequest);
  if (expectedAccounts.sourceTokenAccount !== onChainRequest.sourceTokenAccount) {
    throw new ApiError(
      409,
      `Recorded source token account ${onChainRequest.sourceTokenAccount} does not match ${expectedAccounts.sourceTokenAccount}.`,
    );
  }

  if (expectedAccounts.destinationTokenAccount !== onChainRequest.destinationTokenAccount) {
    throw new ApiError(
      409,
      `Recorded destination token account ${onChainRequest.destinationTokenAccount} does not match ${expectedAccounts.destinationTokenAccount}.`,
    );
  }

  if (
    payload.sourceTokenAccountAddress
    && payload.sourceTokenAccountAddress !== onChainRequest.sourceTokenAccount
  ) {
    throw new ApiError(
      409,
      `Submitted source token account ${payload.sourceTokenAccountAddress} does not match the on-chain request.`,
    );
  }

  if (
    payload.destinationTokenAccountAddress
    && payload.destinationTokenAccountAddress !== onChainRequest.destinationTokenAccount
  ) {
    throw new ApiError(
      409,
      `Submitted destination token account ${payload.destinationTokenAccountAddress} does not match the on-chain request.`,
    );
  }

  return onChainRequest;
}

async function verifyConfirmedTransaction(signature, requiredAddresses = []) {
  const transaction = await getConnection().getParsedTransaction(
    signature,
    {
      commitment: env.SOLANA_COMMITMENT,
      maxSupportedTransactionVersion: 0,
    },
  );

  if (!transaction) {
    throw new ApiError(409, `Transaction ${signature} is not confirmed on the configured RPC.`);
  }

  if (transaction.meta?.err) {
    throw new ApiError(409, `Transaction ${signature} failed on chain and cannot be recorded as successful.`);
  }

  const accountKeys = transaction.transaction.message.accountKeys.map((entry) => (
    typeof entry === 'string' ? entry : entry.pubkey.toBase58()
  ));

  for (const requiredAddress of requiredAddresses.filter(Boolean)) {
    if (!accountKeys.includes(requiredAddress)) {
      throw new ApiError(
        409,
        `Transaction ${signature} does not reference required address ${requiredAddress}.`,
      );
    }
  }

  return transaction;
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

async function autoProvisionIssuerTreasuryForMint(mintAddress) {
  const issuerBank = await prisma.bank.findFirst({
    where: {
      OR: [
        { isIssuer: true },
        { code: DK_BANK_CODE },
      ],
      isActive: true,
    },
    orderBy: [
      { isIssuer: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!issuerBank) {
    return {
      bankId: null,
      bankName: null,
      synced: false,
      treasuryAccountRegisteredOnChain: false,
      reason: 'No active issuer bank is configured for automatic treasury provisioning.',
    };
  }

  if (!issuerBank.treasuryWalletAddress) {
    return {
      bankId: issuerBank.id,
      bankName: issuerBank.name,
      synced: false,
      treasuryAccountRegisteredOnChain: false,
      reason: `Issuer bank ${issuerBank.name} does not have a bank treasury owner wallet configured.`,
    };
  }

  const adminKeypair = getAdminKeypair();
  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const treasuryWalletPublicKey = parsePublicKey(
    issuerBank.treasuryWalletAddress,
    'issuer treasuryWalletAddress',
  );

  const tokenAccountPublicKey = await ensureDestinationAta(
    adminKeypair,
    mintPublicKey,
    treasuryWalletPublicKey,
  );
  const tokenAccountAddress = tokenAccountPublicKey.toBase58();

  const bankTokenAccount = await prisma.$transaction(async (tx) => {
    await tx.bankTokenAccount.updateMany({
      where: {
        bankId: issuerBank.id,
        mintAddress,
        NOT: {
          tokenAccountAddress,
        },
      },
      data: {
        isPrimary: false,
      },
    });

    return tx.bankTokenAccount.upsert({
      where: {
        bankId_mintAddress_purpose: {
          bankId: issuerBank.id,
          mintAddress,
          purpose: BANK_TOKEN_ACCOUNT_PURPOSES.TREASURY,
        },
      },
      update: {
        purpose: BANK_TOKEN_ACCOUNT_PURPOSES.TREASURY,
        treasuryWalletAddress: issuerBank.treasuryWalletAddress,
        tokenAccountAddress,
        isPrimary: true,
        isActive: true,
      },
      create: {
        bankId: issuerBank.id,
        mintAddress,
        purpose: BANK_TOKEN_ACCOUNT_PURPOSES.TREASURY,
        treasuryWalletAddress: issuerBank.treasuryWalletAddress,
        tokenAccountAddress,
        isPrimary: true,
        isActive: true,
        remarks: 'Auto-provisioned during managed token mint creation.',
      },
    });
  });

  let treasuryAccountRegisteredOnChain = false;
  let onChainRegistrationError = null;

  try {
    const status = await getConfigStatus();
    if ((status.onChain?.treasuryAccounts || []).includes(tokenAccountAddress)) {
      treasuryAccountRegisteredOnChain = true;
    } else {
      await addTreasuryAccount(tokenAccountAddress);
      treasuryAccountRegisteredOnChain = true;
    }
  } catch (error) {
    onChainRegistrationError = error instanceof Error ? error.message : 'Unknown on-chain registry error';
  }

  return {
    bankId: issuerBank.id,
    bankName: issuerBank.name,
    treasuryWalletAddress: issuerBank.treasuryWalletAddress,
    tokenAccountAddress,
    mintAddress,
    bankTokenAccountId: bankTokenAccount.id,
    synced: true,
    treasuryAccountRegisteredOnChain,
    reason: onChainRegistrationError,
  };
}

async function resolveBankTokenAccountByPurpose(bankId, mintAddress, purpose) {
  const bankTokenAccount = await prisma.bankTokenAccount.findFirst({
    where: {
      bankId,
      mintAddress,
      purpose,
      isActive: true,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!bankTokenAccount) {
    throw new ApiError(
      404,
      `No active ${String(purpose || '').toLowerCase()} bank token account found for bank ${bankId} and mint ${mintAddress}`,
    );
  }

  return bankTokenAccount;
}

async function resolveBankTreasuryTokenAccount(bankId, mintAddress) {
  return resolveBankTokenAccountByPurpose(bankId, mintAddress, BANK_TOKEN_ACCOUNT_PURPOSES.TREASURY);
}

async function resolveBankDistributionTokenAccount(bankId, mintAddress) {
  return resolveBankTokenAccountByPurpose(bankId, mintAddress, BANK_TOKEN_ACCOUNT_PURPOSES.DISTRIBUTION);
}

async function mintToBankTreasury({ bankId, mintAddress, amount }) {
  const makerKeypair = getOptionalMakerKeypair();
  const checkerKeypair = getOptionalCheckerKeypair();

  if (!makerKeypair) {
    throw new ApiError(
      500,
      'SOLANA_MAKER_KEYPAIR_PATH must be configured for backend-managed reserve mint execution',
    );
  }

  if (!checkerKeypair) {
    throw new ApiError(
      500,
      'SOLANA_CHECKER_KEYPAIR_PATH must be configured for backend-managed reserve mint execution',
    );
  }

  const treasuryTokenAccount = await resolveBankTreasuryTokenAccount(bankId, mintAddress);
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const destinationTokenAccount = parsePublicKey(
    treasuryTokenAccount.tokenAccountAddress,
    'tokenAccountAddress',
  );
  const requestKeypair = Keypair.generate();
  const makerProgram = getProgram(makerKeypair);
  const checkerProgram = getProgram(checkerKeypair);

  await assertCheckerConfigured(configAddress, checkerKeypair);

  const rawAmount = toAnchorAmount(amount);

  const createSignature = await makerProgram.methods
    .createMintRequest(rawAmount)
    .accounts({
      request: requestKeypair.publicKey,
      config: configAddress,
      mint: mintPublicKey,
      destinationTokenAccount,
      maker: makerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([makerKeypair, requestKeypair])
    .rpc();

  const approveSignature = await checkerProgram.methods
    .approveRequest()
    .accounts({
      request: requestKeypair.publicKey,
      config: configAddress,
      mint: mintPublicKey,
      sourceTokenAccount: null,
      destinationTokenAccount,
      tokenAuthority,
      checker: checkerKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([checkerKeypair])
    .rpc();

  return {
    bankId,
    mintAddress,
    amount: toRawAmount(amount),
    onChainRequestAddress: requestKeypair.publicKey.toBase58(),
    createSignature,
    approveSignature,
    txSignature: approveSignature,
    explorerUrl: buildExplorerUrl(approveSignature),
    tokenAuthority: tokenAuthority.toBase58(),
    destinationTokenAccount: destinationTokenAccount.toBase58(),
    treasuryWalletAddress: treasuryTokenAccount.treasuryWalletAddress,
  };
}

async function transferFromBankTreasuryToWallet({ bankId, mintAddress, amount, destinationWalletAddress }) {
  const makerKeypair = getOptionalMakerKeypair();
  const checkerKeypair = getOptionalCheckerKeypair();

  if (!makerKeypair) {
    throw new ApiError(
      500,
      'SOLANA_MAKER_KEYPAIR_PATH must be configured for backend-managed treasury transfers',
    );
  }

  if (!checkerKeypair) {
    throw new ApiError(
      500,
      'SOLANA_CHECKER_KEYPAIR_PATH must be configured for backend-managed treasury transfers',
    );
  }

  const treasuryTokenAccount = await resolveBankTreasuryTokenAccount(bankId, mintAddress);
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const sourceTokenAccount = parsePublicKey(
    treasuryTokenAccount.tokenAccountAddress,
    'tokenAccountAddress',
  );
  const destinationWalletPublicKey = parsePublicKey(destinationWalletAddress, 'destinationWalletAddress');
  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    makerKeypair,
    mintPublicKey,
    destinationWalletPublicKey,
  );
  const requestKeypair = Keypair.generate();
  const makerProgram = getProgram(makerKeypair);
  const checkerProgram = getProgram(checkerKeypair);

  await assertCheckerConfigured(configAddress, checkerKeypair);

  const sourceAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);
  const rawAmount = toBigIntAmount(amount);

  if (sourceAccount.amount < rawAmount) {
    throw new ApiError(
      409,
      `DK treasury has insufficient BTN inventory. Available ${sourceAccount.amount.toString()}, required ${rawAmount.toString()}.`,
    );
  }

  const treasuryOwner = resolveTreasuryOwnerKeypair(treasuryTokenAccount.treasuryWalletAddress);
  const delegation = await ensureTreasuryDelegation({
    sourceTokenAccount,
    tokenAuthority,
    treasuryOwnerKeypair: treasuryOwner.keypair,
    amount: rawAmount,
  });

  const anchorAmount = new anchor.BN(rawAmount.toString());

  const createSignature = await makerProgram.methods
    .createTransferRequest(anchorAmount)
    .accounts({
      request: requestKeypair.publicKey,
      config: configAddress,
      mint: mintPublicKey,
      sourceTokenAccount,
      destinationTokenAccount: destinationTokenAccount.address,
      maker: makerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([makerKeypair, requestKeypair])
    .rpc();

  const approveSignature = await checkerProgram.methods
    .approveRequest()
    .accounts({
      request: requestKeypair.publicKey,
      config: configAddress,
      mint: mintPublicKey,
      sourceTokenAccount,
      destinationTokenAccount: destinationTokenAccount.address,
      tokenAuthority,
      checker: checkerKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([checkerKeypair])
    .rpc();

  return {
    bankId,
    mintAddress,
    amount: rawAmount.toString(),
    onChainRequestAddress: requestKeypair.publicKey.toBase58(),
    createSignature,
    approveSignature,
    txSignature: approveSignature,
    explorerUrl: buildExplorerUrl(approveSignature),
    tokenAuthority: tokenAuthority.toBase58(),
    sourceTokenAccount: sourceTokenAccount.toBase58(),
    destinationWalletAddress: destinationWalletPublicKey.toBase58(),
    destinationTokenAccount: destinationTokenAccount.address.toBase58(),
    treasuryWalletAddress: treasuryTokenAccount.treasuryWalletAddress,
    treasuryOwnerRole: treasuryOwner.role,
    delegation,
  };
}

async function transferFromBankDistributionToWallet({ bankId, mintAddress, amount, destinationWalletAddress }) {
  const distributionTokenAccount = await resolveBankDistributionTokenAccount(bankId, mintAddress);
  const distributionOwner = resolveTreasuryOwnerKeypair(distributionTokenAccount.treasuryWalletAddress);
  const payerKeypair = distributionOwner.keypair;
  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const sourceTokenAccount = parsePublicKey(
    distributionTokenAccount.tokenAccountAddress,
    'tokenAccountAddress',
  );
  const destinationWalletPublicKey = parsePublicKey(destinationWalletAddress, 'destinationWalletAddress');
  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    payerKeypair,
    mintPublicKey,
    destinationWalletPublicKey,
  );

  const sourceAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);
  const rawAmount = toBigIntAmount(amount);

  if (sourceAccount.amount < rawAmount) {
    throw new ApiError(
      409,
      `Distribution account has insufficient BTN inventory. Available ${sourceAccount.amount.toString()}, required ${rawAmount.toString()}.`,
    );
  }

  const transferSignature = await transferTokens(
    getConnection(),
    payerKeypair,
    sourceTokenAccount,
    destinationTokenAccount.address,
    distributionOwner.keypair,
    rawAmount,
    [],
    {
      commitment: env.SOLANA_COMMITMENT,
      preflightCommitment: env.SOLANA_COMMITMENT,
    },
  );

  return {
    bankId,
    mintAddress,
    amount: rawAmount.toString(),
    onChainRequestAddress: null,
    createSignature: null,
    approveSignature: null,
    txSignature: transferSignature,
    explorerUrl: buildExplorerUrl(transferSignature),
    tokenAuthority: null,
    sourceTokenAccount: sourceTokenAccount.toBase58(),
    destinationWalletAddress: destinationWalletPublicKey.toBase58(),
    destinationTokenAccount: destinationTokenAccount.address.toBase58(),
    distributionWalletAddress: distributionTokenAccount.treasuryWalletAddress,
    distributionOwnerRole: distributionOwner.role,
    delegation: null,
  };
}

async function getCustomerSellDelegationStatus({ mintAddress, walletAddress, requiredAmount = null }) {
  const makerKeypair = getOptionalMakerKeypair();
  if (!makerKeypair) {
    return {
      configured: false,
      active: false,
      sufficient: false,
      requiredAmount: requiredAmount ? toRawAmount(requiredAmount) : null,
      delegatedAmount: '0',
      delegateWalletAddress: null,
      tokenAccountAddress: null,
      warning: 'SOLANA_MAKER_KEYPAIR_PATH is not configured for automatic sell delegation.',
    };
  }

  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const walletPublicKey = parsePublicKey(walletAddress, 'walletAddress');
  const sourceTokenAccount = getOwnerAta(mintPublicKey, walletPublicKey);
  const account = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);
  const delegatedAmount = account.delegatedAmount?.toString() || '0';
  const requiredRawAmount = requiredAmount ? toRawAmount(requiredAmount) : null;
  const active = account.delegate?.toBase58() === makerKeypair.publicKey.toBase58();
  const sufficient = active && (
    requiredRawAmount === null
      ? BigInt(delegatedAmount) > 0n
      : BigInt(delegatedAmount) >= BigInt(requiredRawAmount)
  );

  return {
    configured: true,
    active,
    sufficient,
    requiredAmount: requiredRawAmount,
    delegatedAmount,
    delegateWalletAddress: makerKeypair.publicKey.toBase58(),
    tokenAccountAddress: sourceTokenAccount.toBase58(),
  };
}

async function transferFromCustomerWalletToDistribution({ bankId, mintAddress, amount, sourceWalletAddress }) {
  const makerKeypair = getOptionalMakerKeypair();
  if (!makerKeypair) {
    throw new ApiError(500, 'SOLANA_MAKER_KEYPAIR_PATH must be configured for automatic customer sell transfers');
  }

  const distributionTokenAccount = await resolveBankDistributionTokenAccount(bankId, mintAddress);
  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const sourceWalletPublicKey = parsePublicKey(sourceWalletAddress, 'sourceWalletAddress');
  const sourceTokenAccount = getOwnerAta(mintPublicKey, sourceWalletPublicKey);
  const destinationTokenAccount = parsePublicKey(
    distributionTokenAccount.tokenAccountAddress,
    'distributionTokenAccountAddress',
  );
  const rawAmount = toBigIntAmount(amount);
  const sourceAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);

  if (sourceAccount.amount < rawAmount) {
    throw new ApiError(
      409,
      `Customer wallet has insufficient BTN balance. Available ${sourceAccount.amount.toString()}, required ${rawAmount.toString()}.`,
    );
  }

  const delegatedAmount = sourceAccount.delegatedAmount || 0n;
  const hasValidDelegate =
    sourceAccount.delegate
    && sourceAccount.delegate.toBase58() === makerKeypair.publicKey.toBase58()
    && delegatedAmount >= rawAmount;

  if (!hasValidDelegate) {
    throw new ApiError(
      409,
      'Customer wallet has not delegated enough BTN allowance for automatic sell execution.',
    );
  }

  const transferSignature = await transferTokens(
    getConnection(),
    makerKeypair,
    sourceTokenAccount,
    destinationTokenAccount,
    makerKeypair,
    rawAmount,
    [],
    {
      commitment: env.SOLANA_COMMITMENT,
      preflightCommitment: env.SOLANA_COMMITMENT,
    },
  );

  return {
    bankId,
    mintAddress,
    amount: rawAmount.toString(),
    txSignature: transferSignature,
    explorerUrl: buildExplorerUrl(transferSignature),
    sourceWalletAddress: sourceWalletPublicKey.toBase58(),
    sourceTokenAccount: sourceTokenAccount.toBase58(),
    destinationTokenAccount: destinationTokenAccount.toBase58(),
    delegateWalletAddress: makerKeypair.publicKey.toBase58(),
    delegatedAmount: delegatedAmount.toString(),
  };
}

async function transferFromCustomerWalletToWallet({ mintAddress, amount, sourceWalletAddress, destinationWalletAddress }) {
  const makerKeypair = getOptionalMakerKeypair();
  if (!makerKeypair) {
    throw new ApiError(500, 'SOLANA_MAKER_KEYPAIR_PATH must be configured for automatic customer transfers');
  }

  const mintPublicKey = parsePublicKey(mintAddress, 'mintAddress');
  const sourceWalletPublicKey = parsePublicKey(sourceWalletAddress, 'sourceWalletAddress');
  const sourceTokenAccount = getOwnerAta(mintPublicKey, sourceWalletPublicKey);
  const rawAmount = toBigIntAmount(amount);
  const sourceAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);

  if (sourceAccount.amount < rawAmount) {
    throw new ApiError(
      409,
      `Customer wallet has insufficient BTN balance. Available ${sourceAccount.amount.toString()}, required ${rawAmount.toString()}.`,
    );
  }

  const delegatedAmount = sourceAccount.delegatedAmount || 0n;
  const hasValidDelegate =
    sourceAccount.delegate
    && sourceAccount.delegate.toBase58() === makerKeypair.publicKey.toBase58()
    && delegatedAmount >= rawAmount;

  if (!hasValidDelegate) {
    throw new ApiError(
      409,
      'Customer wallet has not delegated enough BTN allowance for automatic transfer execution.',
    );
  }

  let destinationWalletPublicKey = null;
  try {
    destinationWalletPublicKey = destinationWalletAddress ? new PublicKey(destinationWalletAddress) : null;
  } catch {
    destinationWalletPublicKey = null;
  }

  let transferTargetOwner = destinationWalletPublicKey;
  let transferMode = 'wallet';
  let fiatAmount = null;

  if (!transferTargetOwner) {
    transferTargetOwner = parsePublicKey(env.DISTRIBUTOR_WALLET_ADDRESS, 'DISTRIBUTOR_WALLET_ADDRESS');
    fiatAmount = await convertBtnToFiat(rawAmount);
    await creditFiatBalance({ amount: fiatAmount, destinationWalletAddress, sourceWalletAddress });
    transferMode = 'fiat_fallback';
  }

  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    getConnection(),
    makerKeypair,
    mintPublicKey,
    transferTargetOwner,
  );

  const transferSignature = await transferTokens(
    getConnection(),
    makerKeypair,
    sourceTokenAccount,
    destinationTokenAccount.address,
    makerKeypair,
    rawAmount,
    [],
    {
      commitment: env.SOLANA_COMMITMENT,
      preflightCommitment: env.SOLANA_COMMITMENT,
    },
  );

  return {
    mintAddress,
    amount: rawAmount.toString(),
    txSignature: transferSignature,
    explorerUrl: buildExplorerUrl(transferSignature),
    sourceWalletAddress: sourceWalletPublicKey.toBase58(),
    sourceTokenAccount: sourceTokenAccount.toBase58(),
    destinationWalletAddress: destinationWalletPublicKey?.toBase58() || null,
    destinationTokenAccount: destinationTokenAccount.address.toBase58(),
    distributorWalletAddress: transferMode === 'fiat_fallback' ? transferTargetOwner.toBase58() : null,
    delegateWalletAddress: makerKeypair.publicKey.toBase58(),
    delegatedAmount: delegatedAmount.toString(),
    transferMode,
    fiatAmount,
  };
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
  const onChainTreasuryAccounts = (config.treasuryAccounts || []).map((treasuryAccount) => treasuryAccount.toBase58());
  const onChainTreasuryAccountDetails = await Promise.all(
    onChainTreasuryAccounts.map(async (treasuryAccountAddress) => {
      try {
        const tokenAccount = await getAccount(
          getConnection(),
          parsePublicKey(treasuryAccountAddress, 'treasuryAccountAddress'),
          env.SOLANA_COMMITMENT,
        );

        return {
          tokenAccountAddress: treasuryAccountAddress,
          ownerAddress: tokenAccount.owner.toBase58(),
          mintAddress: tokenAccount.mint.toBase58(),
        };
      } catch (error) {
        return {
          tokenAccountAddress: treasuryAccountAddress,
          ownerAddress: null,
          mintAddress: null,
          error: error instanceof Error ? error.message : 'Unable to inspect treasury token account',
        };
      }
    }),
  );

  status.onChain = {
    admin: onChainAdmin,
    checkers: onChainCheckers,
    treasuryAccounts: onChainTreasuryAccounts,
    treasuryAccountDetails: onChainTreasuryAccountDetails,
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

  if (!onChainTreasuryAccounts.length) {
    status.warnings.push(
      'No treasury token accounts are registered on chain. Treasury-restricted mint, transfer, and burn requests will fail until treasury token accounts are registered.',
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

async function addTreasuryAccount(treasuryAccountAddress) {
  const treasuryAccountPublicKey = parsePublicKey(treasuryAccountAddress, 'treasuryAccountAddress');
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();

  await adminProgram.methods
    .addTreasuryAccount(treasuryAccountPublicKey)
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

async function removeTreasuryAccount(treasuryAccountAddress) {
  const treasuryAccountPublicKey = parsePublicKey(treasuryAccountAddress, 'treasuryAccountAddress');
  const { adminKeypair, adminProgram, configAddress } = await requireAdminManagedConfig();

  await adminProgram.methods
    .removeTreasuryAccount(treasuryAccountPublicKey)
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

function resolveTreasuryOwnerKeypair(expectedTreasuryWalletAddress) {
  const expectedWallet = String(expectedTreasuryWalletAddress || '').trim();

  if (!expectedWallet) {
    throw new ApiError(500, 'Treasury wallet address is not configured for the selected treasury token account');
  }

  const candidates = [
    ['maker', getOptionalMakerKeypair()],
    ['treasury owner', getOptionalTreasuryOwnerKeypair()],
    ['admin', getAdminKeypair()],
    ['checker', getOptionalCheckerKeypair()],
  ].filter(([, keypair]) => Boolean(keypair));

  const match = candidates.find(([, keypair]) => keypair.publicKey.toBase58() === expectedWallet);
  if (match) {
    return {
      role: match[0],
      keypair: match[1],
    };
  }

  throw new ApiError(
    500,
    `No configured signer matches treasury wallet ${expectedWallet}. Set SOLANA_TREASURY_OWNER_KEYPAIR_PATH to that wallet's keypair.`,
  );
}

async function ensureTreasuryDelegation({
  sourceTokenAccount,
  tokenAuthority,
  treasuryOwnerKeypair,
  amount,
}) {
  const currentAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);
  const delegatedAmount = currentAccount.delegatedAmount || 0n;
  const hasValidDelegate =
    currentAccount.delegate
    && currentAccount.delegate.toBase58() === tokenAuthority.toBase58()
    && delegatedAmount >= amount;

  if (hasValidDelegate) {
    return {
      delegated: false,
      delegate: currentAccount.delegate.toBase58(),
      delegatedAmount: delegatedAmount.toString(),
    };
  }

  await approveSourceDelegation({
    sourceTokenAccount,
    tokenAuthority,
    makerKeypair: treasuryOwnerKeypair,
    payerKeypair: treasuryOwnerKeypair,
    amount,
  });

  const refreshedAccount = await getAccount(getConnection(), sourceTokenAccount, env.SOLANA_COMMITMENT);

  return {
    delegated: true,
    delegate: refreshedAccount.delegate?.toBase58() || null,
    delegatedAmount: refreshedAccount.delegatedAmount?.toString() || '0',
  };
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

function getMintSettlementExecutionContext(settlement, destinationWalletAddress, destinationTokenAccountAddress) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(settlement.tokenMintAddress, 'tokenMintAddress');

  return {
    integrationReady: true,
    executionBoundaryVersion: 1,
    executionMode: EXECUTION_MODES.BROWSER_WALLET,
    runtimeMode: 'browser-wallet',
    rpcUrl: env.SOLANA_RPC_URL,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    tokenMintAddress: mintAddress.toBase58(),
    amount: toRawAmount(settlement.amount),
    serverManagedCreateSupported: false,
    walletInitiation: {
      supported: true,
      recorded: Boolean(settlement.onChainRequestAddress && settlement.initiationTxSignature),
      expectedMakerWalletAddress: settlement.makerWalletAddress || null,
      makerWalletAddress: settlement.makerWalletAddress || null,
      onChainRequestAddress: settlement.onChainRequestAddress || null,
      initiationTxSignature: settlement.initiationTxSignature || null,
      initiationExplorerUrl: settlement.initiationExplorerUrl || null,
      makerInitiatedAt: settlement.makerInitiatedAt || null,
    },
    destinationWalletAddress,
    destinationTokenAccount: destinationTokenAccountAddress || null,
    destinationTokenAccountAddress: destinationTokenAccountAddress || null,
  };
}

function getTransferSettlementExecutionContext(
  settlement,
  sourceWalletAddress,
  sourceTokenAccountAddress,
  destinationWalletAddress,
  destinationTokenAccountAddress,
) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(settlement.tokenMintAddress, 'tokenMintAddress');

  return {
    integrationReady: true,
    executionBoundaryVersion: 1,
    executionMode: EXECUTION_MODES.BROWSER_WALLET,
    runtimeMode: 'browser-wallet',
    rpcUrl: env.SOLANA_RPC_URL,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    tokenMintAddress: mintAddress.toBase58(),
    amount: toRawAmount(settlement.amount),
    serverManagedCreateSupported: false,
    walletInitiation: {
      supported: true,
      recorded: Boolean(settlement.onChainRequestAddress && settlement.initiationTxSignature),
      expectedMakerWalletAddress: settlement.makerWalletAddress || sourceWalletAddress || null,
      makerWalletAddress: settlement.makerWalletAddress || null,
      onChainRequestAddress: settlement.onChainRequestAddress || null,
      initiationTxSignature: settlement.initiationTxSignature || null,
      initiationExplorerUrl: settlement.initiationExplorerUrl || null,
      makerInitiatedAt: settlement.makerInitiatedAt || null,
    },
    sourceWalletAddress,
    sourceTokenAccount: sourceTokenAccountAddress || null,
    sourceTokenAccountAddress: sourceTokenAccountAddress || null,
    destinationWalletAddress,
    destinationTokenAccount: destinationTokenAccountAddress || null,
    destinationTokenAccountAddress: destinationTokenAccountAddress || null,
  };
}

function getBurnSettlementExecutionContext(
  settlement,
  sourceWalletAddress,
  sourceTokenAccountAddress,
) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const mintAddress = parsePublicKey(settlement.tokenMintAddress, 'tokenMintAddress');

  return {
    integrationReady: true,
    executionBoundaryVersion: 1,
    executionMode: EXECUTION_MODES.BROWSER_WALLET,
    runtimeMode: 'browser-wallet',
    rpcUrl: env.SOLANA_RPC_URL,
    programId: getProgramId().toBase58(),
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    tokenMintAddress: mintAddress.toBase58(),
    amount: toRawAmount(settlement.amount),
    serverManagedCreateSupported: false,
    walletInitiation: {
      supported: true,
      recorded: Boolean(settlement.onChainRequestAddress && settlement.initiationTxSignature),
      expectedMakerWalletAddress: settlement.makerWalletAddress || sourceWalletAddress || null,
      makerWalletAddress: settlement.makerWalletAddress || null,
      onChainRequestAddress: settlement.onChainRequestAddress || null,
      initiationTxSignature: settlement.initiationTxSignature || null,
      initiationExplorerUrl: settlement.initiationExplorerUrl || null,
      makerInitiatedAt: settlement.makerInitiatedAt || null,
    },
    sourceWalletAddress,
    sourceTokenAccount: sourceTokenAccountAddress || null,
    sourceTokenAccountAddress: sourceTokenAccountAddress || null,
  };
}

async function prepareSettlementMintApprovalInstruction({
  onChainRequestAddress,
  tokenMintAddress,
  destinationTokenAccountAddress,
  checkerWalletAddress,
}) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const instructionProgram = getProgram(getAdminKeypair());
  const approvalInstruction = await instructionProgram.methods
    .approveRequest()
    .accounts({
      request: onChainRequestAddress,
      config: configAddress,
      mint: tokenMintAddress,
      sourceTokenAccount: null,
      destinationTokenAccount: destinationTokenAccountAddress,
      tokenAuthority,
      checker: checkerWalletAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return {
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    approvalInstruction: {
      programId: approvalInstruction.programId.toBase58(),
      keys: approvalInstruction.keys.map((meta) => ({
        pubkey: meta.pubkey.toBase58(),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      })),
      data: Buffer.from(approvalInstruction.data).toString('base64'),
    },
  };
}

async function prepareSettlementTransferApprovalInstruction({
  onChainRequestAddress,
  tokenMintAddress,
  sourceTokenAccountAddress,
  destinationTokenAccountAddress,
  checkerWalletAddress,
}) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const instructionProgram = getProgram(getAdminKeypair());
  const approvalInstruction = await instructionProgram.methods
    .approveRequest()
    .accounts({
      request: onChainRequestAddress,
      config: configAddress,
      mint: tokenMintAddress,
      sourceTokenAccount: sourceTokenAccountAddress,
      destinationTokenAccount: destinationTokenAccountAddress,
      tokenAuthority,
      checker: checkerWalletAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return {
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    approvalInstruction: {
      programId: approvalInstruction.programId.toBase58(),
      keys: approvalInstruction.keys.map((meta) => ({
        pubkey: meta.pubkey.toBase58(),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      })),
      data: Buffer.from(approvalInstruction.data).toString('base64'),
    },
  };
}

async function prepareSettlementBurnApprovalInstruction({
  onChainRequestAddress,
  tokenMintAddress,
  sourceTokenAccountAddress,
  checkerWalletAddress,
}) {
  const configAddress = requireConfigAddress();
  const tokenAuthority = getTokenAuthority(configAddress);
  const instructionProgram = getProgram(getAdminKeypair());
  const approvalInstruction = await instructionProgram.methods
    .approveRequest()
    .accounts({
      request: onChainRequestAddress,
      config: configAddress,
      mint: tokenMintAddress,
      sourceTokenAccount: sourceTokenAccountAddress,
      destinationTokenAccount: null,
      tokenAuthority,
      checker: checkerWalletAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return {
    configAddress: configAddress.toBase58(),
    tokenAuthority: tokenAuthority.toBase58(),
    approvalInstruction: {
      programId: approvalInstruction.programId.toBase58(),
      keys: approvalInstruction.keys.map((meta) => ({
        pubkey: meta.pubkey.toBase58(),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      })),
      data: Buffer.from(approvalInstruction.data).toString('base64'),
    },
  };
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

async function getTokenAccountBalance(tokenAccountAddress) {
  const tokenAccountPublicKey = parsePublicKey(tokenAccountAddress, 'tokenAccountAddress');
  const account = await getAccount(getConnection(), tokenAccountPublicKey, env.SOLANA_COMMITMENT);

  return {
    tokenAccountAddress: tokenAccountPublicKey.toBase58(),
    mintAddress: account.mint.toBase58(),
    ownerAddress: account.owner.toBase58(),
    rawAmount: account.amount.toString(),
  };
}

module.exports = {
  addChecker,
  addTreasuryAccount,
  autoProvisionIssuerTreasuryForMint,
  bootstrapOnChainConfig,
  createTokenMint,
  executeOnChainRequest,
  fetchTokenRequestAccount,
  getConfigStatus,
  getAdminKeypair,
  getMakerKeypair,
  getCheckerKeypair,
  getExecutionContext,
  getProgram,
  getTokenAuthorityAddress,
  getMetadataProgramId: () => METADATA_PROGRAM_ID,
  getProgramId,
  hydrateManagedToken,
  getCustomerSellDelegationStatus,
  getTokenAccountBalance,
  getWalletTokenBalances,
  buildExplorerUrl,
  resolveBankTokenAccountByPurpose,
  resolveBankTreasuryTokenAccount,
  resolveBankDistributionTokenAccount,
  mintToBankTreasury,
  transferFromCustomerWalletToWallet,
  transferFromCustomerWalletToDistribution,
  transferFromBankTreasuryToWallet,
  transferFromBankDistributionToWallet,
  ensureManagedTokenMetadata,
  validateRecordedOnChainRequest,
  verifyConfirmedTransaction,
  supportsBrowserWalletExecution,
  getMintSettlementExecutionContext,
  getTransferSettlementExecutionContext,
  getBurnSettlementExecutionContext,
  prepareSettlementMintApprovalInstruction,
  prepareSettlementTransferApprovalInstruction,
  prepareSettlementBurnApprovalInstruction,
  removeChecker,
  removeTreasuryAccount,
  setAdmin,
};
