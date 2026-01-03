import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Wallet } from 'ethers';
import { keysDir, loadEnv, to0x } from './utils';

function readPrivateKey(): string | null {
  loadEnv();
  if (process.env.VALIDATOR_PRIVATE_KEY) {
    return process.env.VALIDATOR_PRIVATE_KEY;
  }

  const keyPath = path.join(keysDir, 'validator.key');
  if (fs.existsSync(keyPath)) {
    return to0x(fs.readFileSync(keyPath, 'utf8').trim());
  }

  return null;
}

async function revealAddress() {
  console.clear();

  const pk = readPrivateKey();
  if (!pk) {
    console.log(chalk.red('Validator private key not found. Run npm run setup first.'));
    return;
  }

  const wallet = new Wallet(pk);
  console.log(chalk.green('\n✓ Validator information:\n'));
  console.log(chalk.cyan('Address:    '), chalk.white(wallet.address));
  console.log(chalk.cyan('Public Key: '), chalk.white(wallet.signingKey.publicKey));
  console.log();
}

revealAddress().catch((err) => {
  console.error(chalk.red('Reveal failed:'), err);
  process.exit(1);
});
