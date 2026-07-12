'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, RefreshCw, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';

interface CardData {
  last4: string;
  maskedNumber: string;
  fullNumber: string;
  cvv: string;
  holderName: string;
  network: string;
  variant: string;
  status: string;
  expiry: string;
  balance: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  merchant: string;
  status: string;
  date: string | null;
  charge?: number;
  postBalance?: number | null;
}

export default function PublicCardPage() {
  const params = useParams();
  const last4 = params['last4'] as string;

  const [card, setCard] = useState<CardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const cardId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('card_id') || '' : '';

  const fetchCard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      // card_id passed to API internally — not shown in browser URL bar
      const url = cardId ? `/api/public/card/${last4}?card_id=${cardId}` : `/api/public/card/${last4}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Card not found'); return; }
      setCard(data.card);
      setTransactions(data.transactions || []);
    } catch {
      setError('Failed to load card data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCard(); }, [last4]);

  if (loading) return (
    <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#1a1a1a] mb-3" />
        <p className="font-bold font-mono uppercase text-sm tracking-wider text-[#1a1a1a]">Loading card...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center p-4">
      <div className="text-center border-3 border-[#1a1a1a] bg-white p-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] max-w-sm w-full">
        <CreditCard className="h-12 w-12 mx-auto text-[#e63b2e] mb-4" />
        <h2 className="text-xl font-black uppercase font-display text-[#1a1a1a] mb-2">Card Not Found</h2>
        <p className="text-sm font-mono text-gray-500">No card ending in <span className="font-bold text-[#1a1a1a]">•••• {last4}</span> was found.</p>
      </div>
    </div>
  );

  if (!card) return null;

  const statusColor = card.status === 'active'
    ? 'bg-[#00ffcc] text-[#1a1a1a]'
    : card.status === 'frozen'
    ? 'bg-[#0055ff] text-white'
    : 'bg-[#e63b2e] text-white';


  return (
    <div className="min-h-screen bg-[#f5f0e8] p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase font-display text-[#1a1a1a] leading-none">JJWallet</h1>
            <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-wider">Virtual Card View</p>
          </div>
          <button onClick={() => fetchCard(true)} disabled={refreshing}
            className="p-2 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] transition-colors shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <RefreshCw className={`h-4 w-4 text-[#1a1a1a] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Card Visual */}
        <div className="relative bg-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] p-6 flex flex-col gap-4 overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ background: 'radial-gradient(circle at 80% 20%, #ffcc00 0%, transparent 60%)' }} />

          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">JJWallet</p>
              <p className="text-xs font-bold text-white uppercase mt-0.5">{card.variant}</p>
            </div>
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border border-white/20 ${statusColor}`}>
              {card.status}
            </span>
          </div>

          {/* Card Number Row */}
          <div className="z-10">
            <p className="text-xl font-mono font-bold text-white tracking-widest">{card.maskedNumber}</p>
          </div>

          {/* Bottom Row */}
          <div className="flex justify-between items-end z-10">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Card Holder</p>
              <p className="text-sm font-bold text-white uppercase">{card.holderName}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Expires</p>
              <p className="text-sm font-bold text-white">{card.expiry || '••/••'}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">CVV</p>
              <p className="text-sm font-bold text-white font-mono">•••</p>
            </div>
          </div>


        </div>

        {/* Balance */}
        <div className="border-3 border-[#1a1a1a] bg-[#ffcc00] p-5 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
          <p className="text-[10px] font-bold uppercase font-mono tracking-widest text-[#1a1a1a]">Available Balance</p>
          <p className="text-4xl font-black font-display text-[#1a1a1a] mt-1">
            ${Number(card.balance).toFixed(2)}
            <span className="text-sm font-bold ml-2">USD</span>
          </p>
        </div>

        {/* Transaction History */}
        <div className="border-3 border-[#1a1a1a] bg-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
          <div className="p-4 border-b-3 border-[#1a1a1a] bg-[#f5f0e8]">
            <h2 className="text-sm font-black uppercase font-display text-[#1a1a1a]">Transaction History</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-10 text-center">
              <Clock className="h-8 w-8 mx-auto text-gray-300 mb-3" />
              <p className="text-xs font-bold uppercase font-mono text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]/10">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-[#ffcc00]/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 border-2 border-[#1a1a1a] flex items-center justify-center ${tx.type === 'topup' ? 'bg-[#00ffcc]' : 'bg-[#f5f0e8]'}`}>
                      {tx.type === 'topup' ? <ArrowDownLeft className="h-4 w-4 text-[#1a1a1a]" /> : <ArrowUpRight className="h-4 w-4 text-[#1a1a1a]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1a1a1a] uppercase">{tx.merchant}</p>
                      <p className="text-[10px] font-mono text-gray-400">
                        {tx.date ? new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </p>
                      {tx.charge != null && tx.charge > 0 && (
                        <p className="text-[9px] font-mono text-gray-400">Fee: ${Number(tx.charge).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black font-mono ${tx.type === 'topup' ? 'text-green-600' : 'text-[#1a1a1a]'}`}>
                      {tx.type === 'topup' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                    </p>
                    {tx.postBalance != null && (
                      <p className="text-[9px] font-mono text-gray-400">Bal: ${Number(tx.postBalance).toFixed(2)}</p>
                    )}
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border border-[#1a1a1a] ${tx.status === 'approved' ? 'bg-[#00ffcc] text-[#1a1a1a]' : 'bg-[#e63b2e] text-white'}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          JJWallet · Virtual Card
        </p>
      </div>
    </div>
  );
}
