import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

export default buildModule("UniV2", (m) => {
  const deployer    = m.getAccount(0);
  const feeToSetter = m.getParameter("feeToSetter", deployer);

  const factory = m.contract("UniswapV2Factory", [feeToSetter], { id: "Factory", from: deployer });
  const weth    = m.contract("WETH9", [],  { id: "WETH9",  from: deployer });

  // add initial supplies (tweak values as you like)
  const daiInitial  = ethers.parseUnits("1000000", 18); // 1,000,000 DAI
  const usdcInitial = ethers.parseUnits("1000000", 18);  // 1,000,000 USDC

  const dai  = m.contract("MockERC20", ["DAI",  "DAI",   daiInitial,deployer],  { id: "DAI",  from: deployer });
  const usdc = m.contract("MockERC20", ["USDC", "USDC",  usdcInitial, deployer], { id: "USDC", from: deployer });

  const router = m.contract("UniswapV2Router02", [factory, weth], { id: "Router02", from: deployer });

  
  m.call(factory, "createPair", [weth, usdc], { id: "CreateWethUsdc" });
  m.call(factory, "createPair", [weth, dai], { id: "CreateWethDAI" });
  m.call(factory, "createPair", [usdc, dai], { id: "CreatehUsdcDAI" });


  return { factory, weth, dai, usdc, router };
});
