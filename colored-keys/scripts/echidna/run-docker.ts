#!/usr/bin/env node
/**
 * Docker wrapper for Echidna fuzzing tests
 */
import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get command line arguments
const args = process.argv.slice(2);

// Parse contract name from args or use default
const contractIndex = args.findIndex(arg => arg === '--contract');
const contract = contractIndex !== -1 && args[contractIndex + 1] 
  ? args[contractIndex + 1] 
  : 'EchidnaOnePerWalletKeyToken';

// Ensure corpus directory exists
const corpusDir = path.join(process.cwd(), 'echidna-corpus');
if (!fs.existsSync(corpusDir)) {
  fs.mkdirSync(corpusDir, { recursive: true });
}

// Ensure flattened directory exists
const flattenedDir = path.join(process.cwd(), 'flattened');
if (!fs.existsSync(flattenedDir)) {
  fs.mkdirSync(flattenedDir, { recursive: true });
}

console.log('Running Echidna fuzzing tests...');
console.log(`Contract: ${contract}`);

// First compile contracts
try {
  console.log('Compiling contracts...');
  execSync('pnpm run compile', { stdio: 'inherit' });
} catch (error) {
  console.error('Contract compilation failed');
  process.exit(1);
}

// Flatten the contract
console.log('Flattening contract for Echidna...');
try {
  // Find the contract file
  const contractFile = findContractFile(contract);
  if (!contractFile) {
    console.error(`Could not find contract file for ${contract}`);
    process.exit(1);
  }
  
  // Use Hardhat's built-in flatten task
  const flattenedPath = path.join(flattenedDir, `${contract}.sol`);
  const flattenedContent = execSync(`npx hardhat flatten ${contractFile}`, { encoding: 'utf8' });
  
  // Write flattened content
  fs.writeFileSync(flattenedPath, flattenedContent);
  console.log(`Flattened contract written to: ${flattenedPath}`);
} catch (error) {
  console.error('Contract flattening failed:', error);
  process.exit(1);
}

// Create a bash script to run inside Docker
const bashScript = [
  'solc-select install 0.8.20',
  'solc-select use 0.8.20',
  `echidna /src/flattened/${contract}.sol --contract ${contract} --config /src/echidna.yml`
].join(' && ');

// Build Docker command
const dockerArgs = [
  'run',
  '--rm',
  '-it',
  '-v', `${process.cwd()}:/src`,
  '-v', `${corpusDir}:/src/echidna-corpus`,
  '-w', '/src',
  'ghcr.io/crytic/echidna/echidna:latest',
  'sh', '-c',
  bashScript
];

// Run Echidna
const docker = spawn('docker', dockerArgs, {
  stdio: 'inherit',
  shell: false
});

docker.on('error', (error) => {
  console.error('Docker execution failed:', error);
  console.error('Make sure the Echidna image is available: docker pull ghcr.io/crytic/echidna/echidna:latest');
  process.exit(1);
});

docker.on('exit', (exitCode) => {
  if (exitCode === 0) {
    console.log('\n✅ All Echidna tests passed!');
    
    // Check for coverage files
    const coverageFiles = fs.readdirSync(corpusDir)
      .filter(f => f.startsWith('covered.') && f.endsWith('.html'));
    
    if (coverageFiles.length > 0) {
      console.log('\n📊 Coverage reports generated:');
      coverageFiles.forEach(f => console.log(`   - ${path.join('echidna-corpus', f)}`));
    }
  }
  process.exit(exitCode || 0);
});

// Helper function to find contract file
function findContractFile(contractName: string): string | null {
  const dirs = ['contracts', 'contracts/test'];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.includes(contractName) && file.endsWith('.sol')) {
        return path.join(dir, file);
      }
    }
  }
  
  return null;
}