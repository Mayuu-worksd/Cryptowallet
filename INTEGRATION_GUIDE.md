# KYC + Supabase Integration Guide

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com → New Project
2. Note your **Project URL** and **anon public key** from:
   Project Settings → API → Project URL / anon key

---

## Step 2 — Configure the Client

Open `services/supabaseClient.ts` and replace:

```ts
export const SUPABASE_URL    = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

---

## Step 3 — Run the Database Schema

1. Supabase Dashboard → SQL Editor → New Query
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**

This creates:
- `kyc` table
- `cards` table
- `card_variants` table (pre-seeded with Classic/Gold/Platinum/Travel)
- `card_requests` table
- RLS policies (anon access for demo)

---

## Step 4 — Create the Storage Bucket

1. Supabase Dashboard → Storage → New Bucket
2. Name: `kyc-docs`
3. Toggle **Public bucket** ON (demo only)
4. Click **Create bucket**

---

## Step 5 — Verify New Files

These files were added/modified:

### New Files
| File | Purpose |
|------|---------|
| `services/supabaseClient.ts` | Supabase singleton client |
| `services/supabaseService.ts` | All DB + storage operations |
| `screens/KYCFormScreen.tsx` | Step 1: personal details form |
| `screens/KYCUploadScreen.tsx` | Step 2: document + selfie upload |
| `screens/KYCStatusScreen.tsx` | KYC status viewer |
| `screens/ApplyPhysicalCardScreen.tsx` | Physical card request flow |
| `supabase_schema.sql` | DB schema (run once) |

### Modified Files
| File | Change |
|------|--------|
| `store/WalletContext.tsx` | Added `kycStatus` + `refreshKYCStatus` |
| `screens/SettingsScreen.tsx` | Added KYC menu row with status badge |
| `screens/CardScreen.tsx` | Added Physical Card CTA banner |
| `App.tsx` | Registered 4 new screens in stack + web |

---

## Step 6 — User Flow

```
Profile → Identity Verification
  → KYCFormScreen   (fill name/email/phone/address)
  → KYCUploadScreen (upload ID doc + selfie)
  → KYCStatusScreen (shows pending/verified/rejected)

Card Tab → Physical Card banner
  → KYCStatus (if not verified)
  → ApplyPhysicalCardScreen (if verified)
      → Select variant (Classic/Gold/Platinum/Travel)
      → Select country (dynamic shipping fee)
      → Submit → success screen
```

---

## Step 7 — Demo Admin: Manually Verify a KYC

Since this is a demo with no real review process, you can manually
approve a submission in Supabase:

1. Supabase Dashboard → Table Editor → `kyc`
2. Find the row by `wallet_address`
3. Change `status` from `pending` → `verified`
4. The app will reflect this on next load or refresh

---

## Architecture Notes

- All records are linked by `wallet_address` (lowercased) — no auth required
- `kycStatus` is loaded into WalletContext on startup and refreshable
- Card variants are loaded from DB with a local fallback (no blank screen if DB is down)
- Shipping fees are a static map in `supabaseService.ts` — easy to extend
- No real card numbers, no real payments, no real compliance logic
