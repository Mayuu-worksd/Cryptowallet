// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IFiatToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title MultiCurrencyBridge
 * @dev Secure cross-chain bridge for upgradeable multi-currency stablecoins using lock-and-burn / mint-and-release mechanisms.
 */
contract MultiCurrencyBridge is AccessControl, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Maps token ID (keccak256 of currency symbol) to its local proxy address
    mapping(bytes32 => address) public supportedTokens;

    // Track processed transaction hashes to prevent replay attacks across chains
    mapping(bytes32 => bool) public processedTransactions;

    // Track user lock nonces to prevent double lock submissions
    mapping(address => mapping(uint256 => bool)) public userNonces;

    // Events
    event TokensLocked(
        bytes32 indexed tokenId,
        address indexed token,
        address indexed sender,
        address recipient,
        uint256 amount,
        uint256 destChainId,
        uint256 nonce,
        uint256 deadline
    );

    event TokensReleased(
        bytes32 indexed tokenId,
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChainId,
        uint256 nonce
    );

    event TokenSupportedAdded(bytes32 indexed tokenId, address indexed token);
    event TokenSupportedRemoved(bytes32 indexed tokenId);

    constructor(address admin) {
        require(admin != address(0), "Bridge: admin is zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function addSupportedToken(bytes32 tokenId, address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Bridge: token is zero address");
        supportedTokens[tokenId] = token;
        emit TokenSupportedAdded(tokenId, token);
    }

    function removeSupportedToken(bytes32 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(supportedTokens[tokenId] != address(0), "Bridge: token not supported");
        supportedTokens[tokenId] = address(0);
        emit TokenSupportedRemoved(tokenId);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Lock tokens on the source chain (burns them) and prepares cross-chain transfer.
     */
    function lock(
        bytes32 tokenId,
        uint256 amount,
        uint256 destChainId,
        address recipient,
        uint256 nonce,
        uint256 deadline
    ) external whenNotPaused returns (bool) {
        require(destChainId != block.chainid, "Bridge: dest chain must be different");
        require(recipient != address(0), "Bridge: recipient is zero address");
        require(amount > 0, "Bridge: amount must be greater than zero");
        require(block.timestamp <= deadline, "Bridge: transaction expired");

        address token = supportedTokens[tokenId];
        require(token != address(0), "Bridge: token not supported");

        require(!userNonces[msg.sender][nonce], "Bridge: nonce already used");
        userNonces[msg.sender][nonce] = true;

        // Burn user's tokens (requires user to approve this bridge first)
        IFiatToken(token).burnFrom(msg.sender, amount);

        emit TokensLocked(
            tokenId,
            token,
            msg.sender,
            recipient,
            amount,
            destChainId,
            nonce,
            deadline
        );

        return true;
    }

    /**
     * @dev Release tokens on the destination chain (mints them) based on relayer signature.
     */
    function release(
        bytes32 tokenId,
        uint256 amount,
        uint256 sourceChainId,
        address recipient,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused returns (bool) {
        require(sourceChainId != block.chainid, "Bridge: source chain must be different");
        require(recipient != address(0), "Bridge: recipient is zero address");
        require(amount > 0, "Bridge: amount must be greater than zero");
        require(block.timestamp <= deadline, "Bridge: transaction expired");

        address token = supportedTokens[tokenId];
        require(token != address(0), "Bridge: token not supported");

        // Calculate transaction hash for unique identification and replay protection
        bytes32 txHash = keccak256(
            abi.encode(
                block.chainid,
                tokenId,
                amount,
                sourceChainId,
                recipient,
                nonce,
                deadline
            )
        );

        require(!processedTransactions[txHash], "Bridge: transaction already processed");
        processedTransactions[txHash] = true;

        // Recover signer from signature and verify RELAYER_ROLE
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(txHash);
        address signer = ethSignedMessageHash.recover(signature);
        require(hasRole(RELAYER_ROLE, signer), "Bridge: invalid relayer signature");

        // Mint tokens to recipient
        IFiatToken(token).mint(recipient, amount);

        emit TokensReleased(
            tokenId,
            token,
            recipient,
            amount,
            sourceChainId,
            nonce
        );

        return true;
    }
}
