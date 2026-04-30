const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const settlementService = require('../src/services/settlement.service');

async function main() {
  const requestedLimit = process.argv[2] ? Number(process.argv[2]) : env.BIPS_RECONCILE_BATCH_LIMIT;
  const includeManualReviewArg = process.argv[3];
  const includeManualReview = includeManualReviewArg === undefined
    ? env.BIPS_RECONCILE_INCLUDE_MANUAL_REVIEW
    : String(includeManualReviewArg).trim().toLowerCase() === 'true';

  const result = await settlementService.reconcilePendingSettlements(
    {
      limit: requestedLimit,
      includeManualReview,
    },
    null,
  );

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
