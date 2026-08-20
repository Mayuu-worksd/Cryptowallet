// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title TokenFactory
 * @dev Reusable factory contract to deploy upgradeable ERC-1967 proxies pointing to a shared FiatToken implementation.
 */
contract TokenFactory is Ownable {
    address public implementation;

    // Array to store all deployed token addresses
    address[] public deployedTokens;

    // Mapping from token symbol (e.g. "THB") to its deployed contract address
    mapping(string => address) public tokensBySymbol;

    // Events
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint8 decimals,
        address admin
    );
    event ImplementationUpdated(address indexed oldImplementation, address indexed newImplementation);

    /**
     * @dev Constructor passes the initial owner to the Ownable constructor and stores the implementation contract.
     */
    constructor(address initialOwner, address initialImplementation) Ownable(initialOwner) {
        require(initialOwner != address(0), "TokenFactory: initial owner is zero address");
        require(initialImplementation != address(0), "TokenFactory: implementation is zero address");
        implementation = initialImplementation;
    }

    /**
     * @dev Allows the owner to update the shared token implementation.
     */
    function setImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "TokenFactory: implementation is zero address");
        address old = implementation;
        implementation = newImplementation;
        emit ImplementationUpdated(old, newImplementation);
    }

    /**
     * @dev Deploys a new currency proxy with default admin, minter, and burner roles set to msg.sender.
     */
    function createCurrency(
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlyOwner returns (address) {
        return _createProxyToken(name, symbol, decimals, msg.sender, msg.sender, msg.sender, 0);
    }

    /**
     * @dev Deploys a new FiatToken proxy. Only callable by the factory owner.
     * Backward-compatible with the PoC signature.
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address admin,
        address minter,
        address burner,
        uint256 initialSupply
    ) external onlyOwner returns (address) {
        return _createProxyToken(name, symbol, decimals, admin, minter, burner, initialSupply);
    }

    /**
     * @dev Internal helper to deploy and initialize the proxy.
     */
    function _createProxyToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address admin,
        address minter,
        address burner,
        uint256 initialSupply
    ) private returns (address) {
        require(bytes(name).length > 0, "TokenFactory: empty name");
        require(bytes(symbol).length > 0, "TokenFactory: empty symbol");
        require(tokensBySymbol[symbol] == address(0), "TokenFactory: token symbol already deployed");
        require(admin != address(0), "TokenFactory: admin is zero address");
        require(minter != address(0), "TokenFactory: minter is zero address");
        require(burner != address(0), "TokenFactory: burner is zero address");

        // Encode initialization data for FiatTokenUpgradeable
        bytes memory initData = abi.encodeWithSignature(
            "initialize(string,string,uint8,address,address,address,uint256)",
            name,
            symbol,
            decimals,
            admin,
            minter,
            burner,
            initialSupply
        );

        // Deploy ERC-1967 Proxy pointing to the implementation contract
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        address tokenAddr = address(proxy);

        // Register in state
        deployedTokens.push(tokenAddr);
        tokensBySymbol[symbol] = tokenAddr;

        // Emit creation event
        emit TokenCreated(tokenAddr, name, symbol, decimals, admin);

        return tokenAddr;
    }

    /**
     * @dev Returns the total number of deployed tokens.
     */
    function getDeployedTokensCount() external view returns (uint256) {
        return deployedTokens.length;
    }
}
