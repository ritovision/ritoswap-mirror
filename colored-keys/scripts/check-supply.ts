import { ethers } from "hardhat";
import { readContractAddresses } from './utils/contractAddressRecorder';
import hre from "hardhat";
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('check-supply');

async function main() {
  // @ts-expect-error TS2339: Hardhat's `ethers` actually has getSigners at runtime
  const [signer] = await ethers.getSigners();
  logger.info("Network", { network: hre.network.name });
  
  const addresses = readContractAddresses(hre.network.name);
  const contractData = addresses.OnePerWalletKeyToken;
  
  if (!contractData || !contractData.address) {
    logger.error(`OnePerWalletKeyToken not deployed on ${hre.network.name}`);
    logger.error("Please deploy the contract first using deploy-contract.ts");
    return;
  }
  
  const CONTRACT_ADDRESS = contractData.address;
  const keyToken = await ethers.getContractAt("OnePerWalletKeyToken", CONTRACT_ADDRESS);
  
  logger.info("=== KeyToken Collection Status ===");
  logger.info("Contract info", {
    address: CONTRACT_ADDRESS,
    name: await keyToken.name(),
    symbol: await keyToken.symbol()
  });
  
  const totalSupply = await keyToken.totalSupply();
  logger.info("Total Supply", { tokens: totalSupply.toString() });
  
  logger.info("Your tokens", { address: signer.address });
  const yourBalance = await keyToken.balanceOf(signer.address);
  logger.info("Your balance", { balance: yourBalance.toString() });
  
  if (yourBalance > 0) {
    const [tokenId, hasToken] = await keyToken.getTokenOfOwner(signer.address);
    logger.info("Your token ID", { tokenId: tokenId.toString() });
    
    const [bgColor, keyColor] = await keyToken.getTokenColors(tokenId);
    logger.info("Token details", {
      tokenId: tokenId.toString(),
      background: bgColor,
      key: keyColor
    });
  }
  
  const args = process.argv.slice(2);
  if (args[0]) {
    const checkTokenId = parseInt(args[0]);
    logger.info(`Checking Token #${checkTokenId}`);
    
    try {
      const owner = await keyToken.ownerOf(checkTokenId);
      const [bgColor, keyColor] = await keyToken.getTokenColors(checkTokenId);
      logger.info("Token info", {
        owner,
        background: bgColor,
        key: keyColor,
        isYours: owner.toLowerCase() === signer.address.toLowerCase()
      });
    } catch (error) {
      logger.warn("Token doesn't exist (may have been burned)");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Script failed", { error: error.message });
    process.exit(1);
  });