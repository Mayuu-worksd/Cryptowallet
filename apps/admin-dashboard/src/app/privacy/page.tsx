import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — CryptoWallet',
  description: 'Privacy Policy for CryptoWallet — how we collect, use, and protect your data.',
};

const LAST_UPDATED = 'January 1, 2025';
const CONTACT_EMAIL = 'wickb5825@gmail.com';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Header */}
      <header className="border-b-4 border-[#1a1a1a] bg-[#EC2629] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-white" />
          <span className="text-white font-black text-xl uppercase tracking-tight font-display">CryptoWallet</span>
        </div>
        <Link
          href="/terms"
          className="text-white text-xs font-bold uppercase tracking-widest border-2 border-white px-3 py-1.5 hover:bg-white hover:text-[#EC2629] transition-all"
        >
          Terms of Service →
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Title block */}
        <div className="border-4 border-[#1a1a1a] bg-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] p-8 mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-2">Legal Document</p>
          <h1 className="text-4xl font-black uppercase tracking-tight text-[#1a1a1a] font-display leading-none mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-6 text-sm text-[#1a1a1a] leading-relaxed">

          <Section title="1. Overview">
            CryptoWallet (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a non-custodial cryptocurrency wallet application. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data. By using CryptoWallet, you agree to the practices described in this policy.
          </Section>

          <Section title="2. Information We Collect">
            <ul className="list-none space-y-2 mt-2">
              <Li><strong>Wallet Address:</strong> Your public Ethereum/EVM wallet address, used to identify your account. This is public blockchain data.</Li>
              <Li><strong>KYC Data (optional):</strong> If you apply for a virtual card, we collect your full name, date of birth, address, phone number, email, and government-issued ID documents. This is required by our card issuer partners.</Li>
              <Li><strong>Email Address:</strong> If you use email-based wallet recovery, we store your email via Supabase Auth to send one-time passwords (OTPs).</Li>
              <Li><strong>Transaction History:</strong> On-chain transaction data fetched from Etherscan and stored locally for display purposes. This data is already public on the blockchain.</Li>
              <Li><strong>Device & Usage Data:</strong> Anonymous app traffic logs (screen views, session duration) to improve app performance. No personally identifiable information is included.</Li>
              <Li><strong>PIN Hash:</strong> A SHA-256 hash of your PIN with a per-device salt. The raw PIN is never stored.</Li>
            </ul>
          </Section>

          <Section title="3. What We Do NOT Collect">
            <ul className="list-none space-y-2 mt-2">
              <Li>Your private keys or seed phrase — these never leave your device.</Li>
              <Li>Your full card number or CVV in plaintext — card data is encrypted at rest.</Li>
              <Li>Location data, contacts, or microphone audio outside of face verification.</Li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Information">
            <ul className="list-none space-y-2 mt-2">
              <Li>To provide wallet functionality — balance display, transaction history, QR code generation.</Li>
              <Li>To issue virtual cards via our card provider partners (KripiCard, Codego).</Li>
              <Li>To verify your identity (KYC) as required by financial regulations.</Li>
              <Li>To send OTP emails for wallet recovery.</Li>
              <Li>To improve app performance through anonymous analytics.</Li>
            </ul>
          </Section>

          <Section title="5. Data Storage & Security">
            Your private keys and seed phrase are stored exclusively on your device using OS-level encrypted storage (iOS Keychain / Android Keystore via <code className="bg-gray-100 px-1 font-mono text-xs">expo-secure-store</code>). KYC documents are stored in a private Supabase storage bucket with row-level security. All API communications use HTTPS/TLS. We do not sell your data to third parties.
          </Section>

          <Section title="6. Third-Party Services">
            We use the following third-party services, each with their own privacy policies:
            <ul className="list-none space-y-2 mt-2">
              <Li><strong>Supabase</strong> — database and authentication (<a href="https://supabase.com/privacy" className="text-[#EC2629] underline" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>)</Li>
              <Li><strong>Alchemy</strong> — Ethereum RPC provider (<a href="https://www.alchemy.com/policies/privacy-policy" className="text-[#EC2629] underline" target="_blank" rel="noopener noreferrer">alchemy.com/privacy</a>)</Li>
              <Li><strong>CoinGecko</strong> — market price data (<a href="https://www.coingecko.com/en/privacy" className="text-[#EC2629] underline" target="_blank" rel="noopener noreferrer">coingecko.com/privacy</a>)</Li>
              <Li><strong>KripiCard / Codego</strong> — virtual card issuance (KYC data shared as required for card provisioning)</Li>
              <Li><strong>Etherscan</strong> — on-chain transaction lookup</Li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            We retain your data for as long as your account is active. KYC documents are retained as required by applicable financial regulations (typically 5 years). You may request deletion of your account data by contacting us at the email below, subject to legal retention requirements.
          </Section>

          <Section title="8. Your Rights">
            Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#EC2629] underline">{CONTACT_EMAIL}</a>. We will respond within 30 days.
          </Section>

          <Section title="9. Children's Privacy">
            CryptoWallet is not intended for users under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal data, please contact us immediately.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify users of significant changes via an in-app notice. Continued use of the app after changes constitutes acceptance of the updated policy.
          </Section>

          <Section title="11. Contact Us">
            For privacy-related questions or requests:
            <div className="mt-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] p-4 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <p><strong>CryptoWallet</strong></p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#EC2629] underline">{CONTACT_EMAIL}</a></p>
              <p>GitHub: <a href="https://github.com/Mayuu-worksd" className="text-[#EC2629] underline" target="_blank" rel="noopener noreferrer">github.com/Mayuu-worksd</a></p>
            </div>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-[#1a1a1a] bg-[#1a1a1a] text-white px-6 py-6 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <span className="font-bold uppercase tracking-widest">© 2025 CryptoWallet. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[#EC2629] font-bold uppercase hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="text-gray-400 hover:text-white uppercase font-bold">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-6">
      <h2 className="text-sm font-black uppercase tracking-tight text-[#1a1a1a] font-display mb-3 pb-2 border-b-2 border-[#1a1a1a]">
        {title}
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-[#EC2629] font-black mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  );
}
