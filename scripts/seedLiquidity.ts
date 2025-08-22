import { readFileSync } from "fs";
import path from "path";
import { ethers } from "hardhat";
import {
    UniswapV2Factory__factory,
    UniswapV2Router02__factory,
    MockERC20__factory,
    UniswapV2Pair__factory,
} from "../typechain-types";

type ContractAddresses = {
    UniswapV2Factory: string;
    UniswapV2Router02: string;
    WETH9: string;
    DAI: string;
    USDC: string;
    WETH_USDC_Pair?: string;
    WETH_DAI_Pair?: string;
};

function loadAddresses(chainId: number): ContractAddresses {
    const filePath = path.join(process.cwd(), `export/frontend/addresses.${chainId}.json`);
    const json = JSON.parse(readFileSync(filePath, "utf8"));
    return json[String(chainId)] as ContractAddresses;
}

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const addressList = loadAddresses(chainId);
    const [signer] = await ethers.getSigners();
    const me = await signer.getAddress();

    // Strongly typed instances (TypeChain factories)
    const factory = UniswapV2Factory__factory.connect(addressList.UniswapV2Factory, signer);
    const router = UniswapV2Router02__factory.connect(addressList.UniswapV2Router02, signer);
    const dai = MockERC20__factory.connect(addressList.DAI, signer);
    const usdc = MockERC20__factory.connect(addressList.USDC, signer);

    await (await dai.approve(addressList.UniswapV2Router02, ethers.MaxUint256)).wait();
    await (await usdc.approve(addressList.UniswapV2Router02, ethers.MaxUint256)).wait();


    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
    const seedToken = ethers.parseUnits("20000", 18); // mock DAI/USDC = 18 decimals
    const seedEth = ethers.parseEther("10");

    // WETH / DAI
    {
        const tx = await router.addLiquidityETH(
            addressList.DAI,
            seedToken,
            0n, 0n,
            me,
            deadline,
            { value: seedEth }
        );
        await tx.wait();
        console.log("Seeded WETH/DAI");
    }

    // WETH / USDC
    {
        const tx = await router.addLiquidityETH(
            addressList.USDC,
            seedToken,
            0n, 0n,
            me,
            deadline,
            { value: seedEth }
        );
        await tx.wait();
        console.log("Seeded WETH/USDC");
    }

    {
        const tx = await router.addLiquidity(
            addressList.DAI,
            addressList.USDC,
            seedToken, // amountADesired
            seedToken, // amountBDesired
            0n, 0n,    // mins (relaxed for dev)
            me,
            deadline
        );
        await tx.wait();
        console.log("Seeded DAI/USDC");
    }

    // Optional: log pair addresses
    const pairWethDai = await factory.getPair(addressList.WETH9, addressList.DAI);
    const pairWethUsdc = await factory.getPair(addressList.WETH9, addressList.USDC);
    const pairDaiUsdc = await factory.getPair(addressList.DAI, addressList.USDC);
    console.log("Pairs → WETH/DAI:", pairWethDai, " WETH/USDC:", pairWethUsdc, " DAI/USDC:", pairDaiUsdc);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
