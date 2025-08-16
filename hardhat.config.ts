import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const opt = { optimizer: { enabled: true, runs: 200 } };

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    anvil: {
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;
