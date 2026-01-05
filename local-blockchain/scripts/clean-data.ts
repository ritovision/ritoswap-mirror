import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { configDir, dataDir, ritoswapRoot } from './utils';

async function clean() {
  console.log(chalk.blue('🧹 Cleaning RitoSwap Besu data...'));

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'This will delete Besu data, validator keys, Blockscout checkout, and docker volumes. Continue?',
    initial: false
  });

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  try {
    console.log(chalk.gray('Stopping containers and removing volumes...'));
    require('child_process').execSync('docker compose -f docker-compose.yml down -v', {
      cwd: ritoswapRoot,
      stdio: 'inherit'
    });
  } catch (err) {
    console.log(chalk.yellow('Warning: docker compose down failed or services not running.'));
  }

  const besuData = path.join(dataDir, 'besu');
  if (fs.existsSync(besuData)) {
    console.log(chalk.gray('Removing Besu data directory...'));
    fs.removeSync(besuData);
  }

  const genesisPath = path.join(configDir, 'genesis.json');
  if (fs.existsSync(genesisPath)) {
    console.log(chalk.gray('Removing genesis.json...'));
    fs.removeSync(genesisPath);
  }

  const keysDir = path.join(configDir, 'keys');
  if (fs.existsSync(keysDir)) {
    console.log(chalk.gray('Removing validator keys...'));
    fs.removeSync(keysDir);
  }

  const blockscoutDir = path.join(ritoswapRoot, 'blockscout');
  if (fs.existsSync(blockscoutDir)) {
    console.log(chalk.gray('Removing Blockscout checkout...'));
    fs.removeSync(blockscoutDir);
  }

  console.log(chalk.green('✓ Clean complete. Run npm run setup before starting again.'));
}

clean().catch((err) => {
  console.error(chalk.red('Clean failed:'), err);
  process.exit(1);
});
