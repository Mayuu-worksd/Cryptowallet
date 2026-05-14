// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/**
 * @title P2PEscrow
 * @notice Production-grade on-chain escrow for CryptoWallet P2P marketplace.
 *         Supports ETH and ERC-20 tokens (USDC, USDT, DAI).
 *
 * Security:
 *   - ReentrancyGuard on all state-changing + ETH-sending functions
 *   - Checks-Effects-Interactions pattern throughout
 *   - Emergency pause by admin
 *   - Admin ownership transfer (2-step)
 *   - Platform fee collection (0.5%)
 *   - Dispute timeout: auto-refund seller after 7 days if admin doesn't resolve
 *
 * Flow:
 *   1. Seller calls depositETH() or depositToken() → funds locked in contract
 *   2. Buyer calls lockBuyer() → marks themselves as buyer
 *   3. Buyer pays fiat off-chain, calls markFiatSent()
 *   4. Seller confirms receipt, calls release() → funds sent to buyer
 *   5. Either party can raiseDispute() → admin resolves within 7 days
 *   6. Seller can cancel() before a buyer locks in
 */
contract P2PEscrow {

    // ─── State ────────────────────────────────────────────────────────────────

    address public admin;
    address public pendingAdmin;   // 2-step admin transfer
    address public feeRecipient;   // where platform fees go
    bool    public paused;

    uint256 public constant FEE_BPS         = 50;    // 0.5% in basis points
    uint256 public constant DISPUTE_TIMEOUT = 7 days; // auto-refund after 7 days

    // Reentrancy guard
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    enum Status { Open, Locked, FiatSent, Completed, Cancelled, Disputed }

    struct Escrow {
        address seller;
        address buyer;
        address token;        // address(0) = ETH
        uint256 amount;       // gross amount (before fee)
        uint256 fee;          // platform fee amount
        Status  status;
        uint256 disputedAt;   // timestamp when dispute was raised
    }

    mapping(bytes32 => Escrow) public escrows;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited      (bytes32 indexed orderId, address seller, address token, uint256 amount, uint256 fee);
    event BuyerLocked    (bytes32 indexed orderId, address buyer);
    event FiatSent       (bytes32 indexed orderId);
    event Released       (bytes32 indexed orderId, address buyer, uint256 netAmount, uint256 fee);
    event Cancelled      (bytes32 indexed orderId, address seller, uint256 amount);
    event Disputed       (bytes32 indexed orderId, address raisedBy);
    event AdminResolved  (bytes32 indexed orderId, address winner, uint256 netAmount);
    event DisputeExpired (bytes32 indexed orderId, address seller, uint256 amount);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferAccepted (address indexed newAdmin);
    event Paused         (address by);
    event Unpaused       (address by);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Zero fee recipient");
        admin        = msg.sender;
        feeRecipient = _feeRecipient;
        _status      = _NOT_ENTERED;
    }

    // ─── Seller: deposit ETH ──────────────────────────────────────────────────

    function depositETH(bytes32 orderId) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No ETH sent");
        require(escrows[orderId].seller == address(0), "Order exists");

        uint256 fee    = (msg.value * FEE_BPS) / 10000;
        uint256 net    = msg.value - fee;
        require(net > 0, "Amount too small");

        escrows[orderId] = Escrow({
            seller:     msg.sender,
            buyer:      address(0),
            token:      address(0),
            amount:     net,
            fee:        fee,
            status:     Status.Open,
            disputedAt: 0
        });

        emit Deposited(orderId, msg.sender, address(0), net, fee);
    }

    // ─── Seller: deposit ERC-20 ───────────────────────────────────────────────

    function depositToken(bytes32 orderId, address token, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");
        require(token != address(0), "Invalid token");
        require(escrows[orderId].seller == address(0), "Order exists");

        uint256 fee = (amount * FEE_BPS) / 10000;
        uint256 net = amount - fee;
        require(net > 0, "Amount too small");

        // Pull tokens from seller — CEI: state update before external call
        escrows[orderId] = Escrow({
            seller:     msg.sender,
            buyer:      address(0),
            token:      token,
            amount:     net,
            fee:        fee,
            status:     Status.Open,
            disputedAt: 0
        });

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit Deposited(orderId, msg.sender, token, net, fee);
    }

    // ─── Buyer: lock in ───────────────────────────────────────────────────────

    function lockBuyer(bytes32 orderId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[orderId];
        require(e.seller != address(0), "No order");
        require(e.status == Status.Open, "Not open");
        require(msg.sender != e.seller, "Seller cannot buy");
        require(msg.sender != address(0), "Zero buyer");

        e.buyer  = msg.sender;
        e.status = Status.Locked;

        emit BuyerLocked(orderId, msg.sender);
    }

    // ─── Buyer: mark fiat sent ────────────────────────────────────────────────

    function markFiatSent(bytes32 orderId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.buyer, "Not buyer");
        require(e.status == Status.Locked, "Not locked");

        e.status = Status.FiatSent;
        emit FiatSent(orderId);
    }

    // ─── Seller: release funds to buyer ──────────────────────────────────────

    function release(bytes32 orderId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller, "Not seller");
        require(e.status == Status.FiatSent, "Fiat not sent yet");

        // CEI: update state BEFORE sending funds
        uint256 net = e.amount;
        uint256 fee = e.fee;
        address buyer = e.buyer;
        address token = e.token;
        e.status = Status.Completed;

        _send(token, buyer, net);
        if (fee > 0) _send(token, feeRecipient, fee);

        emit Released(orderId, buyer, net, fee);
    }

    // ─── Seller: cancel (only before buyer locks) ─────────────────────────────

    function cancel(bytes32 orderId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller, "Not seller");
        require(e.status == Status.Open, "Cannot cancel");

        uint256 total = e.amount + e.fee; // refund full amount including fee
        address token = e.token;
        address seller = e.seller;
        e.status = Status.Cancelled;

        _send(token, seller, total);

        emit Cancelled(orderId, seller, total);
    }

    // ─── Either party: raise dispute ──────────────────────────────────────────

    function raiseDispute(bytes32 orderId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller || msg.sender == e.buyer, "Not party");
        require(e.status == Status.Locked || e.status == Status.FiatSent, "Cannot dispute");

        e.status     = Status.Disputed;
        e.disputedAt = block.timestamp;

        emit Disputed(orderId, msg.sender);
    }

    // ─── Admin: resolve dispute ───────────────────────────────────────────────

    function adminResolve(bytes32 orderId, address winner) external onlyAdmin nonReentrant {
        Escrow storage e = escrows[orderId];
        require(e.status == Status.Disputed, "Not disputed");
        require(winner == e.seller || winner == e.buyer, "Invalid winner");

        uint256 net   = e.amount;
        uint256 fee   = e.fee;
        address token = e.token;
        e.status = Status.Completed;

        _send(token, winner, net);
        if (fee > 0) _send(token, feeRecipient, fee);

        emit AdminResolved(orderId, winner, net);
    }

    // ─── Anyone: claim expired dispute (auto-refund seller after 7 days) ──────

    function claimExpiredDispute(bytes32 orderId) external nonReentrant {
        Escrow storage e = escrows[orderId];
        require(e.status == Status.Disputed, "Not disputed");
        require(block.timestamp >= e.disputedAt + DISPUTE_TIMEOUT, "Not expired yet");

        uint256 total  = e.amount + e.fee;
        address token  = e.token;
        address seller = e.seller;
        e.status = Status.Cancelled;

        _send(token, seller, total);

        emit DisputeExpired(orderId, seller, total);
    }

    // ─── Admin: 2-step ownership transfer ────────────────────────────────────

    function initiateAdminTransfer(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdminTransfer() external {
        require(msg.sender == pendingAdmin, "Not pending admin");
        admin        = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferAccepted(admin);
    }

    // ─── Admin: update fee recipient ─────────────────────────────────────────

    function setFeeRecipient(address newRecipient) external onlyAdmin {
        require(newRecipient != address(0), "Zero address");
        feeRecipient = newRecipient;
    }

    // ─── Admin: emergency pause ───────────────────────────────────────────────

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getEscrow(bytes32 orderId) external view returns (Escrow memory) {
        return escrows[orderId];
    }

    function isDisputeExpired(bytes32 orderId) external view returns (bool) {
        Escrow storage e = escrows[orderId];
        return e.status == Status.Disputed && block.timestamp >= e.disputedAt + DISPUTE_TIMEOUT;
    }

    // ─── Internal: send ETH or ERC-20 (CEI-safe) ─────────────────────────────

    function _send(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "ETH send failed");
        } else {
            require(IERC20(token).transfer(to, amount), "Token send failed");
        }
    }
}
