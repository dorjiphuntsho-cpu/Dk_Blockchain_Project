const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = require('./env');
const logger = require('../utils/logger');
const solanaService = require('../services/solana.service');

const prisma = require('./prisma');

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

function isWindowsPrismaEngineLockError(error) {
  const message = String(error?.message || '');

  return process.platform === 'win32'
    && message.includes('EPERM: operation not permitted, rename')
    && message.includes('node_modules')
    && message.includes('.prisma')
    && message.includes('query_engine');
}

async function bootstrapApplication() {
  if (env.AUTO_GENERATE_PRISMA) {
    if (shouldRegeneratePrismaClient()) {
      logger.info('Generating Prisma client...');
      try {
        await runPrismaCommand(['generate']);
      } catch (error) {
        if (hasGeneratedPrismaClient() && isWindowsPrismaEngineLockError(error)) {
          logger.warn(
            'Prisma client regeneration was skipped because the Windows query engine DLL is locked by another process. Reusing the existing generated client for this startup.',
          );
        } else {
          throw error;
        }
      }
    } else {
      logger.info('Prisma client already up to date. Skipping generate.');
    }
  }

  if (env.AUTO_SYNC_DB) {
    logger.info('Syncing database schema...');
    await runPrismaCommand(['db', 'push', '--skip-generate']);
  }

  await prisma.$connect();
  logger.info('Database connection established.');

  if (env.SOLANA_BOOTSTRAP_MODE !== 'disabled') {
    try {
      const solanaBootstrap = await solanaService.bootstrapOnChainConfig();
      logger.info(
        `Solana config loaded at ${solanaBootstrap.configAddress}. On-chain admin: ${solanaBootstrap.onChain?.admin || 'not initialized'}.`,
      );

      if (solanaBootstrap.warnings?.length) {
        solanaBootstrap.warnings.forEach((warning) => logger.warn(warning));
      }
    } catch (error) {
      if (env.SOLANA_BOOTSTRAP_MODE === 'warn') {
        logger.warn(`Solana bootstrap warning: ${error.message}`);
      } else {
        throw error;
      }
    }
  }
}

module.exports = {
  bootstrapApplication,
};
