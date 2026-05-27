import React from 'react';
import Image from 'next/image';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0A0A0A] flex flex-col items-center justify-center">
      <div className="relative flex flex-col items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute w-32 h-32 rounded-full border-4 border-transparent border-t-[#EC2629] border-r-[#EC2629] animate-spin"></div>
        
        {/* Inner pulsing logo */}
        <div className="absolute w-24 h-24 rounded-full bg-[#1A1A1A] flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(236,38,41,0.3)]">
          <Image
            src="/logo.png"
            alt="CryptoWallet Logo"
            width={56}
            height={56}
            className="object-contain drop-shadow-[0_0_15px_rgba(236,38,41,0.5)] animate-bounce"
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>
      
      {/* Loading Text */}
      <div className="mt-20 flex flex-col items-center">
        <h2 className="text-[#EC2629] text-lg font-bold tracking-[0.2em] uppercase animate-pulse">
          Loading
        </h2>
        <div className="flex gap-1 mt-2">
          <div className="w-2 h-2 rounded-full bg-[#EC2629] animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-[#EC2629] animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-[#EC2629] animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
