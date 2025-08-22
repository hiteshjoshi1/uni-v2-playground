// scripts/export-addresses.ts
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { ethers, network } from "hardhat";

async function main() {
  const chainId = parseInt(await network.provider.send("eth_chainId"), 16);

  // Load Ignition deployment addresses
  const deployedPath = path.join(process.cwd(), `ignition/deployments/chain-${chainId}/deployed_addresses.json`);
  const deployed = JSON.parse(readFileSync(deployedPath, "utf8"));

  // Destructure the addresses from the deployment map
  const {
    ["UniV2#Factory"]: factoryAddr,
    ["UniV2#Router02"]: routerAddr,
    ["UniV2#WETH9"]:   wethAddr,
    ["UniV2#DAI"]:     daiAddr,
    ["UniV2#USDC"]:    usdcAddr,
  } = deployed;

  // Load Factory ABI from the abi export (array form)
  const factoryAbiPath = path.join(process.cwd(), "export", "abi", "UniswapV2Factory.json");
  const FactoryAbi = JSON.parse(readFileSync(factoryAbiPath, "utf8"));

  // Read pair addresses from chain
  const factory = new ethers.Contract(factoryAddr, FactoryAbi, ethers.provider);
  console.log(wethAddr)
  console.log(usdcAddr)
  console.log(daiAddr)
  const pairWethUsdc = await factory.getPair(wethAddr, usdcAddr);
  const pairWethDai  = await factory.getPair(wethAddr, daiAddr);
  const pairUsdcDai  = await factory.getPair(usdcAddr, daiAddr);

  // Build output for the frontend artifacts package
  const out = {
    [chainId]: {
      UniswapV2Factory: factoryAddr,
      UniswapV2Router02: routerAddr,
      WETH9: wethAddr,
      DAI: daiAddr,
      USDC: usdcAddr,
      WETH_USDC_Pair: pairWethUsdc,
      WETH_DAI_Pair:  pairWethDai,
      USDC_DAI_Pair: pairUsdcDai,
    },
  };

  const outDir = path.join(process.cwd(), "export", "frontend");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(outDir, `addresses.${chainId}.json`), JSON.stringify(out, null, 2));
  console.log(`Wrote export/frontend/addresses.${chainId}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
