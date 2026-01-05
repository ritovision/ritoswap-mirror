// scripts/estimate-gas-deploy-viem.ts
import { createPublicClient, http, formatEther, formatGwei } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../env';
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('estimate-gas');

async function main() {
  const privateKey = env.PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith('0x')) {
    throw new Error('PRIVATE_KEY must be set in .env');
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(env.MAINNET_URL)
  });
  
  const contractPath = path.join(__dirname, '../artifacts/contracts/OnePerWalletKeyToken.sol/OnePerWalletKeyToken.json');
  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const bytecode = contractJson.bytecode as `0x${string}`;
  
  logger.info('Estimating gas for OnePerWalletKeyToken deployment...');
  
  try {
    const estimatedGas = await publicClient.estimateGas({
      account: account.address,
      data: bytecode,
      value: 0n
    });
    
    const gasPrice = await publicClient.getGasPrice();
    const costInWei = estimatedGas * gasPrice;
    const costInEth = formatEther(costInWei);
    
    logger.info('Gas estimation complete', {
      gasRequired: estimatedGas.toString(),
      gasPrice: `${formatGwei(gasPrice)} gwei`,
      deploymentCost: `${costInEth} ETH`,
      recommendedGasLimit: (estimatedGas * 120n / 100n).toString()
    });
    
  } catch (error: any) {
    logger.error('Gas estimation failed', { error: error.message });
    
    if (error.message.includes('gas required exceeds')) {
      logger.info('Your contract requires a lot of gas. Try with 5-6M gas limit.');
    }
  }
}

main().catch((error) => {
  logger.error('Script failed', { error: error.message });
});