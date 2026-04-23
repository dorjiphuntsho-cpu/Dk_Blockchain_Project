import { Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const TRANSFER_DISCRIMINATOR = Uint8Array.from([123, 124, 122, 222, 156, 180, 255, 72]);
const BURN_DISCRIMINATOR = Uint8Array.from([159, 137, 71, 117, 6, 143, 39, 225]);
const MINT_DISCRIMINATOR = Uint8Array.from([77, 73, 78, 84, 65, 67, 75, 69]); // MINTACKE
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
        createAssociatedTokenAccountInstruction(
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

      const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccountPublicKey, 'confirmed');
      if (!destinationAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            makerPublicKey,
            destinationTokenAccountPublicKey,
            destinationWalletPublicKey,
            mintPublicKey,
          ),
        );
      }
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
    signature = await connection.sendRawTransaction(signedTransaction.serialize());
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
}

export function buildCheckerApprovalTransaction({ executionPayload, checkerWalletAddress }) {
  const onChainRequestAddress = executionPayload?.walletInitiation?.onChainRequestAddress || executionPayload?.onChainRequestAddress;
  if (!onChainRequestAddress) {
    throw new Error('An on-chain request address is required before checker wallet approval can run.');
  }

  const connection = new Connection(requirePayloadField(executionPayload, 'rpcUrl'), 'confirmed');
  const transaction = new Transaction();
  const programPublicKey = new PublicKey(requirePayloadField(executionPayload, 'programId'));
  const checkerPublicKey = new PublicKey(checkerWalletAddress);
  const sourceTokenAccountPublicKey = executionPayload.sourceTokenAccount
    ? new PublicKey(executionPayload.sourceTokenAccount)
    : programPublicKey;
  const destinationTokenAccountPublicKey = executionPayload.destinationTokenAccount
    ? new PublicKey(executionPayload.destinationTokenAccount)
    : programPublicKey;

  transaction.add(
    new TransactionInstruction({
      programId: programPublicKey,
      keys: [
        { pubkey: new PublicKey(onChainRequestAddress), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(requirePayloadField(executionPayload, 'configAddress')), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(requirePayloadField(executionPayload, 'tokenMintAddress')), isSigner: false, isWritable: true },
        { pubkey: sourceTokenAccountPublicKey, isSigner: false, isWritable: sourceTokenAccountPublicKey.equals(programPublicKey) ? false : true },
        { pubkey: destinationTokenAccountPublicKey, isSigner: false, isWritable: destinationTokenAccountPublicKey.equals(programPublicKey) ? false : true },
        { pubkey: new PublicKey(requirePayloadField(executionPayload, 'tokenAuthority')), isSigner: false, isWritable: false },
        { pubkey: checkerPublicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: APPROVE_REQUEST_DISCRIMINATOR,
    }),
  );

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
  if (!provider) {
    throw new Error('Wallet provider is not available.');
  }

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
    signature = await connection.sendRawTransaction(signedTransaction.serialize());
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
}
