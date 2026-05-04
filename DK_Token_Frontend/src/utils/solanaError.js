function normalizeMessageList(error) {
  return [
    error?.message,
    error?.cause?.message,
    error?.reason,
    ...(Array.isArray(error?.logs) ? error.logs : []),
    ...(Array.isArray(error?.transactionLogs) ? error.transactionLogs : []),
    ...(Array.isArray(error?.simulationLogs) ? error.simulationLogs : []),
    ...(Array.isArray(error?.programLogs) ? error.programLogs : []),
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

function pickFirstMatch(messages, patterns) {
  return messages.find((message) => patterns.some((pattern) => pattern.test(message))) || null;
}

export function parseSolanaError(error) {
  const messages = normalizeMessageList(error);
  const joined = messages.join(' | ');

  const knownParsers = [
    {
      code: 'BLOCKHASH_NOT_FOUND',
      patterns: [/BlockhashNotFound/i, /blockhash not found/i, /expired blockhash/i],
      message: 'The transaction blockhash expired before it was confirmed. Retry the transaction.',
    },
    {
      code: 'INSUFFICIENT_FUNDS',
      patterns: [/InsufficientFundsForRent/i, /insufficient funds/i, /insufficient lamports/i],
      message: 'The connected wallet does not have enough SOL to pay transaction fees or rent.',
    },
    {
      code: 'ACCOUNT_NOT_FOUND',
      patterns: [/AccountNotFound/i, /could not find account/i],
      message: 'A required Solana account does not exist on the selected cluster.',
    },
    {
      code: 'INVALID_ACCOUNT_DATA',
      patterns: [/InvalidAccountData/i, /invalid account data/i],
      message: 'One of the transaction accounts has invalid data for the requested program instruction.',
    },
    {
      code: 'SIGNATURE_VERIFICATION_FAILED',
      patterns: [/Signature verification failed/i, /SignatureVerificationFailed/i],
      message: 'A required signer is missing or the transaction signatures are invalid.',
    },
    {
      code: 'INVALID_INSTRUCTION',
      patterns: [/InstructionError/i, /invalid instruction/i],
      message: 'The transaction contains an invalid instruction or incorrect instruction accounts.',
    },
    {
      code: 'ANCHOR_ERROR',
      patterns: [/AnchorError/i, /custom program error/i],
      message: 'The on-chain program rejected the transaction. Check the program logs for the exact instruction failure.',
    },
    {
      code: 'WALLET_REJECTED',
      patterns: [/User rejected/i, /rejected the request/i, /declined/i],
      message: 'The wallet request was rejected before the transaction was signed.',
    },
    {
      code: 'RPC_CLUSTER_MISMATCH',
      patterns: [/cluster mismatch/i, /wrong cluster/i],
      message: 'The wallet or RPC connection is pointed at a different Solana cluster than the transaction expects.',
    },
  ];

  for (const parser of knownParsers) {
    const matchedMessage = pickFirstMatch(messages, parser.patterns);
    if (matchedMessage) {
      return {
        code: parser.code,
        message: parser.message,
        matchedMessage,
        details: joined,
      };
    }
  }

  return {
    code: 'UNKNOWN_SOLANA_ERROR',
    message: null,
    matchedMessage: null,
    details: joined,
  };
}

export async function getSolanaErrorMessage(error, fallbackMessage = 'Transaction failed') {
  const parsed = parseSolanaError(error);
  const messages = normalizeMessageList(error);

  if (typeof error?.getLogs === 'function') {
    try {
      const rpcLogs = await error.getLogs();
      if (Array.isArray(rpcLogs) && rpcLogs.length) {
        messages.push(`RPC logs: ${rpcLogs.join(' | ')}`);
      }
    } catch {
      // Ignore log retrieval failures.
    }
  }

  const summary = parsed.message || fallbackMessage;
  const detail = parsed.matchedMessage || messages[0] || '';
  return detail ? `${summary} ${detail}` : summary;
}

export function logSolanaError(error, context = 'Solana transaction failed', metadata = {}) {
  const parsed = parseSolanaError(error);

  console.error(context, {
    metadata,
    parsed,
    error,
  });
}
