// scripts/deploy-contract.ts
import { ethers } from "hardhat";
import { recordContractAddress } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('deploy');

async function main() {
  logger.info("Deploying OnePerWalletKeyToken (max 1 token per address)...");
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [deployer] = await ethers.getSigners();
  logger.info("Deploying with account", { address: deployer.address });
  logger.info("Network", { network: hre.network.name });

  // Get the contract factory
  const OnePerWalletKeyToken = await ethers.getContractFactory("OnePerWalletKeyToken");
  
  // Get bytecode sizes before deployment
  const deploymentBytecode = OnePerWalletKeyToken.bytecode;
  const deploymentBytecodeSize = deploymentBytecode.length / 2 - 1;
  
  // Get runtime bytecode from artifacts
  const artifact = await hre.artifacts.readArtifact("OnePerWalletKeyToken");
  const runtimeBytecode = artifact.deployedBytecode;
  const runtimeBytecodeSize = runtimeBytecode.length / 2 - 1;
  
  // Display bytecode sizes
  logger.info("📊 Bytecode Sizes:");
  logger.info(`  Init bytecode:    ${deploymentBytecodeSize} bytes (${(deploymentBytecodeSize / 1024).toFixed(2)} KB)`);
  logger.info(`  Runtime bytecode: ${runtimeBytecodeSize} bytes (${(runtimeBytecodeSize / 1024).toFixed(2)} KB)`);
  
  // Check against EIP-170 contract size limit (24,576 bytes for runtime bytecode)
  const CONTRACT_SIZE_LIMIT = 24576;
  const sizePercentage = ((runtimeBytecodeSize / CONTRACT_SIZE_LIMIT) * 100).toFixed(1);
  logger.info(`  Size limit usage: ${sizePercentage}% of 24KB limit`);
  
  if (runtimeBytecodeSize > CONTRACT_SIZE_LIMIT) {
    logger.warn("  ⚠️  WARNING: Contract exceeds EIP-170 size limit!");
  } else if (runtimeBytecodeSize > CONTRACT_SIZE_LIMIT * 0.9) {
    logger.warn("  ⚠️  WARNING: Contract is over 90% of size limit!");
  } else {
    logger.info("  ✅ Contract size is within limits");
  }

  // Deploy the contract
  const keyToken = await OnePerWalletKeyToken.deploy();
  await keyToken.waitForDeployment();
  
  const contractAddress = await keyToken.getAddress();
  logger.info('OnePerWalletKeyToken deployed to:', { address: contractAddress });

  // Get the deployment transaction receipt for block number
  const deploymentReceipt = await keyToken.deploymentTransaction()?.wait();
  const blockNumber = deploymentReceipt?.blockNumber;

  // Record the contract address
  await recordContractAddress(
    hre.network.name,
    'OnePerWalletKeyToken',
    contractAddress,
    blockNumber
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Deployment failed", { error });
    process.exit(1);
  });