// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock Tether", "USDT") {
        _mint(msg.sender, 1000000000 * 10**6); // 1 Billion USDT with 6 decimals
    }
    
    function decimals() public view override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
