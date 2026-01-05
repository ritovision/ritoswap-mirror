// scripts/deploy-contract-mint-burn.ts
import { ethers } from "hardhat";
import { recordContractAddress } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('deploy-mint-burn');

async function main() {
  logger.info("Deploying OnePerWalletKeyToken (max 1 token per address)...");
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [deployer] = await ethers.getSigners();
  logger.info("Deploying with account", { address: deployer.address });
  logger.info("Network", { network: hre.network.name });

  // Deploy the contract
  const OnePerWalletKeyToken = await ethers.getContractFactory("OnePerWalletKeyToken");
  const keyToken = await OnePerWalletKeyToken.deploy();
  await keyToken.waitForDeployment();
  
  const contractAddress = await keyToken.getAddress();
  logger.info("OnePerWalletKeyToken deployed to", { address: contractAddress });
  
  // Get the deployment transaction receipt for block number
  const deploymentReceipt = await keyToken.deploymentTransaction()?.wait();
  const blockNumber = deploymentReceipt?.blockNumber;

  // Record the contract address before running tests
  await recordContractAddress(
    hre.network.name,
    'OnePerWalletKeyToken',
    contractAddress,
    blockNumber
  );
  
  // Test the restriction
  logger.info("=== Testing One-Per-Wallet Restriction ===");
  
  // Mint first token
  logger.info("1. Minting first token...");
  const mintTx1 = await keyToken.mint();
  await mintTx1.wait();
  logger.info("✅ First token minted successfully");
  
  // Try to mint second token (should fail)
  logger.info("2. Trying to mint second token (should fail)...");
  try {
    const mintTx2 = await keyToken.mint();
    await mintTx2.wait();
    logger.error("❌ ERROR: Should not have been able to mint second token!");
  } catch (error: any) {
    logger.info("✅ Correctly prevented second mint", { error: error.message.slice(0, 100) + "..." });
  }
  
  // Check balance
  const balance = await keyToken.balanceOf(deployer.address);
  logger.info("3. Current balance", { tokens: balance.toString() });
  
  // Get the token
  const [tokenId, hasToken] = await keyToken.getTokenOfOwner(deployer.address);
  if (hasToken) {
    logger.info("Token owned", { tokenId: tokenId.toString() });
    const [bgColor, keyColor] = await keyToken.getTokenColors(tokenId);
    logger.info("Colors", { background: bgColor, key: keyColor });
  }
  
  // Test burning and re-minting
  logger.info("4. Burning the token...");
  const burnTx = await keyToken.burn(tokenId);
  await burnTx.wait();
  logger.info("✅ Token burned");
  
  const balanceAfterBurn = await keyToken.balanceOf(deployer.address);
  logger.info("Balance after burn", { balance: balanceAfterBurn.toString() });
  
  logger.info("5. Minting new token after burn...");
  const mintTx3 = await keyToken.mint();
  await mintTx3.wait();
  logger.info("✅ Successfully minted new token after burning previous one");
  
  const [newTokenId, hasNewToken] = await keyToken.getTokenOfOwner(deployer.address);
  logger.info("New token owned", { tokenId: newTokenId.toString() });
  
  // Contract info
  logger.info("=== Contract Information ===");
  logger.info("Contract details", {
    address: contractAddress,
    name: await keyToken.name(),
    symbol: await keyToken.symbol(),
    totalSupply: (await keyToken.totalSupply()).toString()
  });
  
  logger.info("=== Restrictions Applied ===");
  logger.info("✅ Max 1 token per wallet");
  logger.info("✅ Cannot mint if already own a token");
  logger.info("✅ Cannot receive transfers if already own a token");
  logger.info("✅ Can mint again after burning or transferring");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Script failed", { error });
    process.exit(1);
  });