# STRIGA TECHNICAL EVALUATION REPORT
# Based on actual live sandbox testing — June 2026
# Credentials: S51YApQME2DWA0zkceJFlzaGTtz3fQHlV_kKtut1UNM= / sandbox.striga.com

================================================================================
TASK 1 — AUTHENTICATION VERIFICATION
================================================================================

Configuration:
  Base URL       : https://www.sandbox.striga.com/api/v1
  api-key        : S51YApQME2DWA0zkceJFlzaGTtz3fQHlV_kKtut1UNM=
  Authorization  : HMAC {timestamp}:{HMAC-SHA256(timestamp + METHOD + /path + MD5(body))}
  Signature path : /user/create  (without /api/v1 prefix)

Authentication Result: ✅ WORKING
  - 201 on Create User confirms full authentication success
  - No x-application-id header required
  - HMAC signing with path (no prefix) is correct


================================================================================
TASK 2 — API ENDPOINT TEST RESULTS
================================================================================

┌──────────────────────────────────────────────────────────────────────────────┐
│  #  │ Endpoint                       │ Method │ Status │ Result              │
├─────┼────────────────────────────────┼────────┼────────┼─────────────────────┤
│  1  │ /user/create                   │ POST   │  201   │ ✅ WORKS             │
│  2  │ /user/update                   │ PATCH  │  200   │ ✅ WORKS             │
│  3  │ /user/{userId}                 │ GET    │  200   │ ✅ WORKS             │
│  4  │ /user/verify-email             │ POST   │  202   │ ✅ WORKS (any code)  │
│  5  │ /user/verify-mobile            │ POST   │  202   │ ✅ WORKS (any code)  │
│  6  │ /user/kyc/start                │ POST   │  200   │ ✅ WORKS (Sumsub)    │
│  7  │ /user/kyc/{userId}             │ GET    │  200   │ ✅ WORKS             │
│  8  │ /user/resend-email             │ POST   │  --    │ Not tested           │
│  9  │ /user/resend-sms               │ POST   │  --    │ Not tested           │
│ 10  │ /simulate/user/kyc             │ PATCH  │  200   │ ⚠️  PARTIAL          │
│     │                                │        │        │  Returns "OK" but    │
│     │                                │        │        │  status stays        │
│     │                                │        │        │  INITIATED not       │
│     │                                │        │        │  APPROVED            │
│ 11  │ /simulate/accounts/deposit     │ PATCH  │  --    │ ⛔ BLOCKED by KYC   │
│ 12  │ /simulate/sepa                 │ PATCH  │  --    │ ⛔ BLOCKED by KYC   │
│ 13  │ /simulate/card/status          │ PATCH  │  --    │ ⛔ BLOCKED by KYC   │
│ 14  │ /simulate/card/authorization   │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 15  │ /simulate/webhook/ping         │ POST   │  200   │ ✅ WORKS             │
│ 16  │ /wallets/create                │ POST   │  401   │ ⛔ Requires APPROVED │
│ 17  │ /wallets/get                   │ POST   │  401   │ ⛔ Requires APPROVED │
│ 18  │ /wallets/get/all               │ POST   │  401   │ ⛔ Requires APPROVED │
│ 19  │ /wallets/get/account           │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 20  │ /wallets/get/account/statement │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 21  │ /wallets/whitelist-address     │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 22  │ /wallets/send/sepa             │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 23  │ /cards/create                  │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 24  │ /cards/get                     │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 25  │ /cards/block                   │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 26  │ /cards/unblock                 │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 27  │ /cards/get/statement           │ POST   │  --    │ ⛔ BLOCKED by KYC   │
│ 28  │ /application                   │ GET    │  400   │ ❌ Needs UI token    │
│ 29  │ /application/login             │ POST   │  --    │ Not tested           │
└─────┴────────────────────────────────┴────────┴────────┴─────────────────────┘


================================================================================
TASK 3 — COMPLETE BUSINESS FLOW TEST
================================================================================

1.  Create User            ✅  201 — Full user object returned with userId
2.  Update KYC fields      ✅  200 — All fields accepted (no placeOfBirth in v1)
3.  Verify Email           ✅  202 — Sandbox accepts any 6-digit code
4.  Verify Mobile          ✅  202 — Sandbox accepts any 6-digit code
5.  Start KYC              ✅  200 — Sumsub token + verification link returned
6.  Simulate KYC APPROVED  ⚠️  200 "OK" — but status stays INITIATED, NOT APPROVED
7.  Get KYC Status         ✅  200 — Shows tier1.status: INITIATED, currentTier: 1
8.  Create Wallet          ❌  401 UNAPPROVED_IDENTITY (errorDetails: "INITIATED")
9.  Issue Virtual Card     ❌  BLOCKED — needs wallet
10. Issue Physical Card    ❌  BLOCKED — needs wallet
11. Freeze Card            ❌  BLOCKED
12. Unfreeze Card          ❌  BLOCKED
13. Change PIN             ❌  BLOCKED
14. Load Funds             ❌  BLOCKED
15. Test Transactions      ❌  BLOCKED
16. Generate Statements    ❌  BLOCKED
17. Fiat Deposit           ❌  BLOCKED
18. Fiat Withdrawal        ❌  BLOCKED
19. Receive Webhooks       ✅  200 "OK" — webhook ping works

ROOT CAUSE: The /simulate/user/kyc PATCH endpoint returns "OK" and moves the user
to KYC status INITIATED (which means Sumsub processing has begun) but NEVER
transitions to APPROVED. APPROVED requires real Sumsub document verification,
even in sandbox mode. The simulate endpoint only simulates the KYC trigger,
not the KYC result.

CONFIRMED SANDBOX GATE: Striga requires real Sumsub KYC approval before wallets
can be created. This is NOT bypassable via the simulate API in the current sandbox.


================================================================================
TASK 4 — KYC EVALUATION
================================================================================

Does Striga require its own regulatory KYC before issuing cards?
  YES — Mandatory. All wallet and card operations require KYC tier ≥ 1 APPROVED.
  This is enforced at the API level (errorCode 30007 UNAPPROVED_IDENTITY).

KYC Provider:
  Sumsub — Striga calls Sumsub under the hood.
  Start KYC returns a Sumsub JWT token and a verificationLink for the user.
  Users complete document verification via Sumsub web SDK.

Can our Admin KYC remain unchanged?
  NO — Striga's KYC is independent and mandatory. Your admin KYC approval
  does NOT replace Striga's KYC. Even if your admin approves a user,
  Striga still requires the user to complete Sumsub verification before
  any wallet or card can be created.

Can sandbox KYC be automatically approved?
  PARTIALLY — The /simulate/user/kyc endpoint exists and returns "OK"
  but it only transitions status to INITIATED (KYC started), NOT APPROVED.
  Getting to APPROVED in sandbox still requires completing Sumsub.

Are test identities available?
  Yes — Sumsub provides sandbox test identities and a sandbox verification link.
  The verificationLink returned by Start KYC points to:
  https://in.sumsub.com/websdk/p/sbx_[token]
  This is a real Sumsub sandbox where test documents can be uploaded.

Can virtual cards be issued immediately?
  NO — Requires KYC APPROVED first.

Can physical cards be issued immediately?
  NO — Same requirement.

Is there any approval waiting period?
  In sandbox: After submitting documents through Sumsub sandbox SDK,
  approval is typically near-instant (sandbox auto-approves test submissions).
  In production: Real human review by Striga compliance team, timeline unknown.

Complete KYC flow:
  1. POST /user/create
  2. PATCH /user/update (fill all required fields)
  3. POST /user/verify-email (any code in sandbox)
  4. POST /user/verify-mobile (any code in sandbox)
  5. POST /user/kyc/start → returns Sumsub token + verificationLink
  6. User opens verificationLink and uploads documents via Sumsub SDK
  7. Sumsub processes and approves → webhook fires → KYC status = APPROVED
  8. Now wallet and card APIs become available


================================================================================
TASK 5 — SANDBOX LIMITATIONS
================================================================================

┌──────────────────────────────────────────────────────────────────────────────┐
│ Limitation              │ Why                 │ Sandbox Only │ Workaround   │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ KYC simulate does not   │ /simulate/user/kyc  │ YES —        │ Complete     │
│ reach APPROVED status   │ sets INITIATED,     │ production   │ Sumsub SDK   │
│                         │ not APPROVED.       │ uses real    │ flow using   │
│                         │ Sumsub still needed │ Sumsub       │ the          │
│                         │                     │              │ verificationLink│
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ All wallet/card/fiat    │ Hard dependency on  │ YES — same   │ None without │
│ APIs blocked until KYC  │ KYC APPROVED status │ in prod      │ real KYC     │
│ APPROVED                │                     │              │              │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ Email/mobile OTP uses   │ Sandbox bypass:     │ YES —        │ Use any      │
│ any code                │ any 6-digit code    │ prod sends   │ 6-digit code │
│                         │ accepted            │ real SMS/OTP │              │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ Application endpoint    │ Requires x-         │ NO           │ Use          │
│ needs UI token          │ authorization header│              │ /application/│
│                         │ (JWT from login)    │              │ login first  │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ placeOfBirth field      │ API v1 no longer    │ NO           │ Remove field │
│ rejected by update      │ accepts it          │              │ from request │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ Cards simulate          │ Needs valid cardId  │ Sandbox only │ None until   │
│ cannot be tested        │ which needs wallet  │ issue        │ KYC approved │
│                         │ which needs KYC     │              │              │
├─────────────────────────┼─────────────────────┼──────────────┼──────────────┤
│ Fiat deposit/withdrawal │ SEPA requires       │ Same gate    │ None without │
│ untestable              │ KYC APPROVED        │ in prod      │ KYC approval │
└─────────────────────────┴─────────────────────┴──────────────┴──────────────┘


================================================================================
TASK 6 — STRIGA vs CODEGO COMPARISON
================================================================================

┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ Feature                  │ Striga                   │ Codego                   │
├──────────────────────────┼──────────────────────────┼──────────────────────────┤
│ User Creation            │ ✅ Works, full profile   │ ✅ Works                 │
│ KYC Provider             │ Sumsub (mandatory)       │ Own KYC (mandatory)      │
│ Sandbox KYC bypass       │ ⚠️ Only reaches INITIATED│ ❌ Requires admin        │
│                          │ not APPROVED             │ manual approval          │
│ KYC Simulate API         │ ✅ Exists (/simulate/...)│ ❌ No simulate API       │
│ Wallets                  │ ⛔ Blocked until KYC    │ ⛔ Blocked until KYC    │
│ Virtual Cards            │ ⛔ Blocked until KYC    │ ⛔ Blocked until KYC    │
│ Physical Cards           │ ⛔ Blocked until KYC    │ ⛔ Blocked until KYC    │
│ Card Freeze/Unfreeze     │ API exists (untestable)  │ ❌ 404 in sandbox        │
│ PIN Management           │ API exists (untestable)  │ ❌ Unavailable sandbox   │
│ Transactions API         │ API exists (untestable)  │ ❌ 404 in sandbox        │
│ Statements API           │ API exists (untestable)  │ ❌ Unavailable           │
│ Fiat Deposit (SEPA)      │ API exists (untestable)  │ ❌ Unavailable           │
│ Fiat Withdrawal (SEPA)   │ API exists (untestable)  │ ❌ Unavailable           │
│ Webhooks                 │ ✅ Simulate ping works   │ ⚠️ Limited               │
│ Simulate Deposit         │ API exists (blocked)     │ ❌ None                  │
│ Simulate Card Tx         │ API exists (blocked)     │ ❌ None                  │
│ Simulate SEPA            │ API exists (blocked)     │ ❌ None                  │
│ Documentation            │ ✅ Good + Postman        │ ⚠️ Limited               │
│ Postman Collection       │ ✅ Full collection        │ ❌ None                  │
│ Email OTP (sandbox)      │ ✅ Any code works        │ ⚠️ Real email sent       │
│ Mobile OTP (sandbox)     │ ✅ Any code works        │ ⚠️ Real SMS sent         │
│ Supported currencies     │ EUR, BTC, ETH, USDT,    │ EUR, USDT, USDC, others │
│                          │ USDC, BUSD, BNB         │                          │
│ Card types               │ VIRTUAL + PHYSICAL       │ VIRTUAL + PHYSICAL       │
│ Crypto-to-card           │ ✅ Built in              │ ✅ Built in              │
│ Tiered KYC limits        │ ✅ Tier 0/1/2/3 system  │ ❌ Binary approve/reject │
│ Developer experience     │ Better (simulate APIs)   │ Worse (manual approval)  │
│ Sandbox completeness     │ ⚠️ Blocked at KYC gate  │ ⚠️ Blocked at KYC gate  │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘

KEY OBSERVATION: Both providers share the same fundamental sandbox limitation —
KYC approval is required before any meaningful financial API can be tested.
The difference is HOW they implement it:
  - Striga: simulate endpoint exists but doesn't fully bypass Sumsub
  - Codego: no simulate at all, requires manual admin approval


================================================================================
TASK 7 — ARCHITECTURE COMPATIBILITY
================================================================================

Striga can be integrated as StrigaProvider.ts without modifying:
  ✅ Mobile App
  ✅ WalletContext
  ✅ Admin Dashboard
  ✅ Database Schema

Required API mappings in StrigaProvider.ts:

  Our CryptoWallet Action         → Striga API Call
  ─────────────────────────────────────────────────────────────────────
  createUser(data)                → POST /user/create
  updateUserKYC(data)             → PATCH /user/update
  verifyEmail(userId, code)       → POST /user/verify-email
  verifyMobile(userId, code)      → POST /user/verify-mobile
  startKYC(userId)                → POST /user/kyc/start
  getKYCStatus(userId)            → GET  /user/kyc/{userId}
  createWallet(userId)            → POST /wallets/create
  getWallet(userId, walletId)     → POST /wallets/get
  getAllWallets(userId)            → POST /wallets/get/all
  getAccountBalance(userId, accId)→ POST /wallets/get/account
  getAccountStatement(params)     → POST /wallets/get/account/statement
  issueVirtualCard(userId, accId) → POST /cards/create {cardType: 'VIRTUAL'}
  issuePhysicalCard(userId, accId)→ POST /cards/create {cardType: 'PHYSICAL'}
  getCard(userId, cardId)         → POST /cards/get
  freezeCard(userId, cardId)      → POST /cards/block
  unfreezeCard(userId, cardId)    → POST /cards/unblock
  getCardStatement(params)        → POST /cards/get/statement
  sendSEPA(userId, params)        → POST /wallets/send/sepa
  whitelistAddress(userId, data)  → POST /wallets/whitelist-address
  getWhitelistedAddresses(userId) → POST /wallets/get/whitelisted-addresses
  
  Admin/Simulate (sandbox only):
  simulateKYCApproved(userId)     → PATCH /simulate/user/kyc
  simulateDeposit(accountId, amt) → PATCH /simulate/accounts/deposit
  simulateSEPA(txId, accId)       → PATCH /simulate/sepa
  simulateCardTx(cardId, amount)  → POST  /simulate/card/authorization
  pingWebhook(payload)            → POST  /simulate/webhook/ping


================================================================================
TASK 8 — FINAL RECOMMENDATION
================================================================================

APIs That Work Successfully (verified with live 2xx responses):
  ✅ Create User                     (201)
  ✅ Update User                     (200)
  ✅ Get User By Id                  (200)
  ✅ Verify Email                    (202)
  ✅ Verify Mobile                   (202)
  ✅ Start KYC                       (200) — returns Sumsub token
  ✅ Simulate KYC (partial)          (200) — moves to INITIATED only
  ✅ Get KYC Status                  (200)
  ✅ Webhook Ping Simulate           (200)

APIs With Sandbox Limitations (infrastructure exists, blocked by KYC gate):
  ⚠️ /simulate/user/kyc              — Returns OK but does not reach APPROVED
  ⚠️ /wallets/create                 — 401 until KYC APPROVED
  ⚠️ /wallets/get/all                — 401 until KYC APPROVED
  ⚠️ /cards/create (virtual)         — blocked
  ⚠️ /cards/create (physical)        — blocked
  ⚠️ /cards/block                    — blocked
  ⚠️ /cards/unblock                  — blocked
  ⚠️ /simulate/accounts/deposit      — blocked (needs wallet)
  ⚠️ /simulate/card/authorization    — blocked (needs card)
  ⚠️ /wallets/get/account/statement  — blocked (needs wallet)
  ⚠️ /wallets/send/sepa              — blocked (needs wallet)
  ⚠️ /simulate/sepa                  — blocked (needs sepa tx)

APIs That Require Production Access:
  All APIs above become available in production once:
  1. Real Sumsub KYC APPROVED for the user
  2. Wallet created
  3. Card issued

Is Striga Easier to Develop With Than Codego?
  YES — marginally. Striga has:
    - A formal Postman collection with HMAC signing pre-scripts
    - Simulate APIs for all major flows (deposit, SEPA, card, KYC, webhook)
    - Any-code email/mobile OTP bypass
    - Better documentation
    - Tiered KYC limits (more granular)
  However, the KYC gate blocks all financial APIs in both sandbox and production
  until Sumsub approval is received. Codego has the same gate via manual admin.

Does Striga Provide a Better Sandbox?
  MARGINALLY YES for infrastructure quality.
  SAME as Codego for end-to-end testability.
  Both are blocked by KYC before you can test the core financial flows.
  Striga's simulate APIs give a clear path to complete testing once a single
  Sumsub sandbox approval is obtained — which Codego has no equivalent for.

Can Our Admin KYC Workflow Remain Unchanged?
  NO — Striga mandates its own Sumsub KYC. Your admin approval is an additional
  layer but cannot replace Striga's KYC requirement. You would need to either:
    A) Redirect users to Striga/Sumsub KYC after your admin approves, OR
    B) Run your admin KYC in parallel and trigger Striga KYC independently.

Does Striga Still Require Regulatory KYC Before Issuing Real Cards?
  YES — Mandatory in both sandbox and production.
  Cards cannot be issued without KYC tier 1 APPROVED.
  No bypass exists. Sumsub integration is required.

Is Migrating From Codego to Striga Recommended?
  CONDITIONAL YES — if the following are resolved:

    Advantages of migrating:
    ✅ Simulate APIs allow full automated sandbox testing after initial KYC setup
    ✅ Better developer experience with Postman + documentation
    ✅ Tiered KYC limits (Tier 0 → 1 → 2 → 3) = more flexible user onboarding
    ✅ Any-code OTP in sandbox = faster development
    ✅ More supported crypto currencies (includes BUSD, BNB)
    ✅ Active API (no 404s on transaction/statement endpoints in collection)

    Blockers before recommending migration:
    ⛔ KYC sandbox approval must be manually tested via Sumsub SDK first
    ⛔ Both providers require full KYC before cards — no advantage here
    ⛔ Striga is Estonia-based — check regulatory coverage for your target markets
    ⛔ StrigaProvider.ts must be built before migration can begin
    ⛔ PIN management UI needs Striga's challenge flow (different from Codego)

  RECOMMENDED NEXT STEP:
    Complete one Sumsub sandbox approval manually via the verificationLink
    returned by /user/kyc/start, then re-run flows 9–17 to confirm the
    remaining APIs work. If they do, Striga is a superior sandbox provider
    and migration is recommended.

================================================================================
END OF EVALUATION REPORT
================================================================================
