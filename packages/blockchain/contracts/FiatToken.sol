// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FiatToken
 * @dev Reusable ERC20 Stablecoin token with controlled minting, burning, and pausing features.
 */
contract FiatToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 private immutable _tokenDecimals;

    // Custom events
    event Burned(address indexed account, uint256 amount, string reason);

    /**
     * @dev Constructor to initialize token identity and initial role configurations.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address admin,
        address minter,
        address burner,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        require(admin != address(0), "FiatToken: admin is zero address");
        require(minter != address(0), "FiatToken: minter is zero address");
        require(burner != address(0), "FiatToken: burner is zero address");

        _tokenDecimals = decimals_;

        // Grant Roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(BURNER_ROLE, burner);

        // Mint initial supply to admin
        if (initialSupply > 0) {
            _mint(admin, initialSupply);
        }
    }

    /**
     * @dev Overrides decimals to support dynamic config (e.g. 6 decimals).
     */
    function decimals() public view virtual override returns (uint8) {
        return _tokenDecimals;
    }

    /**
     * @dev Allows addresses with MINTER_ROLE to mint new tokens.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Allows standard token holders to burn their own tokens.
     */
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }

    /**
     * @dev Custom burnFrom method matching INRX signature.
     * Burns tokens from msg.sender and emits Burned event with a reason string.
     */
    function burnFrom(uint256 amount, string memory reason) external returns (bool) {
        _burn(_msgSender(), amount);
        emit Burned(_msgSender(), amount, reason);
        return true;
    }

    /**
     * @dev Standard ERC20 allowance-based burnFrom.
     * Burns tokens from a specified account using spending allowance.
     */
    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }

    /**
     * @dev Allows DEFAULT_ADMIN_ROLE to pause all token transfers.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Allows DEFAULT_ADMIN_ROLE to unpause all token transfers.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Overrides internal update function to implement Pausable checking.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }
}
