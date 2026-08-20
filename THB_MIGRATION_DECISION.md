# THB Migration Decision & Strategy Document

This document compares the working Sepolia Proof of Concept (PoC) THB stablecoin system against the newly implemented Production-Ready Upgradeable Stablecoin architecture, detailing the migration decision framework, rationale, and options.

---

## 1. Architectural Comparison

| Feature / Criteria | Sepolia PoC System (`FiatToken.sol`) | Production Upgradeable System (`FiatTokenUpgradeable.sol`) |
| :--- | :--- | :--- |
| **Upgradeability** | ❌ **Immutable.** Any bug, security vulnerability, or regulatory change requires deploying a new address and force-migrating users. | ✅ **UUPS Upgradeable (ERC-1967).** Supports bug patching, fee logic updates, and regulatory adjustments under a shared address. |
| **Proxy Pattern** | None (Direct deployment) | UUPS Proxy (`ERC1967Proxy`) pointing to a shared logic contract. |
| **Proxy Factory** | Standard deployment (`new FiatToken()`) | Upgradable Proxy Factory (`new ERC1967Proxy(impl)`) mapping symbols to proxies. |
| **Access Control** | Single Owner (`Ownable`) | Role-Based Access Control (`AccessControl` with custom `MINTER_ROLE`, `BURNER_ROLE`, `UPGRADER_ROLE`, and `DEFAULT_ADMIN_ROLE`). |
| **Bridge Support** | Multi-contract (independent per currency) | Dynamic Multi-Currency Bridge supporting locking/releasing multiple assets via unique Keccak token IDs. |
| **Conversion Mechanism** | Client-side mock mint/burn calls | Secure on-chain Reserve Conversion contract managing USDT collateral reserves and executing dynamic FX oracle rates. |
| **Double-Spend / Replay Protection** | None (Basic transfer checks) | Secure transaction-hash tracking, EIP-712-compliant signing, and nonce/deadline verification. |

---

## 2. Why Upgradeability is Critical for Production Stablecoins

1. **Regulatory Compliance (Sanction & Blacklist Management):** Stablecoins are heavily regulated. If compliance requirements dictate freeze/seize mechanics or address blacklisting in the future, the code must be upgradeable to add these features without abandoning the token address.
2. **Contract Bug Resolution:** If a critical exploit is discovered in the transfer or decimals logic, an upgradeable proxy allows the team to patch the implementation logic in a single transaction, preserving user balances and integrations.
3. **Optimized Gas & Logic Iteration:** As the EVM evolves (such as new opcodes like `mcopy` in Cancun), logic contracts can be optimized for gas efficiency and re-deployed.
4. **Permanent Addresses:** Integrators, exchanges, and DeFi pools integrate the proxy address once. Upgradeability guarantees that the logic changes behind the scenes without breaking third-party integrations.

---

## 3. Migration Strategies

Since we must not decommission the Sepolia PoC contract yet, we have two primary options for migrating to the new Upgradeable THB Stablecoin:

### Option A: On-Chain Migration Swap Contract (Recommended)
Deploy a dedicated `THBMigrator` smart contract that facilitates a 1-to-1 swap.
1. The `THBMigrator` contract is granted the `MINTER_ROLE` on the new Upgradeable THB.
2. Users approve the old THB contract to `THBMigrator`.
3. Users call `migrate(uint256 amount)` on `THBMigrator`.
4. The contract burns/locks the old PoC THB and mints the equivalent amount of Upgradeable THB to the user's wallet.
* **Pros:** Decentralized, self-service, real-time, easily auditable on-chain.
* **Cons:** Requires users to send a transaction (gas cost).

### Option B: Snapshot-and-Re-Mint (Airdrop)
1. Halt transfers on the old PoC THB contract (if pause function is active).
2. Take an off-chain block snapshot of all token holders and balances.
3. Deploy the new Upgradeable THB proxy.
4. Execute a batch-mint script from the admin wallet to mint the exact snapshot balances to the respective holders on the new proxy.
* **Pros:** Zero-action and zero-gas required from users.
* **Cons:** Centralized, gas cost falls entirely on the admin, potential for race conditions if transfers aren't successfully paused before the snapshot.

---

## 4. Risk Mitigation & Deployment Protocol

1. **Multi-Signature Control:** In production, the `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` must belong to a secure Multi-Signature wallet (e.g. Safe) or a decentralized Governance Timelock, rather than a single deployer EOA.
2. **Auditing implementation contracts:** Any new implementation logic must be fully audited and tested locally using Hardhat before submitting an upgrade transaction.
3. **Verification and Verification Delays:** Implement a Timelock contract as the proxy owner, giving users a 48-to-72 hour warning before any upgrade becomes active on-chain, allowing them to inspect the code changes.
4. **Dry Run Migrations:** Before mainnet deployment, execute both balance migrations on Sepolia to verify that no decimal truncation or access control blocking occurs.
