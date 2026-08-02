'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AuthPaymentPage() {
  const params = useParams();
  const authId = params?.id as string;

  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // OTP state (8 digits)
  const [otp, setOtp] = useState<string[]>(Array(8).fill(''));
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Fetch authorization details
  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/authorization/status?id=${authId}`);
      const json = await res.json();
      if (json.success) {
        setStatusData(json.data);
        setError('');
        
        // Calculate remaining seconds
        const expiry = new Date(json.data.expires_at).getTime();
        const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setTimeLeft(diff);
      } else {
        setError(json.error || 'Failed to fetch transaction details.');
      }
    } catch (err) {
      setError('Connection failed. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authId) {
      fetchStatus();
    }
  }, [authId]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStatusData((curr: any) => curr ? { ...curr, status: 'expired' } : null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle OTP inputs auto-advance
  const handleOtpChange = (val: string, index: number) => {
    const cleanVal = val.replace(/\D/g, ''); // Numeric only
    if (!cleanVal) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    const newOtp = [...otp];
    // If user pasted a code
    if (cleanVal.length > 1) {
      const pasted = cleanVal.slice(0, 8 - index).split('');
      pasted.forEach((char, i) => {
        if (index + i < 8) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      const targetFocusIdx = Math.min(7, index + pasted.length);
      inputRefs.current[targetFocusIdx]?.focus();
      return;
    }

    newOtp[index] = cleanVal;
    setOtp(newOtp);

    // Focus next
    if (index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join('');
    if (fullCode.length < 8) {
      setError('Please enter the complete 8-digit verification code.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/authorization/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_id: authId, otp: fullCode }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setSuccessMsg(json.message || 'Transaction approved!');
        setStatusData((prev: any) => ({ ...prev, status: 'authorized' }));
      } else {
        setError(json.error || 'Verification failed.');
        setOtp(Array(8).fill('')); // Clear OTP
        inputRefs.current[0]?.focus();
        
        // Refresh status to update attempts
        fetchStatus();
      }
    } catch (err) {
      setError('Network connection failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    
    try {
      const res = await fetch('/api/authorization/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_id: authId }),
      });
      const json = await res.json();
      
      if (res.ok && json.success) {
        setResendCooldown(60); // 60s cooldown
        setSuccessMsg('A new verification code has been sent to your email.');
        setTimeout(() => setSuccessMsg(''), 5000);
        // Reset timer to 5 minutes
        setTimeLeft(300);
      } else {
        setError(json.error || 'Failed to resend code.');
      }
    } catch (err) {
      setError('Network failed. Try again.');
    }
  };

  // Format countdown mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center text-white">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EC2629]"></div>
          <div className="absolute font-semibold text-xs tracking-widest text-[#EC2629]">KRIPI</div>
        </div>
        <p className="mt-6 text-sm text-gray-400 font-display animate-pulse">Initializing Secure Gateway...</p>
      </div>
    );
  }

  const isPending = statusData?.status === 'pending';
  const isAuthorized = statusData?.status === 'authorized';
  const isRejected = statusData?.status === 'rejected';
  const isExpired = statusData?.status === 'expired';

  return (
    <div className="min-h-screen bg-[#131313] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(147,0,13,0.15),rgba(255,255,255,0))] flex flex-col items-center justify-center p-4">
      {/* 3DS / ACS Brand Frame */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between px-2 text-xs font-display tracking-widest text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SECURE ACS GATEWAY
        </span>
        <span>ID: {authId.slice(0, 8)}...</span>
      </div>

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-md bg-[#1C1B1B]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
        
        {/* Core Red Glowing Gradient Overlay */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#EC2629]/20 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#EC2629]/10 rounded-full blur-3xl -z-10"></div>

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-3 shadow-inner">
            <svg className="h-6 w-6 text-[#EC2629]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight font-display text-white">KripiCard Secure Check</h2>
          <p className="text-xs text-gray-500 mt-1">Institutional Multi-Device Cryptographic Verification</p>
        </div>

        {/* Transaction Summary Panel */}
        <div className="bg-[#201F1F]/60 border border-white/5 rounded-2xl p-5 mb-6 text-sm font-sans relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400">Merchant</span>
            <span className="font-semibold text-white">{statusData?.merchant}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400">Amount</span>
            <span className="text-lg font-bold font-display text-[#EC2629]">
              {statusData?.amount?.toFixed(2)} {statusData?.currency}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs text-gray-500">
            <span>Card Ending</span>
            <span className="font-mono text-gray-300">•••• •••• •••• {statusData?.card_last4}</span>
          </div>
        </div>

        {/* Alerts / Error Panel */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* ────────────────── PENDING SCREEN ────────────────── */}
        {isPending && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-400">
                A verification code was sent to <strong className="text-gray-200">{statusData?.masked_email}</strong>.
              </p>
              <p className="text-xs text-gray-500">Please enter the 8-digit OTP code below.</p>
            </div>

            {/* OTP Slots Row */}
            <div className="flex justify-between gap-1.5">
              {otp.map((char, index) => (
                <input
                  key={index}
                  ref={(el: any) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleOtpChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-10 h-12 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold font-display text-white focus:outline-none focus:ring-2 focus:ring-[#EC2629]/50 focus:border-[#EC2629] transition-all"
                  autoFocus={index === 0}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              ))}
            </div>

            {/* Countdown / Resend Option */}
            <div className="flex items-center justify-between text-xs pt-2">
              <div className="flex items-center gap-1.5 text-gray-400">
                <svg className="h-4 w-4 animate-pulse text-[#EC2629]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Code expires in: <strong className="font-mono text-white">{formatTime(timeLeft)}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className={`font-semibold transition-colors ${
                  resendCooldown > 0 ? 'text-gray-600 cursor-not-allowed' : 'text-[#EC2629] hover:text-[#93000D]'
                }`}
              >
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
              </button>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={verifying || otp.join('').length < 8}
              className="w-full py-4 rounded-xl font-display font-bold text-white bg-gradient-to-r from-[#EC2629] to-[#D93025] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-[#EC2629]/30 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying Cryptographic OTP...
                </>
              ) : (
                'Authorize Transaction'
              )}
            </button>
            
            <div className="text-center">
              <span className="text-[10px] text-gray-600">Verification attempt {statusData?.attempts + 1} of 3</span>
            </div>
          </form>
        )}

        {/* ────────────────── SUCCESS / AUTHORIZED SCREEN ────────────────── */}
        {isAuthorized && (
          <div className="text-center py-6 space-y-6">
            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <svg className="h-8 w-8 text-emerald-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-display text-white">Payment Authorized</h3>
              <p className="text-xs text-gray-400">The checkout request has been approved. You can safely close this window now.</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-500/10 text-xs text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Status: AUTHORIZED
            </div>
          </div>
        )}

        {/* ────────────────── REJECTED SCREEN ────────────────── */}
        {isRejected && (
          <div className="text-center py-6 space-y-6">
            <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-red-500/10">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-display text-white">Transaction Declined</h3>
              <p className="text-xs text-gray-400">This payment request was rejected due to incorrect attempts or policy blocks.</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-950/30 border border-red-500/10 text-xs text-red-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
              Status: REJECTED
            </div>
          </div>
        )}

        {/* ────────────────── EXPIRED SCREEN ────────────────── */}
        {isExpired && (
          <div className="text-center py-6 space-y-6">
            <div className="h-16 w-16 bg-amber-500/10 border border-amber-500/20 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-amber-500/10">
              <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-display text-white">Verification Window Closed</h3>
              <p className="text-xs text-gray-400">The 5-minute transaction authorization window has expired.</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/30 border border-amber-500/10 text-xs text-amber-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              Status: EXPIRED
            </div>
            <p className="text-xs text-gray-500">Please re-initiate payment at the merchant checkout.</p>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <p className="text-[10px] text-gray-600 mt-6 text-center max-w-xs font-sans leading-relaxed">
        This ACS portal uses AES-GCM secure storage and standard SHA-256 session mapping to secure your crypto transactions.
      </p>
    </div>
  );
}
