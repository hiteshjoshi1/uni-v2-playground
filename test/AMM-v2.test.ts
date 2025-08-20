
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Uniswap v2 tests", function () {


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

        // Create pairs
        const tx1 = await factory.createPair(wethAddress, usdcAddress);
        const receipt1 = await tx1.wait();

        const tx2 = await factory.createPair(usdcAddress, daiAddress);
        const receipt2 = await tx2.wait();


        // Get pair contracts address
        const wethUsdcPairAddr = await factory.getPair(wethAddress, usdcAddress);
        const usdcDaiPairAddr = await factory.getPair(usdcAddress, daiAddress);


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

        const tx9 = await usdc.transfer(user2.address, ethers.parseEther("50000"));
        await tx9.wait();

        // const tx10 = await weth.connect(user2).deposit({ value: ethers.parseEther("5") });
        // await tx10.wait();

        return { owner, user1, user2, weth, usdc, dai, wethAddress, usdcAddress, daiAddress, factory, router, wethUsdcPair, usdcDaiPair, routerAddr };
    };

    describe("Uni V2 liqudity tests", function () {
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

        // you can add liquidiy directly by calling mint, not ideal but can be done 
        it("Should add liquidity directly to usdc/eth pair", async function () {
            const {  user1, weth, usdc, wethUsdcPair } = await loadFixture(deployFixtures);

            const wethAmount = ethers.parseEther("1");
            const usdcAmount = ethers.parseEther("2000");

            // Transfer tokens directly to pair
            await weth.connect(user1).transfer(await wethUsdcPair.getAddress(), wethAmount);
            await usdc.connect(user1).transfer(await wethUsdcPair.getAddress(), usdcAmount);

            // Call mint directly
            const tx = await wethUsdcPair.connect(user1).mint(user1.address);
            await tx.wait();

            // check user's lp Balance    
            const lpBalance = await wethUsdcPair.balanceOf(user1.address);
            expect(lpBalance).to.be.gt(0);
        });


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
            // console.log("UniswapV2Pair init code hash:", initCodeHash);
            expect(initCodeHash).to.equal("0xe699c2c70a1e9ca16c58b40782745b5d609738b755845b6ee18a18d21352f753");

            const factoryAddress = await factory.getAddress();
            const [token0, token1] = wethAddress < usdcAddress ? [wethAddress, usdcAddress] : [usdcAddress, wethAddress];
            const computedPairAddress = ethers.getCreate2Address(
                factoryAddress,
                ethers.keccak256(ethers.solidityPacked(["address", "address"], [token0, token1])),
                initCodeHash
            );
            const actualPairAddress = await factory.getPair(wethAddress, usdcAddress);
            // console.log("Computed pair address:", computedPairAddress);
            // console.log("Actual pair address:", actualPairAddress);
            expect(computedPairAddress.toLowerCase()).to.equal(actualPairAddress.toLowerCase());
        });

        // this uses addLiquidityETH vs addLiquidity for usdc- dai pair
        it("Should add liquidity to WETH/USDC pair", async function () {
            const { user1, usdcAddress, weth, usdc, router, wethUsdcPair, wethAddress } = await loadFixture(deployFixtures);

            const wethAmount = ethers.parseEther("1");
            const usdcAmount = ethers.parseEther("2000");
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const deadline = BigInt(now + 60 * 60);

            // Check balances of user 1
            expect(await weth.balanceOf(user1.address)).to.be.equal(ethers.parseEther("50"));
            expect(await usdc.balanceOf(user1.address)).to.be.equal(ethers.parseEther("100000"));

            expect(await weth.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);
            expect(await usdc.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);

            // the order matters 
            const reservesInitial = await wethUsdcPair.getReserves();
            expect(reservesInitial[0]).to.be.equal(ethers.parseEther("0")); // USDC reserves
            expect(reservesInitial[1]).to.be.equal(ethers.parseEther("0"));
            try {
                const tx = await router.connect(user1).addLiquidityETH(
                    usdcAddress, // ERC20 token (USDC)
                    usdcAmount, // amountTokenDesired
                    0, // amountTokenMin (relax for testing)
                    0, // amountETHMin (relax for testing)
                    user1.address,
                    deadline,
                    { value: wethAmount, gasLimit: 5000000 }
                );// Log calldata
                await tx.wait();
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
            // as new deployment in a test could change the order of tokens
            const [r0, r1] = await wethUsdcPair.getReserves();
            const t0 = await wethUsdcPair.token0();
            expect(r0).to.equal(t0 === wethAddress ? wethAmount : usdcAmount);
            expect(r1).to.equal(t0 === wethAddress ? usdcAmount : wethAmount);

            const lpBalance = await wethUsdcPair.balanceOf(user1.address);
            expect(lpBalance).to.be.gt(0); // Received LP tokens
        });


        // should add liquidity to USDC/ DAI Pair
        it("Should add liquidity to USDC/DAI pair", async function () {
            const { user1, usdcAddress, daiAddress, usdc, dai, router, usdcDaiPair } = await loadFixture(deployFixtures);


            const usdcAmount = ethers.parseEther("2000");
            const daiAmount = ethers.parseEther("2000");
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const deadline = BigInt(now + 60 * 60);

            // Check balances of user 1
            expect(await dai.balanceOf(user1.address)).to.be.equal(ethers.parseEther("100000"));
            expect(await usdc.balanceOf(user1.address)).to.be.equal(ethers.parseEther("100000"));
            expect(await dai.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);
            expect(await usdc.allowance(user1.address, await router.getAddress())).to.be.equal(ethers.MaxUint256);

            // the order matters 
            const reservesInitial = await usdcDaiPair.getReserves();
            // both are zero, so does not matter which one is which
            expect(reservesInitial[0]).to.be.equal(ethers.parseEther("0")); 
            expect(reservesInitial[1]).to.be.equal(ethers.parseEther("0"));
            try {
                const tx = await router.connect(user1).addLiquidity(
                    usdcAddress,
                    daiAddress,
                    usdcAmount,
                    daiAmount,
                    0n,        // amountAMin
                    0n,        // amountBMin
                    user1.address,
                    deadline,
                    { gasLimit: 5000000 }
                );// Log calldata
                await tx.wait();
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
            // order could be anything in a new deployment
            const [r0, r1] = await usdcDaiPair.getReserves();
            const t0 = await usdcDaiPair.token0();
            expect(r0).to.equal(t0 === usdcAddress ? usdcAmount : daiAmount);
            expect(r1).to.equal(t0 === usdcAddress ? daiAmount : usdcAmount);
            
            const lpBalance = await usdcDaiPair.balanceOf(user1.address);
            expect(lpBalance).to.be.gt(0); // Received LP tokens
        });
    });

    describe("UNI V2 operation", function () {
        it("swap USDC/ DAI using a third user", async function () {
            const { usdc, dai, router, usdcDaiPair, user1, user2, usdcAddress,daiAddress,routerAddr } = await loadFixture(deployFixtures);

            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const deadline = BigInt(now + 60 * 60);
            
            // add liquidity USDC/DAI
            
            const usdcAmount = ethers.parseEther("20000");
            const daiAmount = ethers.parseEther("20000");

            const tx = await router.connect(user1).addLiquidity(
                usdcAddress,
                daiAddress,
                usdcAmount,
                daiAmount,
                0n,        // amountAMin
                0n,        // amountBMin
                user1.address,
                deadline,
                { gasLimit: 5000000 }
            );
            await tx.wait();

            // verify pair exists and reserves are non-zero
            expect(await usdc.balanceOf(user2.address)).to.be.equal(ethers.parseEther("50000"));
            expect(await dai.balanceOf(user2.address)).to.be.equal(ethers.parseEther("0"));


            // approve router for user2
            const amountIn = ethers.parseUnits("10000", 18);
            const tx1 = await usdc.connect(user2).approve(routerAddr, amountIn);  
            await tx1.wait();  
            
            const [r0, r1] = await usdcDaiPair.getReserves();
            expect(r0 + r1).to.be.gt(0n);

            // swap USDC -> DAI with sane slippage guard
            
            const path = [await usdc.getAddress(), await dai.getAddress()];

            // get the expected amount out from router
            // this is calculated based on xy = k
            const amountsOut = await router.getAmountsOut(amountIn, path);
            const amountOutMin = (amountsOut[1] * 99n) / 100n; // 1% slippage
            // amountOut[1] is calculated DAI balance
            const expectedOut = amountsOut[1];

            const aBefore = await usdc.balanceOf(user2.address);
            const bBefore = await dai.balanceOf(user2.address);
            

            await (await router.connect(user2).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                user2.address, 
                deadline
            )).wait();

            const aAfter = await usdc.balanceOf(user2.address);
            const bAfter = await dai.balanceOf(user2.address);
      
            expect(await usdc.balanceOf(user2.address)).to.be.equal(ethers.parseEther("40000"));
            expect(await dai.balanceOf(user2.address)).to.be.equal(expectedOut);

            expect(aAfter).to.equal(aBefore - amountIn);
            expect(bAfter).to.be.gt(bBefore);
        });

        
        it("swap USDC for weth using a third user", async function () {
            const { usdc, weth, router, wethUsdcPair, user1, user2, usdcAddress,wethAddress,routerAddr } = await loadFixture(deployFixtures);

            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const deadline = BigInt(now + 60 * 60);
            
            // add liquidity USDC/weth
            // this is the amount the user1 will add to the pool
            const usdcAmount = ethers.parseEther("44590");
            const wethAmount = ethers.parseEther("10");

            // check his overall balance
            expect(await weth.balanceOf(user1.address)).to.be.equal(ethers.parseEther("50"));
            expect(await usdc.balanceOf(user1.address)).to.be.equal(ethers.parseEther("100000"));

            

            // 1ETH = 4459, so he is adding 10 ETH and  44590 USDC
            const tx = await router.connect(user1).addLiquidityETH(
                usdcAddress, // ERC20 token (USDC)
                usdcAmount, // amountTokenDesired
                0, // amountTokenMin (relax for testing)
                0, // amountETHMin (relax for testing)
                user1.address,
                deadline,
                { value: wethAmount, gasLimit: 5000000 }
            );// Log calldata
            await tx.wait();

                

            const lpBalance = await wethUsdcPair.balanceOf(user1.address);

            const [r0, r1] = await wethUsdcPair.getReserves();
            expect(r0 + r1).to.be.gt(0n);
            const t0 = await wethUsdcPair.token0();
            expect(r0).to.equal(t0 === wethAddress ? wethAmount : usdcAmount);
            expect(r1).to.equal(t0 === wethAddress ? usdcAmount : wethAmount);

           // liquidity is added now other users can swap 
           // check existing user2 balance
           expect(await usdc.balanceOf(user2.address)).to.be.equal(ethers.parseEther("50000"));

            // approve router for user2
            const usdcAmountToSwap = ethers.parseUnits("4459", 18);
            //  give approval to router
            const tx1 = await usdc.connect(user2).approve(routerAddr, usdcAmountToSwap);  
            await tx1.wait();  
            
        
            // setup path
            // When swapping, the router (UniswapV2Router02) handles the mapping automatically based on the path array you provide 
            // (input token first, output token last).
            const path = [usdcAddress, wethAddress];

            // get the expected amount out from router
            // this is calculated based on xy = k
            const amountsOut = await router.getAmountsOut(usdcAmountToSwap, path);
            const amountOutMin = (amountsOut[1] * 99n) / 100n; // 1% slippage
            // amountOut[1] is calculated Weth balance
            const expectedOut = amountsOut[1];

            const aBefore = await usdc.balanceOf(user2.address);
            const ethBalanceInit = await ethers.provider.getBalance(user2.address);

            
            
            // we have exact tokens that we need to swap
            const tx2  = await (await router.connect(user2).swapExactTokensForETH(
                usdcAmountToSwap,
                amountOutMin,
                path,
                user2.address, 
                deadline
            ));
            await tx2.wait();


            const aAfter = await usdc.balanceOf(user2.address);
            const ethBalAfter = await ethers.provider.getBalance(user2.address);
            
            expect(await usdc.balanceOf(user2.address)).to.be.equal(ethers.parseEther("45541"));
            

            expect(aAfter).to.equal(aBefore - usdcAmountToSwap);
            expect(ethBalAfter - ethBalanceInit).to.be.greaterThanOrEqual(amountOutMin);
            
            
        });

    });

});

