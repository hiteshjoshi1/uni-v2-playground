// scripts/export-addresses.ts
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { network } from "hardhat";

async function main() {
    const chainId = parseInt(await network.provider.send("eth_chainId"), 16);
    const p = path.join(process.cwd(), `ignition/deployments/chain-${chainId}/deployed_addresses.json`);
    const deployed = JSON.parse(readFileSync(p, "utf8"));

    const out = {
        [chainId]: {
            UniswapV2Factory: deployed["UniV2#Factory"],
            UniswapV2Router02: deployed["UniV2#Router02"],
            WETH9: deployed["UniV2#WETH9"],
            DAI: deployed["UniV2#DAI"],
            USDC: deployed["UniV2#USDC"]
        }
    };

    const outDir = path.join(process.cwd(), "export", "frontend");
    mkdirSync(outDir, { recursive: true }); // creates only if missing

    //out → object to convert to JSON string.
    //null → no custom replacer (include all properties).
    //2 → pretty-print with 2-space indentation (human-readable).
    writeFileSync(path.join(outDir, `addresses.${chainId}.json`), JSON.stringify(out, null, 2));
    console.log("Wrote export/frontend/addresses.%d.json", chainId);
}
main();
