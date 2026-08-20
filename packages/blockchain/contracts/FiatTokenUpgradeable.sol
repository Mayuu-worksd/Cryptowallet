// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title FiatTokenUpgradeable
 * @dev Reusable upgradeable ERC20 Stablecoin token with controlled minting, burning, and pausing features.
 * Integrates UUPS Upgradeable proxy pattern.
 */
contract FiatTokenUpgradeable is Initializable, ERC20Upgradeable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 private _tokenDecimals;

    // Custom events
    event Burned(address indexed account, uint256 amount, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializer to replace constructor in proxy patterns.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin,
        address minter,
        address burner,
        uint256 initialSupply
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __AccessControl_init();
        __Pausable_init();

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
     * @dev Custom burnFrom method matching PoC/INRX signature.
     * Burns tokens from msg.sender and emits Burned event with a reason string.
     */
    function burnFrom(uint256 amount, string memory reason) external returns (bool) {
        _burn(_msgSender(), amount);
        emit Burned(_msgSender(), amount, reason);
        return true;
    }

    /**
     * @dev Controlled burnFrom method.
     * If the caller has BURNER_ROLE, it burns without checking/spending allowance.
     * Otherwise, it spends the allowance of the account owner first.
     */
    function burnFrom(address account, uint256 amount) external virtual {
        if (!hasRole(BURNER_ROLE, _msgSender())) {
            _spendAllowance(account, _msgSender(), amount);
        }
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

    /**
     * @dev Authorized upgrade function to satisfy UUPSUpgradeable.
     * Restricts upgrade permissions to accounts holding DEFAULT_ADMIN_ROLE.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
