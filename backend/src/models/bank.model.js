const bankAccountOrderBy = [
  { accountType: 'asc' },
  { isPrimary: 'desc' },
  { createdAt: 'asc' },
];

const bankTokenAccountOrderBy = [
  { isPrimary: 'desc' },
  { createdAt: 'asc' },
];

const reserveLedgerOrderBy = [
  { approvedAt: 'desc' },
  { createdAt: 'desc' },
];

const bankInclude = {
  accounts: {
    orderBy: bankAccountOrderBy,
  },
  tokenAccounts: {
    orderBy: bankTokenAccountOrderBy,
  },
  reserveLedgers: {
    orderBy: reserveLedgerOrderBy,
  },
};

module.exports = {
  bankInclude,
  bankAccountOrderBy,
  bankTokenAccountOrderBy,
  reserveLedgerOrderBy,
};
