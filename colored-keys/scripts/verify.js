// scripts/verify.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger/logger');

const logger = createLogger('verify');

const network = process.argv[2] || 'sepolia';
const contractName = process.argv[3] || 'OnePerWalletKeyToken';

const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, `../../ContractAddresses/${network}.json`))
);

const address = addresses[contractName].address;
const cmd = `npx hardhat verify --network ${network} ${address}`;

logger.info(`Verifying ${contractName} at ${address}...`);
execSync(cmd, { stdio: 'inherit' });