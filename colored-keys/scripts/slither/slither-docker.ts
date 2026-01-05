#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get command line arguments and filter out "--"
const args = process.argv.slice(2).filter(arg => arg !== '--');

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'slither-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build Docker command with correct argument order
const dockerArgs: string[] = [
  'compose',
  'run',
  '--rm',
  'slither',
  '.',     // Target directory MUST come first
  ...args  // Then all other arguments
];

// Execute Docker command
const docker = spawn('docker', dockerArgs, {
  stdio: 'inherit',
  shell: false
});

docker.on('error', (error: Error) => {
  console.error('Docker execution failed:', error);
  process.exit(1);
});

docker.on('exit', (code: number | null) => {
  if (code === 255) {
    console.log('\nSlither analysis complete (issues found)');
    process.exit(0);
  }
  process.exit(code || 0);
});