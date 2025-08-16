// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initial, address _to) {
        name = _name; symbol = _symbol; _mint(_to, _initial);
    }
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
    }
    function transfer(address to, uint256 value) external returns (bool) { _transfer(msg.sender, to, value); return true; }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender]; require(a >= value, "ALLOWANCE");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value; _transfer(from, to, value); return true;
    }
    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "BALANCE"); unchecked { balanceOf[from] -= value; balanceOf[to] += value; } emit Transfer(from, to, value);
    }
    function _mint(address to, uint256 value) internal { totalSupply += value; balanceOf[to] += value; emit Transfer(address(0), to, value); }
}