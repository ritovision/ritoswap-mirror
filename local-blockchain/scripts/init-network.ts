import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Wallet } from 'ethers';
import {
  configDir,
  dataDir,
  ensureBaseDirs,
  ensureEnvFile,
  envPath,
  keysDir,
  loadEnv,
  ritoswapRoot,
  strip0x,
  to0x
} from './utils';
import { generateGenesis } from './generate-genesis';

const validatorKeyPath = path.join(keysDir, 'validator.key');

function updateEnvValue(key: string, value: string) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    next.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, next.join('\n'));
}

function ensureValidatorKey() {
  const hasKeyFile = fs.existsSync(validatorKeyPath);
  loadEnv();
  let pk = process.env.VALIDATOR_PRIVATE_KEY;

  if (!hasKeyFile && !pk) {
    console.log(chalk.gray('Generating validator key...'));
    const wallet = Wallet.createRandom();
    pk = wallet.privateKey;
    fs.writeFileSync(validatorKeyPath, strip0x(pk), { mode: 0o600 });
    updateEnvValue('VALIDATOR_PRIVATE_KEY', pk);
    updateEnvValue('VALIDATOR_ADDRESS', wallet.address);
    process.env.VALIDATOR_PRIVATE_KEY = pk;
    process.env.VALIDATOR_ADDRESS = wallet.address;
    console.log(chalk.green(`✓ Created validator ${wallet.address}`));
  }

  if (!hasKeyFile && pk) {
    fs.writeFileSync(validatorKeyPath, strip0x(pk), { mode: 0o600 });
    process.env.VALIDATOR_PRIVATE_KEY = pk;
    console.log(chalk.green('✓ Wrote validator key from .env to config/keys/validator.key'));
  }

  if (hasKeyFile && !pk) {
    const fileKey = fs.readFileSync(validatorKeyPath, 'utf8').trim();
    const wallet = new Wallet(to0x(fileKey));
    updateEnvValue('VALIDATOR_PRIVATE_KEY', wallet.privateKey);
    updateEnvValue('VALIDATOR_ADDRESS', wallet.address);
    process.env.VALIDATOR_PRIVATE_KEY = wallet.privateKey;
    process.env.VALIDATOR_ADDRESS = wallet.address;
    console.log(chalk.green(`✓ Synced validator from key file: ${wallet.address}`));
  }
}

function cloneBlockscoutIfMissing() {
  const blockscoutDir = path.join(ritoswapRoot, 'blockscout');
  if (fs.existsSync(blockscoutDir)) {
    console.log(chalk.gray('Blockscout repo already present.'));
    return;
  }

  const tag = process.env.BLOCKSCOUT_TAG || 'v9.2.2';
  console.log(chalk.gray(`Cloning Blockscout (${tag})...`));
  execSync(
    `git clone --branch ${tag} --depth 1 https://github.com/blockscout/blockscout.git blockscout`,
    { cwd: ritoswapRoot, stdio: 'inherit' }
  );
}

function initGenesis() {
  const besuDataDir = path.join(dataDir, 'besu');
  fs.ensureDirSync(besuDataDir);
}

async function init() {
  console.log(chalk.blue('🚀 Setting up the RitoSwap Besu network...'));
  ensureEnvFile();
  loadEnv();
  ensureBaseDirs();
  ensureValidatorKey();
  loadEnv();

  generateGenesis();
  initGenesis();
  cloneBlockscoutIfMissing();

  const blockscoutPort = process.env.BLOCKSCOUT_PORT || '4001';
  const publicHost = process.env.BLOCKSCOUT_PUBLIC_HOST || 'localhost';
  console.log(
    chalk.gray(
      `Blockscout will be available on http://${publicHost}:${blockscoutPort} (proxy ${blockscoutPort}:80).`
    )
  );

  console.log(chalk.green('\n✅ RitoSwap local network setup complete.'));
  console.log(chalk.cyan('\nNext steps:'));
  console.log(chalk.white('  npm run start:node      # start Besu only'));
  console.log(chalk.white('  npm run start           # start Besu + Blockscout'));
  console.log(chalk.white('  npm run logs            # tail stack logs'));
}

init().catch((err) => {
  console.error(chalk.red('Setup failed:'), err);
  process.exit(1);
});
