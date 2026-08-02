'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        // Redirect to dashboard
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.message || 'Invalid admin credentials');
      }
    } catch (err: any) {
      setError('An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#f5f0e8] overflow-hidden">
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.06)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Decorative colored boxes in the corners */}
      <div className="absolute top-12 left-12 w-24 h-24 bg-[#ffcc00] border-3 border-[#1a1a1a] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] pointer-events-none hidden md:block" />
      <div className="absolute bottom-12 right-12 w-32 h-32 bg-[#0055ff] border-3 border-[#1a1a1a] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] pointer-events-none hidden md:block" />
      <div className="absolute top-1/4 right-20 w-16 h-16 rounded-full bg-[#e63b2e] border-3 border-[#1a1a1a] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] pointer-events-none hidden md:block" />

      {/* Login Box */}
      <div className="w-full max-w-[440px] px-6 z-10">
        <div className="bg-white border-3 border-[#1a1a1a] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] p-8 md:p-10 transition-all duration-300">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 mb-4">
              <img src="/logo.png" alt="CryptoWallet" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight text-center leading-none">
              CryptoWallet Admin
            </h1>
            <p className="text-[10px] text-gray-500 mt-2.5 font-mono font-bold tracking-widest uppercase">
              AUTHORIZED OPERATIONS PANEL ONLY
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-mono uppercase">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5 font-mono">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Admin Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1a1a1a]">
                  <User className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full brutalist-input !pl-10 focus:ring-0 text-xs font-bold"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Admin Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1a1a1a]">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full brutalist-input !pl-10 !pr-10 focus:ring-0 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-[#1a1a1a] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Security Warning Disclaimer */}
            <p className="text-[9px] text-gray-400 font-semibold uppercase leading-relaxed text-center font-mono">
              All interactions are logged and audited. Unauthorized entry attempts trigger immediate lock protocols.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full brutalist-button py-3.5 flex items-center justify-center gap-2 font-display text-xs font-extrabold uppercase disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#1a1a1a]" />
                  <span>Verifying Node Identity...</span>
                </>
              ) : (
                <span>Access Dashboard</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
