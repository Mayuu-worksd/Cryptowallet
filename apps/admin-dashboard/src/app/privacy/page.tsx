'use client';

import { useState } from 'react';
import { Shield, FileText } from 'lucide-react';

const LAST_UPDATED = 'January 1, 2025';

export default function LegalPage() {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy');

  return (
    <div className="min-h-screen bg-[#f5f0e8]">

      {/* Header */}
      <header className="border-b-4 border-[#1a1a1a] bg-[#1a1a1a] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#EC2629] flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-black text-lg uppercase tracking-tight">CryptoWallet</span>
        </div>
        <span className="text-gray-400 text-[10px] font-mono uppercase tracking-widest hidden sm:block">Legal &amp; Compliance</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Title */}
        <div className="mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">Last updated: {LAST_UPDATED}</p>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#1a1a1a] leading-none">
            Legal Documents
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="flex border-4 border-[#1a1a1a] mb-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'privacy'
                ? 'bg-[#EC2629] text-white'
                : 'bg-white text-[#1a1a1a] hover:bg-[#f5f0e8]'
            }`}
          >
            <Shield className="h-4 w-4" />
            Privacy Policy
          </button>
          <div className="w-1 bg-[#1a1a1a]" />
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'terms'
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-white text-[#1a1a1a] hover:bg-[#f5f0e8]'
            }`}
          >
            <FileText className="h-4 w-4" />
            Terms of Service
          </button>
        </div>

        {/* Privacy Policy */}
        {tab === 'privacy' && (
          <div className="space-y-4">
            <Section title="1. Overview">
              CryptoWallet is a non-custodial cryptocurrency wallet application. This Privacy Policy explains what information we collect, how we use it, and your rights. By using CryptoWallet, you agree to the practices described here.
            </Section>

            <Section title="2. Information We Collect">
              <ul className="space-y-2 mt-2">
                <Li><strong>Wallet Address</strong> — Your public EVM wallet address used to identify your account. This is public blockchain data.</Li>
                <Li><strong>KYC Data</strong> — If you apply for a virtual card, we collect your full name, date of birth, address, phone number, email, and government-issued ID. Required by our card issuer partners.</Li>
                <Li><strong>Email Address</strong> — Used only for OTP-based wallet recovery via Supabase Auth.</Li>
                <Li><strong>Transaction History</strong> — On-chain data fetched from Etherscan for display. Already public on the blockchain.</Li>
                <Li><strong>Anonymous Usage Data</strong> — Screen views and session duration to improve performance. No personally identifiable information included.</Li>
                <Li><strong>PIN Hash</strong> — A SHA-256 hash of your PIN with a per-device salt. Your raw PIN is never stored.</Li>
              </ul>
            </Section>

            <Section title="3. What We Do NOT Collect">
              <ul className="space-y-2 mt-2">
                <Li>Your private keys or seed phrase — these never leave your device.</Li>
                <Li>Full card numbers or CVV in plaintext — card data is encrypted at rest.</Li>
                <Li>Location data, contacts, or microphone audio outside of face verification.</Li>
              </ul>
            </Section>

            <Section title="4. How We Use Your Information">
              <ul className="space-y-2 mt-2">
                <Li>To provide wallet functionality — balances, transaction history, QR codes.</Li>
                <Li>To issue virtual cards via our card provider partners.</Li>
                <Li>To verify your identity (KYC) as required by financial regulations.</Li>
                <Li>To send OTP emails for wallet recovery.</Li>
                <Li>To improve app performance through anonymous analytics.</Li>
              </ul>
            </Section>

            <Section title="5. Data Storage & Security">
              Private keys and seed phrases are stored exclusively on your device using OS-level encrypted storage (iOS Keychain / Android Keystore). KYC documents are stored in a private, access-controlled storage bucket. All API communications use HTTPS/TLS. We do not sell your data to third parties.
            </Section>

            <Section title="6. Third-Party Services">
              <ul className="space-y-2 mt-2">
                <Li><strong>Supabase</strong> — Database and authentication</Li>
                <Li><strong>Alchemy</strong> — Ethereum RPC provider</Li>
                <Li><strong>CoinGecko</strong> — Market price data</Li>
                <Li><strong>KripiCard / Codego</strong> — Virtual card issuance (KYC data shared as required)</Li>
                <Li><strong>Etherscan</strong> — On-chain transaction lookup</Li>
              </ul>
            </Section>

            <Section title="7. Data Retention">
              We retain your data for as long as your account is active. KYC documents are retained as required by applicable financial regulations. You may request deletion of your account data by contacting our support team, subject to legal retention requirements.
            </Section>

            <Section title="8. Your Rights">
              Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. Submit a request through the app's support channel and we will respond within 30 days.
            </Section>

            <Section title="9. Children's Privacy">
              CryptoWallet is not intended for users under 18. We do not knowingly collect personal information from minors.
            </Section>

            <Section title="10. Changes to This Policy">
              We may update this Privacy Policy from time to time. Significant changes will be communicated via an in-app notice. Continued use of the app after changes constitutes acceptance.
            </Section>
          </div>
        )}

        {/* Terms of Service */}
        {tab === 'terms' && (
          <div className="space-y-4">
            <Section title="1. Acceptance of Terms">
              By downloading, installing, or using CryptoWallet, you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
            </Section>

            <Section title="2. Description of Service">
              CryptoWallet is a non-custodial cryptocurrency wallet that allows users to:
              <ul className="space-y-2 mt-2">
                <Li>Create and manage Ethereum-compatible wallets</Li>
                <Li>Send and receive cryptocurrency on Ethereum, Polygon, Arbitrum, and other EVM networks</Li>
                <Li>Swap tokens via decentralized exchange aggregators</Li>
                <Li>Apply for and manage virtual debit cards (subject to KYC approval)</Li>
                <Li>View live market prices and transaction history</Li>
              </ul>
            </Section>

            <Section title="3. Non-Custodial Nature">
              <strong>CryptoWallet is a non-custodial wallet.</strong>
              <ul className="space-y-2 mt-2">
                <Li>You are solely responsible for safeguarding your seed phrase and private keys.</Li>
                <Li>We do not have access to your private keys or seed phrase at any time.</Li>
                <Li>If you lose your seed phrase, we cannot recover your wallet or funds.</Li>
                <Li>All signed transactions are final and irreversible on the blockchain.</Li>
              </ul>
            </Section>

            <Section title="4. Eligibility">
              You must be at least 18 years of age to use CryptoWallet. The App is not available in jurisdictions where cryptocurrency services are prohibited by law.
            </Section>

            <Section title="5. Virtual Card Services">
              <ul className="space-y-2 mt-2">
                <Li>Card services require completed KYC identity verification.</Li>
                <Li>Card issuance is subject to approval by our card provider partners.</Li>
                <Li>Virtual cards are for personal use only — commercial use is prohibited.</Li>
                <Li>Card balances are held by the card issuer, not by CryptoWallet.</Li>
                <Li>We are not responsible for card issuer downtime or policy changes.</Li>
              </ul>
            </Section>

            <Section title="6. Prohibited Activities">
              You agree not to use CryptoWallet for:
              <ul className="space-y-2 mt-2">
                <Li>Money laundering, terrorist financing, or any illegal financial activity</Li>
                <Li>Purchasing illegal goods or services</Li>
                <Li>Circumventing sanctions or export controls</Li>
                <Li>Attempting to reverse-engineer, hack, or exploit the App</Li>
                <Li>Any activity that violates applicable local, national, or international law</Li>
              </ul>
            </Section>

            <Section title="7. Risks of Cryptocurrency">
              <ul className="space-y-2 mt-2">
                <Li><strong>Volatility</strong> — Cryptocurrency values can fluctuate dramatically and you may lose all funds.</Li>
                <Li><strong>Irreversibility</strong> — Blockchain transactions cannot be reversed once confirmed.</Li>
                <Li><strong>Smart Contract Risk</strong> — Token swaps involve smart contracts that may contain vulnerabilities.</Li>
                <Li><strong>Regulatory Risk</strong> — Cryptocurrency regulations vary by jurisdiction and may change.</Li>
                <Li><strong>Network Fees</strong> — Gas fees are paid to the blockchain network and are non-refundable.</Li>
              </ul>
            </Section>

            <Section title="8. Disclaimer of Warranties">
              THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED OR ERROR-FREE. WE MAKE NO WARRANTY REGARDING THE ACCURACY OF MARKET DATA OR PRICE FEEDS.
            </Section>

            <Section title="9. Limitation of Liability">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CRYPTOWALLET AND ITS DEVELOPERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF FUNDS OR DATA ARISING FROM YOUR USE OF THE APP.
            </Section>

            <Section title="10. Intellectual Property">
              The CryptoWallet app, its design, code, and branding are the intellectual property of the developer. You may not copy, modify, or distribute without explicit written permission.
            </Section>

            <Section title="11. Termination">
              We reserve the right to suspend card services if you violate these Terms or engage in fraudulent activity. Termination of card services does not affect your non-custodial wallet — your keys and funds remain yours.
            </Section>

            <Section title="12. Governing Law">
              These Terms shall be governed by applicable law. Disputes shall first be resolved through good-faith negotiation, and if unresolved, through binding arbitration.
            </Section>

            <Section title="13. Changes to Terms">
              We may update these Terms at any time. Material changes will be communicated via an in-app notice. Continued use of the App after changes constitutes acceptance.
            </Section>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t-4 border-[#1a1a1a] bg-[#1a1a1a] text-white px-6 py-5 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest">
          <span className="text-gray-400">© 2025 CryptoWallet. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <button onClick={() => {}} className="text-gray-400 hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={() => {}} className="text-gray-400 hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-5">
      <h2 className="text-xs font-black uppercase tracking-tight text-[#1a1a1a] mb-3 pb-2 border-b-2 border-[#1a1a1a]">
        {title}
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 list-none">
      <span className="text-[#EC2629] font-black mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  );
}
