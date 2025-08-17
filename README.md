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



## v2-core contracts

UniswapV2Factory.sol
- Implements interface IUniswapV2Factory which has createPair(), getPair(), allPairs(), setFeeTo, setFeeToSetter
 ```
 Let's dive into the most important function, comments are mine
 ```bash
     function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        //compare the addresses and ensure that only 1 pair is created for a set of 2 tokens. Example (usdc/weth) always deploys one pair
        // after this line token0 will be the smaller token and toke1 will be the bigger token
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        // to ensure that neither of the tokens is a zero address, after comparison zero address will be in token0
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); 

        // type(C) returns compile time metadta about contract UniswapV2Pair, which includes creationCode (Constructor) and runtimeCode
        // https://docs.soliditylang.org/en/latest/units-and-global-variables.html#type-information
        // get the constructor for UniswapV2Pair so that it can be deployed via create2
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        // to ensure that each pair gets a unique address
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));

        // deploy using create2
        // this is what create2 uses internally -  keccak256(0xff ++ deployingAddress ++ salt ++ keccak256(bytecode))
        // https://docs.soliditylang.org/en/latest/yul.html
        assembly {
            pair := create2(
                            0,                    // v , amount of eth sent to the new contract
                            add(bytecode, 32),    // p, bytecode has [ 32 bytes length | actual data (the code) , so adding 32 (or 0x20) to it will get us to actual deploy code
                            mload(bytecode),      // n, read the length of the bytecode
                            salt                  // s , deterministic salt
                            )
        }
        //  deployment of pair os done, initialise the pool
        // this sets token0 and token1 in the UniswapV2Pair contract
        IUniswapV2Pair(pair).initialize(token0, token1);
        // set the pair to mapping, getPair is a double keyed mapping, and we set bidirectional mapping
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
 ```

 2. UniswapV2Pair
- Holds reserves of token0 and token1
- Swaps between them (constant-product AMM with fees)
- Issues/burns LP tokens to track liquidity provider shares
- One instance per unique token pair; created by the Factory.
- createPair() method above in factory will instantiate UniswapV2Pair for every liquidity pair, the assembly code is the constructor call
- once deployed per pair, it is referenced as IUniswapV2Pair(pair)
- important function walk through

```bash
function mint(address to) external lock returns (uint liquidity) {
        // gets _reserve0, _reserve1 _blockTimestampLast once , this discards the _blockTimestampLast        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        // the stored reserves from the last _update (cached state used for pricing/TWAP).
        

        // get ERC-20 balances held by the contract
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));

        // The difference (balance - reserve) is what was newly deposited since the last sync.
        // The fresh liquidity just added of each token:
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            // MINIMUM_LIQUIDITY is burned (sent to address(0)) to pin totalSupply > 0, avoiding edge cases (price manipulation/division-by-zero at tiny supply).
           _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            // min(...) enforces the pool ratio: the side that’s short (relative to reserves) is the limiting factor; any excess on the other side doesn’t increase minted LP
            liquidity = Math.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
        }
        require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);
        // Syncs stored reserves to the actual balances and updates price accumulators (TWAP) using the elapsed time since last update.
        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0).mul(reserve1); // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amount0, amount1);
    }
```



3.UniswapV2Router02 (Main contract to interact with factory) in v2-periphery
4. UniswapV2Library.sol (in v2-periphery)
5. UniswapV2ERC20  
6. UniswapV2OracleLibrary
7. UniswapV2Migrator
