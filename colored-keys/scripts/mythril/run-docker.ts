#!/usr/bin/env node
/**
 * Docker wrapper for Mythril security analysis
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get command line arguments
const args = process.argv.slice(2);

// Default contract if none specified
const contract = args[0] || 'contracts/OnePerWalletKeyToken.sol';

console.log('Preparing Mythril analysis...');

// Create a temporary directory and copy only what we need
const tempDir = '.mythril-temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Copy contracts and config
fs.cpSync('contracts', path.join(tempDir, 'contracts'), { recursive: true });
fs.copyFileSync('mythril-config.json', path.join(tempDir, 'mythril-config.json'));

// Create node_modules structure for OpenZeppelin
const ozPath = path.join(tempDir, 'node_modules', '@openzeppelin');
fs.mkdirSync(ozPath, { recursive: true });

// Copy OpenZeppelin contracts from pnpm store
const pnpmOzPath = path.join('node_modules', '.pnpm', '@openzeppelin+contracts@5.3.0', 'node_modules', '@openzeppelin', 'contracts');
fs.cpSync(pnpmOzPath, path.join(ozPath, 'contracts'), { recursive: true });

// Build Docker command using the temp directory
const dockerArgs = [
  'run',
  '--rm',
  '-it',
  '-v', `${path.resolve(tempDir)}:/src`,
  '-w', '/src',
  'mythril/myth:latest',
  'myth', '-v', '5', 'analyze', contract, '--solc-json', 'mythril-config.json'
];

console.log('Running Mythril analysis...');
const docker = spawn('docker', dockerArgs, {
  stdio: 'inherit',
  shell: false
});

docker.on('error', (error) => {
  console.error('Docker execution failed:', error);
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
});

docker.on('exit', (exitCode) => {
  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(exitCode || 0);
});