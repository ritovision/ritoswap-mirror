import path from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import chalk from 'chalk';

export const ritoswapRoot = path.join(__dirname, '..');
export const envPath = path.join(ritoswapRoot, '.env');
export const configDir = path.join(ritoswapRoot, 'config');
export const dataDir = path.join(ritoswapRoot, 'data');
export const keysDir = path.join(configDir, 'keys');
export const genesisPath = path.join(configDir, 'genesis.json');

export function loadEnv() {
  dotenv.config({ path: envPath, override: true });
}

export function ensureBaseDirs() {
  fs.ensureDirSync(configDir);
  fs.ensureDirSync(dataDir);
  fs.ensureDirSync(keysDir);
}

export function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    return;
  }
  const examplePath = path.join(ritoswapRoot, '.env.example');
  if (!fs.existsSync(examplePath)) {
    console.error(chalk.red('Missing .env.example; cannot bootstrap .env'));
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log(chalk.yellow('Created .env from .env.example'));
}

export function to0x(value: string) {
  return value.startsWith('0x') ? value : `0x${value}`;
}

export function strip0x(value: string) {
  return value.replace(/^0x/i, '');
}

export function posixPath(p: string) {
  return p.replace(/\\/g, '/');
}
