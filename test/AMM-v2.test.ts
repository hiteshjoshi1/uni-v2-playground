
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractTransactionResponse, Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Uniswao v2 tests", function () {


    async function deployFixtures() {

        // Contracts are deployed using the first signer/account by default
        const [owner, user1, user2] = await ethers.getSigners();

        //deplot Weth9
        const WETH9 = await ethers.getContractFactory("WETH9");
        const weth = await WETH9.deploy();
        await weth.waitForDeployment();


        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("Mock USDC", "USDC", ethers.parseUnits("1000000", 18), owner.address);
        await usdc.waitForDeployment();

        const dai = await MockERC20.deploy(" MockDAI", "DAI", ethers.parseUnits("1000000", 18), owner.address);
        await dai.waitForDeployment();


        const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
        const factory = await UniswapV2Factory.deploy(owner.address);
        await factory.waitForDeployment();

        const wethAddress = await weth.getAddress();
        const usdcAddress = await usdc.getAddress();
        const daiAddress = await dai.getAddress();

        const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
        const router = await UniswapV2Router02.deploy(await factory.getAddress(), wethAddress);
        await router.waitForDeployment();

        // console.log("owner", owner.address);
        // console.log("Weth : ", wethAddress);
        // console.log("dai : ", daiAddress);
        // console.log("usdc", usdcAddress);
        // console.log("Uniswap factory address", await factory.getAddress());
        // console.log("Uniswap router address", await router.getAddress());

        // Create pairs
        const tx1 = await factory.createPair(wethAddress, usdcAddress);
        const receipt1 = await tx1.wait();

        const tx2 = await factory.createPair(usdcAddress, daiAddress);
        const receipt2 = await tx2.wait();


        // Get pair contracts address
        const wethUsdcPairAddr = await factory.getPair(wethAddress, usdcAddress);
        const usdcDaiPairAddr = await factory.getPair(usdcAddress, daiAddress);
        // console.log("wethUsdcPairAddr", wethUsdcPairAddr);
        // console.log("usdcDaiPairAddr", usdcDaiPairAddr);

        // Get Pair contract Instance
        const wethUsdcPair = await ethers.getContractAt("UniswapV2Pair", wethUsdcPairAddr);
        const usdcDaiPair = await ethers.getContractAt("UniswapV2Pair", usdcDaiPairAddr);


        // Setup for user1
        // deposit 10 eth to get 10 weth
        const tx3 = await weth.connect(user1).deposit({ value: ethers.parseEther("50") });
        await tx3.wait();
        // console.log("user1 WETH balance  in fixture:", ethers.formatEther(await weth.balanceOf(user1.address)));
        // owner is sending initial tokens   
        const tx4 = await usdc.transfer(user1.address, ethers.parseEther("100000"));
        const rec = await tx4.wait();
        // console.log("user1 USDC balance in fixture:", ethers.formatEther(await usdc.balanceOf(user1.address)));

        const tx5 = await dai.transfer(user1.address, ethers.parseEther("100000"));
        await tx5.wait();

        const routerAddr = await router.getAddress();
        // Approve router
        const tx6 = await weth.connect(user1).approve(routerAddr, ethers.MaxUint256);
        await tx6.wait();

        const tx7 = await usdc.connect(user1).approve(routerAddr, ethers.MaxUint256);
        await tx7.wait();

        const tx8 = await dai.connect(user1).approve(routerAddr, ethers.MaxUint256);
        await tx8.wait();



        return { owner, user1, user2, weth, usdc, dai, wethAddress, usdcAddress, daiAddress, factory, router, wethUsdcPair, usdcDaiPair };
    };

    describe("Uni V2 Integration", function () {
        it("Should deploy all contracts", async function () {
            const { owner, weth, usdc, dai, factory, router } = await loadFixture(deployFixtures);
            expect(await weth.symbol()).to.equal("WETH");
            expect(await usdc.symbol()).to.equal("USDC");
            expect(await dai.symbol()).to.equal("DAI");
            expect(await factory.feeToSetter()).to.equal(owner.address);
            expect(await router.factory()).to.equal(await factory.getAddress());
            expect(await router.WETH()).to.equal(await weth.getAddress());
        });

        it("Should create pairs", async function () {
            const { owner, wethAddress, usdcAddress, daiAddress, factory, router } = await loadFixture(deployFixtures);
            expect(await factory.getPair(wethAddress, usdcAddress)).to.not.equal(ethers.ZeroAddress);
            expect(await factory.getPair(usdcAddress, daiAddress)).to.not.equal(ethers.ZeroAddress);
        });

        // it("Should add liquidity directly to pair", async function () {
        //     const { owner, user1, wethAddress, usdcAddress, weth, usdc, wethUsdcPair } = await loadFixture(deployFixtures);

        //     const wethAmount = ethers.parseEther("1");
        //     const usdcAmount = ethers.parseEther("2000");

        //     // Transfer tokens directly to pair
        //     await weth.connect(user1).transfer(await wethUsdcPair.getAddress(), wethAmount);
        //     await usdc.connect(user1).transfer(await wethUsdcPair.getAddress(), usdcAmount);

        //     // Call mint directly
        //     const tx = await wethUsdcPair.connect(user1).mint(user1.address);
        //     await tx.wait();

        //     console.log("Direct pair mint successful");
        //     const lpBalance = await wethUsdcPair.balanceOf(user1.address);
        //     expect(lpBalance).to.be.gt(0);
        // });

        // user 1 is adding liquidity to the pool

   
        it("Should verify UniswapV2Pair init code hash", async function () {
            const { factory, wethAddress, usdcAddress } = await loadFixture(deployFixtures);
            const UniswapV2Pair = await ethers.getContractFactory("@uniswap/v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair");
            let bytecode = UniswapV2Pair.bytecode;
            // Strip CBOR metadata (e.g., 0xa264...)
            const cborStart = bytecode.indexOf("a264");
            if (cborStart !== -1) {
              bytecode = bytecode.slice(0, cborStart);
            }
            const initCodeHash = ethers.keccak256(bytecode);
            console.log("UniswapV2Pair init code hash:", initCodeHash);
            expect(initCodeHash).to.equal("0xe699c2c70a1e9ca16c58b40782745b5d609738b755845b6ee18a18d21352f753");
      
            const factoryAddress = await factory.getAddress();
            const [token0, token1] = wethAddress < usdcAddress ? [wethAddress, usdcAddress] : [usdcAddress, wethAddress];
            const computedPairAddress = ethers.getCreate2Address(
              factoryAddress,
              ethers.keccak256(ethers.solidityPacked(["address", "address"], [token0, token1])),
              initCodeHash
            );
            const actualPairAddress = await factory.getPair(wethAddress, usdcAddress);
            console.log("Computed pair address:", computedPairAddress);
            console.log("Actual pair address:", actualPairAddress);
            expect(computedPairAddress.toLowerCase()).to.equal(actualPairAddress.toLowerCase());
          });


          it("Should add liquidity to WETH/USDC pair", async function () {
            const { owner, user1, wethAddress, usdcAddress, weth, usdc, factory, router, wethUsdcPair } = await loadFixture(deployFixtures);
          
            const wethAmount = ethers.parseEther("1");
            const usdcAmount = ethers.parseEther("2000");
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const deadline = BigInt(now + 60 * 60);
          
            // Verify balances and allowances
            expect(await weth.balanceOf(user1.address)).to.be.equal(ethers.parseEther("50")); // Note: 50, not 49, since no direct mint yet
            expect(await usdc.balanceOf(user1.address)).to.be.equal(ethers.parseEther("100000"));
            expect(await weth.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);
            expect(await usdc.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);
          
            // Debug info
            console.log("=== DEBUG INFO ===");
            console.log("WETH address:", wethAddress);
            console.log("USDC address:", usdcAddress);
            console.log("Pair address:", await factory.getPair(wethAddress, usdcAddress));
            const pairAddr = await factory.getPair(wethAddress, usdcAddress);
            const pairCode = await ethers.provider.getCode(pairAddr);
            console.log("Pair has code:", pairCode !== "0x");
            console.log("Pair code length:", pairCode.length);
          
            const pairContract = await ethers.getContractAt("UniswapV2Pair", pairAddr);
            try {
              const token0 = await pairContract.token0();
              const token1 = await pairContract.token1();
              console.log("Pair token0:", token0);
              console.log("Pair token1:", token1);
            } catch (e: any) {
              console.log("Failed to get pair tokens:", e.message);
            }
            console.log("Router factory:", await router.factory());
            console.log("Factory address:", await factory.getAddress());
            console.log("Router WETH:", await router.WETH());
            console.log("WETH address:", wethAddress);
            console.log("Router WETH === our WETH:", (await router.WETH()) === wethAddress);
            console.log("ETH balance:", ethers.formatEther(await ethers.provider.getBalance(user1.address)));
            console.log("=================");
          
            // Attempt addLiquidityETH
            try {
              const tx = await router.connect(user1).addLiquidityETH(
                usdcAddress, // ERC20 token (USDC)
                usdcAmount, // amountTokenDesired
                0, // amountTokenMin (relax for testing)
                0, // amountETHMin (relax for testing)
                user1.address,
                deadline,
                { value: wethAmount, gasLimit: 5000000 }
              );
              console.log("Transaction data:", tx.data); // Log calldata
              await tx.wait();
              console.log("addLiquidityETH successful");
            } catch (error: any) {
              console.log("Error code:", error.code);
              console.log("Error message:", error.message);
              console.log("Error data:", error.data);
              if (error.transaction) {
                console.log("Failed transaction:", error.transaction);
              }
              if (error.data && error.data.startsWith("0x08c379a0")) {
                const reason = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + error.data.slice(10));
                console.log("Decoded revert reason:", reason[0]);
              } else if (error.data) {
                console.log("Raw error data:", error.data);
              }
              throw error;
            }
          
            const reserves = await wethUsdcPair.getReserves();
            console.log("Reserves:", reserves);
            expect(reserves[0]).to.be.gt(0); // USDC reserves
            expect(reserves[1]).to.be.gt(0); // WETH reserves
          
            const lpBalance = await wethUsdcPair.balanceOf(user1.address);
            expect(lpBalance).to.be.gt(0); // Received LP tokens
          });   
  

        




        //     it("swap tokens test", async function () {
        //         const { owner, weth, usdc, dai, factory, router } = await loadFixture(deployFixtures);

        //         // approvals
        //         await (await usdc.approve(await router.getAddress(), ethers.MaxUint256)).wait();
        //         await (await dai.approve(await router.getAddress(), ethers.MaxUint256)).wait();

        //         // add liquidity USDC/DAI
        //         const usdcAmt = ethers.parseUnits("10000", 18);
        //         const daiAmt = ethers.parseUnits("10000", 18);

        //         const now = (await ethers.provider.getBlock("latest"))!.timestamp;
        //         const deadline = BigInt(now + 60 * 60);

        //         await (await router.connect(owner).addLiquidity(
        //             await usdc.getAddress(),
        //             await dai.getAddress(),
        //             usdcAmt,
        //             daiAmt,
        //             0n,        // amountAMin
        //             0n,        // amountBMin
        //             owner.address,
        //             deadline
        //         )).wait();

        //         // verify pair exists and reserves are non-zero
        //         const usdcDaiPairAddr = await factory.getPair(await usdc.getAddress(), await dai.getAddress());
        //         expect(usdcDaiPairAddr).to.not.equal(ethers.ZeroAddress);
        //         const usdcDaiPair = await ethers.getContractAt("UniswapV2Pair", usdcDaiPairAddr);
        //         const [r0, r1] = await usdcDaiPair.getReserves();
        //         expect(r0 + r1).to.be.gt(0n);

        //         // swap USDC -> DAI with sane slippage guard
        //         const amountIn = ethers.parseUnits("100", 18);
        //         const path = [await usdc.getAddress(), await dai.getAddress()];

        //         // optional: use router quote for min-out
        //         const amountsOut = await router.getAmountsOut(amountIn, path);
        //         const amountOutMin = (amountsOut[1] * 99n) / 100n; // 1% slippage

        //         const aBefore = await usdc.balanceOf(owner.address);
        //         const bBefore = await dai.balanceOf(owner.address);

        //         await (await router.swapExactTokensForTokens(
        //             amountIn,
        //             amountOutMin,
        //             path,
        //             owner.address, // <-- use address, not Signer
        //             deadline
        //         )).wait();

        //         const aAfter = await usdc.balanceOf(owner.address);
        //         const bAfter = await dai.balanceOf(owner.address);

        //         expect(aAfter).to.equal(aBefore - amountIn);
        //         expect(bAfter).to.be.gt(bBefore);
        //     });


    });

});

