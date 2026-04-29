// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/**
 * @title P2PEscrow
 * @notice On-chain escrow for CryptoWallet P2P marketplace.
 *         Supports ETH and ERC-20 tokens (USDC, USDT, DAI).
 *
 * Flow:
 *   1. Seller calls depositETH() or depositToken() → funds locked in contract
 *   2. Buyer calls lockBuyer() → marks themselves as buyer
 *   3. Buyer pays fiat off-chain, calls markFiatSent()
 *   4. Seller confirms receipt, calls release() → funds sent to buyer
 *   5. Either party can raiseDispute() → admin resolves
 *   6. Seller can cancel() before a buyer locks in
 */
contract P2PEscrow {

    address public admin;

    enum Status { Open, Locked, FiatSent, Completed, Cancelled, Disputed }

    struct Escrow {
        address seller;
        address buyer;
        address token;      // address(0) = ETH
        uint256 amount;
        Status  status;
    }

    mapping(bytes32 => Escrow) public escrows;

    event Deposited  (bytes32 indexed orderId, address seller, address token, uint256 amount);
    event BuyerLocked(bytes32 indexed orderId, address buyer);
    event FiatSent   (bytes32 indexed orderId);
    event Released   (bytes32 indexed orderId, address buyer, uint256 amount);
    event Cancelled  (bytes32 indexed orderId);
    event Disputed   (bytes32 indexed orderId);
    event AdminResolved(bytes32 indexed orderId, address winner);

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }

    constructor() { admin = msg.sender; }

    // ─── Seller: deposit ETH ──────────────────────────────────────────────────

    function depositETH(bytes32 orderId) external payable {
        require(msg.value > 0, "No ETH sent");
        require(escrows[orderId].seller == address(0), "Order exists");

        escrows[orderId] = Escrow({
            seller: msg.sender,
            buyer:  address(0),
            token:  address(0),
            amount: msg.value,
            status: Status.Open
        });

        emit Deposited(orderId, msg.sender, address(0), msg.value);
    }

    // ─── Seller: deposit ERC-20 ───────────────────────────────────────────────

    function depositToken(bytes32 orderId, address token, uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(escrows[orderId].seller == address(0), "Order exists");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        escrows[orderId] = Escrow({
            seller: msg.sender,
            buyer:  address(0),
            token:  token,
            amount: amount,
            status: Status.Open
        });

        emit Deposited(orderId, msg.sender, token, amount);
    }

    // ─── Buyer: lock in ───────────────────────────────────────────────────────

    function lockBuyer(bytes32 orderId) external {
        Escrow storage e = escrows[orderId];
        require(e.seller != address(0), "No order");
        require(e.status == Status.Open, "Not open");
        require(msg.sender != e.seller, "Seller cannot buy");

        e.buyer  = msg.sender;
        e.status = Status.Locked;

        emit BuyerLocked(orderId, msg.sender);
    }

    // ─── Buyer: mark fiat sent ────────────────────────────────────────────────

    function markFiatSent(bytes32 orderId) external {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.buyer, "Not buyer");
        require(e.status == Status.Locked, "Not locked");

        e.status = Status.FiatSent;
        emit FiatSent(orderId);
    }

    // ─── Seller: release funds to buyer ──────────────────────────────────────

    function release(bytes32 orderId) external {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller, "Not seller");
        require(e.status == Status.FiatSent, "Fiat not sent yet");

        e.status = Status.Completed;
        _send(e.token, e.buyer, e.amount);

        emit Released(orderId, e.buyer, e.amount);
    }

    // ─── Seller: cancel (only before buyer locks) ─────────────────────────────

    function cancel(bytes32 orderId) external {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller, "Not seller");
        require(e.status == Status.Open, "Cannot cancel");

        e.status = Status.Cancelled;
        _send(e.token, e.seller, e.amount);

        emit Cancelled(orderId);
    }

    // ─── Either party: raise dispute ──────────────────────────────────────────

    function raiseDispute(bytes32 orderId) external {
        Escrow storage e = escrows[orderId];
        require(msg.sender == e.seller || msg.sender == e.buyer, "Not party");
        require(e.status == Status.Locked || e.status == Status.FiatSent, "Cannot dispute");

        e.status = Status.Disputed;
        emit Disputed(orderId);
    }

    // ─── Admin: resolve dispute ───────────────────────────────────────────────

    function adminResolve(bytes32 orderId, address winner) external onlyAdmin {
        Escrow storage e = escrows[orderId];
        require(e.status == Status.Disputed, "Not disputed");
        require(winner == e.seller || winner == e.buyer, "Invalid winner");

        e.status = Status.Completed;
        _send(e.token, winner, e.amount);

        emit AdminResolved(orderId, winner);
    }

    // ─── Internal: send ETH or ERC-20 ────────────────────────────────────────

    function _send(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "ETH send failed");
        } else {
            require(IERC20(token).transfer(to, amount), "Token send failed");
        }
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getEscrow(bytes32 orderId) external view returns (Escrow memory) {
        return escrows[orderId];
    }
}
