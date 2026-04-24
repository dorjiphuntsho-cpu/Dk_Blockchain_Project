import { Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getSolanaErrorMessage, logSolanaError } from '../../utils/solanaError';

const TRANSFER_DISCRIMINATOR = Uint8Array.from([123, 124, 122, 222, 156, 180, 255, 72]);
const BURN_DISCRIMINATOR = Uint8Array.from([159, 137, 71, 117, 6, 143, 39, 225]);
const MINT_DISCRIMINATOR = Uint8Array.from([139, 221, 52, 253, 235, 174, 238, 135]);
const CREATE_TOKEN_MINT_DISCRIMINATOR = Uint8Array.from([35, 109, 237, 196, 54, 218, 33, 119]);
const APPROVE_REQUEST_DISCRIMINATOR = Uint8Array.from([89, 68, 167, 104, 93, 25, 178, 205]);
const REJECT_REQUEST_DISCRIMINATOR = Uint8Array.from([11, 232, 75, 149, 197, 137, 152, 208]);

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

function buildCreateTokenMintInstructionData(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('Decimals must be an integer between 0 and 9.');
  }

  return concatBytes(CREATE_TOKEN_MINT_DISCRIMINATOR, Uint8Array.from([decimals]));
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

function buildSimulationErrorMessage(simulation, fallbackMessage) {
  const messages = [];

  if (simulation?.value?.err) {
    messages.push(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  if (Array.isArray(simulation?.value?.logs) && simulation.value.logs.length) {
    messages.push(`Logs: ${simulation.value.logs.join(' | ')}`);
  }

  return messages.length ? messages.join(' ') : fallbackMessage;
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
    destinationTokenAccountAddress = executionPayload.destinationTokenAccount
      || getAssociatedTokenAddressSync(mintPublicKey, destinationWalletPublicKey).toBase58();
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

    sourceTokenAccountAddress = executionPayload.sourceTokenAccount
      || getAssociatedTokenAddressSync(mintPublicKey, makerPublicKey).toBase58();
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
      destinationTokenAccountAddress = executionPayload.destinationTokenAccount
        || getAssociatedTokenAddressSync(mintPublicKey, destinationWalletPublicKey).toBase58();
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

export async function buildAdminMintCreationTransaction({ executionPayload, adminWalletAddress, decimals }) {
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
  const transaction = new Transaction();

  transaction.add(
    new TransactionInstruction({
      programId: new PublicKey(requirePayloadField(executionPayload, 'programId')),
      keys: [
        { pubkey: configPublicKey, isSigner: false, isWritable: false },
        { pubkey: mintPublicKey, isSigner: true, isWritable: true },
        { pubkey: tokenAuthorityPublicKey, isSigner: false, isWritable: false },
        { pubkey: adminPublicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: buildCreateTokenMintInstructionData(decimals),
    }),
  );

  return {
    connection,
    mintKeypair,
    mintAddress: mintPublicKey.toBase58(),
    transaction,
  };
}

export async function signAndSendMakerTransaction({ connection, provider, requestKeypair, transaction }) {
  if (!provider) {
    throw new Error('Wallet provider is not available.');
  }

  try {
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.feePayer = provider.publicKey;
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.partialSign(requestKeypair);

    let signature;
    if (typeof provider.signAndSendTransaction === 'function') {
      const response = await provider.signAndSendTransaction(transaction);
      signature = response?.signature;
    } else if (typeof provider.signTransaction === 'function') {
      const signedTransaction = await provider.signTransaction(transaction);
      signature = await sendSignedTransaction(connection, signedTransaction);
    } else {
      throw new Error('Connected wallet does not support transaction signing.');
    }

    if (!signature) {
      throw new Error('Wallet did not return a transaction signature.');
    }

    const confirmation = await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    const message = await getSolanaErrorMessage(error, 'Maker wallet transaction failed');
    logSolanaError(error, 'Maker wallet transaction failed');
    throw wrapWalletTransactionError(error, message);
  }
}

export async function buildCheckerApprovalTransaction({
  executionPayload,
  checkerWalletAddress,
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
  const checkerPublicKey = new PublicKey(checkerWalletAddress);
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
  const sourceTokenAccountPublicKey = sourceTokenAccountAddress
    ? new PublicKey(sourceTokenAccountAddress)
    : null;
  const destinationTokenAccountPublicKey = destinationTokenAccountAddress
    ? new PublicKey(destinationTokenAccountAddress)
    : null;

  const derivedDestinationAta = destinationWalletAddress
    ? getAssociatedTokenAddressSync(mintPublicKey, new PublicKey(destinationWalletAddress))
    : null;

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
  if (!provider) {
    throw new Error('Wallet provider is not available.');
  }

  try {
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.feePayer = provider.publicKey;
    transaction.recentBlockhash = latestBlockhash.blockhash;

    if (partialSigners.length) {
      transaction.partialSign(...partialSigners);
    }

    let signature;
    if (typeof provider.signAndSendTransaction === 'function') {
      const response = await provider.signAndSendTransaction(transaction);
      signature = response?.signature;
    } else if (typeof provider.signTransaction === 'function') {
      const signedTransaction = await provider.signTransaction(transaction);
      signature = await sendSignedTransaction(connection, signedTransaction);
    } else {
      throw new Error('Connected wallet does not support transaction signing.');
    }

    if (!signature) {
      throw new Error('Wallet did not return a transaction signature.');
    }

    const confirmation = await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    const message = await getSolanaErrorMessage(error, 'Wallet transaction failed');
    logSolanaError(error, 'Wallet transaction failed');
    throw wrapWalletTransactionError(error, message);
  }
}
