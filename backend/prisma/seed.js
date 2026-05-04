require('dotenv').config();
const { applyDatabaseUrl } = require('../src/utils/databaseUrl');

applyDatabaseUrl(process.env);

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const roleNames = ['ADMIN', 'MAKER', 'CHECKER', 'EXECUTOR'];
const bankSeeds = [
  {
    name: 'DK Bank',
    code: '1060',
    binNumber: '667707',
    panNumber: '94009405',
    supportsBtn: true,
    supportsBipsSettlement: true,
    isIssuer: true,
    isActive: true,
    accounts: [
      {
        accountType: 'RESERVE',
        accountName: 'DK Bank Reserve Account',
        accountNumber: '100100364185',
        currency: 'BTN',
        isPrimary: true,
        isActive: true,
        remarks: 'Primary reserve account for fiat-backed BTN minting capacity.',
      },
      {
        accountType: 'OTHER',
        accountName: 'DK Customer Test Account 1',
        accountNumber: '100100223740',
        currency: 'BTN',
        isPrimary: false,
        isActive: true,
        remarks: 'DK Bank retail test account for BTN buy/sell/transfer flows.',
      },
      {
        accountType: 'OTHER',
        accountName: 'DK Customer Test Account 2',
        accountNumber: '110158212197',
        currency: 'BTN',
        isPrimary: false,
        isActive: true,
        remarks: 'DK Bank retail beneficiary account used in payment gateway UAT flows.',
      },
      {
        accountType: 'OTHER',
        accountName: 'DK Customer Test Account 3',
        accountNumber: '100100353884',
        currency: 'BTN',
        isPrimary: false,
        isActive: true,
        remarks: 'DK Bank retail test account for BTN buy/sell/transfer flows.',
      },
      {
        accountType: 'OTHER',
        accountName: 'DK Customer Test Account 4',
        accountNumber: '100100426695',
        currency: 'BTN',
        isPrimary: false,
        isActive: true,
        remarks: 'DK Bank retail test account for BTN buy/sell/transfer flows.',
      },
    ],
  },
  {
    name: 'Bank of Bhutan',
    code: '1010',
    binNumber: '502237',
    panNumber: '94009400',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  },
  {
    name: 'Bhutan National Bank',
    code: '1020',
    binNumber: '639545',
    panNumber: '94009401',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  },
  {
    name: 'Druk PNB Bank',
    code: '1030',
    binNumber: '502942',
    panNumber: '94009402',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  },
  {
    name: 'T-Bank',
    code: '1040',
    binNumber: '636243',
    panNumber: '94009403',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  },
  {
    name: 'Bhutan Development Bank Limited',
    code: '1050',
    binNumber: '637053',
    panNumber: '94009404',
    supportsBtn: false,
    supportsBipsSettlement: true,
    isIssuer: false,
    isActive: true,
  },
];

const userSeeds = [
  {
    fullName: 'Default Admin',
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123',
    roles: ['ADMIN'],
  },
  {
    fullName: 'Default Maker',
    email: process.env.DEFAULT_MAKER_EMAIL || 'maker@example.com',
    password: process.env.DEFAULT_MAKER_PASSWORD || 'Maker@123',
    roles: ['MAKER'],
  },
  {
    fullName: 'Default Checker',
    email: process.env.DEFAULT_CHECKER_EMAIL || 'checker@example.com',
    password: process.env.DEFAULT_CHECKER_PASSWORD || 'Checker@123',
    roles: ['CHECKER'],
  },
  {
    fullName: 'Default Executor',
    email: process.env.DEFAULT_EXECUTOR_EMAIL || 'executor@example.com',
    password: process.env.DEFAULT_EXECUTOR_PASSWORD || 'Executor@123',
    roles: ['EXECUTOR'],
  },
  {
    fullName: 'BTN Customer One',
    email: 'customer1@example.com',
    password: 'Customer@123',
    cid: '11101000001',
    customerType: 'RETAIL',
    linkedBankAccountNumber: '100100223740',
    mpin: '1234',
    roles: [],
    walletAddress: '7WNB8u1f2rbYEnxQwma6f8t9c1Kj4mVG4kNzk9sQ7R2p',
  },
  {
    fullName: 'BTN Customer Two',
    email: 'customer2@example.com',
    password: 'Customer@123',
    cid: '11101000002',
    customerType: 'RETAIL',
    linkedBankAccountNumber: '110158212197',
    mpin: '2345',
    roles: [],
    walletAddress: '9Ygpx7M4dTRx6XH4N5V6sM2uB4kQx8pLc3rJm1wZ7aKe',
  },
  {
    fullName: 'BTN Customer Three',
    email: 'customer3@example.com',
    password: 'Customer@123',
    cid: '11101000003',
    customerType: 'RETAIL',
    linkedBankAccountNumber: '100100353884',
    mpin: '3456',
    roles: [],
    walletAddress: '5kG7vYp3RjM8qT2nW4xZ6cL1dF9hQm2sB7uN3aX8eHpR',
  },
  {
    fullName: 'BTN Customer Four',
    email: 'customer4@example.com',
    password: 'Customer@123',
    cid: '11101000004',
    customerType: 'RETAIL',
    linkedBankAccountNumber: '100100426695',
    mpin: '4567',
    roles: [],
    walletAddress: '8Prs4Lx7VmQ2nK9cT5wY1hF6dJ3uBz8mN4qR7aXe2WpH',
  },
];

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const roles = await prisma.role.findMany();
  const roleMap = roles.reduce((acc, role) => {
    acc[role.name] = role.id;
    return acc;
  }, {});

  for (const userSeed of userSeeds) {
    const passwordHash = await bcrypt.hash(userSeed.password, saltRounds);
    const mpinHash = userSeed.mpin ? await bcrypt.hash(userSeed.mpin, saltRounds) : null;

    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: {
        fullName: userSeed.fullName,
        passwordHash,
        cid: userSeed.cid || null,
        customerType: userSeed.customerType || null,
        linkedBankAccountNumber: userSeed.linkedBankAccountNumber || null,
        mpinHash,
        isActive: true,
      },
      create: {
        fullName: userSeed.fullName,
        email: userSeed.email,
        passwordHash,
        cid: userSeed.cid || null,
        customerType: userSeed.customerType || null,
        linkedBankAccountNumber: userSeed.linkedBankAccountNumber || null,
        mpinHash,
        isActive: true,
      },
    });

    for (const roleName of userSeed.roles || []) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleMap[roleName],
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleMap[roleName],
        },
      });
    }

    if (userSeed.walletAddress) {
      await prisma.wallet.upsert({
        where: {
          walletAddress: userSeed.walletAddress,
        },
        update: {
          userId: user.id,
          label: `${userSeed.fullName} Wallet`,
          isPrimary: true,
          isActive: true,
        },
        create: {
          userId: user.id,
          walletAddress: userSeed.walletAddress,
          label: `${userSeed.fullName} Wallet`,
          isPrimary: true,
          isActive: true,
        },
      });
    }
  }

  for (const bankSeed of bankSeeds) {
    const bank = await prisma.bank.upsert({
      where: { code: bankSeed.code },
      update: {
        name: bankSeed.name,
        binNumber: bankSeed.binNumber,
        panNumber: bankSeed.panNumber,
        supportsBtn: bankSeed.supportsBtn,
        supportsBipsSettlement: bankSeed.supportsBipsSettlement,
        isIssuer: bankSeed.isIssuer,
        isActive: bankSeed.isActive,
      },
      create: {
        name: bankSeed.name,
        code: bankSeed.code,
        binNumber: bankSeed.binNumber,
        panNumber: bankSeed.panNumber,
        supportsBtn: bankSeed.supportsBtn,
        supportsBipsSettlement: bankSeed.supportsBipsSettlement,
        isIssuer: bankSeed.isIssuer,
        isActive: bankSeed.isActive,
      },
    });

    for (const accountSeed of bankSeed.accounts || []) {
      await prisma.bankAccount.upsert({
        where: {
          bankId_accountType_accountNumber: {
            bankId: bank.id,
            accountType: accountSeed.accountType,
            accountNumber: accountSeed.accountNumber,
          },
        },
        update: {
          accountName: accountSeed.accountName,
          currency: accountSeed.currency,
          isPrimary: accountSeed.isPrimary,
          isActive: accountSeed.isActive,
          remarks: accountSeed.remarks,
        },
        create: {
          bankId: bank.id,
          accountType: accountSeed.accountType,
          accountName: accountSeed.accountName,
          accountNumber: accountSeed.accountNumber,
          currency: accountSeed.currency,
          isPrimary: accountSeed.isPrimary,
          isActive: accountSeed.isActive,
          remarks: accountSeed.remarks,
        },
      });
    }
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
