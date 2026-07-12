'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, RefreshCw, Search, ExternalLink } from 'lucide-react';

interface CardRow {
  id: string;
  card_last4: string;
  card_holder_name: string;
  card_variant: string;
  card_network: string;
  card_status: string;
  balance: number;
  expiry_mm_yy: string;
  codego_card_id: string | null;
  created_at: string;
}

export default function PublicCardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchCards = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/public/cards');
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load cards'); return; }
      setCards(data.cards || []);
    } catch {
      setError('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  const filtered = cards.filter(c =>
    !search ||
    c.card_last4.includes(search) ||
    c.card_holder_name.toLowerCase().includes(search.toLowerCase()) ||
    c.card_variant.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'active' ? 'bg-[#00ffcc] text-[#1a1a1a]' :
    s === 'frozen' ? 'bg-[#0055ff] text-white' :
    'bg-[#e63b2e] text-white';

  return (
    <div className="min-h-screen bg-[#f5f0e8] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase font-mono text-[#1a1a1a] leading-none">KripiCard</h1>
            <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-wider">All Issued Cards</p>
          </div>
          <button
            onClick={fetchCards}
            disabled={loading}
            className="p-2 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] transition-colors shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
          >
            <RefreshCw className={`h-4 w-4 text-[#1a1a1a] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 border-2 border-[#1a1a1a] bg-white px-4 py-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by last 4 digits, holder name, or variant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm font-mono text-[#1a1a1a] outline-none placeholder-gray-400"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Cards', value: cards.length },
            { label: 'Active', value: cards.filter(c => c.card_status === 'active').length },
            { label: 'Real KripiCards', value: cards.filter(c => c.codego_card_id && !c.codego_card_id.startsWith('mock_cg_')).length },
          ].map(s => (
            <div key={s.label} className="border-2 border-[#1a1a1a] bg-white p-4 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
              <p className="text-[9px] font-bold uppercase font-mono tracking-wider text-gray-500">{s.label}</p>
              <p className="text-2xl font-black font-mono text-[#1a1a1a] mt-1">{loading ? '...' : s.value}</p>
            </div>
          ))}
        </div>

        {/* Cards List */}
        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#1a1a1a] mb-3" />
            <p className="font-bold font-mono uppercase text-sm tracking-wider text-[#1a1a1a]">Loading cards...</p>
          </div>
        ) : error ? (
          <div className="border-2 border-[#e63b2e] bg-white p-6 text-center">
            <p className="text-sm font-bold font-mono text-[#e63b2e]">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-2 border-[#1a1a1a] bg-white p-16 text-center shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
            <CreditCard className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-bold font-mono uppercase text-gray-400">No cards found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(card => (
              <button
                key={card.id}
                onClick={() => router.push(`/card/${card.card_last4}${card.codego_card_id && !card.codego_card_id.startsWith('mock_cg_') ? `?card_id=${card.codego_card_id}` : ''}`)}
                className="w-full border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00]/10 transition-colors shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] p-4 flex items-center gap-4 text-left"
              >
                {/* Mini card visual */}
                <div className="h-12 w-20 bg-[#1a1a1a] border border-[#1a1a1a] flex flex-col justify-between p-1.5 shrink-0">
                  <p className="text-[7px] font-mono text-gray-400 uppercase">KripiCard</p>
                  <p className="text-[9px] font-bold text-white font-mono">•••• {card.card_last4}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black uppercase font-mono text-[#1a1a1a]">{card.card_holder_name}</p>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border border-[#1a1a1a] ${statusColor(card.card_status)}`}>
                      {card.card_status}
                    </span>
                    {card.codego_card_id && !card.codego_card_id.startsWith('mock_cg_') ? (
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase border border-green-600 bg-green-50 text-green-700">Real</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase border border-[#ffcc00] bg-[#ffcc00]/20 text-[#1a1a1a]">Mock</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[10px] font-mono text-gray-500">
                    <span>{card.card_network} · {card.card_variant}</span>
                    <span>Exp: {card.expiry_mm_yy || '••/••'}</span>
                    <span className="font-bold text-[#1a1a1a]">${Number(card.balance || 0).toFixed(2)}</span>
                  </div>
                </div>

                <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          Powered by KripiCard · {filtered.length} card{filtered.length !== 1 ? 's' : ''} shown
        </p>
      </div>
    </div>
  );
}
