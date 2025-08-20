import "hardhat-abi-exporter";   
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
            enabled: false, // Disable optimizer to match Uniswap V2
          },
          evmVersion: "istanbul", // Match Uniswap's EVM version
          outputSelection: {
            "*": {
              "*": ["evm.bytecode"],
            },
          },
        },
      },
    ],
  },
  defaultNetwork: "anvil",
  networks: {
    anvil: {
      url: "http://127.0.0.1:8545",
    },
  },
  abiExporter: {
    path: "export/abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    only: [
      "UniswapV2Factory",
      "UniswapV2Router02",
      "UniswapV2Pair",
      "UniswapV2ERC20",
      "WETH9",
      "MockERC20"
    ]
  }
};

export default config;
