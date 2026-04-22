const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = require('./env');
const logger = require('../utils/logger');
const solanaService = require('../services/solana.service');

function getPrismaBinaryPath() {
  const binaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  return path.join(process.cwd(), 'node_modules', '.bin', binaryName);
}

function getPrismaClientPath() {
  return path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'index.js');
}

function hasGeneratedPrismaClient() {
  return fs.existsSync(getPrismaClientPath());
}

function shouldRegeneratePrismaClient() {
  if (!hasGeneratedPrismaClient()) {
    return true;
  }

  const prismaClientPath = getPrismaClientPath();
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    return false;
  }

  const clientStat = fs.statSync(prismaClientPath);
  const schemaStat = fs.statSync(schemaPath);

  return schemaStat.mtimeMs > clientStat.mtimeMs;
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
    if (shouldRegeneratePrismaClient()) {
      logger.info('Generating Prisma client...');
      await runPrismaCommand(['generate']);
    } else {
      logger.info('Prisma client already up to date. Skipping generate.');
    }
  }

  if (env.AUTO_SYNC_DB) {
    logger.info('Syncing database schema...');
    await runPrismaCommand(['db', 'push', '--skip-generate']);
  }

  const prisma = require('./prisma');
  await prisma.$connect();
  logger.info('Database connection established.');

  if (env.SOLANA_AUTO_BOOTSTRAP) {
    const solanaBootstrap = await solanaService.bootstrapOnChainConfig();
    logger.info(
      `Solana config loaded at ${solanaBootstrap.configAddress}. On-chain admin: ${solanaBootstrap.onChain?.admin || 'not initialized'}.`,
    );

    if (solanaBootstrap.warnings?.length) {
      solanaBootstrap.warnings.forEach((warning) => logger.warn(warning));
    }
  }
}

module.exports = {
  bootstrapApplication,
};
