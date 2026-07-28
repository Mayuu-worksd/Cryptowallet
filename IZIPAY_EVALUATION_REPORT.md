# IZIPAY Sandbox Production-Readiness & Security Audit

This audit evaluates the feasibility, security, and compatibility of integrating the **IZIPAY Sandbox API** (v1.0) into our existing Crypto Wallet application.

---

## ─── PHASE 1: Authentication & Connection ───

We verified the authentication mechanics of `https://izipay.me/api/v1` against standard QA parameters:

### 1. Protocol Validation
*   **API Key Works:** Valid test keys (starting with `izpk_test_`) allow connection.
*   **Authorization Header:** Enforces standard Bearer token format:
    ```http
    Authorization: Bearer izpk_test_...
    ```
*   **Missing Key / Bad Format:** Returns `401 Unauthorized` with a validation message:
    `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY"}}`
*   **Invalid / Expired Key:** Returns `401 Unauthorized`:
    `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Invalid API key"}}`
*   **Rate Limits:** Enforced per-minute for requests and daily caps for card issuance. Exceeding them returns HTTP `429 RATE_LIMIT`.
*   **Idempotency:** Supported on state-mutating requests (`POST`) using the `X-Idempotency-Key` header. If a duplicate request is received with different parameters, it returns `409 IDEMPOTENCY_CONFLICT`.

---

## ─── PHASE 2: User Journey Simulation ───

We mapped out a customer's lifecycle under the IZIPAY API to test app continuity:

```mermaid
graph TD
    A[New User Signup] --> B[POST /cards/issue]
    B --> C[Receive Invoice & Deposit Address]
    C --> D[Pay Invoice On-Chain]
    D --> E[POST /sandbox/confirm]
    E --> F[Receive Card: PAN & CVV Shown ONCE]
    F --> G[POST /cards/{id}/topup]
    G --> H[Confirm Top-Up Invoice]
    H --> I[GET /cards/{id}/transactions]
    I --> J[User Closes & Reopens App]
    J --> K[GET /cards/{id}]
    K --> L[CRITICAL BLOCKER: Masked PAN & No CVV]
```

### 1. Step-by-Step Experience & Persistence Check
1.  **Registration:** User signs up (email only) at `https://izipay.me/register`.
2.  **Card Request:** App makes a `POST /cards/issue` request. Returns `pending_payment` and a payment invoice block (USDT TRC-20 deposit address and amount).
3.  **Payment:** Customer pays on-chain. Sandbox simulates this via `POST /sandbox/confirm` with `payment_id`.
4.  **Provisioning:** The card status updates to `issued`. The confirmation payload returns the **unmasked PAN, CVV, and Expiry**.
5.  **Card Topup:** User requests top-up via `POST /cards/{card_id}/topup`. Renders a new invoice, paid on-chain (or simulated in sandbox).
6.  **Viewing Transactions:** App fetches `GET /cards/{card_id}/transactions`. Returns flat transactions array.
7.  **Freeze & Unfreeze:** **Unsupported.** The API lacks endpoints to alter card lock/freeze states.
8.  **Reopen App State:** When the app is closed and reopened, the frontend requests card details via `GET /cards/{card_id}`.
    *   **CRITICAL FAULT:** The retrieve endpoint returns only the masked card number (`5258 47** **** 1937`) and **no CVV**.
    *   **USER IMPACT:** Because we do not store raw card credentials locally (to maintain PCI-DSS compliance), the card becomes **completely unusable** for online purchases after the initial session. The user cannot view their CVV or full card number ever again.

---

## ─── PHASE 3: Card Creation & Identity Verification ───

We audited the KYC/KYB requirements of the `POST /cards/issue` endpoint:

| Field | Required? | Details |
| :--- | :---: | :--- |
| **Email** | **Yes** | `cardholder_email` is the only mandatory field in the payload. |
| **Name** | **No** | `cardholder_alias` is optional (defaults to email prefix). |
| **Phone** | **No** | Not accepted or required. |
| **Address** | **No** | Not accepted or required. |
| **Country** | **No** | Billing country is not defined at virtual card creation. |
| **DOB** | **No** | Not accepted. |
| **Identity Docs / Selfie** | **No** | No passports, IDs, selfies, or face-liveness videos are requested. |
| **KYB / Business Info** | **No** | No company registration details are checked. |

> [!IMPORTANT]
> Standard card limits bypass KYC completely. There are no developer-facing KYC endpoints, KYC iframe redirects, or document upload verification hooks in the API.

---

## ─── PHASE 4: Card Details & Retrieval Limitations ───

We verified what card metadata is exposed by IZIPAY and when:

*   **Masked PAN:** Yes, returned in `GET /cards/{card_id}` (e.g. `5258 47** **** 1937`).
*   **Full PAN / CVV:** Returned **only once** in the initial activation payload (sandbox confirmation response or the `card.issued` webhook).
*   **Expiry:** Yes, returned in both creation and retrieval.
*   **Cardholder Name / Alias:** Defaults to email prefix.
*   **Billing Address:** Not returned on retrieve.
*   **Network:** Automatically mapped to Visa / Mastercard based on sandbox BINs.
*   **Status:** Expressed via `issue_status` and `payment_status`.
*   **Limits:** Not exposed in responses.

### Impact of "Single-Reveal" Credentials
Since IZIPAY does not support a secure reveal iframe (like Stripe or Marqeta) and forbids retrieving CVVs post-issuance, we face a security-vs-usability conflict:
1.  If we follow **PCI-DSS Compliance**, we cannot store PAN/CVV in our database. The user will only see masked data and cannot copy their card number again.
2.  If we cache PAN/CVV in our database or local app storage to keep the app usable, we **violate PCI compliance**, exposing our platform to significant security liabilities and database breach risks.

---

## ─── PHASE 5 & 6: Funding & Top-Ups ───

We audited the on-chain invoicing model for issuance fees and reloads:

*   **Endpoint:** `POST /cards/issue` (for creation fee) and `POST /cards/{card_id}/topup` (for balance reloads).
*   **Payload response structure:**
    ```json
    {
      "deposit_address": "TKhWqGZ...",
      "pay_amount": 50,
      "pay_currency": "usdttrc20",
      "network": "trc20",
      "expires_at": "2026-05-22T09:04:20Z"
    }
    ```
*   **Missing Fields:** The API does **not** return a pre-generated QR code image, a payment URI scheme, a transaction memo, or a unique payment invoice ID in live responses (only `card_id` is returned).
*   **Current App Compatibility:** **No compatibility.** Our mobile application lacks an invoice layout or polling listener to display addresses and watch for blockchain deposit confirmations.

---

## ─── PHASE 7: Transactions Mappings ───

We evaluated the card transaction list endpoint `GET /cards/{card_id}/transactions`:

*   **Pending / Failed / Cancelled / Refunded:** **Not supported.** The endpoint returns a flat array of completed items with no status flags (they are assumed successful).
*   **Pagination:** **Not supported.** No pagination queries (`limit`, `offset`, `page`) are documented or respected.
*   **Sorting & Search:** **Not supported.** Returns items sorted by most recent first; search parameters are ignored.

---

## ─── PHASE 8: Card Controls & Features ───

We audited card management features. The following table represents IZIPAY API support:

| Card Control | Supported? | Evidence / Alternative |
| :--- | :---: | :--- |
| **Freeze / Unfreeze** | ❌ **No** | No status lock endpoints exist. |
| **Terminate / Delete** | ❌ **No** | No delete card endpoints are documented. |
| **Replace Card** | ❌ **No** | Must create a brand-new card at full cost ($49.99). |
| **Set / Change PIN** | ❌ **No** | Virtual cards are signature-only or tokenized; no PIN management exists. |
| **View / Reset PIN** | ❌ **No** | Not supported. |
| **Apple Pay / Google Pay** | ⚠️ **Partial** | Standard network tokenization is supported, but no direct API push-provisioning integrations exist. |
| **ATM / Online Disabling** | ❌ **No** | Cannot selectively disable ATM or online transactions. |
| **Geographic / Country Blocking** | ❌ **No** | Cannot toggle country permissions. |
| **Merchant Category Blocking** | ❌ **No** | Cannot block specific merchant categories. |

---

## ─── PHASE 9: Compliance & Limits ───

*   **KYC / Identity Checks:** Not requested for standard cards.
*   **AML Screening:** Handled implicitly by IZIPAY's financial processors. No developer notifications are sent.
*   **Reload & Spend Limits:** Daily and monthly limits are plan-based and set on the prepaid merchant account, not exposed per-card in the API.
*   **Sanctions / Age Restrictions:** No automatic checks exist at user registration.

---

## ─── PHASE 10: Security & PCI Audit ───

*   **Webhook Signature:** Uses `X-IZIPAY-Signature` containing an HMAC-SHA256 of the raw body.
*   **Replay Attack Protection:** **No.** Webhook headers do not contain nonces or timestamp verification fields, making the webhook router vulnerable to replay events.
*   **PCI-DSS Risk:** **Critical.** Integrators are forced to choose between PCI violation (storing PAN/CVV to allow future retrieval) or extreme user friction (forcing the user to memorize the card number during activation).
*   **Idempotency Verification:** Supported via the `X-Idempotency-Key` header on POST endpoints, mitigating duplicate duplicate execution issues.

---

## ─── PHASE 11: Application Compatibility ───

Our existing Crypto Wallet application lacks several modules needed to support this integration:

1.  **Card Creation Fee Invoice Screen [MISSING]:** To present the TRC-20 USDT deposit address and QR code when requesting a card.
2.  **Top-up Invoice Screen [MISSING]:** To present the reload deposit address and watch for payment confirmations.
3.  **Credential Warning Modal [MISSING]:** To force the user to save the unmasked PAN and CVV upon activation since it cannot be retrieved again.
4.  **Multi-Card Database Support [MISSING]:** The `vcc_cards` schema has a unique constraint on `wallet_address`, blocking users from owning multiple cards.

---

## ─── PHASE 12: Edge Cases & Error States ───

*   **Expired Invoice / Late Payment:** Payments received after `expires_at` do not automatically provision the card and require manual support intervention.
*   **Incorrect Amount / Network:** Crypto sent on wrong chains (e.g. BEP-20 to TRC-20) or in incorrect amounts are trapped on-chain and do not credit the card balance.
*   **Double Confirmations:** Submitting `POST /sandbox/confirm` multiple times on the same `payment_id` yields success on the first attempt but returns a `404 NOT_FOUND` on subsequent calls.

---

## ─── FINAL EXECUTIVE REPORT ───

### Mapped Features Summary

#### ✅ Working Features
- Anonymous Card Issuance Request (`POST /cards/issue`).
- Prepayment Balance Inquiry (`GET /balance`).
- Card Reload Invoicing (`POST /cards/{id}/topup`).
- Transaction History retrieval (`GET /cards/{id}/transactions`).
- Webhook signature verification (`X-IZIPAY-Signature`).
- Sandbox Payment Simulation (`POST /sandbox/confirm`).

#### ⚠️ Partial Features
- Apple Pay / Google Pay (supported by network, but no API push-provisioning).
- Webhooks (route structure exists in our app, but parser logic is provider-specific).

#### ❌ Missing Features & API Limitations
- **No Card Controls:** No Freeze, Unfreeze, Lock, PIN reset, or selective merchant/ATM blocking.
- **No PAN/CVV Retrieval:** Card details are returned only once and cannot be retrieved later.
- **No Card Deletion:** Cards cannot be terminated or closed via the API.
- **No Transaction Statuses:** No pending or refunded states are available in transaction data.

---

### Direct Q&A Validation Checklist

1.  **Can a new user create a card?**  
    *No. The mobile app lacks the Invoice Screen required to display the blockchain payment instructions (deposit address and network) for the issuance fee.*
2.  **Can they fund it?**  
    *No. Funding requires paying a crypto invoice. The app currently lacks the layout and polling listeners to display or process deposit invoices.*
3.  **Can they use it immediately?**  
    *No. Card provisioning is asynchronous and requires on-chain payment confirmation.*
4.  **Is KYC required?**  
    *No. Standard cards are issued anonymously with only an email address.*
5.  **Can they retrieve CVV later?**  
    *No. The CVV is returned only once at activation and is omitted in retrieval payloads.*
6.  **Can they retrieve Full PAN later?**  
    *No. The PAN is masked in all subsequent GET endpoints.*
7.  **Can they own multiple cards?**  
    *No. The IZIPAY API allows it, but our database schema imposes a `UNIQUE` constraint on `vcc_cards.wallet_address`, limiting each user to a single card.*
8.  **Can they freeze cards?**  
    *No. The API does not have freeze/unfreeze endpoints.*
9.  **Can they reset PIN?**  
    *No. virtual cards are signature-based and the API lacks PIN controls.*
10. **Can they use Apple Pay?**  
    *Yes. Once provisioned, standard card tokenization is supported by the networks.*
11. **Can they use Google Pay?**  
    *Yes. Cards can be manually imported into Google Wallet.*
12. **Can they spend online?**  
    *No (due to our app's limits). They cannot retrieve the CVV after the initial screen, preventing online checkouts.*
13. **Can they spend offline?**  
    *Yes, via Apple Pay / Google Pay, since the physical terminal doesn't require revealing the CVV.*
14. **Can they withdraw from ATM?**  
    *No. Virtual cards do not support ATM cash withdrawals, and the API has no PIN endpoints.*
15. **Can they top up using Crypto?**  
    *Yes. Funding is exclusively processed via crypto deposit invoices.*
16. **Can they top up using Fiat?**  
    *No. Only crypto payment options (USDT/USDC/BTC/ETH) are supported.*
17. **Can they close cards?**  
    *No. The API lacks any card termination or deletion endpoints.*
18. **Can our current wallet already support every feature?**  
    *No. Major gaps exist in the UI, database index rules, and backend provider adapters.*
19. **What is missing in our wallet?**  
    *We lack Invoice QR screens, webhook parsing rules, multi-card database schemas, and conditional UI hides for unsupported controls (freeze/PIN).*
20. **What limitations come from IZIPAY itself?**  
    *Critical limitations include: Single-time card credential display, lack of freeze/unfreeze functions, lack of card closure endpoints, and lack of transaction status sorting.*
