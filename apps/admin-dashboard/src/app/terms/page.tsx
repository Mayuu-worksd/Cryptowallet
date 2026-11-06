import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service — CryptoWallet',
  description: 'Terms of Service for CryptoWallet — rules and conditions for using the app.',
};

const LAST_UPDATED = 'January 1, 2025';
const CONTACT_EMAIL = 'wickb5825@gmail.com';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Header */}
      <header className="border-b-4 border-[#1a1a1a] bg-[#1a1a1a] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-white" />
          <span className="text-white font-black text-xl uppercase tracking-tight font-display">CryptoWallet</span>
        </div>
        <Link
          href="/privacy"
          className="text-white text-xs font-bold uppercase tracking-widest border-2 border-white px-3 py-1.5 hover:bg-white hover:text-[#1a1a1a] transition-all"
        >
          Privacy Policy →
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Title block */}
        <div className="border-4 border-[#1a1a1a] bg-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] p-8 mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-2">Legal Document</p>
          <h1 className="text-4xl font-black uppercase tracking-tight text-[#1a1a1a] font-display leading-none mb-3">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-6 text-sm text-[#1a1a1a] leading-relaxed">

          <Section title="1. Acceptance of Terms">
            By downloading, installing, or using CryptoWallet (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App. These terms apply to all users of the App, including users who contribute content, information, or other materials.
          </Section>

          <Section title="2. Description of Service">
            CryptoWallet is a non-custodial cryptocurrency wallet application that allows users to:
            <ul className="list-none space-y-2 mt-2">
              <Li>Create and manage Ethereum-compatible wallets</Li>
              <Li>Send and receive cryptocurrency on Ethereum, Polygon, Arbitrum, and other EVM-compatible networks</Li>
              <Li>Swap tokens via decentralized exchange aggregators</Li>
              <Li>Apply for and manage virtual debit cards (subject to KYC approval)</Li>
              <Li>View live market prices and transaction history</Li>
            </ul>
          </Section>

          <Section title="3. Non-Custodial Nature">
            <strong>CryptoWallet is a non-custodial wallet.</strong> This means:
            <ul className="list-none space-y-2 mt-2">
              <Li>You are solely responsible for safeguarding your seed phrase and private keys.</Li>
              <Li>We do not have access to your private keys or seed phrase at any time.</Li>
              <Li>If you lose your seed phrase, we cannot recover your wallet or funds. There is no &quot;forgot password&quot; for blockchain assets.</Li>
              <Li>All transactions you sign are final and irreversible on the blockchain.</Li>
            </ul>
          </Section>

          <Section title="4. Eligibility">
            You must be at least 18 years of age to use CryptoWallet. By using the App, you represent and warrant that you are 18 or older and have the legal capacity to enter into these Terms. The App is not available to users in jurisdictions where cryptocurrency services are prohibited by law.
          </Section>

          <Section title="5. Virtual Card Services">
            Virtual card services are provided through third-party card issuers (KripiCard, Codego). To access card services:
            <ul className="list-none space-y-2 mt-2">
              <Li>You must complete KYC (Know Your Customer) identity verification.</Li>
              <Li>Card issuance is subject to approval by our card provider partners.</Li>
              <Li>Virtual cards are for personal use only — commercial use is prohibited.</Li>
              <Li>Card balances are held by the card issuer, not by CryptoWallet.</Li>
              <Li>We are not responsible for card issuer downtime, declined transactions, or card provider policy changes.</Li>
            </ul>
          </Section>

          <Section title="6. Prohibited Activities">
            You agree not to use CryptoWallet for:
            <ul className="list-none space-y-2 mt-2">
              <Li>Money laundering, terrorist financing, or any illegal financial activity</Li>
              <Li>Purchasing illegal goods or services</Li>
              <Li>Circumventing sanctions or export controls</Li>
              <Li>Attempting to reverse-engineer, hack, or exploit the App</Li>
              <Li>Creating multiple accounts to abuse promotional features</Li>
              <Li>Any activity that violates applicable local, national, or international law</Li>
            </ul>
          </Section>

          <Section title="7. Risks of Cryptocurrency">
            You acknowledge and accept the following risks:
            <ul className="list-none space-y-2 mt-2">
              <Li><strong>Volatility:</strong> Cryptocurrency values can fluctuate dramatically and you may lose all funds.</Li>
              <Li><strong>Irreversibility:</strong> Blockchain transactions cannot be reversed once confirmed.</Li>
              <Li><strong>Smart Contract Risk:</strong> Token swaps involve smart contracts that may contain bugs or vulnerabilities.</Li>
              <Li><strong>Regulatory Risk:</strong> Cryptocurrency regulations vary by jurisdiction and may change.</Li>
              <Li><strong>Network Fees:</strong> Gas fees are paid to the blockchain network and are non-refundable.</Li>
            </ul>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES. WE MAKE NO WARRANTY REGARDING THE ACCURACY OF MARKET DATA, PRICE FEEDS, OR TRANSACTION ESTIMATES.
          </Section>

          <Section title="9. Limitation of Liability">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CRYPTOWALLET AND ITS DEVELOPERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF FUNDS, DATA, OR PROFITS, ARISING FROM YOUR USE OF THE APP. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS (WHICH FOR A FREE APP IS $0).
          </Section>

          <Section title="10. Intellectual Property">
            The CryptoWallet app, its design, code, and branding are the intellectual property of the developer. You may not copy, modify, distribute, or create derivative works without explicit written permission. The app is licensed under MIT for open-source components — see the GitHub repository for details.
          </Section>

          <Section title="11. Termination">
            We reserve the right to suspend or terminate your access to card services if you violate these Terms, engage in fraudulent activity, or if required by our card provider partners. Termination of card services does not affect your non-custodial wallet — your keys and funds remain yours.
          </Section>

          <Section title="12. Governing Law">
            These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising from these Terms shall be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration.
          </Section>

          <Section title="13. Changes to Terms">
            We may update these Terms at any time. We will notify users of material changes via an in-app notice. Continued use of the App after changes constitutes acceptance of the updated Terms.
          </Section>

          <Section title="14. Contact">
            For questions about these Terms:
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
            <Link href="/privacy" className="text-gray-400 hover:text-white uppercase font-bold">Privacy Policy</Link>
            <Link href="/terms" className="text-[#EC2629] font-bold uppercase hover:underline">Terms of Service</Link>
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
