







# Provider Layer Architectural Review & Readiness Report

**Author:** Senior Software Architect & FinTech Product Engineer  
**Date:** July 2026  
**Status:** Prepared Architecture (Zero Live/Production Integration Until KYC & Funding Approved)

---

## Executive Summary

Our FinTech Crypto Wallet uses a strict **Provider Abstraction Layer** architecture designed to insulate the mobile application (React Native) and core database (Supabase) from third-party Card-as-a-Service (CaaS) provider dependencies.

We have prepared our architecture to support **KripiCard** as a modular provider implementation alongside **Codego**, **Rain**, **Striga**, and future providers. Crucially, **no KripiCard-specific logic or response structures have been hardcoded into the mobile app or core database.**

Once our business KYC is approved and our wallet account is funded, enabling KripiCard requires solely setting `CARD_PROVIDER=kripicard` in the backend configuration (`.env`). No application code, frontend screens, or database schemas require modification.

---

## 1. System Architecture & Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT NATIVE MOBILE APP                         │
│  - Communicates ONLY with Internal Backend API (/api/cards, etc.)     │
│  - Consumes ONLY UnifiedApiResponse / Standardized Card JSON           │
│  - ZERO knowledge of KripiCard, Codego, Rain, or 3rd-party APIs        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST (Unified API Model)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ADMIN DASHBOARD / NEXT.JS BACKEND                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    API Route Layer (/api/cards)                  │  │
│  │  - Validates user JWT & KYC verification status                  │  │
│  │  - Calls getCardProvider() (Provider-Agnostic Interface)         │  │
│  │  - Returns normalized JSON via UnifiedApiResponse envelope       │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────▼─────────────────────────────────┐  │
│  │                     Provider Abstraction Layer                   │  │
│  │                                                                  │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐  │  │
│  │  │   ProviderManager    │  │       Structured Logging         │  │  │
│  │  │ Loads CARD_PROVIDER  │  │  Automatic PAN/CVV Redaction     │  │  │
│  │  └──────────┬───────────┘  └──────────────────────────────────┘  │  │
│  │             │                                                    │  │
│  │             ▼                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │     CardProvider & FinancialProvider Unified Interfaces    │  │  │
│  │  └───────┬───────────────────────┬────────────────────┬───────┘  │  │
│  │          │                       │                    │          │  │
│  │          ▼                       ▼                    ▼          │  │
│  │  ┌───────────────┐       ┌───────────────┐    ┌───────────────┐  │  │
│  │  │  KripiCard    │       │    Codego     │    │     Rain /    │  │  │
│  │  │  Provider     │       │   Provider    │    │ Future Provs  │  │  │
│  │  └───────┬───────┘       └───────┬───────┘    └───────┬───────┘  │  │
│  └──────────┼───────────────────────┼────────────────────┼──────────┘  │
└─────────────┼───────────────────────┼────────────────────┼─────────────┘
              │                       │                    │
              ▼                       ▼                    ▼
     External KripiCard API     External Codego API   Future External API
     (home.kripicard.com)       (api.codego.eu)       (Rain / Wallester)

┌────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE DATABASE                             │
│  - Stores ONLY provider-independent metadata:                          │
│    (User ID, Wallet Address, Provider Name, Provider Card ID, Last 4,  │
│     Expiration MM/YY, Normalized Status, Card Type, Created At)        │
│  - NEVER stores sensitive PAN, CVV, or Provider API Secrets            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Requirements Compliance Matrix

| Requirement | Implementation Strategy & File Location | Verification Status |
| :--- | :--- | :--- |
| **1. No hardcoded KripiCard logic in mobile app** | React Native calls `/api/cards` using generic HTTP requests. Mobile code references zero provider names or SDKs. | ✅ Verified |
| **2. No UI dependence on KripiCard responses** | Route handlers convert all provider responses via `_toCardData()` / `UnifiedCard` before returning JSON to frontend. | ✅ Verified |
| **3. Provider Layer isolates provider APIs** | Only `KripiCardProvider.ts` imports API endpoints (`home.kripicard.com/api/premium`) and formats KripiCard requests. | ✅ Verified |
| **4. Standardized internal format** | `models.ts` defines `UnifiedCard`, `UnifiedCardholder`, `UnifiedTransaction`, and `UnifiedApiResponse<T>`. | ✅ Verified |
| **5. Interfaces for minimal-change replacement** | `CardProvider` & `FinancialProvider` interfaces guarantee any provider can be replaced without backend/frontend rewrites. | ✅ Verified |
| **6. KripiCard as an implementation only** | Implemented `KripiCardProvider` adhering strictly to `CardProvider` and `FinancialProvider` contracts. | ✅ Verified |
| **7. Secrets & auth inside Admin Dashboard** | API keys (`KRIPICARD_API_KEY`, etc.) reside on the secure backend and are checked by `ProviderManager`. | ✅ Verified |
| **8. Provider-independent storage in Supabase** | `supabase_provider_layer_migration.sql` creates `provider_cards` storing only non-sensitive fields (`last4`, `expiry_mm_yy`, `status`). | ✅ Verified |
| **9. Mobile communicates only with Backend API** | Mobile app routes exclusively through our Next.js backend API gateway (`/api/*`). | ✅ Verified |
| **10. Config-based provider selection** | `ProviderManager.loadProvider()` inspects `process.env.CARD_PROVIDER` dynamically at runtime. | ✅ Verified |

---

## 3. Prepared Architectural Components

### A. Unified Domain Models (`src/lib/providers/models.ts`)
- **`UnifiedCard`**: Internal card representation with normalized status (`active`, `frozen`, `blocked`, `pending`, `terminated`), card type (`virtual` or `physical`), `last4`, and `expiryMmYy`.
- **`UnifiedApiResponse<T>`**: Standard response envelope guaranteeing consistent success/error structures (`success`, `data`, `error`, `meta`) across all endpoints.

### B. Unified Exception Handling (`src/lib/providers/exceptions.ts`)
- **Hierarchy**: `ProviderException` → `ProviderNotConfiguredException`, `ProviderAuthenticationException` (HTTP 401/403), `ProviderAPIException` (HTTP 4xx/5xx), `ProviderKYCException`, and `ProviderCardNotFoundException`.
- **Normalization**: `normalizeProviderError(error, providerName)` translates arbitrary HTTP errors or exceptions into standardized structured errors.

### C. Automatic Sensitive Data Sanitization (`src/lib/providers/logger.ts`)
- **`ProviderLogger`**: Intercepts all provider requests and responses, tracking latency (`durationMs`) and operation status.
- **Data Redaction**: Automatically scrubs and masks full 13-19 digit card numbers (`•••• •••• •••• 1234`), CVV codes (`***`), SSNs, and API keys before logging.

### D. KripiCard Provider Implementation (`src/lib/providers/KripiCardProvider.ts`)
- Implements both `CardProvider` and `FinancialProvider` interfaces.
- Maps internal actions (`createCard`, `getCard`, `freezeCard`, `unfreezeCard`, `getTransactions`, `fundVirtualCard`) to KripiCard Premium BIN API v1.6 endpoints.
- Ready for non-disruptive enablement once KYC is approved.

### E. Configuration-Based Provider Manager (`src/lib/providers/ProviderManager.ts`)
- Dynamically resolves provider implementations based on `process.env.CARD_PROVIDER`:
  - `codego` → `CodegoProvider`
  - `kripicard` → `KripiCardProvider`
  - `rain` → `RainProvider`
  - `striga` → `StrigaProvider`
  - `pintopay` / `kulipa` / `future` → Respective provider classes
- Includes `validateConfiguration()` to verify credentials and connectivity before switching production traffic.

---

## 4. Review & Recommendations for the Provider Layer

During our comprehensive review of existing Provider Layer code and routes, we identified and addressed several critical areas to ensure enterprise-grade reliability:

### 1. Database Storage Independence (Resolved via `supabase_provider_layer_migration.sql`)
- **Observation**: Legacy card records were historically stored in `vcc_cards` with column names like `codego_card_id` and `codego_status`.
- **Improvement**: Created `supabase_provider_layer_migration.sql` introducing `provider_cards` and `provider_cardholders`. These tables store generic identifiers (`provider_name`, `provider_card_id`, `card_last4`, `expiry_mm_yy`) so switching providers never breaks SQL queries or requires schema alterations.

### 2. Log Sanitation & PCI-DSS Compliance (Resolved via `logger.ts`)
- **Observation**: Unsanitized provider JSON responses could accidentally log full PAN or CVV during card issuance debug sessions.
- **Improvement**: Implemented recursive regex-based masking in `ProviderLogger.sanitizeLogData()` to guarantee full PAN numbers and CVVs are masked before hitting stdout or log aggregators.

### 3. Route Response Normalization (Resolved in `/api/cards/route.ts`)
- **Observation**: Route handlers previously returned raw provider JSON objects (`liveCard.raw`) in certain branches.
- **Improvement**: Standardized all responses through `UnifiedApiResponse` and `_toCardData()`, ensuring React Native receives a clean, deterministic schema across all providers.

---

## 5. Pre-Production Activation Checklist

When business KYC is approved and our KripiCard wallet is funded, execute the following steps to activate and verify KripiCard without changing any code:

1. **Configure Environment Variables** (in `.env.local` or production deployment settings):
   ```env
   CARD_PROVIDER=kripicard
   KRIPICARD_API_KEY=your_approved_kripicard_api_key
   KRIPICARD_BASE_URL=https://home.kripicard.com/api/premium
   ```
2. **Verify Configuration Readiness**:
   - Run `ProviderManager.validateConfiguration()` or inspect server startup logs:
     ```
     [ProviderLogger:INFO] {"provider":"kripicard","operation":"loadProvider","message":"Active provider initialized successfully: kripicard"}
     ```
3. **Execute Sandbox / Verification Tests**:
   - Test issuing a virtual card via `/api/cards`.
   - Verify that Supabase stores only non-sensitive metadata (`last4`, `expiry_mm_yy`, `status`).
   - Verify that server logs mask sensitive PAN/CVV output.
4. **Go Live**:
   - Begin production card issuance with zero mobile app deployment or React Native binary updates required.
