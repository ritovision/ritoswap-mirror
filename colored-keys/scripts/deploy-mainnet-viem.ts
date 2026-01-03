// scripts/deploy-mainnet-viem.ts
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../env';
import { recordContractAddress, getNetworkNameFromChainId } from './utils/contractAddressRecorder';
import { createLogger } from '../lib/logger/logger';

const logger = createLogger('deploy-mainnet');

async function main() {
  const privateKey = env.PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith('0x')) {
    throw new Error('PRIVATE_KEY must be set in .env and start with 0x');
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  logger.info('Deploying from', { address: account.address });
  
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(env.MAINNET_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(env.MAINNET_URL)
  });
  
  const balance = await publicClient.getBalance({ address: account.address });
  logger.info('Balance', { eth: formatEther(balance) });
  
  const gasPrice = await publicClient.getGasPrice();
  logger.info('Gas price', { gwei: formatEther(gasPrice * 1000000000n) });
  
  const estimatedCost = gasPrice * 4200000n;
  logger.info('Estimated deployment cost', { eth: formatEther(estimatedCost) });
  
  if (balance < estimatedCost) {
    logger.warn('Low balance, but attempting deployment anyway...');
  }
  
  const contractPath = path.join(__dirname, '../artifacts/contracts/OnePerWalletKeyToken.sol/OnePerWalletKeyToken.json');
  const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const bytecode = contractJson.bytecode as `0x${string}`;
  
  logger.info('Deploying OnePerWalletKeyToken...');
  
  const hash = await walletClient.deployContract({
    abi: contractJson.abi,
    bytecode,
    args: [],
    gas: 4200000n,
  });
  
  logger.info('Transaction submitted', { 
    hash,
    etherscan: `https://etherscan.io/tx/${hash}`
  });
  
  logger.info('Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash,
    timeout: 300_000,
    pollingInterval: 2_000
  });
  
  logger.info('✅ Contract deployed!', {
    address: receipt.contractAddress,
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber.toString()
  });
  
  if (receipt.contractAddress) {
    const networkName = getNetworkNameFromChainId(mainnet.id);
    await recordContractAddress(
      networkName,
      'OnePerWalletKeyToken',
      receipt.contractAddress,
      receipt.blockNumber
    );
  }
}

main().catch((error) => {
  logger.error('Deployment failed', { error: error.message });
  process.exit(1);
});