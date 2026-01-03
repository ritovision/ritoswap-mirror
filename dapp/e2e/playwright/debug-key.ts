// dapp/e2e/playwright/debug-key.ts
// Run this with: npx tsx dapp/e2e/playwright/debug-key.ts

import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.playwright
dotenv.config({ path: path.resolve(__dirname, '../../.env.playwright') });

console.log('\n=== Private Key Debug ===\n');

const rawPrivateKey = process.env.PRIVATE_KEY;
console.log('Raw PRIVATE_KEY from env (first 10 chars):', rawPrivateKey?.substring(0, 10) + '...');
console.log('Raw PRIVATE_KEY length:', rawPrivateKey?.length);

// Try different normalization approaches
function normalizePrivateKey(input: string): `0x${string}` {
  if (!input) throw new Error('Private key missing');
  
  let s = String(input);
  
  // Log initial state
  console.log('\nNormalization steps:');
  console.log('1. Initial:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  
  // Trim
  s = s.trim();
  console.log('2. After trim:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  
  // Remove quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
    console.log('3. After quote removal:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  }
  
  // Remove invisible chars
  const INVISIBLES = /[\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF\u00A0]/g;
  const hadInvisibles = INVISIBLES.test(s);
  s = s.replace(INVISIBLES, '');
  if (hadInvisibles) {
    console.log('4. After invisible char removal:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  }
  
  // Remove line endings & tabs
  s = s.replace(/[\r\n\t]/g, '');
  
  // Handle 0x prefix
  if (s.startsWith('0x') || s.startsWith('0X')) {
    s = s.slice(2);
    console.log('5. After 0x removal:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  }
  
  // Check for non-hex chars
  const invalidMatches = s.match(/[^0-9a-fA-F]/g);
  if (invalidMatches) {
    const uniq = Array.from(new Set(invalidMatches));
    console.log('ERROR: Found non-hex characters:', uniq);
    throw new Error('Private key contains non-hex characters');
  }
  
  // Pad if needed
  if (s.length < 64) {
    s = s.padStart(64, '0');
    console.log('6. After padding:', s.substring(0, 10) + '...', `(length: ${s.length})`);
  }
  
  const hex = `0x${s.toLowerCase()}` as `0x${string}`;
  console.log('7. Final normalized:', hex.substring(0, 10) + '...', `(length: ${hex.length})`);
  
  return hex;
}

try {
  // Method 1: Direct use (what wallet-stub might be doing)
  if (rawPrivateKey) {
    console.log('\n--- Method 1: Direct use ---');
    try {
      const directKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey as `0x${string}` : `0x${rawPrivateKey}` as `0x${string}`;
      const account1 = privateKeyToAccount(directKey);
      console.log('Address from direct use:', account1.address);
    } catch (e) {
      console.log('Error with direct use:', (e as Error).message);
    }
  }
  
  // Method 2: With normalization (what env.ts does)
  if (rawPrivateKey) {
    console.log('\n--- Method 2: With normalization ---');
    try {
      const normalizedKey = normalizePrivateKey(rawPrivateKey);
      const account2 = privateKeyToAccount(normalizedKey);
      console.log('Address from normalized key:', account2.address);
    } catch (e) {
      console.log('Error with normalized key:', (e as Error).message);
    }
  }
  
  // Method 3: Test with hardcoded test key
  console.log('\n--- Method 3: Hardcoded test key ---');
  const testKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;
  const testAccount = privateKeyToAccount(testKey);
  console.log('Test key address:', testAccount.address);
  console.log('Expected:', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  
} catch (error) {
  console.error('\nError:', error);
}

console.log('\n=== End Debug ===\n');