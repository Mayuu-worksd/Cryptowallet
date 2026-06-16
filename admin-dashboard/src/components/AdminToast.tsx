'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export type Toast = {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
};

export const AdminToast = ({ toast, onClose }: { toast: Toast; onClose: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    
    // Auto dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [onClose]);

  const getThemeColors = () => {
    switch (toast.type) {
      case 'warning': return 'bg-[#eab308] border-[#1a1a1a] text-[#1a1a1a]';
      case 'error': return 'bg-[#ef4444] border-[#1a1a1a] text-white';
      case 'success': return 'bg-[#22c55e] border-[#1a1a1a] text-white';
      default: return 'bg-white border-[#1a1a1a] text-[#1a1a1a]';
    }
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className={`flex items-start gap-3 p-4 border-2 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] w-80 ${getThemeColors()}`}>
        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 font-mono">
          <h4 className="font-bold text-sm tracking-tight mb-1 uppercase">{toast.title}</h4>
          <p className="text-xs leading-relaxed opacity-90">{toast.message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-current hover:opacity-70 transition-opacity p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
