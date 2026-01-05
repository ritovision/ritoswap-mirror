import { ethers } from "hardhat";
import { readContractAddresses } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('burn-token');

async function main() {
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [signer] = await ethers.getSigners();
  logger.info("Acting as", { address: signer.address });
  logger.info("Network", { network: hre.network.name });
  
  const addresses = readContractAddresses(hre.network.name);
  const contractData = addresses.OnePerWalletKeyToken;
  
  if (!contractData || !contractData.address) {
    logger.error(`OnePerWalletKeyToken not deployed on ${hre.network.name}`);
    logger.error("Please deploy the contract first using deploy-contract.ts");
    return;
  }
  
  const CONTRACT_ADDRESS = contractData.address;
  logger.info("Contract address", { address: CONTRACT_ADDRESS });
  
  const keyToken = await ethers.getContractAt("OnePerWalletKeyToken", CONTRACT_ADDRESS);
  
  logger.info("Checking your tokens...");
  const [tokenId, hasToken] = await keyToken.getTokenOfOwner(signer.address);
  
  if (!hasToken) {
    logger.error("You don't own any tokens to burn!");
    return;
  }
  
  const tokenIdToBurn = Number(tokenId);
  logger.info(`🔥 Will burn token #${tokenIdToBurn}`);
  
  try {
    const [bgColor, keyColor] = await keyToken.getTokenColors(tokenIdToBurn);
    logger.info("Token colors", { background: bgColor, key: keyColor });
    
    const balanceBefore = await keyToken.balanceOf(signer.address);
    const totalSupplyBefore = await keyToken.totalSupply();
    logger.info("Before burning", {
      yourBalance: balanceBefore.toString(),
      totalSupply: totalSupplyBefore.toString()
    });
    
    logger.info(`🔥 Burning token #${tokenIdToBurn}...`);
    const burnTx = await keyToken.burn(tokenIdToBurn);
    const receipt = await burnTx.wait();
    logger.info("Transaction complete", { hash: receipt?.hash });
    
    const balanceAfter = await keyToken.balanceOf(signer.address);
    const totalSupplyAfter = await keyToken.totalSupply();
    logger.info("After burning", {
      yourBalance: `${balanceBefore} → ${balanceAfter}`,
      totalSupply: `${totalSupplyBefore} → ${totalSupplyAfter}`
    });
    
    const [newTokenId, hasNewToken] = await keyToken.getTokenOfOwner(signer.address);
    if (hasNewToken) {
      logger.info("Your remaining token", { tokenId: newTokenId.toString() });
    } else {
      logger.info("You have no tokens remaining");
    }
    
  } catch (error: any) {
    logger.error("Burn failed", { error: error.message });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Script failed", { error: error.message });
    process.exit(1);
  });