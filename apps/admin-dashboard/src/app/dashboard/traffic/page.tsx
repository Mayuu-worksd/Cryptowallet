'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Globe,
  Smartphone,
  RefreshCw,
  Search,
  Filter,
  Layers,
  MapPin,
  Clock,
  Shield,
  Eye,
  CheckCircle2,
  Radio,
  Copy,
  ExternalLink,
  Laptop,
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
  const { data, isLoading, isFetching, refetch } = useQuery({
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
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">App Traffic Monitor</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE RADAR
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              Real-time online sessions, client IP addresses, GeoIP country mapping, and screen hit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-gray-400">Sync Interval</span>
            <div className="text-xs font-mono text-emerald-400 font-medium">4s Realtime</div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-xl transition border border-gray-700 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Online Now */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Online Right Now</span>
              <div className="text-3xl font-extrabold text-white mt-1.5 flex items-center gap-2">
                {stats.online_now}
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-emerald-400/80 mt-3 font-medium">Heartbeat active &lt; 2m ago</p>
        </div>

        {/* Total Hits */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Screen Hits</span>
              <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{stats.total_hits}</div>
            </div>
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Aggregated across all screens</p>
        </div>

        {/* Countries Detected */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Countries Detected</span>
              <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{stats.countries_count}</div>
            </div>
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-purple-400/80 mt-3">Worldwide GeoIP localization</p>
        </div>

        {/* Total Sessions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Logged Sessions</span>
              <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{stats.total_sessions}</div>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Unique app launch instances</p>
        </div>
      </div>

      {/* ── Country Distribution Breakdown ── */}
      {countries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" />
            Geo-Location Traffic Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {countries.map((c: any) => (
              <div
                key={c.code}
                className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 flex items-center gap-2.5"
              >
                <span className="text-xl">{getFlagEmoji(c.code)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-200 truncate">{c.country}</div>
                  <div className="text-[11px] text-gray-400 font-mono">{c.count} session{c.count > 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar: Search & Online Filters ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by IP, Country, City, Wallet, Device ID, or Screen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 ml-1" />
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
            {(['all', 'online', 'offline'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterOnline(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                  filterOnline === filter
                    ? 'bg-red-600 text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {filter === 'online' ? '🟢 Online Only' : filter === 'offline' ? '⚪ Offline' : 'All Sessions'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Realtime Table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950/60 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">IP & Location</th>
                <th className="py-3.5 px-4">Device & Platform</th>
                <th className="py-3.5 px-4">Wallet / UID</th>
                <th className="py-3.5 px-4">Active Screen</th>
                <th className="py-3.5 px-4 text-center">Hits</th>
                <th className="py-3.5 px-4 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                    Connecting to live telemetry radar...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-400" />
                    No matching traffic sessions found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isOnline =
                    log.is_online &&
                    Date.now() - new Date(log.last_heartbeat).getTime() < 2 * 60 * 1000;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-800/40 transition-colors group"
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            Idle
                          </span>
                        )}
                      </td>

                      {/* IP & Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFlagEmoji(log.country_code)}</span>
                          <div>
                            <div className="font-medium text-white flex items-center gap-1.5">
                              {log.country || 'Unknown'}
                              {log.city && log.city !== 'Unknown' && (
                                <span className="text-xs text-gray-400">({log.city})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                              <span>{log.ip_address}</span>
                              <button
                                onClick={() => handleCopy(log.ip_address)}
                                title="Copy IP"
                                className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-white"
                              >
                                {copiedText === log.ip_address ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Device & Platform */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-200 truncate">
                              {log.device_model || 'Mobile Device'}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                              <span className="uppercase">{log.platform}</span>
                              <span>•</span>
                              <span>v{log.app_version || '1.0.0'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Wallet / UID */}
                      <td className="py-3.5 px-4">
                        {log.wallet_address ? (
                          <div>
                            <div className="font-mono text-xs text-gray-300 flex items-center gap-1">
                              {log.wallet_address.slice(0, 6)}...{log.wallet_address.slice(-4)}
                              <button
                                onClick={() => handleCopy(log.wallet_address!)}
                                className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-white"
                              >
                                {copiedText === log.wallet_address ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {log.user_uid && (
                              <div className="text-[11px] text-amber-400/90 font-mono font-medium">
                                UID: {log.user_uid}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Guest / Creating</span>
                        )}
                      </td>

                      {/* Screen */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-800 text-gray-300 border border-gray-700">
                          {log.screen_name || 'Home'}
                        </span>
                      </td>

                      {/* Hits */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-mono font-bold text-gray-300">
                          {log.hit_count || 1}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="text-xs text-gray-300 font-medium">
                          {formatTimeAgo(log.last_heartbeat)}
                        </div>
                        <div className="text-[10px] text-gray-500">
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
    </div>
  );
}
