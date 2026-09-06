const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hxmacphgbpedazdvgdnz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase env variables not found.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultPages = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    content: `# Terms of Service

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

For inquiries or support, please contact our support desk through the Help & Support section in the app.`,
    is_published: true,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    content: `# Privacy Policy

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
Local app data is protected by system-level encryption (SecureStore / Keychain) and user-configured PIN authentication.`,
    is_published: true,
  },
  {
    slug: 'about',
    title: 'About CryptoWallet',
    content: `# About CryptoWallet

**CryptoWallet** is a state-of-the-art, non-custodial Web3 financial platform designed for multi-chain digital asset management, gasless transactions, and seamless decentralized finance.

---

### Key Capabilities
- **Multi-Chain Support**: Manage Ethereum, TRON (TRC-20), Binance Smart Chain, Solana, and Bitcoin assets in one unified interface.
- **GasFree TRON Transfers**: Transfer USDT on TRON without holding native TRX for gas fees.
- **Integrated Virtual & Physical Cards**: Convert crypto to spendable card balance globally.
- **Decentralized Escrow & P2P**: Trade assets securely through automated escrow contracts.
- **Institutional-Grade Security**: OS-level secure storage encryption with local PIN verification.

CryptoWallet Version 2.0.48`,
    is_published: true,
  }
];

async function seedCMSPages() {
  console.log('🚀 Seeding CMS Pages to Supabase...');
  // 1. Try seeding to cms_pages table
  for (const page of defaultPages) {
    const { data, error } = await supabase
      .from('cms_pages')
      .upsert(page, { onConflict: 'slug' })
      .select();
    if (error) {
      console.warn(`⚠️ Table cms_pages upsert for ${page.slug}:`, error.message);
    } else {
      console.log(`✅ Seeded cms_pages table: "${page.title}" (slug: ${page.slug})`);
    }
  }

  // 2. Also seed to admin_settings table (key: 'cms_pages_data') as a guaranteed fallback
  const cmsMap = {};
  defaultPages.forEach(p => {
    cmsMap[p.slug] = { ...p, id: p.slug, updated_at: new Date().toISOString() };
  });
  const { error: settingsError } = await supabase
    .from('admin_settings')
    .upsert({ key: 'cms_pages_data', value: cmsMap }, { onConflict: 'key' });
  if (settingsError) {
    console.error('❌ Error seeding admin_settings:', settingsError.message);
  } else {
    console.log('✅ Seeded admin_settings table (key: cms_pages_data) successfully!');
  }

  console.log('🎉 Seed complete.');
}

seedCMSPages();
