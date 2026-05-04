import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { getSolanaErrorMessage, logSolanaError, parseSolanaError } from '../../utils/solanaError';
import { SOLANA_CLUSTER } from '../../utils/constants';

const TRANSFER_DISCRIMINATOR = Uint8Array.from([123, 124, 122, 222, 156, 180, 255, 72]);
const BURN_DISCRIMINATOR = Uint8Array.from([159, 137, 71, 117, 6, 143, 39, 225]);
const MINT_DISCRIMINATOR = Uint8Array.from([139, 221, 52, 253, 235, 174, 238, 135]);
const CREATE_TOKEN_MINT_DISCRIMINATOR = Uint8Array.from([35, 109, 237, 196, 54, 218, 33, 119]);
const APPROVE_REQUEST_DISCRIMINATOR = Uint8Array.from([89, 68, 167, 104, 93, 25, 178, 205]);
const REJECT_REQUEST_DISCRIMINATOR = Uint8Array.from([11, 232, 75, 149, 197, 137, 152, 208]);
const DEFAULT_COMMITMENT = 'finalized';
const MIN_FEE_BUFFER_LAMPORTS = 5000;
const SEND_RETRY_LIMIT = 2;
const RETRYABLE_RPC_PATTERNS = [
  /BlockhashNotFound/i,
  /Node is behind/i,
  /429/i,
  /timed out/i,
  /socket hang up/i,
  /fetch failed/i,
  /Too Many Requests/i,
];
const CLUSTER_GENESIS_HASHES = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'mainnet-beta',
  'EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'devnet',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': 'testnet',
};

function encodeU64(value) {
  let remaining = BigInt(value);
  const bytes = new Uint8Array(8);

  for (let index = 0; index < 8; index += 1) {
    bytes[index] = Number(remaining & 255n);
    remaining >>= 8n;
  }

  return bytes;
}

function concatBytes(...chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.length;
  });

  return combined;
}

function buildRequestInstructionData(operation, amount) {
  let discriminator;
  switch (operation) {
    case 'TRANSFER':
      discriminator = TRANSFER_DISCRIMINATOR;
      break;
    case 'BURN':
      discriminator = BURN_DISCRIMINATOR;
      break;
    case 'MINT':
      discriminator = MINT_DISCRIMINATOR;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  return concatBytes(discriminator, encodeU64(amount));
}

function encodeUtf8String(value) {
  const encoded = new TextEncoder().encode(value);
  const length = new Uint8Array(4);
  let remaining = encoded.length;

  for (let index = 0; index < 4; index += 1) {
    length[index] = remaining & 255;
    remaining >>= 8;
  }

  return concatBytes(length, encoded);
}

function buildCreateTokenMintInstructionPayload(decimals, name, symbol, uri) {
  return concatBytes(
    CREATE_TOKEN_MINT_DISCRIMINATOR,
    Uint8Array.from([decimals]),
    encodeUtf8String(name),
    encodeUtf8String(symbol),
    encodeUtf8String(uri),
  );
}

function findMetadataAddress(metadataProgramPublicKey, mintPublicKey) {
  const [metadataPublicKey] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      metadataProgramPublicKey.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    metadataProgramPublicKey,
  );

  return metadataPublicKey;
}

export function buildExplorerTransactionUrl(signature, rpcUrl) {
  const customUrl = encodeURIComponent(rpcUrl);
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${customUrl}`;
}

function requirePayloadField(payload, fieldName) {
  if (!payload?.[fieldName]) {
    throw new Error(`${fieldName} is required to build the wallet initiation transaction.`);
  }

  return payload[fieldName];
}

function decodeBase64ToUint8Array(value) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }

  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function deserializeTransactionInstruction(serializedInstruction) {
  if (!serializedInstruction?.programId || !Array.isArray(serializedInstruction.keys) || !serializedInstruction.data) {
    throw new Error('Serialized transaction instruction is missing required fields.');
  }

  return new TransactionInstruction({
    programId: new PublicKey(serializedInstruction.programId),
    keys: serializedInstruction.keys.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: Boolean(key.isSigner),
      isWritable: Boolean(key.isWritable),
    })),
    data: decodeBase64ToUint8Array(serializedInstruction.data),
  });
}

function buildTransactionDebugLog(metadata) {
  return {
    walletPublicKey: metadata.walletPublicKey || null,
    cluster: metadata.cluster || SOLANA_CLUSTER,
    rpcUrl: metadata.rpcUrl || null,
    walletName: metadata.walletName || null,
    blockhash: metadata.blockhash || null,
    lastValidBlockHeight: metadata.lastValidBlockHeight || null,
    feePayer: metadata.feePayer || null,
    requiredSigners: metadata.requiredSigners || [],
    presentSigners: metadata.presentSigners || [],
    instructionCount: metadata.instructionCount || 0,
    instructionAccounts: metadata.instructionAccounts || [],
    accountValidation: metadata.accountValidation || [],
    transactionSize: metadata.transactionSize || 0,
    transactionVersion: metadata.transactionVersion || 'legacy',
    providerCapabilities: metadata.providerCapabilities || {},
    simulationError: metadata.simulationError || null,
    simulationLogs: metadata.simulationLogs || [],
    programLogs: metadata.programLogs || [],
    signature: metadata.signature || null,
  };
}

function serializeSimulationError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    return JSON.stringify(error);
  }

  if (typeof error === 'object') {
    const entries = Object.entries(error);
    if (!entries.length) {
      return 'Unknown simulation error object';
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function isOpaqueSimulationError(error) {
  return serializeSimulationError(error) === 'Unknown simulation error object';
}

function hasSimulationLogs(simulation) {
  return Array.isArray(simulation?.logs) && simulation.logs.length > 0;
}

function isVersionedTransaction(transaction) {
  return transaction instanceof VersionedTransaction;
}

function getTransactionVersionLabel(transaction) {
  return isVersionedTransaction(transaction) ? 'versioned' : 'legacy';
}

function getTransactionInstructionCount(transaction) {
  if (isVersionedTransaction(transaction)) {
    return transaction.message.compiledInstructions?.length || 0;
  }

  return transaction.instructions?.length || 0;
}

function getLegacyInstructionAccounts(transaction) {
  return (transaction.instructions || []).map((instruction, index) => ({
    index,
    programId: instruction.programId?.toBase58?.() || String(instruction.programId || ''),
    keys: instruction.keys.map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    dataLength: instruction.data?.length || 0,
  }));
}

function getRequiredSignerList(transaction) {
  if (isVersionedTransaction(transaction)) {
    return [];
  }

  const signerSet = new Set();

  if (transaction.feePayer) {
    signerSet.add(transaction.feePayer.toBase58());
  }

  for (const instruction of transaction.instructions || []) {
    for (const key of instruction.keys) {
      if (key.isSigner) {
        signerSet.add(key.pubkey.toBase58());
      }
    }
  }

  return Array.from(signerSet);
}

function getPresentSignerList(transaction) {
  if (isVersionedTransaction(transaction)) {
    return [];
  }

  return (transaction.signatures || [])
    .filter((entry) => entry.publicKey)
    .map((entry) => ({
      publicKey: entry.publicKey.toBase58(),
      signed: Boolean(entry.signature),
    }));
}

function getTransactionSerializedSize(transaction) {
  try {
    if (isVersionedTransaction(transaction)) {
      return transaction.serialize().length;
    }

    return transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).length;
  } catch {
    return 0;
  }
}

function resolveCanonicalAssociatedTokenAccount({
  mintPublicKey,
  ownerPublicKey,
  configuredTokenAccountAddress = null,
  label,
}) {
  const derivedTokenAccountAddress = getAssociatedTokenAddressSync(
    mintPublicKey,
    ownerPublicKey,
  ).toBase58();

  if (!configuredTokenAccountAddress) {
    return {
      tokenAccountAddress: derivedTokenAccountAddress,
      derivedTokenAccountAddress,
      usedConfiguredAddress: false,
    };
  }

  if (configuredTokenAccountAddress !== derivedTokenAccountAddress) {
    console.warn(`solana.wallet_execution.${label}_ata_mismatch`, {
      configuredTokenAccountAddress,
      derivedTokenAccountAddress,
    });

    return {
      tokenAccountAddress: derivedTokenAccountAddress,
      derivedTokenAccountAddress,
      usedConfiguredAddress: false,
    };
  }

  return {
    tokenAccountAddress: configuredTokenAccountAddress,
    derivedTokenAccountAddress,
    usedConfiguredAddress: true,
  };
}

function resolveExpectedClusterFromRpc(rpcUrl) {
  const normalized = String(rpcUrl || '').toLowerCase();

  if (normalized.includes('127.0.0.1') || normalized.includes('localhost')) {
    return 'localnet';
  }

  if (normalized.includes('devnet')) {
    return 'devnet';
  }

  if (normalized.includes('testnet')) {
    return 'testnet';
  }

  if (normalized.includes('mainnet')) {
    return 'mainnet-beta';
  }

  return SOLANA_CLUSTER;
}

function isRetryableRpcError(error) {
  const messages = [
    error?.message,
    error?.cause?.message,
    ...(Array.isArray(error?.simulationLogs) ? error.simulationLogs : []),
  ]
    .filter(Boolean)
    .map((value) => String(value));

  return RETRYABLE_RPC_PATTERNS.some((pattern) => messages.some((message) => pattern.test(message)));
}

export function validateWalletConnection(provider, options = {}) {
  const walletPublicKey = provider?.publicKey?.toBase58?.() || null;

  if (!provider) {
    throw new Error('Wallet provider is not available.');
  }

  if (!walletPublicKey) {
    throw new Error('Wallet is connected without a public key. Reconnect the wallet and try again.');
  }

  if (options.expectedWalletAddress && options.expectedWalletAddress !== walletPublicKey) {
    throw new Error(`Connected wallet ${walletPublicKey} does not match the expected wallet ${options.expectedWalletAddress}.`);
  }

  if (typeof provider.signTransaction !== 'function' && typeof provider.signAndSendTransaction !== 'function') {
    throw new Error('Connected wallet does not support signTransaction or signAndSendTransaction.');
  }

  return {
    walletPublicKey,
    supportsSignTransaction: typeof provider.signTransaction === 'function',
    supportsSignAndSendTransaction: typeof provider.signAndSendTransaction === 'function',
  };
}

export async function validateCluster(connection, options = {}) {
  if (!connection) {
    throw new Error('RPC connection is not available.');
  }

  const genesisHash = await connection.getGenesisHash();
  const detectedCluster = CLUSTER_GENESIS_HASHES[genesisHash] || resolveExpectedClusterFromRpc(options.rpcUrl);
  const expectedCluster = options.expectedCluster || resolveExpectedClusterFromRpc(options.rpcUrl);

  if (expectedCluster !== 'custom' && expectedCluster !== detectedCluster) {
    throw new Error(`RPC cluster mismatch detected. Expected ${expectedCluster} but connected to ${detectedCluster}.`);
  }

  return {
    expectedCluster,
    detectedCluster,
    genesisHash,
  };
}

function addPriorityFeeInstruction(transaction, microLamports = 1000) {
  if (isVersionedTransaction(transaction)) {
    return transaction;
  }

  transaction.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
  );

  return transaction;
}

function validateTransactionShape(transaction) {
  if (!transaction) {
    throw new Error('Transaction was not built.');
  }

  if (!getTransactionInstructionCount(transaction)) {
    throw new Error('Transaction contains no instructions.');
  }

  if (!transaction.recentBlockhash) {
    throw new Error('Transaction is missing a recent blockhash.');
  }

  if (!transaction.feePayer && !isVersionedTransaction(transaction)) {
    throw new Error('Transaction is missing a fee payer.');
  }

  return true;
}

async function ensureSufficientSolBalance(connection, feePayerPublicKey) {
  const balance = await connection.getBalance(feePayerPublicKey, DEFAULT_COMMITMENT);

  if (balance <= MIN_FEE_BUFFER_LAMPORTS) {
    throw new Error('The connected wallet does not have enough SOL to pay transaction fees.');
  }

  return balance;
}

async function prepareTransactionForExecution({
  connection,
  transaction,
  walletPublicKey,
  partialSigners = [],
  priorityFeeMicroLamports = 1000,
}) {
  const latestBlockhash = await connection.getLatestBlockhash(DEFAULT_COMMITMENT);

  addPriorityFeeInstruction(transaction, priorityFeeMicroLamports);

  if (!isVersionedTransaction(transaction)) {
    transaction.feePayer = new PublicKey(walletPublicKey);
    transaction.recentBlockhash = latestBlockhash.blockhash;

    if (partialSigners.length) {
      transaction.partialSign(...partialSigners);
    }
  }

  validateTransactionShape(transaction);

  return latestBlockhash;
}

async function validateExecutionAccounts(connection, accountDefinitions = []) {
  const results = [];

  for (const definition of accountDefinitions) {
    if (!definition?.address) {
      continue;
    }

    const publicKey = new PublicKey(definition.address);
    const info = await connection.getAccountInfo(publicKey, DEFAULT_COMMITMENT);

    results.push({
      label: definition.label,
      address: definition.address,
      exists: Boolean(info),
      executable: Boolean(info?.executable),
      owner: info?.owner?.toBase58?.() || null,
    });

    if (definition.required && !info) {
      throw new Error(`${definition.label} does not exist on the selected cluster: ${definition.address}`);
    }

    if (definition.mustBeExecutable && !info?.executable) {
      throw new Error(`${definition.label} is not executable on the selected cluster: ${definition.address}`);
    }
  }

  return results;
}

export async function simulateTransaction(connection, transaction) {
  try {
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: 'processed',
    });

    return {
      error: simulation.value.err || null,
      logs: simulation.value.logs || [],
      unitsConsumed: simulation.value.unitsConsumed || null,
    };
  } catch (error) {
    return {
      error,
      logs: [],
      unitsConsumed: null,
    };
  }
}

async function signTransactionWithWallet(provider, transaction) {
  if (typeof provider.signTransaction === 'function') {
    return provider.signTransaction(transaction);
  }

  if (typeof provider.signAndSendTransaction === 'function') {
    throw new Error(
      'This wallet only exposes signAndSendTransaction. Switch to a Wallet Adapter compatible signer or enable signTransaction support to avoid cluster-dependent send failures.',
    );
  }

  throw new Error('Connected wallet does not support transaction signing.');
}

async function sendRawTransactionWithRetry(connection, signedTransaction, options = {}) {
  const maxRetries = options.maxRetries ?? SEND_RETRY_LIMIT;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await sendSignedTransaction(connection, signedTransaction);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isRetryableRpcError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function confirmTransactionWithStrategy(connection, signature, latestBlockhash) {
  const confirmation = await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature,
  }, DEFAULT_COMMITMENT);

  if (confirmation.value.err) {
    const confirmationError = new Error(`Transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
    confirmationError.transactionError = confirmation.value.err;
    throw confirmationError;
  }

  return confirmation;
}

function parseAndDisplayErrors(error, metadata = {}) {
  const parsed = parseSolanaError(error);
  const wrappedError = new Error(parsed.message || error?.message || 'Unexpected Solana transaction failure');
  wrappedError.cause = error;
  wrappedError.code = parsed.code;
  wrappedError.logs = error?.logs || [];
  wrappedError.transactionLogs = error?.transactionLogs || [];
  wrappedError.simulationLogs = error?.simulationLogs || [];
  wrappedError.programLogs = error?.programLogs || [];
  wrappedError.details = parsed.details;
  wrappedError.metadata = metadata;
  return wrappedError;
}

function wrapWalletTransactionError(error, fallbackMessage) {
  const wrappedError = new Error(fallbackMessage);
  wrappedError.cause = error;

  if (Array.isArray(error?.logs)) {
    wrappedError.logs = error.logs;
  }

  if (Array.isArray(error?.transactionLogs)) {
    wrappedError.transactionLogs = error.transactionLogs;
  }

  if (typeof error?.getLogs === 'function') {
    wrappedError.getLogs = (...args) => error.getLogs(...args);
  }

  if (Array.isArray(error?.simulationLogs)) {
    wrappedError.simulationLogs = error.simulationLogs;
  }

  if (Array.isArray(error?.programLogs)) {
    wrappedError.programLogs = error.programLogs;
  }

  if (error?.metadata) {
    wrappedError.metadata = error.metadata;
  }

  if (error?.code) {
    wrappedError.code = error.code;
  }

  return wrappedError;
}

function isAlreadyProcessedError(error) {
  const messages = [
    error?.message,
    error?.cause?.message,
    error?.reason,
    ...(Array.isArray(error?.logs) ? error.logs : []),
    ...(Array.isArray(error?.transactionLogs) ? error.transactionLogs : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return messages.some((value) => value.includes('already been processed'));
}

function getSignedTransactionSignature(transaction) {
  const signatureBytes = transaction?.signature;
  return signatureBytes?.length ? bs58.encode(signatureBytes) : null;
}

async function sendSignedTransaction(connection, signedTransaction) {
  try {
    return await connection.sendRawTransaction(signedTransaction.serialize());
  } catch (error) {
    if (!isAlreadyProcessedError(error)) {
      throw error;
    }

    const duplicateSignature = getSignedTransactionSignature(signedTransaction);
    if (!duplicateSignature) {
      throw error;
    }

    return duplicateSignature;
  }
}

export async function buildMakerInitiationTransaction({ executionPayload, makerWalletAddress }) {
  const operation = executionPayload?.operation;
  // Phase A: Now supports MINT, TRANSFER, and BURN
  if (!['TRANSFER', 'BURN', 'MINT'].includes(operation)) {
    throw new Error('Wallet initiation is currently supported only for MINT, TRANSFER, and BURN requests.');
  }

  const expectedMakerWalletAddress = executionPayload?.walletInitiation?.expectedMakerWalletAddress;
  if (expectedMakerWalletAddress && expectedMakerWalletAddress !== makerWalletAddress) {
    throw new Error(`Connected wallet must match the expected maker wallet ${expectedMakerWalletAddress}.`);
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const makerPublicKey = new PublicKey(makerWalletAddress);
  const configPublicKey = new PublicKey(requirePayloadField(executionPayload, 'configAddress'));
  const mintPublicKey = new PublicKey(requirePayloadField(executionPayload, 'tokenMintAddress'));
  const tokenAuthorityPublicKey = new PublicKey(requirePayloadField(executionPayload, 'tokenAuthority'));
  const requestKeypair = Keypair.generate();
  const transaction = new Transaction();
  const amount = BigInt(requirePayloadField(executionPayload, 'amount'));

  // For MINT requests, there's no source wallet - tokens go to destination
  let sourceTokenAccountAddress = null;
  let sourceTokenAccountPublicKey = null;
  let destinationTokenAccountAddress = null;
  let destinationTokenAccountPublicKey = null;

  if (operation === 'MINT') {
    // MINT: Create destination ATA if needed
    const destinationWalletAddress = requirePayloadField(executionPayload, 'destinationWalletAddress');
    const destinationWalletPublicKey = new PublicKey(destinationWalletAddress);
    const resolvedDestinationAta = resolveCanonicalAssociatedTokenAccount({
      mintPublicKey,
      ownerPublicKey: destinationWalletPublicKey,
      configuredTokenAccountAddress: executionPayload.destinationTokenAccount || null,
      label: 'destination',
    });
    destinationTokenAccountAddress = resolvedDestinationAta.tokenAccountAddress;
    destinationTokenAccountPublicKey = new PublicKey(destinationTokenAccountAddress);

    const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccountPublicKey, 'confirmed');
    if (!destinationAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          makerPublicKey,
          destinationTokenAccountPublicKey,
          destinationWalletPublicKey,
          mintPublicKey,
        ),
      );
    }
  } else {
    // TRANSFER or BURN: Requires source wallet
    const sourceWalletAddress = requirePayloadField(executionPayload, 'sourceWalletAddress');
    if (sourceWalletAddress !== makerWalletAddress) {
      throw new Error(`The connected wallet ${makerWalletAddress} does not own the source wallet ${sourceWalletAddress}.`);
    }

    const resolvedSourceAta = resolveCanonicalAssociatedTokenAccount({
      mintPublicKey,
      ownerPublicKey: makerPublicKey,
      configuredTokenAccountAddress: executionPayload.sourceTokenAccount || null,
      label: 'source',
    });
    sourceTokenAccountAddress = resolvedSourceAta.tokenAccountAddress;
    sourceTokenAccountPublicKey = new PublicKey(sourceTokenAccountAddress);

    transaction.add(
      createApproveInstruction(
        sourceTokenAccountPublicKey,
        tokenAuthorityPublicKey,
        makerPublicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    if (operation === 'TRANSFER') {
      const destinationWalletAddress = requirePayloadField(executionPayload, 'destinationWalletAddress');
      const destinationWalletPublicKey = new PublicKey(destinationWalletAddress);
      const resolvedDestinationAta = resolveCanonicalAssociatedTokenAccount({
        mintPublicKey,
        ownerPublicKey: destinationWalletPublicKey,
        configuredTokenAccountAddress: executionPayload.destinationTokenAccount || null,
        label: 'destination',
      });
      destinationTokenAccountAddress = resolvedDestinationAta.tokenAccountAddress;
      destinationTokenAccountPublicKey = new PublicKey(destinationTokenAccountAddress);

      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          makerPublicKey,
          destinationTokenAccountPublicKey,
          destinationWalletPublicKey,
          mintPublicKey,
        ),
      );
    }
  }

  // Build the request instruction based on operation type
  const instructionKeys = [
    { pubkey: requestKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: configPublicKey, isSigner: false, isWritable: false },
    { pubkey: mintPublicKey, isSigner: false, isWritable: false },
    // MINT has no source token account, only destination
    ...(operation !== 'MINT' ? [{ pubkey: sourceTokenAccountPublicKey, isSigner: false, isWritable: false }] : []),
    // TRANSFER and MINT have destination accounts
    ...(operation !== 'BURN' ? [{ pubkey: destinationTokenAccountPublicKey, isSigner: false, isWritable: false }] : []),
    { pubkey: makerPublicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  transaction.add(
    new TransactionInstruction({
      programId: new PublicKey(requirePayloadField(executionPayload, 'programId')),
      keys: instructionKeys,
      data: buildRequestInstructionData(operation, amount),
    }),
  );

  return {
    connection,
    destinationTokenAccountAddress,
    requestAddress: requestKeypair.publicKey.toBase58(),
    requestKeypair,
    sourceTokenAccountAddress,
    transaction,
  };
}

export async function buildAdminMintCreationTransaction({
  executionPayload,
  adminWalletAddress,
  decimals,
  name,
  symbol,
  metadataUri,
}) {
  const expectedAdminWalletAddress = executionPayload?.expectedAdminWalletAddress || null;
  if (expectedAdminWalletAddress && expectedAdminWalletAddress !== adminWalletAddress) {
    throw new Error(`Connected wallet must match the expected admin wallet ${expectedAdminWalletAddress}.`);
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const adminPublicKey = new PublicKey(adminWalletAddress);
  const configPublicKey = new PublicKey(requirePayloadField(executionPayload, 'configAddress'));
  const mintKeypair = Keypair.generate();
  const mintPublicKey = mintKeypair.publicKey;
  const tokenAuthorityPublicKey = new PublicKey(requirePayloadField(executionPayload, 'tokenAuthority'));
  const metadataProgramPublicKey = new PublicKey(requirePayloadField(executionPayload, 'metadataProgramId'));
  const metadataPublicKey = findMetadataAddress(metadataProgramPublicKey, mintPublicKey);
  const transaction = new Transaction();

  transaction.add(
    new TransactionInstruction({
      programId: new PublicKey(requirePayloadField(executionPayload, 'programId')),
      keys: [
        { pubkey: configPublicKey, isSigner: false, isWritable: false },
        { pubkey: mintPublicKey, isSigner: true, isWritable: true },
        { pubkey: tokenAuthorityPublicKey, isSigner: false, isWritable: false },
        { pubkey: metadataPublicKey, isSigner: false, isWritable: true },
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: metadataProgramPublicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: buildCreateTokenMintInstructionPayload(
        decimals,
        name,
        symbol,
        metadataUri,
      ),
    }),
  );

  return {
    connection,
    metadataAddress: metadataPublicKey.toBase58(),
    mintKeypair,
    mintAddress: mintPublicKey.toBase58(),
    transaction,
  };
}

export async function signAndSendMakerTransaction({ connection, provider, requestKeypair, transaction }) {
  try {
    const walletState = validateWalletConnection(provider);
    const clusterState = await validateCluster(connection, {
      rpcUrl: connection.rpcEndpoint,
      expectedCluster: resolveExpectedClusterFromRpc(connection.rpcEndpoint),
    });
    await ensureSufficientSolBalance(connection, provider.publicKey);
    const latestBlockhash = await prepareTransactionForExecution({
      connection,
      transaction,
      walletPublicKey: walletState.walletPublicKey,
      partialSigners: [requestKeypair],
    });
    const accountValidation = await validateExecutionAccounts(connection, [
      { label: 'Program ID', address: transaction.instructions?.[transaction.instructions.length - 1]?.programId?.toBase58?.(), required: true, mustBeExecutable: true },
      { label: 'System Program', address: SystemProgram.programId.toBase58(), required: true, mustBeExecutable: true },
      { label: 'Config Account', address: transaction.instructions?.[transaction.instructions.length - 1]?.keys?.[1]?.pubkey?.toBase58?.(), required: true },
      { label: 'Mint Account', address: transaction.instructions?.[transaction.instructions.length - 1]?.keys?.[2]?.pubkey?.toBase58?.(), required: true },
    ]);
    const simulation = await simulateTransaction(connection, transaction);

    const logMetadata = buildTransactionDebugLog({
      walletPublicKey: walletState.walletPublicKey,
      cluster: clusterState.detectedCluster,
      rpcUrl: connection.rpcEndpoint,
      walletName: provider?.isPhantom ? 'Phantom' : provider?.isBackpack ? 'Backpack' : provider?.isSolflare ? 'Solflare' : 'Injected Wallet',
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      feePayer: provider.publicKey?.toBase58?.() || null,
      requiredSigners: getRequiredSignerList(transaction),
      presentSigners: getPresentSignerList(transaction),
      instructionCount: getTransactionInstructionCount(transaction),
      instructionAccounts: getLegacyInstructionAccounts(transaction),
      accountValidation,
      transactionSize: getTransactionSerializedSize(transaction),
      transactionVersion: getTransactionVersionLabel(transaction),
      providerCapabilities: {
        signTransaction: typeof provider?.signTransaction === 'function',
        signAndSendTransaction: typeof provider?.signAndSendTransaction === 'function',
      },
      simulationError: serializeSimulationError(simulation.error),
      simulationLogs: simulation.logs,
      programLogs: simulation.logs,
    });

    console.info('solana.maker_transaction.prepared', logMetadata);

    if (simulation.error && !isOpaqueSimulationError(simulation.error)) {
      const simulationError = new Error(`Transaction simulation failed: ${serializeSimulationError(simulation.error)}`);
      simulationError.simulationLogs = simulation.logs;
      simulationError.programLogs = simulation.logs;
      throw parseAndDisplayErrors(simulationError, logMetadata);
    }

    const signedTransaction = await signTransactionWithWallet(provider, transaction);
    const signedSimulation = await simulateTransaction(connection, signedTransaction);

    if (signedSimulation.error) {
      const signedSimulationMetadata = buildTransactionDebugLog({
        ...logMetadata,
        simulationError: serializeSimulationError(signedSimulation.error),
        simulationLogs: signedSimulation.logs,
        programLogs: signedSimulation.logs,
      });
      console.info('solana.maker_transaction.signed_simulation', signedSimulationMetadata);

      if (isOpaqueSimulationError(signedSimulation.error) && !hasSimulationLogs(signedSimulation)) {
        console.warn('solana.maker_transaction.signed_simulation_opaque', signedSimulationMetadata);
      } else {
      const simulationError = new Error(`Transaction simulation failed: ${serializeSimulationError(signedSimulation.error)}`);
      simulationError.simulationLogs = signedSimulation.logs;
      simulationError.programLogs = signedSimulation.logs;
      throw parseAndDisplayErrors(simulationError, signedSimulationMetadata);
      }
    }

    const signature = await sendRawTransactionWithRetry(connection, signedTransaction);

    if (!signature) {
      throw new Error('Wallet signed the transaction but no transaction signature was returned.');
    }

    await confirmTransactionWithStrategy(connection, signature, latestBlockhash);
    console.info('solana.maker_transaction.confirmed', buildTransactionDebugLog({
      ...logMetadata,
      signature,
    }));
    return signature;
  } catch (error) {
    const message = await getSolanaErrorMessage(error, 'Maker wallet transaction failed');
    logSolanaError(error, 'Maker wallet transaction failed', {
      rpcUrl: connection?.rpcEndpoint || null,
      transactionVersion: getTransactionVersionLabel(transaction),
    });
    throw wrapWalletTransactionError(error, message);
  }
}

export async function buildCheckerApprovalTransaction({
  executionPayload,
  sourceWalletAddress: sourceWalletAddressOverride = null,
  destinationWalletAddress: destinationWalletAddressOverride = null,
  sourceTokenAccountAddress: sourceTokenAccountAddressOverride = null,
  destinationTokenAccountAddress: destinationTokenAccountAddressOverride = null,
}) {
  const onChainRequestAddress = executionPayload?.walletInitiation?.onChainRequestAddress || executionPayload?.onChainRequestAddress;
  if (!onChainRequestAddress) {
    throw new Error('An on-chain request address is required before checker wallet approval can run.');
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const transaction = new Transaction();
  const mintPublicKey = new PublicKey(requirePayloadField(executionPayload, 'tokenMintAddress'));
  const sourceWalletAddress = sourceWalletAddressOverride
    || executionPayload.sourceWalletAddress
    || executionPayload.walletInitiation?.sourceWalletAddress
    || null;
  const destinationWalletAddress = destinationWalletAddressOverride
    || executionPayload.destinationWalletAddress
    || executionPayload.walletInitiation?.destinationWalletAddress
    || null;
  const sourceTokenAccountAddress = sourceTokenAccountAddressOverride
    || executionPayload.sourceTokenAccountAddress
    || executionPayload.sourceTokenAccount
    || (sourceWalletAddress ? getAssociatedTokenAddressSync(mintPublicKey, new PublicKey(sourceWalletAddress)).toBase58() : null);
  const destinationTokenAccountAddress = destinationTokenAccountAddressOverride
    || executionPayload.destinationTokenAccountAddress
    || executionPayload.destinationTokenAccount
    || (destinationWalletAddress ? getAssociatedTokenAddressSync(mintPublicKey, new PublicKey(destinationWalletAddress)).toBase58() : null);
  if (executionPayload.approvalInstruction) {
    transaction.add(deserializeTransactionInstruction(executionPayload.approvalInstruction));
  } else {
    throw new Error('Checker approval instruction is missing from the backend payload.');
  }

  return {
    connection,
    transaction,
    destinationTokenAccountAddress,
    sourceTokenAccountAddress,
  };
}

export function buildMakerCancellationTransaction({ executionPayload, makerWalletAddress }) {
  const onChainRequestAddress = executionPayload?.walletInitiation?.onChainRequestAddress || executionPayload?.onChainRequestAddress;
  if (!onChainRequestAddress) {
    throw new Error('An on-chain request address is required before maker wallet cancellation can run.');
  }

  const expectedMakerWalletAddress = executionPayload?.expectedMakerWalletAddress
    || executionPayload?.walletInitiation?.expectedMakerWalletAddress
    || null;

  if (expectedMakerWalletAddress && expectedMakerWalletAddress !== makerWalletAddress) {
    throw new Error(`Connected wallet must match the expected maker wallet ${expectedMakerWalletAddress}.`);
  }

  if (!executionPayload?.cancelInstruction) {
    throw new Error('Maker cancellation instruction is missing from the backend payload.');
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const transaction = new Transaction();
  transaction.add(deserializeTransactionInstruction(executionPayload.cancelInstruction));

  return {
    connection,
    transaction,
  };
}

export function buildCheckerRejectionTransaction({ executionPayload, checkerWalletAddress }) {
  const onChainRequestAddress = executionPayload?.walletInitiation?.onChainRequestAddress || executionPayload?.onChainRequestAddress;
  if (!onChainRequestAddress) {
    throw new Error('An on-chain request address is required before checker wallet rejection can run.');
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const transaction = new Transaction();
  const programPublicKey = new PublicKey(requirePayloadField(executionPayload, 'programId'));
  const checkerPublicKey = new PublicKey(checkerWalletAddress);

  transaction.add(
    new TransactionInstruction({
      programId: programPublicKey,
      keys: [
        { pubkey: new PublicKey(onChainRequestAddress), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(requirePayloadField(executionPayload, 'configAddress')), isSigner: false, isWritable: false },
        { pubkey: checkerPublicKey, isSigner: true, isWritable: false },
      ],
      data: REJECT_REQUEST_DISCRIMINATOR,
    }),
  );

  return {
    connection,
    transaction,
  };
}

export async function signAndSendWalletTransaction({ connection, provider, transaction, partialSigners = [] }) {
  try {
    const walletState = validateWalletConnection(provider);
    const clusterState = await validateCluster(connection, {
      rpcUrl: connection.rpcEndpoint,
      expectedCluster: resolveExpectedClusterFromRpc(connection.rpcEndpoint),
    });
    await ensureSufficientSolBalance(connection, provider.publicKey);
    const latestBlockhash = await prepareTransactionForExecution({
      connection,
      transaction,
      walletPublicKey: walletState.walletPublicKey,
      partialSigners,
    });
    const accountValidation = await validateExecutionAccounts(connection, [
      { label: 'Program ID', address: transaction.instructions?.[transaction.instructions.length - 1]?.programId?.toBase58?.(), required: true, mustBeExecutable: true },
      { label: 'System Program', address: SystemProgram.programId.toBase58(), required: true, mustBeExecutable: true },
    ]);
    const simulation = await simulateTransaction(connection, transaction);
    const logMetadata = buildTransactionDebugLog({
      walletPublicKey: walletState.walletPublicKey,
      cluster: clusterState.detectedCluster,
      rpcUrl: connection.rpcEndpoint,
      walletName: provider?.isPhantom ? 'Phantom' : provider?.isBackpack ? 'Backpack' : provider?.isSolflare ? 'Solflare' : 'Injected Wallet',
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      feePayer: provider.publicKey?.toBase58?.() || null,
      requiredSigners: getRequiredSignerList(transaction),
      presentSigners: getPresentSignerList(transaction),
      instructionCount: getTransactionInstructionCount(transaction),
      instructionAccounts: getLegacyInstructionAccounts(transaction),
      accountValidation,
      transactionSize: getTransactionSerializedSize(transaction),
      transactionVersion: getTransactionVersionLabel(transaction),
      providerCapabilities: {
        signTransaction: typeof provider?.signTransaction === 'function',
        signAndSendTransaction: typeof provider?.signAndSendTransaction === 'function',
      },
      simulationError: serializeSimulationError(simulation.error),
      simulationLogs: simulation.logs,
      programLogs: simulation.logs,
    });

    console.info('solana.wallet_transaction.prepared', logMetadata);

    if (simulation.error && !isOpaqueSimulationError(simulation.error)) {
      const simulationError = new Error(`Transaction simulation failed: ${serializeSimulationError(simulation.error)}`);
      simulationError.simulationLogs = simulation.logs;
      simulationError.programLogs = simulation.logs;
      throw parseAndDisplayErrors(simulationError, logMetadata);
    }

    const signedTransaction = await signTransactionWithWallet(provider, transaction);
    const signedSimulation = await simulateTransaction(connection, signedTransaction);

    if (signedSimulation.error) {
      const signedSimulationMetadata = buildTransactionDebugLog({
        ...logMetadata,
        simulationError: serializeSimulationError(signedSimulation.error),
        simulationLogs: signedSimulation.logs,
        programLogs: signedSimulation.logs,
      });
      console.info('solana.wallet_transaction.signed_simulation', signedSimulationMetadata);

      if (isOpaqueSimulationError(signedSimulation.error) && !hasSimulationLogs(signedSimulation)) {
        console.warn('solana.wallet_transaction.signed_simulation_opaque', signedSimulationMetadata);
      } else {
        const simulationError = new Error(`Transaction simulation failed: ${serializeSimulationError(signedSimulation.error)}`);
        simulationError.simulationLogs = signedSimulation.logs;
        simulationError.programLogs = signedSimulation.logs;
        throw parseAndDisplayErrors(simulationError, signedSimulationMetadata);
      }
    }

    const signature = await sendRawTransactionWithRetry(connection, signedTransaction);

    if (!signature) {
      throw new Error('Wallet signed the transaction but no transaction signature was returned.');
    }

    await confirmTransactionWithStrategy(connection, signature, latestBlockhash);
    console.info('solana.wallet_transaction.confirmed', buildTransactionDebugLog({
      ...logMetadata,
      signature,
    }));
    return signature;
  } catch (error) {
    const message = await getSolanaErrorMessage(error, 'Wallet transaction failed');
    logSolanaError(error, 'Wallet transaction failed', {
      rpcUrl: connection?.rpcEndpoint || null,
      transactionVersion: getTransactionVersionLabel(transaction),
    });
    throw wrapWalletTransactionError(error, message);
  }
}
