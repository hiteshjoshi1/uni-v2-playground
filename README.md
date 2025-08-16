# Uniswap V2 playground

This project deploys Uniswap V2 on a test node. I am runnig foundry anvil but hardhat local node can be used too.


## Compiler version and hardhat settings 
- UniV2, Univ2periphery and my Token contracts has different compiler version
- So hardhat.config.ts has settings for different versions
- Also in order to import Uni contracts, I create two sol files ImportCore.sol and ImportPeriphery.sol
- These imports have to be in different files as the compiler version is different for both



## Adding Liquidity in Uni v2
In the UniswapV2Library.sol, initcode hash is hardcoded to 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f
I could not get my code to reproduce the same code hash as the original V2.
So I changed the initcode to what my code was generating
TODO - add more details about initcode, why Uniswap code was written this way
```shell
    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint(keccak256(abi.encodePacked(
                hex'ff',
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex'e699c2c70a1e9ca16c58b40782745b5d609738b755845b6ee18a18d21352f753' // init code hash
            ))));
    }
```
These changes would not persist for someone who takes my code and does npm install, so I will persist these changes using patch-package
```shell
npm i -D patch-package
npx patch-package @uniswap/v2-periphery
```

### Compiling the contracts which also generates typings
```shell
## clean artifacts, not needed everytime
rm -rf cache artifacts typechain typechain-types
## clean and compile, needed only if you added new contracts, probablu can just compile without cleaning
npx hardhat clean && npx hardhat compile    
```

### Running tests
```shell
npx hardhat test ./test/AMM-v2.test.ts   
```


Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
