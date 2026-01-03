// scripts/transfer-token.ts
import { ethers } from "hardhat";
import { readContractAddresses } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { env } from '../env';
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('transfer-token');

async function main() {
    // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [signer] = await ethers.getSigners();
  logger.info(`Transferring from: ${signer.address}`);
  logger.info(`Network: ${hre.network.name}`);
  
  // Get receiver address from env
  const RECEIVER_ADDRESS = env.RECEIVER_ADDRESS;
  if (!RECEIVER_ADDRESS || !ethers.isAddress(RECEIVER_ADDRESS)) {
    logger.error("❌ RECEIVER_ADDRESS must be set in .env with a valid address");
    process.exitCode = 1;
    return;
  }
  logger.info(`Receiver address: ${RECEIVER_ADDRESS}`);
  
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
  logger.info(`Contract address: ${CONTRACT_ADDRESS}`);
  
  // Get contract instance
  const keyToken = await ethers.getContractAt("OnePerWalletKeyToken", CONTRACT_ADDRESS);
  
  // Check if sender has a token
  const [tokenId, hasToken] = await keyToken.getTokenOfOwner(signer.address);
  
  if (!hasToken) {
    logger.error("❌ You don't own any tokens to transfer!");
    process.exitCode = 1;
    return;
  }
  
  logger.info(`📦 You own token #${tokenId}`);
  
  // Check if receiver already has a token
  const [receiverTokenId, receiverHasToken] = await keyToken.getTokenOfOwner(RECEIVER_ADDRESS);
  if (receiverHasToken) {
    logger.error(`❌ Receiver already owns token #${receiverTokenId}. Cannot transfer.`);
    logger.error("Each wallet can only hold 1 token at a time.");
    process.exitCode = 1;
    return;
  }
  
  try {
    // Get token details before transfer
    const [bgColor, keyColor] = await keyToken.getTokenColors(tokenId);
    logger.info(`Token colors - Background: ${bgColor}, Key: ${keyColor}`);
    
    // Transfer the token
    logger.info(`🚀 Transferring token #${tokenId} to ${RECEIVER_ADDRESS}...`);
    const transferTx = await keyToken.transferFrom(
      signer.address,
      RECEIVER_ADDRESS,
      tokenId
    );
    const receipt = await transferTx.wait();
    logger.info(`Transaction hash: ${receipt?.hash}`);
    
    // Verify transfer was successful
    const [newOwnerToken, receiverNowHasToken] = await keyToken.getTokenOfOwner(RECEIVER_ADDRESS);
    const [senderToken, senderStillHasToken] = await keyToken.getTokenOfOwner(signer.address);
    
    if (receiverNowHasToken && !senderStillHasToken) {
      logger.info(`✅ Transfer successful!`);
      logger.info(`Token #${tokenId} now owned by ${RECEIVER_ADDRESS}`);
    } else {
      logger.error("❌ Transfer verification failed");
    }
    
  } catch (error: any) {
    logger.error(`❌ Error: ${error.message}`, { error });
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Script failed', error);
    process.exit(1);
  });