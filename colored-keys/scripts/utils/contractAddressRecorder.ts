// scripts/utils/contractAddressRecorder.ts
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../lib/logger/logger';
import { env } from '../../env';

const logger = createLogger('contractAddressRecorder');

interface ContractAddresses {
  [contractName: string]: {
    address: string;
    deployedAt: string;
    blockNumber?: number;
  };
}

interface NetworkConfig {
  outputPath: string;
  chainId?: number;
}

// Network configurations - easy to add new networks
const CONTRACT_ADDRESSES_DIR = path.join(__dirname, '..', '..', '..', 'ContractAddresses');

const NETWORK_CONFIGS: { [key: string]: NetworkConfig } = {
  mainnet: {
    outputPath: path.join(CONTRACT_ADDRESSES_DIR, 'mainnet.json'),
    chainId: 1
  },
  sepolia: {
    outputPath: path.join(CONTRACT_ADDRESSES_DIR, 'sepolia.json'),
    chainId: 11155111
  },
  "local-blockchain": {
    outputPath: path.join(CONTRACT_ADDRESSES_DIR, 'local_blockchain.json'),
    chainId: env.LOCAL_CHAIN_ID
  },
  localhost: {
    outputPath: path.join(CONTRACT_ADDRESSES_DIR, 'hardhat.json'),
    chainId: 31337
  }
};

/**
 * Records a deployed contract address to a network-specific JSON file
 * @param networkName - The network name (mainnet, sepolia, local-blockchain, etc.)
 * @param contractName - The name of the contract
 * @param contractAddress - The deployed contract address
 * @param blockNumber - Optional block number of deployment
 */
export async function recordContractAddress(
  networkName: string,
  contractName: string,
  contractAddress: string,
  blockNumber?: number | bigint
): Promise<void> {
  const networkConfig = NETWORK_CONFIGS[networkName.toLowerCase()];
  
  if (!networkConfig) {
    throw new Error(`Network ${networkName} not configured. Add it to NETWORK_CONFIGS in contractAddressRecorder.ts`);
  }

  const outputPath = networkConfig.outputPath;
  const outputDir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logger.info(`Created directory: ${outputDir}`);
  }

  // Read existing addresses or create new object
  let addresses: ContractAddresses = {};
  if (fs.existsSync(outputPath)) {
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    // Handle empty files
    if (fileContent.trim()) {
      try {
        addresses = JSON.parse(fileContent);
      } catch (error) {
        logger.warn(`Invalid JSON in ${outputPath}, starting fresh`, { error });
        addresses = {};
      }
    }
  }

  // Update with new contract address
  addresses[contractName] = {
    address: contractAddress,
    deployedAt: new Date().toISOString(),
    blockNumber: blockNumber ? Number(blockNumber) : undefined
  };

  // Write back to file
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  logger.info(`📝 Recorded ${contractName} at ${contractAddress} to ${outputPath}`);
}

/**
 * Gets the network name from chain ID (useful for Viem deployments)
 * @param chainId - The chain ID
 * @returns The network name
 */
export function getNetworkNameFromChainId(chainId: number): string {
  for (const [networkName, config] of Object.entries(NETWORK_CONFIGS)) {
    if (config.chainId === chainId) {
      return networkName;
    }
  }
  throw new Error(`Unknown chain ID: ${chainId}. Add it to NETWORK_CONFIGS in contractAddressRecorder.ts`);
}

/**
 * Reads contract addresses for a specific network
 * @param networkName - The network name
 * @returns The contract addresses object
 */
export function readContractAddresses(networkName: string): ContractAddresses {
  const networkConfig = NETWORK_CONFIGS[networkName.toLowerCase()];
  
  if (!networkConfig) {
    throw new Error(`Network ${networkName} not configured`);
  }

  const outputPath = networkConfig.outputPath;
  
  if (!fs.existsSync(outputPath)) {
    return {};
  }

  const fileContent = fs.readFileSync(outputPath, 'utf8');
  
  // Handle empty files
  if (!fileContent.trim()) {
    return {};
  }
  
  try {
    return JSON.parse(fileContent);
  } catch (error) {
    logger.warn(`Invalid JSON in ${outputPath}`, { error });
    return {};
  }
}