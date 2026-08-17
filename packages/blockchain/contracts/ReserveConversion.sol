// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFiatToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title ReserveConversion
 * @dev Secure reserve swap contract that manages conversions between USDT and fiat stablecoins using dynamic exchange rates.
 */
contract ReserveConversion is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public usdtToken;

    // Maps token ID (keccak256 of currency symbol) to stablecoin proxy address
    mapping(bytes32 => address) public supportedTokens;

    // Maps token ID to FX rate relative to USDT (represented with 6 decimals precision)
    // Example: 1 USDT = 36.5 THB -> rate = 36.5 * 10^6 = 36,500,000
    mapping(bytes32 => uint256) public fxRates;

    // Maps token ID to timestamp of last rate update
    mapping(bytes32 => uint256) public rateLastUpdated;

    // Validity duration of exchange rates (default: 24 hours)
    uint256 public rateValidityDuration = 24 hours;

    // Maximum allowed rate deviation in basis points (1000 bps = 10%, default: 10%)
    // Set to 0 to disable deviation check
    uint256 public maxDeviationBps = 1000;

    // Maximum USDT limit for individual conversions (default: 0 = unlimited)
    uint256 public maxUSDTConversionLimit;

    // Events
    event SwapUSDTToStable(
        bytes32 indexed tokenId,
        address indexed user,
        uint256 usdtAmount,
        uint256 stablecoinAmount
    );

    event SwapStableToUSDT(
        bytes32 indexed tokenId,
        address indexed user,
        uint256 stablecoinAmount,
        uint256 usdtAmount
    );

    event SwapStableToStable(
        bytes32 indexed fromTokenId,
        bytes32 indexed toTokenId,
        address indexed user,
        uint256 fromAmount,
        uint256 toAmount
    );

    event RateUpdated(bytes32 indexed tokenId, uint256 oldRate, uint256 newRate);
    event TokenConfigured(bytes32 indexed tokenId, address indexed token);
    event TokenRemoved(bytes32 indexed tokenId);
    event RateValidityDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MaxDeviationBpsUpdated(uint256 oldBps, uint256 newBps);
    event MaxUSDTConversionLimitUpdated(uint256 oldLimit, uint256 newLimit);

    constructor(address admin, address _usdtToken) {
        require(admin != address(0), "ReserveConversion: admin is zero address");
        require(_usdtToken != address(0), "ReserveConversion: USDT token is zero address");
        
        usdtToken = _usdtToken;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    /**
     * @dev Configures a supported fiat stablecoin.
     */
    function configureToken(bytes32 tokenId, address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "ReserveConversion: token is zero address");
        supportedTokens[tokenId] = token;
        emit TokenConfigured(tokenId, token);
    }

    /**
     * @dev Removes a supported fiat stablecoin.
     */
    function removeToken(bytes32 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[tokenId] = address(0);
        emit TokenRemoved(tokenId);
    }

    /**
     * @dev Sets rate validity duration (in seconds).
     */
    function setRateValidityDuration(uint256 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit RateValidityDurationUpdated(rateValidityDuration, duration);
        rateValidityDuration = duration;
    }

    /**
     * @dev Sets max deviation in basis points (1000 = 10%).
     */
    function setMaxDeviationBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 10000, "ReserveConversion: bps exceeds 10000");
        emit MaxDeviationBpsUpdated(maxDeviationBps, bps);
        maxDeviationBps = bps;
    }

    /**
     * @dev Sets maximum USDT swap limit for any individual conversion.
     */
    function setMaxUSDTConversionLimit(uint256 limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit MaxUSDTConversionLimitUpdated(maxUSDTConversionLimit, limit);
        maxUSDTConversionLimit = limit;
    }

    /**
     * @dev Sets FX rate for a given token (6 decimals precision) with safety checks.
     */
    function setRate(bytes32 tokenId, uint256 rate) external onlyRole(ORACLE_ROLE) {
        require(rate > 0, "ReserveConversion: rate must be greater than zero");
        
        uint256 old = fxRates[tokenId];
        if (old > 0 && maxDeviationBps > 0) {
            uint256 diff = rate > old ? rate - old : old - rate;
            require(diff * 10000 <= old * maxDeviationBps, "ReserveConversion: rate deviation too high");
        }

        fxRates[tokenId] = rate;
        rateLastUpdated[tokenId] = block.timestamp;
        emit RateUpdated(tokenId, old, rate);
    }

    /**
     * @dev Sets FX rate for a given token bypassing deviation checks. Admin emergency only.
     */
    function setRateOverride(bytes32 tokenId, uint256 rate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(rate > 0, "ReserveConversion: rate must be greater than zero");
        uint256 old = fxRates[tokenId];
        fxRates[tokenId] = rate;
        rateLastUpdated[tokenId] = block.timestamp;
        emit RateUpdated(tokenId, old, rate);
    }

    /**
     * @dev Swaps USDT for custom stablecoin (USDT -> Reserve -> mint stablecoin).
     */
    function swapUSDTToStablecoin(bytes32 tokenId, uint256 usdtAmount) external returns (uint256) {
        require(usdtAmount > 0, "ReserveConversion: amount must be greater than zero");
        require(maxUSDTConversionLimit == 0 || usdtAmount <= maxUSDTConversionLimit, "ReserveConversion: exceeds maximum swap limit");
        
        address token = supportedTokens[tokenId];
        require(token != address(0), "ReserveConversion: token not supported");

        uint256 rate = fxRates[tokenId];
        require(rate > 0, "ReserveConversion: rate not set");
        require(block.timestamp - rateLastUpdated[tokenId] <= rateValidityDuration, "ReserveConversion: rate expired");

        // Transfer USDT from user to reserve (requires approval)
        require(
            IERC20(usdtToken).transferFrom(msg.sender, address(this), usdtAmount),
            "ReserveConversion: USDT transfer failed"
        );

        // Calculate stablecoin amount: (USDT * rate) / 10^6
        uint256 stablecoinAmount = (usdtAmount * rate) / 1e6;
        require(stablecoinAmount > 0, "ReserveConversion: stablecoin amount is zero");

        // Mint stablecoins to user
        IFiatToken(token).mint(msg.sender, stablecoinAmount);

        emit SwapUSDTToStable(tokenId, msg.sender, usdtAmount, stablecoinAmount);

        return stablecoinAmount;
    }

    /**
     * @dev Swaps custom stablecoin for USDT (stablecoin -> burn -> release USDT).
     */
    function swapStablecoinToUSDT(bytes32 tokenId, uint256 stablecoinAmount) external returns (uint256) {
        require(stablecoinAmount > 0, "ReserveConversion: amount must be greater than zero");

        address token = supportedTokens[tokenId];
        require(token != address(0), "ReserveConversion: token not supported");

        uint256 rate = fxRates[tokenId];
        require(rate > 0, "ReserveConversion: rate not set");
        require(block.timestamp - rateLastUpdated[tokenId] <= rateValidityDuration, "ReserveConversion: rate expired");

        // Calculate USDT amount to release: (stablecoinAmount * 10^6) / rate
        uint256 usdtAmount = (stablecoinAmount * 1e6) / rate;
        require(usdtAmount > 0, "ReserveConversion: USDT amount is zero");
        require(maxUSDTConversionLimit == 0 || usdtAmount <= maxUSDTConversionLimit, "ReserveConversion: exceeds maximum swap limit");

        // Verify reserve has sufficient USDT liquidity
        uint256 reserveBalance = IERC20(usdtToken).balanceOf(address(this));
        require(reserveBalance >= usdtAmount, "ReserveConversion: insufficient USDT reserves");

        // Burn user's stablecoins (requires user to approve this contract or contract to have BURNER_ROLE)
        IFiatToken(token).burnFrom(msg.sender, stablecoinAmount);

        // Transfer USDT from reserve to user
        require(
            IERC20(usdtToken).transfer(msg.sender, usdtAmount),
            "ReserveConversion: USDT release failed"
        );

        emit SwapStableToUSDT(tokenId, msg.sender, stablecoinAmount, usdtAmount);

        return usdtAmount;
    }

    /**
     * @dev Swaps custom stablecoin for another custom stablecoin atomically (Stablecoin A -> burn -> mint Stablecoin B).
     */
    function swapStablecoinToStablecoin(
        bytes32 fromTokenId,
        bytes32 toTokenId,
        uint256 stablecoinAmount
    ) external returns (uint256) {
        require(stablecoinAmount > 0, "ReserveConversion: amount must be greater than zero");

        address fromToken = supportedTokens[fromTokenId];
        address toToken = supportedTokens[toTokenId];
        require(fromToken != address(0) && toToken != address(0), "ReserveConversion: token not supported");

        uint256 fromRate = fxRates[fromTokenId];
        uint256 toRate = fxRates[toTokenId];
        require(fromRate > 0 && toRate > 0, "ReserveConversion: rates not configured");
        require(block.timestamp - rateLastUpdated[fromTokenId] <= rateValidityDuration, "ReserveConversion: from rate expired");
        require(block.timestamp - rateLastUpdated[toTokenId] <= rateValidityDuration, "ReserveConversion: to rate expired");

        // Calculate intermediate USDT amount (6 decimals): (stablecoinAmount * 10^6) / fromRate
        uint256 usdtAmount = (stablecoinAmount * 1e6) / fromRate;
        require(usdtAmount > 0, "ReserveConversion: intermediate USDT is zero");
        require(maxUSDTConversionLimit == 0 || usdtAmount <= maxUSDTConversionLimit, "ReserveConversion: exceeds maximum swap limit");

        // Calculate toStablecoinAmount: (usdtAmount * toRate) / 10^6
        uint256 toStablecoinAmount = (usdtAmount * toRate) / 1e6;
        require(toStablecoinAmount > 0, "ReserveConversion: target amount is zero");

        // Burn user's source stablecoin
        IFiatToken(fromToken).burnFrom(msg.sender, stablecoinAmount);

        // Mint target stablecoin to user
        IFiatToken(toToken).mint(msg.sender, toStablecoinAmount);

        emit SwapStableToStable(fromTokenId, toTokenId, msg.sender, stablecoinAmount, toStablecoinAmount);

        return toStablecoinAmount;
    }

    /**
     * @dev Allows the admin to withdraw USDT reserves or other accidentally sent tokens.
     */
    function withdrawReserve(address tokenAddress, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            IERC20(tokenAddress).transfer(msg.sender, amount),
            "ReserveConversion: withdrawal failed"
        );
    }
}
