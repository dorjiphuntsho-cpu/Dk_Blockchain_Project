const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const paymentsService = require('../src/services/payments.service');

async function main() {
  const requestedLimit = process.argv[2] ? Number(process.argv[2]) : env.PAYMENT_RECONCILE_BATCH_LIMIT;
  const includeTerminalFailuresArg = process.argv[3];
  const includeTerminalFailures = includeTerminalFailuresArg === undefined
    ? env.PAYMENT_RECONCILE_INCLUDE_TERMINAL_FAILURES
    : String(includeTerminalFailuresArg).trim().toLowerCase() === 'true';

  const result = await paymentsService.reconcilePendingPayments({
    limit: requestedLimit,
    includeTerminalFailures,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
