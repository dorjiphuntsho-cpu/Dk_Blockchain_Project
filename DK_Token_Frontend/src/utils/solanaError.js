function collectErrorMessages(error) {
  const messages = [];

  if (error?.message) {
    messages.push(String(error.message));
  }

  if (error?.cause?.message) {
    messages.push(String(error.cause.message));
  }

  if (error?.reason) {
    messages.push(String(error.reason));
  }

  if (Array.isArray(error?.logs) && error.logs.length) {
    messages.push(`Logs: ${error.logs.join(' | ')}`);
  }

  if (Array.isArray(error?.transactionLogs) && error.transactionLogs.length) {
    messages.push(`Transaction logs: ${error.transactionLogs.join(' | ')}`);
  }

  return messages.filter(Boolean);
}

export async function getSolanaErrorMessage(error, fallbackMessage = 'Transaction failed') {
  const messages = collectErrorMessages(error);

  if (typeof error?.getLogs === 'function') {
    try {
      const logs = await error.getLogs();
      if (Array.isArray(logs) && logs.length) {
        messages.push(`RPC logs: ${logs.join(' | ')}`);
      }
    } catch {
      // Ignore log retrieval failures and fall back to the existing message chain.
    }
  }

  const uniqueMessages = [...new Set(messages)];
  return uniqueMessages.length ? uniqueMessages.join(' ') : fallbackMessage;
}

export function logSolanaError(error, context = 'Solana transaction failed') {
  // Keep the logging centralized so browser-side failures can be correlated in devtools.
  // The backend logs capture API-side failures separately.
  console.error(context, error);
}
