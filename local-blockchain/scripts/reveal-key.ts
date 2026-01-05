import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { Wallet } from 'ethers';
import { keysDir, loadEnv, to0x } from './utils';

const clearScreen = '\x1Bc';
const cursorHide = '\x1B[?25l';
const cursorShow = '\x1B[?25h';
const clearLine = '\x1B[2K';

let isExiting = false;

function readPrivateKey(): string | null {
  loadEnv();
  if (process.env.VALIDATOR_PRIVATE_KEY) {
    return process.env.VALIDATOR_PRIVATE_KEY;
  }

  const keyPath = path.join(keysDir, 'validator.key');
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    return to0x(raw);
  }

  return null;
}

async function revealKey() {
  console.clear();

  console.log(chalk.red.bold('\n⚠️  SECURITY WARNING ⚠️'));
  console.log(chalk.red('━'.repeat(50)));
  console.log(chalk.yellow('You are about to reveal your validator PRIVATE KEY.'));
  console.log(chalk.yellow('Anyone with this key can control the prefunded validator account.'));
  console.log(chalk.red('━'.repeat(50)));

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: chalk.cyan('Do you understand the risks and want to continue?'),
    initial: false
  });

  if (!confirm) {
    console.log(clearScreen);
    console.log(chalk.yellow('\n✓ Key reveal cancelled.'));
    return;
  }

  const pk = readPrivateKey();
  if (!pk) {
    console.log(chalk.red('\n❌ Validator key not found. Run npm run setup first.'));
    return;
  }

  const wallet = new Wallet(pk);

  console.log(clearScreen);
  console.log(cursorHide);
  console.log(chalk.red.bold('🔐 PRIVATE KEY - DO NOT SHARE! 🔐\n'));
  console.log(chalk.white.bgRed.bold(` ${wallet.privateKey} `));
  console.log(chalk.gray(`\nAddress:    ${wallet.address}`));
  console.log(chalk.gray(`Public Key: ${wallet.signingKey.publicKey}`));
  console.log('\n');

  for (let i = 20; i >= 0; i--) {
    if (isExiting) break;
    process.stdout.write(clearLine);
    const color = i > 10 ? chalk.green : i > 5 ? chalk.yellow : chalk.red;
    process.stdout.write(color.bold(`\rKey will be hidden in: ${i} seconds`));
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(clearScreen);
  console.log(cursorShow);
  console.log(chalk.green('✓ Private key cleared from screen'));
}

process.on('SIGINT', () => {
  if (isExiting) return;
  isExiting = true;
  console.log(clearScreen);
  console.log(cursorShow);
  console.log(chalk.yellow('\n✓ Key reveal interrupted.'));
  setTimeout(() => {
    console.log(clearScreen);
    process.exit(0);
  }, 2000);
});

revealKey().catch((err) => {
  console.error(chalk.red('Reveal failed:'), err);
  process.exit(1);
});
