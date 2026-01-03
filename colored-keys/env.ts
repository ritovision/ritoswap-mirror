import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Check if we're in test environment
const isTestEnvironment = process.env.NODE_ENV === 'test' || 
                         process.env.HARDHAT_NETWORK === 'hardhat' ||
                         process.env.CI === 'true';

// Define the schema
const envSchema = z.object({
  // Required for production/deployment, optional for tests
  PRIVATE_KEY: isTestEnvironment 
    ? z.string().optional().default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') // Hardhat's default test private key
    : z.string().min(1, 'PRIVATE_KEY is required').startsWith('0x', 'PRIVATE_KEY must start with 0x'),
  
  // Numeric with default fallback
  LOCAL_CHAIN_ID: z.string().default('90999999').transform((val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 90999999 : parsed;
  }),
  
  // URLs with defaults
  LOCAL_BLOCKCHAIN_RPC: z.string().url().optional().default('http://127.0.0.1:8545'),
  BLOCKSCOUT_API_URL: z.string().url().optional().default('http://localhost:4000/api'),
  BLOCKSCOUT_URL: z.string().url().optional().default('http://localhost:4000'),
  
  // Local Blockscout API key - most local instances don't require auth, so 'none' is fine
  LOCAL_BLOCKCHAIN_EXPLORER_API_KEY: z.string().optional().default('none'),
  
  // Optional but log if missing
  ETHERSCAN_API_KEY: z.string().optional(),
  RECEIVER_ADDRESS: z.string().optional(),
  
  // Network URLs with reliable defaults
  SEPOLIA_URL: z.string().url().optional().default('https://ethereum-sepolia-rpc.publicnode.com'),
  MAINNET_URL: z.string().url().optional().default('https://cloudflare-eth.com'),
  
  // Gas reporter
  REPORT_GAS: z.enum(['true', 'false']).optional().default('false'),
});

// Parse and validate
const parseResult = envSchema.safeParse(process.env);

// Collect warnings for optional fields
const warnings: string[] = [];

if (parseResult.success) {
  const env = parseResult.data;
  
  // Only show warnings in non-test environments
  if (!isTestEnvironment) {
    // Check for optional fields that might be missing
    if (!env.ETHERSCAN_API_KEY) {
      warnings.push('⚠️  ETHERSCAN_API_KEY is not set - Etherscan verification will not work');
    }
    
    if (!env.RECEIVER_ADDRESS) {
      warnings.push('⚠️  RECEIVER_ADDRESS is not set - transfer scripts may fail');
    }
    
    // Info about local blockchain setup if using defaults
    if (env.LOCAL_BLOCKCHAIN_EXPLORER_API_KEY === 'none') {
      warnings.push('ℹ️  Using default Blockscout configuration for local blockchain (no API key required)');
    }
  }
  
  // Log all warnings together if any exist
  if (warnings.length > 0) {
    console.log('\n📋 Environment Configuration Warnings:');
    warnings.forEach(warning => console.log(warning));
    console.log(''); // Empty line for spacing
  }
} else {
  // Fatal errors - these will crash the app
  console.error('\n❌ Environment Validation Failed:');
  console.error('The following environment variables have errors:\n');
  
  parseResult.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    console.error(`  ${path}: ${issue.message}`);
  });
  
  console.error('\nPlease check your .env file and ensure all required variables are set correctly.\n');
  process.exit(1);
}

// Export typed environment variables
export const env = parseResult.data;

// Type export for use elsewhere if needed
export type Env = z.infer<typeof envSchema>;