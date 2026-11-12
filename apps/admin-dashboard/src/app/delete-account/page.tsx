'use client';

import { Shield, Trash2, AlertTriangle, Mail } from 'lucide-react';

export default function DeleteAccountPage() {
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
        <span className="text-gray-400 text-[10px] font-mono uppercase tracking-widest hidden sm:block">Account Deletion</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Title */}
        <div className="mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-1">Data & Privacy</p>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#1a1a1a] leading-none">
            Delete Your Account
          </h1>
        </div>

        {/* Warning */}
        <div className="border-2 border-[#EC2629] bg-white shadow-[3px_3px_0px_0px_rgba(236,38,41,1)] p-5 mb-6 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-[#EC2629] shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 leading-relaxed">
            <strong className="text-[#1a1a1a]">This action is irreversible.</strong> Deleting your account will permanently remove your profile, KYC data, virtual card records, and transaction history from our servers. Your on-chain wallet and funds are unaffected — your private keys and seed phrase remain on your device.
          </div>
        </div>

        {/* What gets deleted */}
        <div className="border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-5 mb-6">
          <h2 className="text-xs font-black uppercase tracking-tight text-[#1a1a1a] mb-3 pb-2 border-b-2 border-[#1a1a1a]">
            What Gets Deleted
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              'Your email address and authentication data',
              'KYC identity documents and verification records',
              'Virtual card application and spend history',
              'P2P trade history and merchant profile',
              'App usage and session data',
              'Wallet profile and linked addresses',
            ].map((item) => (
              <li key={item} className="flex gap-2 list-none">
                <span className="text-[#EC2629] font-black mt-0.5 shrink-0">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What is NOT deleted */}
        <div className="border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-5 mb-6">
          <h2 className="text-xs font-black uppercase tracking-tight text-[#1a1a1a] mb-3 pb-2 border-b-2 border-[#1a1a1a]">
            What Is NOT Deleted
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              'Your on-chain wallet — it exists on the blockchain permanently',
              'Your private keys and seed phrase — stored only on your device, we never have them',
              'On-chain transaction records — these are public blockchain data and cannot be removed',
              'KYC data may be retained for up to 5 years as required by applicable financial regulations',
            ].map((item) => (
              <li key={item} className="flex gap-2 list-none">
                <span className="text-gray-400 font-black mt-0.5 shrink-0">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* How to request deletion */}
        <div className="border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-5 mb-6">
          <h2 className="text-xs font-black uppercase tracking-tight text-[#1a1a1a] mb-3 pb-2 border-b-2 border-[#1a1a1a]">
            How to Request Deletion
          </h2>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#1a1a1a] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Send an email to <strong>wickb5825@gmail.com</strong> with the subject line: <strong>"Account Deletion Request"</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#1a1a1a] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Include your registered email address and wallet address so we can identify your account</span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#1a1a1a] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>We will process your request within <strong>30 days</strong> and send a confirmation email once complete</span>
            </li>
          </ol>
        </div>

        {/* CTA */}
        <a
          href="mailto:wickb5825@gmail.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20CryptoWallet%20account.%0A%0ARegistered%20email%3A%20%0AWallet%20address%3A%20"
          className="flex items-center justify-center gap-3 w-full py-4 bg-[#EC2629] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] text-white font-black text-sm uppercase tracking-widest hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-all"
        >
          <Mail className="h-4 w-4" />
          Request Account Deletion
        </a>

        <p className="text-center text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-4">
          Requests are processed within 30 days · wickb5825@gmail.com
        </p>

      </main>

      {/* Footer */}
      <footer className="border-t-4 border-[#1a1a1a] bg-[#1a1a1a] text-white px-6 py-5 mt-12">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest">
          <span className="text-gray-400">© 2025 CryptoWallet. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
