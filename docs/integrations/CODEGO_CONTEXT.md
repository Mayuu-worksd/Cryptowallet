# CryptoWallet × Codego — Verified Architecture Context

> Last verified against actual source files. All flows below are confirmed from code, not assumptions.

---

## PART 1 — CODEGO INTEGRATION OVERVIEW

Codego (`vcc-sandbox.codegotech.com`) is the card-issuing backend. The mobile app NEVER calls Codego directly. Every Codego call goes through the **admin-dashboard** Next.js API routes running on Vercel.

```
Mobile App  →  Admin Dashboard API (Vercel)  →  Codego Sandbox API
                        ↕
                  Supabase (source of truth)
```

Auth header for all Codego calls: `X-Api-Key: <CODEGO_API_KEY>`  
NOT `Authorization: Bearer` — this was a known bug that has been fixed.

Sandbox base URL: `https://vcc-sandbox.codegotech.com/api/v1`  
Sandbox KYC URL: `https://kyc-sandbox.codegotech.com/api/session/create`

---

## PART 2 — KYC FLOW (Our Own System + Codego Sandbox Simulator)

### Why We Have Two KYC Systems

Codego Sandbox enforces its own KYC (Sumsub/Persona tokens) before issuing cards. Since we don't integrate Sumsub/Persona, we built:
1. Our own KYC system (document + selfie + liveness video, reviewed by admin)
2. A Sandbox KYC Simulator tool in the admin dashboard that generates a Codego-hosted verification session link

### Our KYC States
`pending` → `under_review` → `verified` | `rejected`

Data stored in Supabase `kyc` table:
- `wallet_address` — primary key link (always lowercase)
- `full_name`, `email`, `phone`, `address`, `nationality`, `dob`, `document_type`
- `document_url`, `selfie_url`, `selfie_video_url` — storage paths in `kyc-docs` bucket (accessed via signed URLs)
- `unique_code` — user writes this code on paper and holds it in their liveness selfie (anti-spoofing)
- `status` — `pending | under_review | verified | rejected`
- `codego_cardholder_id` — set once user is registered on Codego side

### Mobile App KYC Flow
```
KYCIntroScreen
  → KYCFormScreen (personal details)
  → KYCDocumentScreen / KYCScanScreen (ID document upload)
  → KYCSelfieModeScreen → KYCCodeSelfieScreen (selfie with unique code)
  → KYCVideoLivenessScreen (liveness video)
  → KYCProcessingScreen
  → KYCResultScreen (shows status: pending)
```

All uploads go via `kycService.uploadFile()` → Supabase Storage `kyc-docs` bucket.  
Form data saved via `kycService.submitKYC()` → calls Supabase RPC `upsert_kyc`.  
Files finalized via `kycService.finalizeSubmission()` → calls Supabase RPC `finalize_kyc`.

### Admin KYC Desk (`/dashboard/kyc/page.tsx`)

1. Lists all KYC submissions via `admin_get_all_kyc` RPC
2. Admin opens a record → sees document, selfie, liveness video (via signed URLs)
3. **Sandbox KYC Simulator panel** — admin clicks "Generate Sandbox KYC Link":
   - Calls `POST /api/admin/sandbox-kyc` with `{ walletAddress }`
   - Route fetches KYC record from Supabase
   - If `codego_cardholder_id` is missing → calls `POST /applications` on Codego to register user, saves returned ID to `kyc.codego_cardholder_id`
   - Then calls `POST https://kyc-sandbox.codegotech.com/api/session/create` with `{ externalUserId, applicantType, email, returnUrl }`
   - Returns `iframeUrl` + `sessionId`
   - Admin shares/opens the `iframeUrl` so the user completes Codego's own KYC flow in browser
4. Admin checks Codego status via `GET /api/codego/cardholders?walletAddress=...`
   - Calls `GET /users/{codego_cardholder_id}` on Codego
   - Returns `applicationStatus` — possible values: `needsVerification`, `approved`, `not_started`
5. **"Verify Identity" button is BLOCKED** unless `codegoAppStatus === 'approved'`
   - If not approved: shows alert explaining the sandbox KYC link must be completed first
   - If approved: shows confirmation modal → calls `admin_update_kyc` RPC → sets `status = 'verified'`
6. Rejection: requires at least 10 characters of admin notes → calls `admin_update_kyc` with `status = 'rejected'`

---

## PART 3 — CARD CREATION FLOW (Virtual + Physical)

### Step 1: Mobile App — Variant Selection
```
CardScreen → VCCVariantScreen
  → loads variants from Supabase `card_variants` table via cardVariantService.getVariants()
  → user selects a variant
  → navigates to VCCPreviewScreen with selected variant
  → VCCProcessingScreen calls the admin API
```

### Step 2: Admin API — POST /api/codego/cards

Full logic in `/api/codego/cards/route.ts`:

```
1. Validate: walletAddress + type required
2. Fetch KYC from Supabase — must exist and status === 'verified'
3. Check vcc_cards for existing card → if codego_card_id already set:
   - Try GET /cards/{codego_card_id} on Codego
   - Return existing card data (alreadyExists: true) — prevents duplicates
4. Get codego_cardholder_id from KYC record
   - If missing → POST /applications on Codego:
     Payload: { walletAddress, email, firstName, lastName, birthDate,
                phoneNumber, phoneCountryCode, ipAddress, address,
                nationalId: '123456789', countryOfIssue, key: CODEGO_API_KEY }
     On success → save codego_cardholder_id to kyc table
     On failure → SKIP to mock card generation (sandbox fallback)
5. Check if user already has cards on Codego: GET /users/{id}/cards
   - If matching type found → sync to vcc_cards + return (alreadyExists: true)
6. Create card: POST /users/{codegoCardholderId}/cards
   Payload: {
     type: 'virtual' | 'physical',
     configuration: { displayName: holder name in CAPS, productId: '1' }
     billing: { ... } (physical only)
   }
   On success → upsert vcc_cards with codego_card_id, card_last4, expiry, status
   On failure → FALLBACK: generate mock card (id starts with 'mock_cg_')
```

### Mock Card Fallback
Triggered when `/applications` or `/users/{id}/cards` fails in sandbox:
- Generates random Visa card number (`4000...XXXX`)
- Random CVV (100-999 range)
- Fixed expiry `12/28`
- codego_card_id = `mock_cg_XXXXXXXXX`
- Response includes `isMock: true`
- Still saved to `vcc_cards` table so the app works normally

### Internal Card Storage: `vcc_cards` table
Key fields:
- `wallet_address` — owner (FK to kyc)
- `codego_card_id` — Codego's card ID (null if mock or not yet synced)
- `codego_status` — raw status from Codego (`active`, `locked`, `canceled`)
- `card_status` — our internal status (`active`, `frozen`, `blocked`, `pending`)
- `card_last4`, `expiry_mm_yy`, `card_holder_name`, `card_network`, `card_variant`
- `is_physical`, `physical_shipping_status` (`not_requested`, `processing`, `shipped`, `delivered`)
- `kyc_verified`, `compliance_status`

### Status Mapping (Codego → Internal)
| Codego | vcc_cards.card_status |
|---|---|
| active / activated | active |
| locked / frozen | frozen |
| canceled / cancelled / blocked | blocked |
| (default/unknown) | pending |

### Codego Status Update: PATCH /api/codego/cards/[id]/status
- Correct Codego endpoint: `PATCH /cards/{id}` (body: `{ status }`)
- NOT `/cards/{id}/status` — that path doesn't exist
- Our internal `frozen` → Codego `locked`, `blocked` → Codego `canceled`
- If card starts with `mock_cg_` or 404 on Codego → update Supabase only

### Admin Cards Dashboard (`/dashboard/cards/page.tsx`)
4 tabs:
1. **Virtual Cards** — lists all `vcc_cards`, shows Codego sync status, has "Sync to Codego" button for unsynced cards
2. **Card Orders** — physical card requests, admin can mark as shipped (requires tracking number) or delivered
3. **Variants Manager** — CRUD for `card_variants` table (gradient, fees, limits, features, currency_support)
4. **Pricing & Currencies** — shipping fees per country, fiat currency exchange rates

### Physical Card Order Flow
```
Mobile: CardScreen → ApplyPhysicalCardScreen
  → submits to cardRequestService.submitRequest()
  → inserts row into vcc_cards with is_physical=true, physical_shipping_status='processing'

Admin: /dashboard/cards → Card Orders tab
  → Reviews order via /api/admin/physical-cards
  → Action: "Mark as Shipped" → POST /api/admin/physical-cards/action
    1. Fetches KYC for wallet
    2. Checks codego_cardholder_id exists
    3. Fetches live Codego user status: GET /users/{id}
    4. Blocks if applicationStatus !== 'approved'
    5. Updates vcc_cards.physical_shipping_status = 'shipped'
    6. If card not yet synced → auto-calls POST /api/codego/cards to issue physical card on Codego
  → Action: "Mark as Delivered" → updates physical_shipping_status = 'delivered'
```

---

## PART 4 — FIAT DEPOSIT FLOW

### Mobile App: FiatDepositScreen.tsx
5-step wizard:
1. Select crypto asset to receive (USDT, USDC, BTC, ETH)
2. Select fiat currency (USD, AED, EUR, GBP, INR)
3. Enter amount + see crypto estimate (based on CoinGecko prices from WalletContext)
4. View admin bank details + mandatory reference code (`DEP-{userUid}`)
5. Upload payment proof (image or PDF) → submit

Bank details loaded from `admin_bank_accounts` table via `BankAccountService.getAllActiveBankAccounts()`.  
The bank shown is matched by `currency === selectedFiatCurrency`.

On submit:
```
1. fiatRequestService.uploadProof() → uploads file to Supabase storage 'payment-proofs' bucket
2. fiatRequestService.submitDeposit() → inserts row in fiat_crypto_requests table:
   { wallet_address, type:'deposit', fiat_currency, crypto_asset, amount, payment_proof_url, status:'pending' }
```

After submit → shows tracking screen with timeline (Submitted → Under Review → Credited).  
If a pending request already exists → skips form, shows tracking directly.

### Admin: /dashboard/fiat-requests/page.tsx
Fetches from 3 tables merged in `/api/admin/fiat-queues`:
- `fiat_crypto_requests` (legacy + mobile app deposits) — `source: 'legacy'`
- `fiat_deposits` (Codego-flow deposits) — `source: 'codego'`
- `fiat_withdrawals` (Codego-flow withdrawals) — `source: 'codego'`

Admin actions via `/api/admin/fiat-queues/action`:
- For `source === 'legacy'` → calls Supabase RPC `admin_process_fiat_request(p_request_id, p_action, p_crypto_amount, p_admin_notes)`
  - `approve` → credits user's token balance in `token_balances`, updates ledger, sets status='completed'
  - `reject` → sets status='rejected'
- For `source === 'codego'` → directly updates `fiat_deposits` or `fiat_withdrawals` table status

### Codego Fiat Deposit API: POST /api/codego/fiat/deposit
Used when fiat flows through Codego's card system:
1. Verify KYC
2. Fetch active admin bank account from `admin_bank_accounts`
3. Generate unique `referenceCode` = `DEP-{timestamp36}-{random4}`
4. Resolve internal card UUID from `codego_card_id` if provided
5. Insert pending record into `fiat_deposits` table
6. Return bank details + reference code to client

NOTE: Codego sandbox `POST /transfers/outgoing` returns 404. Fiat is always admin-managed.

---

## PART 5 — FIAT WITHDRAWAL FLOW

### Mobile App: FiatWithdrawalScreen.tsx
5-step wizard:
1. Select crypto asset to sell (USDT, USDC, ETH, BTC)
2. Select payout fiat currency (USD, AED, EUR, GBP, INR)
3. Enter quantity (shows available balance, max button)
4. Enter bank details (account name, bank name, IBAN/account number, SWIFT, notes)
5. Confirm summary → submit

On submit:
```
fiatRequestService.submitWithdrawal()
  → calls Supabase RPC 'submit_fiat_withdrawal'
    params: { p_wallet_address, p_crypto_asset, p_fiat_currency, p_amount, p_bank_details }
  → RPC inserts into fiat_crypto_requests table (type='withdrawal')
```

After submit → shows tracking screen with timeline (Submitted → Processing → Sent).

### Codego Withdrawal API: POST /api/codego/fiat/withdraw
1. Verify KYC
2. Try `POST /transfers/outgoing` on Codego (works in production, 404 in sandbox)
3. Store in `fiat_withdrawals` table:
   - `status: 'processing'` if Codego call succeeded
   - `status: 'pending'` if Codego returned 404 (sandbox)
4. Admin processes manually via fiat-requests dashboard

---

## PART 6 — TRANSACTION HISTORY

`transactionService.fetchAll()` merges sources:

| Source | Storage | Type |
|---|---|---|
| `cw_transactions` (AsyncStorage) | Local | sent, received, swap, card_topup, card_spend |
| `cw_card_transactions` (AsyncStorage) | Local | topup, spend |
| `swap_transactions` (AsyncStorage) | Local | swap |
| Etherscan API | On-chain | ETH + ERC-20 txs |
| TronGrid API | On-chain | TRON/TRC-20 txs (if TRON network) |

Merge dedup key: `hash:type` for chain txs, `id` for local txs.  
Sorted descending by date.  
Cached to `tx_history_cache` in AsyncStorage when Etherscan succeeds (used on rate-limit failure).

`syncIncoming()` — polls every 60s minimum:
- Processes ETH txs, token txs, internal txs in parallel
- Custom token contract (`EXPO_PUBLIC_CUSTOM_TOKEN`) → classified as `swap` type
- Rate limit (NOTOK) → enters 5-minute backoff lockout mode

Card transactions from Codego:
- Codego sends `transaction.created` / `transaction.updated` webhooks
- Webhook handler upserts into `transactions` table with `type: 'card_spend'`, deduped on `reference_id`

Card transaction history on admin:
- `GET /api/codego/cards/[id]/transactions`
- First tries Codego `GET /cards/{id}/transactions` — works in production
- Sandbox returns 404 → falls back to Supabase `transactions` table filtered by wallet_address
- Response includes `source: 'codego' | 'supabase_fallback' | 'not_found'`

---

## PART 7 — WEBHOOKS

Endpoint: `POST /api/webhooks/codego`

All events logged to `codego_webhooks_log` table first (with `processed: false`), then processed:

| Event | Action on Supabase |
|---|---|
| `card.created`, `card.activated` | `vcc_cards`: `card_status='active'`, `codego_status='active'` |
| `card.locked`, `card.frozen` | `vcc_cards`: `card_status='frozen'`, `codego_status='locked'` |
| `card.unlocked`, `card.unfrozen` | `vcc_cards`: `card_status='active'`, `codego_status='active'` |
| `card.canceled`, `card.blocked` | `vcc_cards`: `card_status='blocked'`, `codego_status='canceled'` |
| `card.updated` | `vcc_cards`: update `balance` and/or `card_status` from payload |
| `transaction.created`, `transaction.updated` | `transactions`: upsert with `type='card_spend'`, dedup on `reference_id` |
| `transfer.completed` | `fiat_withdrawals`: `status='completed'` where `codego_withdrawal_id` matches |
| `transfer.failed` | `fiat_withdrawals`: `status='failed'` |

On success → `codego_webhooks_log.processed = true`.  
On error → `processed = false`, `error_message` saved.

---

## PART 8 — CODEGO API ENDPOINTS: WHAT WORKS IN SANDBOX

| Method | Endpoint | Sandbox | Notes |
|---|---|---|---|
| POST | `/applications` | Sometimes ✅ | Requires `key` field as bypass (sandbox only) |
| GET | `/users/{id}` | ✅ | Check user exists + applicationStatus |
| GET | `/users/{id}/cards` | ✅ | List cards for a user |
| POST | `/users/{id}/cards` | Sometimes ✅ | May fail — triggers mock card fallback |
| PATCH | `/cards/{id}` | ✅ | Status update (NOT `/cards/{id}/status`) |
| GET | `/cards/{id}` | ✅ | Get card details |
| GET | `/cards/{id}/transactions` | ❌ 404 | Not available in sandbox |
| POST | `/transfers/outgoing` | ❌ 404 | Not available in sandbox |
| POST | `kyc-sandbox.../api/session/create` | ✅ | Generates KYC iframe URL for sandbox |

---

## PART 9 — SUPABASE TABLES REFERENCE

| Table | Purpose |
|---|---|
| `kyc` | User identity records + codego_cardholder_id mapping |
| `vcc_cards` | All virtual/physical cards (Codego-synced and mock) |
| `cards` | Legacy simple card (XOR-encrypted card number/CVV, balance, freeze) |
| `card_variants` | Admin-configurable tiers (Classic/Gold/Platinum/Travel + custom) |
| `shipping_fees` | Per-country physical card shipping costs |
| `fiat_currencies` | Fiat currency list with exchange rates (admin-managed) |
| `transactions` | All txs: send/receive/swap/card_spend/fee — unified ledger |
| `fiat_crypto_requests` | Mobile app deposit/withdrawal tickets (legacy flow) |
| `fiat_deposits` | Codego-flow pending bank deposit records |
| `fiat_withdrawals` | Codego-flow withdrawal requests with destination IBAN/BIC |
| `ledger_entries` | Double-entry accounting per user |
| `admin_bank_accounts` | Admin-configured bank accounts shown to depositors |
| `codego_webhooks_log` | Raw webhook event log for debugging/auditing |
| `admin_settings` | Key-value admin config (30s in-memory TTL cache in mobile app) |
| `admin_alerts` | Admin notification queue |
| `wallet_profiles` | Per-wallet settings: name, account type, p2p country/currency, balances |

---

## PART 10 — CARD CREDENTIAL STORAGE (MOBILE)

Two storage paths for card numbers:

**Path A — vcc_cards (Codego-synced):**
- `card_last4` stored in DB
- Full card number available from Codego API only (masked PAN in most responses)
- `codego_card_id` is the reference to fetch live card details

**Path B — cards table (Legacy/Local):**
- Full card number XOR-encrypted with wallet address as key
- CVV XOR-encrypted same way
- Decrypted client-side via `dbCardService.decryptNumber()` and `dbCardService.decryptCvv()`
- XOR cipher: `charCode ^ parseInt(keyByte, 16)` cycling through wallet hex chars

**vccService card generation (mobile, for local-flow):**
- Card number: Luhn-valid, crypto.getRandomValues(), Visa prefix `4`, Mastercard prefix `5`
- CVV: `crypto.getRandomValues()`, 100–999 range
- Expiry: `MM/YY` format, 3 years from current date
- NOT derived from wallet address (security fix)

---

## PART 11 — ADMIN DASHBOARD QUICK REFERENCE

All routes are Next.js API Routes on Vercel:

| Route | What it does |
|---|---|
| `POST /api/admin/sandbox-kyc` | Generate Codego sandbox KYC session link for a wallet |
| `GET/POST /api/codego/cardholders` | Register user on Codego / check existing status |
| `GET/POST /api/codego/cards` | List or create cards on Codego |
| `PATCH /api/codego/cards/[id]/status` | Update card freeze/unfreeze/block via Codego |
| `GET /api/codego/cards/[id]/transactions` | Get card tx history (falls back to Supabase) |
| `POST /api/codego/fiat/deposit` | Create pending fiat deposit record + return bank details |
| `POST /api/codego/fiat/withdraw` | Create withdrawal (tries Codego, falls back to pending) |
| `POST /api/webhooks/codego` | Receive Codego webhook events |
| `GET /api/admin/fiat-queues` | List all fiat requests (legacy + Codego deposits + withdrawals) |
| `POST /api/admin/fiat-queues/action` | Process approve/reject/complete on fiat requests |
| `GET /api/admin/physical-cards` | List physical card orders |
| `POST /api/admin/physical-cards/action` | Approve/ship/deliver physical card orders |
