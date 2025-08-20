# Uniswap V2 playground

## [Uniswap v2 deep dive](./Uniswap.md)  

This project deploys Uniswap V2 locally. I am running foundry anvil but hardhat local node can be used too.



## Compiler version and hardhat settings 
- UniV2, Univ2periphery and my Token contracts has different compiler version
- So hardhat.config.ts has settings for different versions
- Also in order to import Uni contracts, I create two sol files ImportCore.sol and ImportPeriphery.sol
- These imports have to be in different files as the compiler version is different for both


## v2-core contracts

1. UniswapV2Pair.sol (Main contract which has pairs, swap, update(TWAP) etc)
2. UniswapV2Factory.sol (Main contract which creates pairs, and setsFee)
3.UniswapV2Router02 (All najor operations are orchestrated from here, addLiquidity,removeLiquidity, swapforTokens,getAmountIn getAmountOut etc) 
4. UniswapV2Library.sol (getPairs(), hardcoded initcode as seen above, sortTokens() for deterministic ordering, getReserves etc )
5. UniswapV2ERC20.sol (ERC 20 for LP tokens, have Permit functionality)  
6. UniswapV2OracleLibrary (Helpers for TWAP calculation)
7. UniswapV2Migrator (Migaret from v1 to v2)






## A note on pairFor() method issues
- In the UniswapV2Library.sol, initcode hash is hardcoded is the pairFor method 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f
- This is the hex of the constructor code for UniswapV2Pair.sol
- My compiler could not produce the same hex as was hardcoded in Uniswap code. Not sure why. So I has to change the initcode to what my compiler was generating
- with this you will get the pair corectly
```shell
    // calculates the CREATE2 address for a pair without making any external calls
    // Create 2 formula address = keccak256(0xff + deployer + salt + bytecodeHash)[12:]
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint(keccak256(abi.encodePacked(
                hex'ff', // CREATE2 prefix
                factory, // Factory contract address
                keccak256(abi.encodePacked(token0, token1)), // Salt
                hex'e699c2c70a1e9ca16c58b40782745b5d609738b755845b6ee18a18d21352f753' // init code hash
            ))));
    }
```
where hex'e699c2c70a1e9ca16c58b40782745b5d609738b755845b6ee18a18d21352f753' is the bytecode of UniswapV2Pair.sol (the constructor part). 
This might be different if you do this in future or with different compiler settings.


- As I made changes in my Node Modules to make this work. These changes would not persist for someone who takes my code and does npm install, so I will persist these changes using patch-package
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
npx hardhat test ./test/AMM-v2.test.ts --network anvil  
```

You can report gas in test if you want
```
REPORT_GAS=true npx hardhat test ./test/AMM-v2.test.ts --network anvil  
```

If you want to use local hardhat node instead of anvil, if not SKIP
```npx hardhat node```


### Deploy to network of choice, i deploy to anvil

```npx hardhat ignition deploy ignition/modules/UniV2.ts --network anvil```


### Take the deployed contracts address for frontend
```npx hardhat run scripts/export-addresses.ts --network anvil```



