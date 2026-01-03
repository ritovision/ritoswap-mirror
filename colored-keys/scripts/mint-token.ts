// scripts/mint-token.ts
// Mints a single KeyToken NFT for the connected wallet
import { ethers } from "hardhat";
import { readContractAddresses } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('mint-token');

async function main(): Promise<void> {
    // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [signer] = await ethers.getSigners();
  logger.info(`⛓  Minting 1 NFT from: ${signer.address}`);
  logger.info(`Network: ${hre.network.name}`);
  
  // Read contract address from recorded addresses
  const addresses = readContractAddresses(hre.network.name);
  const contractData = addresses.OnePerWalletKeyToken;
  
  if (!contractData || !contractData.address) {
    logger.error(`❌ OnePerWalletKeyToken not deployed on ${hre.network.name}`);
    logger.error("Please deploy the contract first using deploy-contract.ts");
    process.exitCode = 1;
    return;
  }
  
  const CONTRACT_ADDRESS = contractData.address;
  logger.info(`🔗  Against contract: ${CONTRACT_ADDRESS}`);
  
  // Grab your deployed contract, connected to your signer
  const keyToken = await ethers.getContractAt(
    "OnePerWalletKeyToken",
    CONTRACT_ADDRESS,
    signer
  );
  
  // Check if already has a token
  const [existingTokenId, hasToken] = await keyToken.getTokenOfOwner(signer.address);
  if (hasToken) {
    logger.error(`❌  You already own token #${existingTokenId}. Cannot mint another.`);
    logger.error("Each wallet can only hold 1 token at a time.");
    process.exitCode = 1;
    return;
  }
  
  // Fire off mint()
  const tx = await keyToken.mint();
  logger.info(`→  Tx submitted: ${tx.hash}`);
  
  // Wait for it
  const receipt = await tx.wait();
  if (!receipt) {
    logger.error("❌  Transaction failed: no receipt");
    process.exitCode = 1;
    return;
  }
  
  logger.info(`✅  Mint confirmed in block ${receipt.blockNumber}`);
  
  // Show the newly minted token
  const [newTokenId, hasNewToken] = await keyToken.getTokenOfOwner(signer.address);
  if (hasNewToken) {
    logger.info(`🎉  You now own token #${newTokenId}`);
    const [bgColor, keyColor] = await keyToken.getTokenColors(newTokenId);
    logger.info(`Token colors - Background: ${bgColor}, Key: ${keyColor}`);
  }
}

main().catch((error) => {
  logger.error('Script failed', error);
  process.exitCode = 1;
});