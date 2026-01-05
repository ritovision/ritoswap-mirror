// scripts/verify.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger/logger';
import { env } from '../env';

const logger = createLogger('verify');

// HARDHAT_NETWORK is set by Hardhat at runtime, not in .env
const network = process.env.HARDHAT_NETWORK || process.argv[2];
const contractName = process.argv[3] || 'OnePerWalletKeyToken';

// Validate that we have necessary API keys for verification
if (network === 'sepolia' || network === 'mainnet') {
  if (!env.ETHERSCAN_API_KEY) {
    logger.error(`Cannot verify on ${network}: ETHERSCAN_API_KEY is not set in .env`);
    logger.info('Please add your Etherscan API key to .env file');
    process.exit(1);
  }
  logger.info(`Using Etherscan API for verification on ${network}`);
} else if (network === 'local-blockchain') {
  // Local blockchain with Blockscout doesn't strictly require an API key
  // but we log what's being used for transparency
  logger.info(`Using Blockscout for verification on local blockchain`);
  logger.info(`Blockscout URL: ${env.BLOCKSCOUT_URL}`);
  logger.info(`API Key: ${env.LOCAL_BLOCKCHAIN_EXPLORER_API_KEY}`);
  
  // Note: Blockscout often works with 'none' or without API key for local instances
  // If your Blockscout instance requires a real API key, uncomment below:
  /*
  if (env.LOCAL_BLOCKCHAIN_EXPLORER_API_KEY === 'none') {
    logger.warn('Using default "none" API key for Blockscout - this may not work if your instance requires authentication');
  }
  */
}

const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, `../../ContractAddresses/${network}.json`), 'utf8')
);

const address = addresses[contractName]?.address;

if (!address) {
  logger.error(`Contract ${contractName} not found in ${network}.json`);
  process.exit(1);
}

const cmd = `npx hardhat verify --network ${network} ${address}`;

logger.info(`Verifying ${contractName} at ${address} on ${network}...`);

try {
  execSync(cmd, { stdio: 'inherit' });
  logger.info(`Successfully verified ${contractName} on ${network}`);
} catch (error: any) {
  if (error.message?.includes('already verified')) {
    logger.info('Contract already verified!');
  } else {
    logger.error(`Verification failed: ${error.message}`);
    throw error;
  }
}