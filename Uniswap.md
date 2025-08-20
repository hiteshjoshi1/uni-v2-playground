# Core Idea of Uniswap V2 - constant product AMM
Uniswap V2 is a decentralized exchange protocol that implements an automated market maker (AMM) model using a constant product market maker (CPMM) formula. The fundamental idea is to create permissionless, decentralized liquidity pools for token pairs (e.g., ETH/USDC) where anyone can provide liquidity or trade without relying on traditional order books or centralized intermediaries. Instead of matching buyers and sellers, the pool uses a mathematical invariant to determine prices and execute trades automatically.
The key invariant is x * y = k, where:

x is the reserve of token0 (one asset in the pair).
y is the reserve of token1 (the other asset).
k is a constant that remains unchanged during trades (but increases when liquidity is added and decreases when removed).

This formula ensures that trades adjust the reserves proportionally, causing the price (the ratio of reserves) to change dynamically based on supply and demand. For example:

If someone buys token0 (removing some token0, adding token1), the price of token0 increases because its reserve decreases relative to token1.
Arbitrageurs can then trade against external market prices to "rebalance" the pool, ensuring the internal price reflects real-world values.

## Swap and math intuition

1. xy = k, This invariant is maintained
2. Example, token0 = 1 and token1 = 1000
Effectively, the liquidity provider is saying 1 token0 = 1000 token1
so x = 1, y 1000 and k = 1000

### Swap 0.5 token0 in for token1 
3. Now let's say a user wants to Swap 0.5 token0 in for token1
Effective balance to swap = 0.5 * 0.997 ≈ 0.4985 (0.3% goes to fees)
Now, we need to figure out how much 0.4985 token0 is equal to in token1 and return that to user

4. This is "constant product" AMM, it maintains the product invariant, so

```(x + Δx) * (y - Δy) = k```

we want Δy, so

``` Δy = y - (k / (x + Δx))```

  = 1000 - (1000/ (1+ 0.4985)
  = 332.67 
This is what the user will get 332.67 token1 for his 0.5 token0.
New reserves: ~1.5 token0 AND  ~667.33 token1 (k≈1000.5).
5. This means that after the swap, in the pool
1.5 token0 = 667.33 token1
or 1 token0 = 667.33/1.5 = 444.89 token1

So the price in the pool changed from 1 token0 = 1000 token1 to 1 token0 = 444.89 token1

### Swap 500 token1 in for token0 

Effective balance to be swapped = 500*0.997 = 498.5

new reserve1 = 1000+498.5

```(x - Δx) * (y + Δy) = k```
Solving for 
```Δx = x - (k/(y + Δy))```
       = 1 - (1000/ 1000+498.5) = 0.333 of token0

User gets 0.333 of token0 

Pool has New reserves: ~0.667 token0, ~1500 token1 (k≈1000.5)

So now 0.6667 token0  = 1500 token1

or 1 token0 = 1500/0.667 = 2248.88 token1

Notice that the new price has nothing to do with price discovery, pool is just maintaining the invariant, price discovery is left to arbitrageurs.


## UniswapV2Pair.sol - main contract that implements a V2 Pair
- Holds reserves of token0 and token1
- Swaps between them (constant-product AMM with fees)
- Issues/burns LP tokens to track liquidity provider shares
- One instance per unique token pair; created by the Factory. 
- Factory's createPair() method above in factory will instantiate UniswapV2Pair for every liquidity pair, the assembly code is the constructor call
- once deployed per pair, it is referenced as IUniswapV2Pair(pair)


Let's take a look at a few methods of this contract

### Swap function
```solidity
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;
        // Stack Too Deep Error: Solidity has a limit of ~16 local variables per function. These scoping blocks allow variable reuse by limiting variable lifetime.

        { // scope for _token{0,1}, avoids stack too deep errors
        address _token0 = token0;
        address _token1 = token1;
        require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');

        // sends payments first, verify payments later, this enables flashloans functionality
        if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
        if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens

        // if we passed in calldata, take the to address and call its fallback function
        if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
        // check the token balance of the Pair contract
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        }
        // check what came in for token0 and toke1
        // amount0In = balance0 - (reserve0 - amount0Out) if balance0> _reserve0 - amount0Out  else 0
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        // one of them should have amount>0, token balance increased
        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');

        {// checks pool invariant xy = k such that x' y' = k' and k '>= k (require check)

        uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
        uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
        require(balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(1000**2), 'UniswapV2: K');
        }
        //update the TWAP prices
         _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
```
### How Swap works
1. Initial state of the pool
100 ETH, 200k USDC reserves
2. User wants to swap 1 ETH to USDC 
 
 3. Calculate output USDC amount that the user would get
 Δy = y - (k / (x + Δx))
amount1Out =  200 000 -  200 000 00 / (100+ .997) = 1974.32 USDC
Thus amount1Out  =  Δy =  1974.32 USDC

4. Pool optimistically sends the value to the user
if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out);

5. User has sent the payment to the contract, that is 1ETH

6. Get New Balances for the token pair

balance0 = IERC20(_token0).balanceOf(address(this)); // = 101 ETH
balance1 = IERC20(_token1).balanceOf(address(this)); // = 198025.68 USDC

7. Calculate how much amount was sent
uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;

balance0 = 101 ETH
_reserve0 - amount0Out = 100 - 0 = 100
therefore, balance0 > _reserve0 - amount0Out, 

<b>so, amount0In = 101-100 = 1 ETH</b>


balance1 = 198025.68 USDC
_reserve1 - amount1Out = 200,000 - 1,974.32 = 198025.68
balance1 > 198025.68? NO (they're equal)
<b>amount1In = 0 </b>

8. calculate new balances
  balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
  balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));


balance0adjusted = 101 - 0.003 = 100.997 ETH 
balance1Adjusted = 198,025.68 - 0  = 198,025.68 USDC 
New K = 100.997 × 198025.68 = ~20,0000 (Loop invariant holds)


### Arbitrage: Flash Loans with swap

1. World State
- Uniswap: 1 ETH = 2,000 USDC
- Sushiswap: 1 ETH = 2,050 USDC (50 USDC higher!)
- You have: 0 ETH, 0 USDC (broke but smart)

2. You Flash borrow 1 ETH from Uniswap
pair.swap(1e18, 0, address(this), "arbitrage");

3. Pool sends you: 1 ETH
You owe: ~2,006 USDC (2,000 + 0.3% fee)

4. As the swap allows calling your fallback, you can arb your heart out
```solidity
contract FlashArbitrage {
    function executeArbitrage() external {
        // Flash swap 1 ETH from Uniswap
        IUniswapV2Pair(uniswapPair).swap(1e18, 0, address(this), "arb");
    }
    
    function uniswapV2Call(address, uint amount0, uint, bytes calldata) external {
        // 1. Received 1 ETH from Uniswap
        
        // 2. Sell on Sushiswap at higher price
        IERC20(WETH).transfer(address(sushiRouter), amount0);
        sushiRouter.swapExactTokensForTokens(amount0, 0, ethToUsdcPath, address(this));
        
        // 3. Calculate repayment (with 0.3% fee)
        uint repayAmount = (amount0 * 1000) / 997 + 1; // Round up
        
        // 4. Swap just enough USDC back to ETH for repayment
        uniRouter.swapTokensForExactTokens(repayAmount, type(uint).max, usdcToEthPath, address(this));
        
        // 5. Repay the flash loan
        IERC20(WETH).transfer(msg.sender, repayAmount);
        
        // 6. Keep remaining USDC as profit! 🎉
    }
}
```

Other use cases
1. Liquidate undercollateralized loan on Aave
2. Arbitrage using Flash Loan



## Update function
The update method is the one which maintains the TWAP oracle by tracking the time weighted average price in price0CumulativeLast, price1CumulativeLast and forms the basis of Uniswap oracle

```solidity
/*
balance0 and balance1 are the ERC20 token balance of token0 and token1 held by this contract
reserve0 and eserve1 are the reserve variables maintained by UniswapV2Pair contract
*/
    function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
        // check the balances are less than the max value that uint112 can attain. uint112(-1) = 2^112 -1
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'UniswapV2: OVERFLOW');

        // Line 2: Get current block timestamp, modulo 2^32 
        // why uin32 instead of uint256, block.timestamp is a uint256
        // uint32  is more gas efficient, we are interested in timeElapsed which will be seconds or minutes, no need to use a bigger data type
        // uint32 can represent upto 136 years ((2^32 seconds) more than enough for what we need
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired

        //  if time passed and reserves were non zero, accumulate prices
        // for first time liquidity addition, reserves would be 0, so this block wont run
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // * never overflows, and + overflow is desired

            price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }
        // first time, just set reserves to balances, and blockTimestampLast value
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

```


### mint function
```solidity
function mint(address to) external lock returns (uint liquidity) {
        // gets _reserve0, _reserve1 _blockTimestampLast once , this discards the _blockTimestampLast        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        // the stored reserves from the last _update (cached state used for pricing/TWAP).
        

        // get ERC-20 balances held by the contract
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));

        // amount0 and amount1 are the fresh liquidity added for each token pair
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
   
// a note on the lock modifier
```solidity
    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'UniswapV2: LOCKED');  // 1. Check if unlocked
        unlocked = 0;                                  // 2. Lock it
    _;                                            // 3. Execute function
        unlocked = 1;                                 // 4. Unlock when done
    }

```




## UniswapV2Factory.sol : instantiates and interacts with UniswapV2Pair.sol

- Implements interface IUniswapV2Factory which has createPair(), getPair(), allPairs(), setFeeTo, setFeeToSetter
 
 This is how a pair is created, These are all helper methods to instantiate and work with pair contract

 ```solidity
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

# Time weighted Average price intuition

Attack scenario:

1. Flash loan 1M tokens
2. Dump into pool → price crashes
3. Oracle reads crashed price
4. Use crashed price to liquidate positions
5. Profit from manipulation

Solution is Time weighted average price - which is difficult to manipulate 

uint avgPrice = (price1*time1 + price2*time2 + ...) / totalTime
<b>Why time weighting works:</b>

- Expensive to manipulate: Must maintain fake price for extended periods
- Cost increases with time: Longer manipulation = more capital locked
- Natural reversion: Arbitrageurs restore fair prices quickly


## UniswapV2OracleLibrary.sol
- Helper to get Oracle prices
```solidity
    function currentCumulativePrices(
        address pair
    ) internal view returns (uint price0Cumulative, uint price1Cumulative, uint32 blockTimestamp) {
        // get timestanp in unit32
        blockTimestamp = currentBlockTimestamp();
        // get prices stored in  the pair
        price0Cumulative = IUniswapV2Pair(pair).price0CumulativeLast();
        price1Cumulative = IUniswapV2Pair(pair).price1CumulativeLast();
        
        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = IUniswapV2Pair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // subtraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            // addition overflow is desired
            // counterfactual
            // accumulate the price (price *time) for the time spent since last accumulation. The proice might not change but time has passed

            price0Cumulative += uint(FixedPoint.fraction(reserve1, reserve0)._x) * timeElapsed;
            // counterfactual
            price1Cumulative += uint(FixedPoint.fraction(reserve0, reserve1)._x) * timeElapsed;
        }
    }
}
```


