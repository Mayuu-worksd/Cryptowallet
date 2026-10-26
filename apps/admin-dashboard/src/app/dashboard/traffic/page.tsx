'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Globe,
  Smartphone,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Copy,
  Radio,
  Eye,
  Loader2,
  Layers,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface TrafficLog {
  id: string;
  session_id: string;
  device_id: string;
  wallet_address?: string;
  user_uid?: number;
  ip_address: string;
  country: string;
  country_code: string;
  city: string;
  platform: string;
  device_model: string;
  app_version: string;
  screen_name: string;
  hit_count: number;
  is_online: boolean;
  last_heartbeat: string;
  created_at: string;
}

// Convert country code to emoji flag
function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode === 'XX' || countryCode === 'LO') return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Time ago helper
function formatTimeAgo(isoString: string) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TrafficDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnline, setFilterOnline] = useState<'all' | 'online' | 'offline'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Auto-refresh traffic logs every 4 seconds
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-traffic-telemetry'],
    queryFn: async () => {
      const res = await fetch('/api/public/traffic?limit=100');
      if (!res.ok) throw new Error('Failed to fetch traffic logs');
      return res.json();
    },
    refetchInterval: 4000,
  });

  const logs: TrafficLog[] = data?.logs || [];
  const stats = data?.stats || {
    online_now: 0,
    total_hits: 0,
    total_sessions: 0,
    countries_count: 0,
  };
  const countries = data?.countries || [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const [isPinging, setIsPinging] = useState(false);

  const handleTestPing = async () => {
    setIsPinging(true);
    try {
      await fetch('/api/public/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: `sess_test_${Date.now()}`,
          device_id: `hw_radar_${Math.random().toString(36).slice(2, 8)}`,
          platform: 'android',
          device_model: 'Google Pixel 8 Pro',
          screen_name: 'P2P Marketplace',
          action: 'hit',
        }),
      });
      refetch();
    } catch {}
    finally {
      setIsPinging(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (log.ip_address || '').toLowerCase().includes(term) ||
      (log.country || '').toLowerCase().includes(term) ||
      (log.city || '').toLowerCase().includes(term) ||
      (log.wallet_address || '').toLowerCase().includes(term) ||
      (log.device_id || '').toLowerCase().includes(term) ||
      (log.device_model || '').toLowerCase().includes(term) ||
      (log.screen_name || '').toLowerCase().includes(term);

    // Online threshold: heartbeat in last 2 minutes
    const isRecentlyActive =
      log.is_online &&
      Date.now() - new Date(log.last_heartbeat).getTime() < 2 * 60 * 1000;

    const matchesStatus =
      filterOnline === 'all'
        ? true
        : filterOnline === 'online'
        ? isRecentlyActive
        : !isRecentlyActive;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* ── Brutalist Top Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] flex items-center justify-center font-bold">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">
                Traffic & Sessions Radar
              </h1>
              <p className="text-xs font-bold font-mono uppercase tracking-wider mt-1.5 opacity-90">
                Real-time online sessions, client IP addresses, GeoIP country mapping, and screen telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] px-3 py-1 font-mono text-[10px] uppercase font-bold shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <span className="text-[#00C853] inline-block animate-ping mr-1.5">●</span>
            RADAR: 4S REFRESH
          </div>
          <button
            onClick={handleTestPing}
            disabled={isPinging}
            className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
          >
            <Radio className={`h-4 w-4 ${isPinging ? 'animate-ping' : ''}`} />
            <span>{isPinging ? 'PINGING...' : '+ TEST HIT'}</span>
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="self-start brutalist-button-white px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>SYNC RADAR</span>
          </button>
        </div>
      </div>

      {/* ── Brutalist KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Online Right Now */}
        <div className="brutalist-card p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500">
                Live Online Users
              </span>
              <div className="text-3xl font-black font-display tracking-tight text-[#1a1a1a] dark:text-white mt-1.5 flex items-center gap-2">
                {stats.online_now}
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C853] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00C853]"></span>
                </span>
              </div>
            </div>
            <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#00C853] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Radio className="h-4.5 w-4.5 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono font-bold uppercase text-[#00C853]">
            ● Pinged &lt; 2 mins ago
          </div>
        </div>

        {/* Total Screen Hits */}
        <div className="brutalist-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500">
                Total Screen Hits
              </span>
              <div className="text-3xl font-black font-display tracking-tight text-[#1a1a1a] dark:text-white mt-1.5 font-mono">
                {stats.total_hits}
              </div>
            </div>
            <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#0055ff] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Eye className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono text-gray-500 uppercase">
            Aggregated Across App Pages
          </div>
        </div>

        {/* Countries Detected */}
        <div className="brutalist-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500">
                GeoIP Countries
              </span>
              <div className="text-3xl font-black font-display tracking-tight text-[#1a1a1a] dark:text-white mt-1.5 font-mono">
                {stats.countries_count}
              </div>
            </div>
            <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Globe className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono text-gray-500 uppercase">
            Detected Global IP Regions
          </div>
        </div>

        {/* Total App Sessions */}
        <div className="brutalist-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500">
                Logged Sessions
              </span>
              <div className="text-3xl font-black font-display tracking-tight text-[#1a1a1a] dark:text-white mt-1.5 font-mono">
                {stats.total_sessions}
              </div>
            </div>
            <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono text-gray-500 uppercase">
            Physical Hardware Sessions
          </div>
        </div>
      </div>

      {/* ── Brutalist Country Distribution ── */}
      {countries.length > 0 && (
        <div className="brutalist-card p-5">
          <h2 className="text-xs font-bold font-display uppercase tracking-wider text-[#1a1a1a] dark:text-white mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#0055ff]" />
            Geo-Location Regional Distribution
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {countries.map((c: any) => (
              <div
                key={c.code}
                className="border-2 border-[#1a1a1a] p-3 flex items-center gap-2.5 bg-white dark:bg-[#201F1F] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
              >
                <span className="text-xl">{getFlagEmoji(c.code)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold font-display uppercase text-[#1a1a1a] dark:text-white truncate">
                    {c.country}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {c.count} session{c.count > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search & Filter Toolbar ── */}
      <div className="brutalist-card p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="h-4.5 w-4.5 text-[#1a1a1a]" />
          </span>
          <input
            type="text"
            placeholder="Search IP, Country, City, Wallet Address, or Screen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full brutalist-input !pl-10 focus:ring-0 focus:border-[#1a1a1a]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#1a1a1a] dark:text-white" />
          <div className="flex border-2 border-[#1a1a1a] p-1 bg-white dark:bg-[#201F1F] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            {(['all', 'online', 'offline'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterOnline(filter)}
                className={`px-3 py-1 font-display uppercase text-[10px] font-bold transition cursor-pointer ${
                  filterOnline === filter
                    ? 'bg-[#1a1a1a] text-white dark:bg-white dark:text-[#1a1a1a]'
                    : 'text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white'
                }`}
              >
                {filter === 'online' ? '🟢 Online Only' : filter === 'offline' ? '⚪ Offline' : 'All Sessions'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Brutalist Table ── */}
      <div className="overflow-x-auto brutalist-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Status</th>
              <th className="py-4 px-6 border-r-2 border-[#1a1a1a] font-display">Client IP & Location</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Hardware & OS</th>
              <th className="py-4 px-6 border-r-2 border-[#1a1a1a] font-display">Wallet / User UID</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Active Screen</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] text-center font-display">Hits</th>
              <th className="py-4 px-6 text-right font-display">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a] dark:text-white" />
                    <span className="font-bold font-display uppercase text-xs">Connecting to telemetry radar...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500 font-bold uppercase font-display">
                  No matching traffic sessions detected.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isOnline =
                  log.is_online &&
                  Date.now() - new Date(log.last_heartbeat).getTime() < 2 * 60 * 1000;

                return (
                  <tr key={log.id} className="hover:bg-[#ffcc00]/5 transition-colors group">
                    {/* Status */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10 whitespace-nowrap">
                      {isOnline ? (
                        <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#00C853] text-white text-[9px] font-extrabold uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                          ● Online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#f5f0e8] text-[#1a1a1a] text-[9px] font-extrabold uppercase">
                          Idle
                        </span>
                      )}
                    </td>

                    {/* IP & Location */}
                    <td className="py-4 px-6 border-r-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{getFlagEmoji(log.country_code)}</span>
                        <div>
                          <div className="font-bold font-display text-xs uppercase text-[#1a1a1a] dark:text-white flex items-center gap-1.5">
                            {log.country || 'Unknown'}
                            {log.city && log.city !== 'Unknown' && (
                              <span className="text-[10px] text-gray-500 font-mono font-normal">({log.city})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono mt-0.5">
                            <span>{log.ip_address}</span>
                            <button
                              onClick={() => handleCopy(log.ip_address)}
                              title="Copy IP"
                              className="text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white ml-1 cursor-pointer"
                            >
                              {copiedText === log.ip_address ? (
                                <CheckCircle className="h-3 w-3 text-[#00C853]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Hardware & OS */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <div>
                        <div className="font-bold font-display text-xs uppercase text-[#1a1a1a] dark:text-white">
                          {log.device_model || 'Mobile Device'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">
                          {log.platform} • v{log.app_version || '1.0.0'}
                        </div>
                      </div>
                    </td>

                    {/* Wallet / User UID */}
                    <td className="py-4 px-6 border-r-2 border-[#1a1a1a]/10">
                      {log.wallet_address ? (
                        <div>
                          <div className="font-mono text-xs font-bold text-[#0055ff] flex items-center gap-1">
                            {log.wallet_address.slice(0, 6)}...{log.wallet_address.slice(-4)}
                            <button
                              onClick={() => handleCopy(log.wallet_address!)}
                              className="text-gray-400 hover:text-[#1a1a1a] dark:hover:text-white cursor-pointer ml-1"
                            >
                              {copiedText === log.wallet_address ? (
                                <CheckCircle className="h-3 w-3 text-[#00C853]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          {log.user_uid && (
                            <div className="text-[10px] font-mono font-bold text-[#ff9900] uppercase mt-0.5">
                              UID: {log.user_uid}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-mono uppercase italic">
                          Guest / Onboarding
                        </span>
                      )}
                    </td>

                    {/* Active Screen */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <span className="px-2 py-0.5 border border-[#1a1a1a] bg-white dark:bg-[#201F1F] text-[#1a1a1a] dark:text-white text-[10px] font-bold font-mono uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                        {log.screen_name || 'Home'}
                      </span>
                    </td>

                    {/* Hits */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10 text-center">
                      <span className="font-mono font-bold text-xs text-[#1a1a1a] dark:text-white">
                        {log.hit_count || 1}
                      </span>
                    </td>

                    {/* Last Seen */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="font-bold font-mono text-xs text-[#1a1a1a] dark:text-white">
                        {formatTimeAgo(log.last_heartbeat)}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {new Date(log.last_heartbeat).toLocaleTimeString()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
