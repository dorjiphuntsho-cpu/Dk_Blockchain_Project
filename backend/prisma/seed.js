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

    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: {
        fullName: userSeed.fullName,
        passwordHash,
        isActive: true,
      },
      create: {
        fullName: userSeed.fullName,
        email: userSeed.email,
        passwordHash,
        isActive: true,
      },
    });

    for (const roleName of userSeed.roles) {
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
  }

  for (const bankSeed of bankSeeds) {
    await prisma.bank.upsert({
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
      create: bankSeed,
    });
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
