import "@nomiclabs/hardhat-solhint";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import { env } from "./env";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{ version: "0.8.20" }],
  },
  networks: {
    "local-blockchain": {
      url: env.LOCAL_BLOCKCHAIN_RPC,
      accounts: [env.PRIVATE_KEY],
      chainId: env.LOCAL_CHAIN_ID,
    },
    sepolia: {
      url: env.SEPOLIA_URL,
      accounts: [env.PRIVATE_KEY],
      chainId: 11155111,
    },
    mainnet: {
      url: env.MAINNET_URL,
      accounts: [env.PRIVATE_KEY],
      chainId: 1,
    },
  },
  gasReporter: {
    enabled: env.REPORT_GAS === "true",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      "local-blockchain": env.LOCAL_BLOCKCHAIN_EXPLORER_API_KEY,
      sepolia: env.ETHERSCAN_API_KEY || "dummy-key",
      mainnet: env.ETHERSCAN_API_KEY || "dummy-key",
    },
    customChains: [
      {
        network: "local-blockchain",
        chainId: env.LOCAL_CHAIN_ID,
        urls: {
          apiURL: env.BLOCKSCOUT_API_URL,
          browserURL: env.BLOCKSCOUT_URL,
        },
      },
    ],
  },
};

export default config;