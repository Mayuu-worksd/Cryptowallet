-- =============================================================================
-- CMS & Legal Content Management Schema — Supabase
-- Stores mobile legal documents, privacy policies, terms of service, and info pages
-- Safe to re-run (CREATE TABLE IF NOT EXISTS / ON CONFLICT)
-- =============================================================================

-- ─── 1. Table Definition ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by slug
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_published ON cms_pages(is_published);

-- updated_at trigger
DROP TRIGGER IF EXISTS cms_pages_updated_at ON cms_pages;
CREATE TRIGGER cms_pages_updated_at
  BEFORE UPDATE ON cms_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Row Level Security (RLS) ──────────────────────────────────────────────
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published pages
DROP POLICY IF EXISTS "Allow public read access to published cms pages" ON cms_pages;
CREATE POLICY "Allow public read access to published cms pages"
  ON cms_pages FOR SELECT
  USING (is_published = true);

-- Allow full access for anon, authenticated, and service_role for admin tools & backend API
GRANT ALL ON cms_pages TO anon, authenticated, service_role;

-- ─── 3. Seed Initial Legal Pages ──────────────────────────────────────────────
INSERT INTO cms_pages (slug, title, content, is_published)
VALUES 
(
  'terms',
  'Terms of Service',
  '# Terms of Service

Last Updated: September 2026

Welcome to **CryptoWallet**. By creating, importing, or using a wallet within this application, you agree to comply with and be bound by the following Terms of Service.

---

### 1. Non-Custodial Architecture
CryptoWallet is a non-custodial cryptocurrency wallet application. 
- You retain sole ownership and responsibility for your private keys, seed phrases, and funds.
- We do not store, hold, or have access to your private keys or recovery mnemonics.
- If you lose your recovery phrase, your funds cannot be recovered by CryptoWallet staff.

### 2. User Responsibilities
- Keep your 12-word BIP39 recovery phrase backed up in a secure, offline location.
- Verify recipient addresses and network details carefully prior to submitting transactions.
- Transactions broadcasted to blockchain networks (Ethereum, TRON, BSC, Solana, Bitcoin) are irreversible.

### 3. Acceptable Use
You agree not to use CryptoWallet for unlawful activities, including money laundering, fraud, or unauthorized financial transactions.

---

### 4. Limitation of Liability
CryptoWallet is provided "as is" without warranty of any kind. We are not liable for losses caused by lost keys, blockchain network congestion, smart contract vulnerabilities, or user error.

For inquiries or support, please contact our support desk through the Help & Support section in the app.',
  true
),
(
  'privacy',
  'Privacy Policy',
  '# Privacy Policy

Last Updated: September 2026

Your privacy is paramount. This Privacy Policy details how **CryptoWallet** protects your information.

---

### 1. Zero Personal Data Tracking
CryptoWallet is built on privacy-first architecture:
- We do **not** log, track, or sell your personal browsing habits, location, or transaction history.
- Your wallet private keys and recovery seed phrases remain encrypted strictly on your local device.

### 2. Information We Process
- **Public Wallet Addresses**: Used solely to query public blockchain nodes for balances and transaction history.
- **Account Profiles**: Basic preferences (display currency, theme preference, optional wallet name) stored in encrypted database tables to customize your experience.
- **Customer Support Logs**: Information you voluntarily provide when contacting support.

---

### 3. Third-Party RPC Providers
To interact with blockchains, the mobile app communicates with public blockchain nodes and RPC endpoints. These endpoints process standard blockchain queries to fetch on-chain state.

### 4. Data Security
Local app data is protected by system-level encryption (SecureStore / Keychain) and user-configured PIN authentication.',
  true
),
(
  'about',
  'About CryptoWallet',
  '# About CryptoWallet

**CryptoWallet** is a state-of-the-art, non-custodial Web3 financial platform designed for multi-chain digital asset management, gasless transactions, and seamless decentralized finance.

---

### Key Capabilities
- **Multi-Chain Support**: Manage Ethereum, TRON (TRC-20), Binance Smart Chain, Solana, and Bitcoin assets in one unified interface.
- **GasFree TRON Transfers**: Transfer USDT on TRON without holding native TRX for gas fees.
- **Integrated Virtual & Physical Cards**: Convert crypto to spendable card balance globally.
- **Decentralized Escrow & P2P**: Trade assets securely through automated escrow contracts.
- **Institutional-Grade Security**: OS-level secure storage encryption with local PIN verification.

CryptoWallet Version 2.0.48',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();
