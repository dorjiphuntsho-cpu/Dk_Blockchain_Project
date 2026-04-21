const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = require('./env');
const logger = require('../utils/logger');

function getPrismaBinaryPath() {
  const binaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  return path.join(process.cwd(), 'node_modules', '.bin', binaryName);
}

function hasGeneratedPrismaClient() {
  const prismaClientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'index.js');
  return fs.existsSync(prismaClientPath);
}

function runPrismaCommand(args) {
  return new Promise((resolve, reject) => {
    const prismaBinaryPath = getPrismaBinaryPath();
    const command = process.platform === 'win32' ? 'cmd.exe' : prismaBinaryPath;
    const commandArgs =
      process.platform === 'win32' ? ['/c', prismaBinaryPath, ...args] : args;

    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Prisma command failed: prisma ${args.join(' ')}`));
    });
  });
}

async function bootstrapApplication() {
  if (env.AUTO_GENERATE_PRISMA) {
    if (hasGeneratedPrismaClient()) {
      logger.info('Prisma client already present. Skipping generate.');
    } else {
      logger.info('Generating Prisma client...');
      await runPrismaCommand(['generate']);
    }
  }

  if (env.AUTO_SYNC_DB) {
    logger.info('Syncing database schema...');
    await runPrismaCommand(['db', 'push', '--skip-generate']);
  }

  const prisma = require('./prisma');
  await prisma.$connect();
  logger.info('Database connection established.');
}

module.exports = {
  bootstrapApplication,
};
