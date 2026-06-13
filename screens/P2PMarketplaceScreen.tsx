import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Platform, ActivityIndicator, Modal, Alert, ScrollView, Image, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Svg, { Polyline, Line, Circle, Defs, LinearGradient as SvgGradient, Stop, Path, G, Rect, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { p2pService, P2POrder, FIAT_CURRENCIES, PAYMENT_METHODS, getLiveRate, calcPlatformFee } from '../services/merchantService';
import TransactionLoader from '../components/ui/TransactionLoader';
import { supabase } from '../services/supabaseClient';

const TOKENS   = ['ETH', 'USDC', 'USDT', 'BTC', 'SOL', 'BNB', 'XRP', 'TON', 'TRX', 'SUI'];
const COUNTRIES = ['United States','United Kingdom','India','UAE','Singapore','Germany','France','Australia','Canada','Brazil','Other'];

const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B', DAI: '#F5AC37',
  BTC: '#F7931A', SOL: '#9945FF', BNB: '#F3BA2F', XRP: '#346AA9',
  TON: '#0088CC', TRX: '#EF0027', SUI: '#6FBCF0',
};

const TOKEN_LOGOS: Record<string, string> = {
  ETH:  'https://assets.coingecko.com/coins/images/279/large/ethereum.png?v=2',
  USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?v=2',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png?v=2',
  DAI:  'https://assets.coingecko.com/coins/images/9956/large/4943.png?v=2',
  BTC:  'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?v=2',
  SOL:  'https://assets.coingecko.com/coins/images/4128/large/solana.png?v=2',
  BNB:  'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?v=2',
  XRP:  'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?v=2',
  TON:  'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png?v=2',
  TRX:  'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png?v=2',
  SUI:  'https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg?v=2',
};

function TokenSymbolIcon({ token, size = 44 }: { token: string; size?: number }) {
  const color = TOKEN_COLORS[token] ?? '#888';
  const [failed, setFailed] = React.useState(false);
  const uri = TOKEN_LOGOS[token];
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '20', borderWidth: 1.5, borderColor: color + '40',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.42, fontWeight: '900' }}>{token.charAt(0)}</Text>
    </View>
  );
}

function SkeletonCard({ T }: { T: any }) {
  return (
    <View style={[sk.card, { backgroundColor: T.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={[sk.circle, { backgroundColor: T.surfaceHigh }]} />
        <View style={{ gap: 6, flex: 1 }}>
          <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '50%' }]} />
          <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '30%' }]} />
        </View>
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: 60 }]} />
      </View>
      <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '100%', height: 1, marginBottom: 14 }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '35%' }]} />
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '25%' }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card:   { borderRadius: 20, padding: 20, marginBottom: 12 },
  circle: { width: 44, height: 44, borderRadius: 22 },
  line:   { height: 10, borderRadius: 5 },
});

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  let hr = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12;
  hr = hr ? hr : 12; // if 0, make it 12
  const formattedHr = String(hr).padStart(2, '0');
  return `${month} ${day}, ${formattedHr}:${min} ${ampm}`;
}

function OrderCard({ order, onPress, T, walletAddress, formatOrderFiat }: { order: P2POrder; onPress: () => void; T: any; walletAddress: string; formatOrderFiat: (amt: number, curr: string) => string; }) {
  const isMine   = order.seller_wallet.toLowerCase() === walletAddress.toLowerCase();
  const isBuying = order.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase();

  const statusMeta: Record<string, { label: string; color: string }> = {
    open:                 { label: 'OPEN',                 color: T.success },
    escrow_locked:        { label: 'IN ESCROW',            color: T.primary },
    payment_pending:      { label: 'PAYMENT PENDING',      color: '#F59E0B' },
    payment_verification: { label: 'PAYMENT VERIFICATION', color: '#F59E0B' },
    crypto_released:      { label: 'CRYPTO RELEASED',      color: T.success },
    completed:            { label: 'COMPLETED',            color: T.success },
    cancelled:            { label: 'CANCELLED',            color: T.textDim },
    disputed:             { label: 'DISPUTED',             color: T.error },
  };
  const { label: statusLabel, color: statusColor } = statusMeta[order.status] ?? { label: order.status.toUpperCase(), color: T.textDim };

  const btnLabel = isMine ? 'View Order' : isBuying ? 'Continue Trade' : `Buy ${order.token}`;
  const btnColor = isMine ? T.surfaceHigh : T.primary;

  return (
    <TouchableOpacity style={[s.card, { backgroundColor: T.surface, borderColor: isBuying ? T.primary + '40' : T.border, borderWidth: isBuying ? 1.5 : 1 }]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <TokenSymbolIcon token={order.token} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[s.tokenName, { color: T.text }]}>{order.token} Trade</Text>
            {isMine && (
              <View style={[s.minePill, { backgroundColor: T.surfaceHigh }]}>
                <Text style={[s.minePillText, { color: T.textMuted }]}>MINE</Text>
              </View>
            )}
            {isBuying && (
              <View style={[s.minePill, { backgroundColor: T.primary + '15' }]}>
                <Text style={[s.minePillText, { color: T.primary }]}>BUYING</Text>
              </View>
            )}
            <View style={[s.minePill, { backgroundColor: order.is_merchant ? T.primary + '15' : T.surfaceHigh }]}>
              <Text style={[s.minePillText, { color: order.is_merchant ? T.primary : T.textMuted }]}>
                {order.is_merchant ? '🏢 MERCHANT' : '👤 PERSONAL'}
              </Text>
            </View>
          </View>
          <Text style={[s.sellerAddr, { color: T.textMuted }]}>
            Seller: {order.seller_wallet.slice(0, 6)}…{order.seller_wallet.slice(-4)}
          </Text>
          {order.created_at && (
            <Text style={{ fontSize: 10, color: T.textDim, fontWeight: '700', marginTop: 3 }}>
              🕒 {formatDateTime(order.created_at)}
            </Text>
          )}
        </View>
        <View style={[s.statusPill, { backgroundColor: statusColor + '15' }]}>
          <Text style={[s.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statLine}>
          <Text style={[s.statLabel, { color: T.textMuted }]}>Amount</Text>
          <Text style={[s.statValue, { color: T.text }]}>{order.amount} {order.token}</Text>
        </View>
        <View style={s.statLine}>
          <Text style={[s.statLabel, { color: T.textMuted }]}>Total Price</Text>
          <Text style={[s.statValueBig, { color: T.primary }]}>{formatOrderFiat(Number(order.fiat_total || 0), order.fiat_currency)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="credit-card" size={13} color={T.textMuted} />
          <Text style={{ fontSize: 12, color: T.textMuted, fontWeight: '600' }}>{order.payment_method}</Text>
        </View>
        {order.created_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="clock" size={12} color={T.textDim} />
            <Text style={{ fontSize: 11, color: T.textDim, fontWeight: '600' }}>{timeAgo(order.created_at)} ({formatDateTime(order.created_at)})</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="zap" size={12} color='#10B981' />
          <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700' }}>~15 min ETA</Text>
        </View>
      </View>

      <TouchableOpacity style={[s.buyBtn, { backgroundColor: btnColor }]} onPress={onPress}>
        <Text style={s.buyBtnText}>{btnLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Interactive Rate Chart for Step 1 ─────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;

function RateChart({
  token, fiat, liveRate, liveRateLoading, rateHistory, sellRate, onRateSelect, T, formatOrderFiat
}: {
  token: string; fiat: string; liveRate: number | null; liveRateLoading: boolean;
  rateHistory: number[]; sellRate: string; onRateSelect: (r: string) => void; T: any; formatOrderFiat: (amt: number, curr: string) => string;
}) {
  const W = SCREEN_W - 48; // card padding
  const H = 160;
  const PAD_L = 4; const PAD_R = 4;
  const chartW = W - PAD_L - PAD_R;

  const isUp = rateHistory.length > 1
    ? rateHistory[rateHistory.length - 1] >= rateHistory[0]
    : true;
  const lineColor = isUp ? '#10B981' : '#EC2629';
  const tokenColor = TOKEN_COLORS[token] ?? '#627EEA';

  // Build chart points
  const pts = rateHistory.length > 1 ? (() => {
    const min = Math.min(...rateHistory) * 0.998;
    const max = Math.max(...rateHistory) * 1.002;
    const range = max - min || 1;
    return rateHistory.map((v, i) => ({
      x: PAD_L + (i / (rateHistory.length - 1)) * chartW,
      y: H - 24 - ((v - min) / range) * (H - 40),
      v,
    }));
  })() : [];

  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = pts.length > 1
    ? `M ${pts[0].x},${pts[0].y} ` +
      pts.slice(1).map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L ${pts[pts.length-1].x},${H} L ${pts[0].x},${H} Z`
    : '';

  const last = pts[pts.length - 1];
  const pct = rateHistory.length > 1
    ? ((rateHistory[rateHistory.length-1] - rateHistory[0]) / rateHistory[0]) * 100
    : 0;

  // Selected rate marker
  const selectedRate = parseFloat(sellRate);
  const hasSelected = selectedRate > 0 && rateHistory.length > 1;
  const min2 = Math.min(...rateHistory) * 0.998;
  const max2 = Math.max(...rateHistory) * 1.002;
  const range2 = max2 - min2 || 1;
  const selectedY = hasSelected
    ? H - 24 - ((selectedRate - min2) / range2) * (H - 40)
    : null;

  // Premium/discount vs live
  const premium = liveRate && selectedRate > 0
    ? ((selectedRate - liveRate) / liveRate) * 100
    : null;

  // Tap points — 5 preset levels
  const presets = liveRate ? [
    { label: '-2%', rate: liveRate * 0.98 },
    { label: '-1%', rate: liveRate * 0.99 },
    { label: 'MKT', rate: liveRate },
    { label: '+1%', rate: liveRate * 1.01 },
    { label: '+2%', rate: liveRate * 1.02 },
  ] : [];

  return (
    <View style={[rc.card, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
      {/* Header */}
      <View style={rc.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TokenSymbolIcon token={token} size={28} />
          <View>
            <Text style={[rc.headerTitle, { color: T.text }]}>
              {token}/{fiat}
            </Text>
            <Text style={[rc.headerSub, { color: T.textDim }]}>7-day price trend</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {liveRateLoading ? (
            <ActivityIndicator size="small" color={lineColor} />
          ) : liveRate ? (
            <>
              <Text style={[rc.livePrice, { color: T.text }]}>
                {formatOrderFiat(liveRate, fiat)}
              </Text>
              <View style={[rc.changeBadge, { backgroundColor: isUp ? '#10B98118' : '#EC262918' }]}>
                <Text style={[rc.changeText, { color: isUp ? '#10B981' : '#EC2629' }]}>
                  {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* SVG Chart */}
      {pts.length > 1 ? (
        <View style={{ marginHorizontal: -4 }}>
          <Svg width={W + 8} height={H}>
            <Defs>
              <SvgGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity="0.25" />
                <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
              </SvgGradient>
            </Defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map((f, i) => (
              <Line key={i}
                x1={PAD_L} y1={H * f}
                x2={W + 8 - PAD_R} y2={H * f}
                stroke={T.border} strokeWidth="0.6" strokeDasharray="5,5"
              />
            ))}

            {/* Area */}
            <Path d={areaPath} fill="url(#rateGrad)" />

            {/* Line */}
            <Polyline
              points={polyPts}
              fill="none"
              stroke={lineColor}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Selected rate horizontal line */}
            {selectedY !== null && selectedY > 0 && selectedY < H && (
              <G>
                <Line
                  x1={PAD_L} y1={selectedY}
                  x2={W + 8 - PAD_R} y2={selectedY}
                  stroke={tokenColor} strokeWidth="1.5" strokeDasharray="6,3"
                />
                {/* Label on right */}
                <Rect
                  x={W - 52} y={selectedY - 11}
                  width={60} height={20}
                  rx={6} fill={tokenColor}
                />
                <SvgText
                  x={W - 22} y={selectedY + 4}
                  fontSize="9" fontWeight="800"
                  fill="#FFF" textAnchor="middle"
                >
                  {selectedRate.toFixed(0)}
                </SvgText>
              </G>
            )}

            {/* Live rate horizontal line */}
            {liveRate && (() => {
              const ly = H - 24 - ((liveRate - min2) / range2) * (H - 40);
              if (ly < 4 || ly > H - 4) return null;
              return (
                <G key="live">
                  <Line
                    x1={PAD_L} y1={ly}
                    x2={W + 8 - PAD_R} y2={ly}
                    stroke="#10B981" strokeWidth="1" strokeDasharray="3,3"
                  />
                  <Rect x={PAD_L} y={ly - 9} width={34} height={16} rx={5} fill="#10B981" />
                  <SvgText x={PAD_L + 17} y={ly + 4} fontSize="8" fontWeight="900" fill="#FFF" textAnchor="middle">
                    LIVE
                  </SvgText>
                </G>
              );
            })()}

            {/* End dot */}
            {last && (
              <G>
                <Circle cx={last.x} cy={last.y} r={10} fill={lineColor} fillOpacity={0.15} />
                <Circle cx={last.x} cy={last.y} r={5} fill={lineColor} />
              </G>
            )}
          </Svg>
        </View>
      ) : (
        <View style={[rc.chartSkeleton, { backgroundColor: T.surfaceHigh }]}>
          <ActivityIndicator color={T.primary} />
          <Text style={{ color: T.textDim, fontSize: 12, marginTop: 8 }}>Loading price data...</Text>
        </View>
      )}

      {/* Preset rate buttons */}
      {presets.length > 0 && (
        <View style={rc.presets}>
          {presets.map(p => {
            const isActive = Math.abs(selectedRate - p.rate) < 0.5;
            const isMkt = p.label === 'MKT';
            return (
              <TouchableOpacity
                key={p.label}
                style={[
                  rc.presetBtn,
                  {
                    backgroundColor: isActive
                      ? (isMkt ? '#10B981' : tokenColor)
                      : T.surfaceHigh,
                    borderColor: isActive
                      ? (isMkt ? '#10B981' : tokenColor)
                      : T.border,
                  }
                ]}
                onPress={() => onRateSelect(p.rate.toFixed(2))}
              >
                <Text style={[
                  rc.presetLabel,
                  { color: isActive ? '#FFF' : T.textDim }
                ]}>{p.label}</Text>
                <Text style={[
                  rc.presetRate,
                  { color: isActive ? '#FFF' : T.text }
                ]}>{p.rate.toFixed(0)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected rate display */}
      <View style={[rc.selectedRow, { borderTopColor: T.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[rc.selectedLabel, { color: T.textDim }]}>YOUR RATE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            {selectedRate > 0 ? (
              <>
                <Text style={[rc.selectedRate, { color: T.text }]}>
                  {formatOrderFiat(selectedRate, fiat)}
                </Text>
              </>
            ) : (
              <Text style={[rc.selectedRate, { color: T.textDim }]}>Tap a preset above</Text>
            )}
          </View>
        </View>
        {premium !== null && selectedRate > 0 && (
          <View style={[
            rc.premiumBadge,
            { backgroundColor: premium >= 0 ? '#10B98118' : '#EC262918' }
          ]}>
            <Text style={[
              rc.premiumText,
              { color: premium >= 0 ? '#10B981' : '#EC2629' }
            ]}>
              {premium >= 0 ? '+' : ''}{premium.toFixed(1)}% vs market
            </Text>
          </View>
        )}
      </View>

      {/* Manual override input */}
      <View style={[rc.manualRow, { borderTopColor: T.border }]}>
        <Feather name="edit-2" size={13} color={T.textDim} />
        <TextInput
          style={[rc.manualInput, { color: T.text }]}
          value={sellRate}
          onChangeText={onRateSelect}
          placeholder={`Custom rate in ${fiat}`}
          placeholderTextColor={T.textDim}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[s.tokenPill, { backgroundColor: T.surfaceHigh }]}
          onPress={() => {}}
        >
          <Text style={[s.tokenPillText, { color: T.text }]}>{fiat}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rc = StyleSheet.create({
  card:         { borderRadius: 24, borderWidth: 1.5, overflow: 'hidden', marginTop: 12 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  headerTitle:  { fontSize: 15, fontWeight: '800' },
  headerSub:    { fontSize: 11, fontWeight: '500', marginTop: 1 },
  livePrice:    { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  liveFiat:     { fontSize: 12, fontWeight: '600' },
  changeBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  changeText:   { fontSize: 11, fontWeight: '800' },
  chartSkeleton:{ height: 160, alignItems: 'center', justifyContent: 'center' },
  presets:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  presetBtn:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, gap: 2 },
  presetLabel:  { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  presetRate:   { fontSize: 11, fontWeight: '800' },
  selectedRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  selectedLabel:{ fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  selectedRate: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  selectedFiat: { fontSize: 13, fontWeight: '600' },
  premiumBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  premiumText:  { fontSize: 12, fontWeight: '800' },
  manualRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  manualInput:  { flex: 1, fontSize: 15, fontWeight: '700', padding: 0 },
});

// ─── Professional Rate Chart ─────────────────────────────────────────────────
function ProfessionalRateChart({ sellAmount, sellRate, sellFiat, sellToken, liveRate, liveRateLoading, rateHistory, T }: any) {
  const gross = parseFloat(sellAmount || '0') * parseFloat(sellRate || '0');
  const fee   = gross * 0.005;
  const net   = gross * 0.995;
  const pct   = rateHistory.length > 1
    ? ((rateHistory[rateHistory.length - 1] - rateHistory[0]) / rateHistory[0]) * 100
    : 0;
  const isUp  = pct >= 0;
  const lineColor = isUp ? '#10B981' : '#EC2629';

  const W = 280, H = 80;
  const chartPts = rateHistory.length > 1 ? (() => {
    const min = Math.min(...rateHistory);
    const max = Math.max(...rateHistory);
    const range = max - min || 1;
    return rateHistory.map((v: number, i: number) => {
      const x = (i / (rateHistory.length - 1)) * W;
      const y = H - 8 - ((v - min) / range) * (H - 20);
      return { x, y };
    });
  })() : [];

  const pts = chartPts.map((p: any) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = chartPts[chartPts.length - 1];
  const areaPath = chartPts.length > 1
    ? `M ${chartPts[0].x},${chartPts[0].y} ` +
      chartPts.slice(1).map((p: any) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L ${W},${H} L 0,${H} Z`
    : '';

  // Horizontal grid lines
  const gridLines = [0.2, 0.5, 0.8].map(f => H * f);

  return (
    <View style={[s.chartCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
      {/* Top: Gross Total + Live badge */}
      <View style={s.chartTopRow}>
        <View>
          <Text style={[s.chartLabel, { color: T.textDim }]}>GROSS TOTAL</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
            <Text style={[s.chartGross, { color: T.primary }]}>{gross.toFixed(2)}</Text>
            <Text style={[s.chartFiatLabel, { color: T.textMuted }]}>{sellFiat}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {liveRateLoading ? (
            <ActivityIndicator size="small" color={T.primary} />
          ) : liveRate ? (
            <View style={[s.livePill, { backgroundColor: '#10B98118' }]}>
              <View style={s.liveDot} />
              <Text style={[s.livePillText, { color: '#10B981' }]}>LIVE</Text>
              <Text style={[s.livePillRate, { color: '#10B981' }]}>{liveRate.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={[s.changePill, { backgroundColor: isUp ? '#10B98115' : '#EC262915' }]}>
            <Text style={[s.changePillText, { color: isUp ? '#10B981' : '#EC2629' }]}>
              {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      {chartPts.length > 1 && (
        <View style={s.chartArea}>
          <Svg width={W} height={H}>
            <Defs>
              <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
                <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
              </SvgGradient>
            </Defs>
            {/* Grid lines */}
            {gridLines.map((y, i) => (
              <Line key={i} x1="0" y1={y} x2={W} y2={y} stroke={T.border} strokeWidth="0.5" strokeDasharray="4,4" />
            ))}
            {/* Area fill */}
            <Path d={areaPath} fill="url(#grad)" />
            {/* Line */}
            <Polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {/* End dot */}
            {last && (
              <G>
                <Circle cx={last.x} cy={last.y} r={8} fill={lineColor} fillOpacity={0.15} />
                <Circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
              </G>
            )}
          </Svg>
          <View style={s.chartFooter}>
            <Text style={[s.chartFooterText, { color: T.textDim }]}>7-day trend</Text>
            <Text style={[s.chartFooterText, { color: T.textDim }]}>
              {rateHistory[0]?.toFixed(2)} → {rateHistory[rateHistory.length - 1]?.toFixed(2)} {sellFiat}
            </Text>
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={[s.chartDivider, { backgroundColor: T.border }]} />

      {/* Fee breakdown — 3 rows */}
      <View style={s.feeGrid}>
        <View style={s.feeGridItem}>
          <Text style={[s.feeGridLabel, { color: T.textDim }]}>Gross</Text>
          <Text style={[s.feeGridValue, { color: T.text }]}>{gross.toFixed(2)}</Text>
        </View>
        <View style={[s.feeGridDivider, { backgroundColor: T.border }]} />
        <View style={s.feeGridItem}>
          <Text style={[s.feeGridLabel, { color: T.textDim }]}>Fee (0.5%)</Text>
          <Text style={[s.feeGridValue, { color: '#EC2629' }]}>−{fee.toFixed(2)}</Text>
        </View>
        <View style={[s.feeGridDivider, { backgroundColor: T.border }]} />
        <View style={s.feeGridItem}>
          <Text style={[s.feeGridLabel, { color: T.textDim }]}>You Receive</Text>
          <Text style={[s.feeGridValue, { color: T.success, fontWeight: '900' }]}>{net.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function P2PMarketplaceScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { walletAddress, isDarkMode, balances, ethBalance, lockedBalance, lockBalance, resetLockedBalances, p2pCountry, p2pCurrency, accountType, network, formatOrderFiat } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const isBusiness = accountType === 'business';

  const [tab, setTab] = useState<'buy' | 'sell'>(
    route?.params?.tab === 'sell' ? 'sell' : 'buy'
  );



  const [orders,  setOrders]  = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedOnce = useRef(false);
  const hasAutoSwitched = useRef(false);

  // Reset fetch flag when walletAddress becomes available
  useEffect(() => {
    if (walletAddress) hasFetchedOnce.current = false;
  }, [walletAddress]);
  const [filterFiat, setFilterFiat] = useState<string>('ALL');
  const [filterToken, setFilterToken] = useState<string>('ALL');
  const [showSellModal, setShowSellModal] = useState(false);

  const [sellToken,   setSellToken]   = useState('ETH');
  const [sellAmount,  setSellAmount]  = useState('');
  const [sellFiat,    setSellFiat]    = useState(p2pCurrency || 'USD');
  const [sellRate,    setSellRate]    = useState('');
  const [sellMethod,  setSellMethod]  = useState('Bank Transfer');
  const [sellCountry, setSellCountry] = useState(p2pCountry || 'United States');
  const [sellPaymentDetails, setSellPaymentDetails] = useState('');
  const [sellLoading, setSellLoading] = useState(false);
  const [liveRate,    setLiveRate]    = useState<number | null>(null);
  const [liveRateLoading, setLiveRateLoading] = useState(false);
  const [rateHistory, setRateHistory] = useState<number[]>([]);

  const [fiatModal,    setFiatModal]    = useState(false);
  const [methodModal,  setMethodModal]  = useState(false);
  const [countryModal, setCountryModal] = useState(false);


  // Auto-heal locked balance: compare AsyncStorage locks vs real active DB orders
  const healLockedBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const myOrders = await p2pService.getMyOrders(walletAddress);
      const activeStatuses = ['open', 'escrow_locked', 'payment_pending', 'payment_verification', 'crypto_released'];

      // Compute what should be locked based on live DB orders
      const realLocks: Record<string, number> = {};
      myOrders
        .filter(o => activeStatuses.includes(o.status))
        .forEach(o => {
          // Lock for seller (they listed the crypto)
          if (o.seller_wallet.toLowerCase() === walletAddress.toLowerCase()) {
            realLocks[o.token] = (realLocks[o.token] || 0) + o.amount;
          }
          // Lock for buyer (they locked funds in escrow)
          if (o.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase() &&
              (o.status === 'escrow_locked' || o.status === 'payment_pending' || o.status === 'payment_verification' || o.status === 'crypto_released')) {
            realLocks[o.token] = (realLocks[o.token] || 0) + o.amount;
          }
        });

      // If stored lock differs from real active lock, correct it
      const currentLocked = lockedBalance;
      let needsUpdate = false;
      const allTokens = new Set([...Object.keys(currentLocked), ...Object.keys(realLocks)]);
      for (const token of allTokens) {
        if (Math.abs((currentLocked[token] || 0) - (realLocks[token] || 0)) > 0.000001) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) resetLockedBalances();
    } catch {}
  }, [walletAddress, lockedBalance, resetLockedBalances]);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!walletAddress) return;
    if (!hasFetchedOnce.current) {
      setLoading(true);
    } else if (isRefresh) {
      setRefreshing(true);
    }
    try {
      if (tab === 'buy') {
        const all = await p2pService.getOpenOrders(walletAddress);
        const visible = all.filter(o => o.seller_wallet.toLowerCase() !== walletAddress.toLowerCase());
        let filtered = visible;
        if (filterFiat !== 'ALL') {
          filtered = filtered.filter(o => o.fiat_currency === filterFiat);
        }
        if (filterToken !== 'ALL') {
          filtered = filtered.filter(o => o.token === filterToken);
        }
        setOrders(filtered);
      } else {
        const myOrders = await p2pService.getMyOrders(walletAddress);
        setOrders(myOrders);
      }
    } catch (e: any) {
      // silent — show empty state instead of crashing
    } finally {
      hasFetchedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, filterFiat, filterToken, walletAddress, isBusiness]);

  // Auto-switch to My Orders if buyer has active in-progress orders (runs once on mount)
  useEffect(() => {
    if (hasAutoSwitched.current || route?.params?.tab) return;
    p2pService.getActiveBuyOrders(walletAddress).then(active => {
      if (active.length > 0 && !hasAutoSwitched.current) {
        hasAutoSwitched.current = true;
        setTab('sell');
      }
    }).catch(() => {});
  }, [walletAddress]);

  // Only run on mount and when tab/filter changes — NOT on every focus
  useEffect(() => {
    hasFetchedOnce.current = false; // reset so tab/filter change shows skeleton once
    loadOrders();
  }, [loadOrders]);

  // On focus: silent background refresh, no skeleton flash
  useFocusEffect(useCallback(() => {
    if (hasFetchedOnce.current) loadOrders(true);
    healLockedBalance();
  }, [tab, filterFiat, filterToken, walletAddress, isBusiness]));

  // Fetch real 7-day price history from CoinGecko
  useEffect(() => {
    let cancelled = false;
    setLiveRateLoading(true);
    const COINGECKO_IDS: Record<string, string> = {
      ETH: 'ethereum', USDC: 'usd-coin', USDT: 'tether', DAI: 'dai',
    };
    const coinId = COINGECKO_IDS[sellToken];
    const vsCurrency = sellFiat.toLowerCase();
    const fetchData = async () => {
      try {
        // Fetch 7-day hourly prices
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=7&interval=hourly`,
          { signal: controller.signal }
        ).finally(() => clearTimeout(timer));
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!cancelled && data.prices?.length > 0) {
          // Sample every 6 hours = ~28 points for clean chart
          const sampled: number[] = [];
          const step = Math.max(1, Math.floor(data.prices.length / 28));
          for (let i = 0; i < data.prices.length; i += step) {
            sampled.push(data.prices[i][1]);
          }
          // Always include last point
          sampled.push(data.prices[data.prices.length - 1][1]);
          setRateHistory(sampled);
          const currentRate = sampled[sampled.length - 1];
          setLiveRate(currentRate);
          if (!sellRate) setSellRate(currentRate.toFixed(2));
        }
      } catch {
        // Fallback: use getLiveRate + realistic jitter
        const rate = await getLiveRate(sellToken, sellFiat);
        if (!cancelled && rate) {
          setLiveRate(rate);
          if (!sellRate) setSellRate(rate.toFixed(2));
          // Generate 30 realistic-looking points
          const pts: number[] = [rate];
          for (let i = 1; i < 30; i++) {
            const prev = pts[i - 1];
            const change = (Math.random() - 0.48) * prev * 0.008;
            pts.push(parseFloat((prev + change).toFixed(2)));
          }
          setRateHistory(pts);
        }
      } finally {
        if (!cancelled) setLiveRateLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [sellToken, sellFiat]);

  // Get real available balance for any token (ETH lives in ethBalance, not balances)
  // Only subtract tokens locked in ACTIVE sell orders (open/escrow_locked/payment_pending/payment_verification/crypto_released)
  const getAvailableBalance = (token: string) => {
    let raw = 0;
    if (token === 'ETH') {
      raw = parseFloat(ethBalance) || 0;
    } else if (token === 'TRX') {
      raw = balances['TRX'] ?? 0;
    } else if (token === 'USDT') {
      raw = ['TRON', 'TRON Nile'].includes(network)
        ? (balances['USDT_TRC20'] ?? balances['USDT'] ?? 0)
        : (balances['USDT_ERC20'] ?? balances['USDT'] ?? 0);
    } else if (token === 'USDC') {
      raw = ['TRON', 'TRON Nile'].includes(network)
        ? (balances['USDC_TRC20'] ?? balances['USDC'] ?? 0)
        : (balances['USDC_ERC20'] ?? balances['USDC'] ?? 0);
    } else {
      raw = balances[token] ?? 0;
    }
    const locked = lockedBalance[token] ?? 0;
    return Math.max(0, raw - locked);
  };

  const handleCreateSellOrder = async () => {
    const amt  = parseFloat(sellAmount);
    const rate = parseFloat(sellRate);
    if (!amt || amt <= 0)   { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    if (!rate || rate <= 0) { Alert.alert('Invalid Rate',   'Enter a valid rate.');   return; }
    if (!sellPaymentDetails.trim()) { Alert.alert('Invalid Details', 'Payment details are required.'); return; }
    const available = getAvailableBalance(sellToken);
    if (amt > available) { Alert.alert('Insufficient Balance', 'You do not have enough balance.'); return; }

    setSellLoading(true);
    try {
      await p2pService.createOrder({
        seller_wallet:  walletAddress,
        token:          sellToken,
        amount:         amt,
        fiat_currency:  sellFiat,
        rate,
        fiat_total:     amt * rate,
        payment_method: sellMethod,
        country:        sellCountry,
        is_merchant:    isBusiness,
        seller_payment_details: sellPaymentDetails.trim(),
      }, network);
      lockBalance(sellToken, amt);
      setShowSellModal(false);
      setSellAmount('');
      setSellRate('');
      loadOrders(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create order.');
    } finally { setSellLoading(false); }
  };

  const [sellStep, setSellStep] = useState(0); // 0=token, 1=amount+rate, 2=details, 3=review

  const resetSellModal = () => {
    setSellStep(0);
    setSellAmount('');
    setSellRate('');
    setSellMethod('Bank Transfer');
    setSellCountry(p2pCountry || 'United States');
    setSellFiat(p2pCurrency || 'USD');
    setSellPaymentDetails('');
    const isTron = ['TRON', 'TRON Nile'].includes(network);
    setSellToken(isTron ? 'TRX' : 'ETH');
  };

  useFocusEffect(useCallback(() => {
    if (route?.params?.tab) setTab(route.params.tab);
    if (route?.params?.token) {
      setFilterToken(route.params.token);
      if (route?.params?.tab === 'sell') {
        resetSellModal();
        setSellToken(route.params.token);
        setShowSellModal(true);
      } else {
        setSellToken(route.params.token);
      }
    }
  }, [route?.params?.tab, route?.params?.token]));

  const STEPS = ['Token', 'Amount', 'Details', 'Review'];

  const canNextStep0 = !!sellToken;
  const canNextStep1 = parseFloat(sellAmount) > 0 && parseFloat(sellRate) > 0 && parseFloat(sellAmount) <= getAvailableBalance(sellToken);
  const canNextStep2 = !!sellMethod && !!sellCountry && !!sellFiat && !!sellPaymentDetails.trim();

  const PickerModal = ({ visible, title, items, selected, onSelect, onClose }: any) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: T.border }]} />
          <Text style={[s.modalTitle, { color: T.text }]}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((item: string) => (
              <TouchableOpacity key={item} style={[s.modalRow, { borderBottomColor: T.border }]} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={[s.modalRowText, { color: T.text }]}>{item}</Text>
                {selected === item && <Feather name="check" size={16} color={T.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <PickerModal visible={fiatModal}    title="Fiat Currency"   items={FIAT_CURRENCIES} selected={sellFiat}    onSelect={setSellFiat}    onClose={() => setFiatModal(false)} />
      <PickerModal visible={methodModal}  title="Payment Method"  items={PAYMENT_METHODS} selected={sellMethod}  onSelect={setSellMethod}  onClose={() => setMethodModal(false)} />
      <PickerModal visible={countryModal} title="Country"         items={COUNTRIES}       selected={sellCountry} onSelect={setSellCountry} onClose={() => setCountryModal(false)} />

      {/* Sell Modal — Step Wizard */}
      <Modal visible={showSellModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.sellSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />

            {/* Step Header */}
            <View style={s.wizardHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (sellStep === 0) { setShowSellModal(false); resetSellModal(); }
                  else setSellStep(s2 => s2 - 1);
                }}
                style={[s.wizardBackBtn, { backgroundColor: T.surfaceLow }]}
              >
                <Feather name={sellStep === 0 ? 'x' : 'arrow-left'} size={18} color={T.text} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[s.wizardTitle, { color: T.text }]}>
                  {['Choose Token', 'Set Amount & Rate', 'Payment Details', 'Review & List'][sellStep]}
                </Text>
                <Text style={[s.wizardStepText, { color: T.textDim }]}>Step {sellStep + 1} of 4</Text>
              </View>
              <View style={{ width: 36 }} />
            </View>

            {/* Step Progress Bar */}
            <View style={[s.progressTrack, { backgroundColor: T.surfaceHigh }]}>
              <View style={[s.progressFill, { backgroundColor: T.primary, width: `${((sellStep + 1) / 4) * 100}%` as any }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 }}>

              {/* ── STEP 0: Token ── */}
              {sellStep === 0 && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <Text style={[s.stepHint, { color: T.textDim }]}>Which crypto do you want to sell?</Text>
                  {TOKENS.filter(t => (['TRON', 'TRON Nile'].includes(network) ? t !== 'ETH' : t !== 'TRX')).map(t => {
                    const active = sellToken === t;
                    const bal = getAvailableBalance(t);
                    const color = TOKEN_COLORS[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          s.tokenCard,
                          { backgroundColor: active ? T.primary + '12' : T.surfaceLow, borderColor: active ? T.primary : T.border }
                        ]}
                        onPress={() => setSellToken(t)}
                        activeOpacity={0.75}
                      >
                        <View style={[s.tokenCardIcon, { backgroundColor: color + '18' }]}>
                          <TokenSymbolIcon token={t} size={36} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.tokenCardName, { color: T.text }]}>{t}</Text>
                          <Text style={[s.tokenCardBal, { color: T.textDim }]}>
                            Balance: {bal.toFixed(6)}
                          </Text>
                        </View>
                        {bal === 0 && (
                          <View style={[s.zeroBadge, { backgroundColor: T.error + '15' }]}>
                            <Text style={{ color: T.error, fontSize: 10, fontWeight: '800' }}>EMPTY</Text>
                          </View>
                        )}
                        <View style={[
                          s.radioOuter,
                          { borderColor: active ? T.primary : T.border }
                        ]}>
                          {active && <View style={[s.radioInner, { backgroundColor: T.primary }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ── STEP 1: Amount & Rate ── */}
              {sellStep === 1 && (
                <View style={{ gap: 0, marginTop: 8 }}>
                  <Text style={[s.stepHint, { color: T.textDim }]}>How much {sellToken} are you selling and at what rate?</Text>

                  {/* Amount input — big card */}
                  <View style={[s.bigInputCard, { backgroundColor: T.surfaceLow, borderColor: T.border, marginTop: 16 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[s.bigInputLabel, { color: T.textDim }]}>AMOUNT TO SELL</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const max = getAvailableBalance(sellToken);
                          if (max > 0) setSellAmount(max.toFixed(6));
                        }}
                        style={[s.maxBtn, { backgroundColor: T.primary + '18' }]}
                      >
                        <Text style={{ color: T.primary, fontSize: 11, fontWeight: '900' }}>MAX</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TextInput
                        style={[s.bigInput, { color: T.text, flex: 1 }]}
                        value={sellAmount}
                        onChangeText={setSellAmount}
                        placeholder="0.00"
                        placeholderTextColor={T.textDim}
                        keyboardType="decimal-pad"
                      />
                      <View style={[s.tokenPill, { backgroundColor: T.surfaceHigh }]}>
                        <TokenSymbolIcon token={sellToken} size={20} />
                        <Text style={[s.tokenPillText, { color: T.text }]}>{sellToken}</Text>
                      </View>
                    </View>
                    <View style={[s.bigInputDivider, { backgroundColor: T.border }]} />
                    <Text style={[s.bigInputSub, { color: T.textDim }]}>
                      Available: {getAvailableBalance(sellToken).toFixed(6)} {sellToken}
                    </Text>
                    {parseFloat(sellAmount) > getAvailableBalance(sellToken) && (
                      <Text style={{ color: T.error, fontSize: 11, fontWeight: '700', marginTop: 4 }}>Exceeds your balance</Text>
                    )}
                  </View>

                  {/* Rate Chart — replaces plain text input */}
                  <RateChart
                    token={sellToken}
                    fiat={sellFiat}
                    liveRate={liveRate}
                    liveRateLoading={liveRateLoading}
                    rateHistory={rateHistory}
                    sellRate={sellRate}
                    onRateSelect={setSellRate}
                    T={T}
                    formatOrderFiat={formatOrderFiat}
                  />

                  {/* Live preview */}
                  {parseFloat(sellAmount) > 0 && parseFloat(sellRate) > 0 && (
                    <View style={[s.previewBanner, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}>
                      <Feather name="trending-up" size={14} color={T.primary} />
                      <Text style={{ color: T.primary, fontSize: 13, fontWeight: '700', flex: 1 }}>
                        You'll receive ~{formatOrderFiat(parseFloat(sellAmount) * parseFloat(sellRate) * 0.995, sellFiat)} after fees
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 2: Payment Details ── */}
              {sellStep === 2 && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <Text style={[s.stepHint, { color: T.textDim }]}>How will the buyer pay you?</Text>

                  <TouchableOpacity
                    style={[s.detailRow2, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                    onPress={() => setMethodModal(true)}
                  >
                    <View style={[s.detailRowIcon, { backgroundColor: T.primary + '15' }]}>
                      <Feather name="credit-card" size={18} color={T.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.detailRowLabel, { color: T.textDim }]}>PAYMENT METHOD</Text>
                      <Text style={[s.detailRowValue, { color: T.text }]}>{sellMethod}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={T.textDim} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.detailRow2, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                    onPress={() => setCountryModal(true)}
                  >
                    <View style={[s.detailRowIcon, { backgroundColor: '#6366F115' }]}>
                      <Feather name="map-pin" size={18} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.detailRowLabel, { color: T.textDim }]}>COUNTRY</Text>
                      <Text style={[s.detailRowValue, { color: T.text }]}>{sellCountry}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={T.textDim} />
                  </TouchableOpacity>

                  {/* Payment Details Input */}
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Receiving Account / Payment Details <Text style={{ color: T.primary }}>*</Text>
                    </Text>
                    <View style={{
                      backgroundColor: T.surfaceLow,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: T.border,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}>
                      <TextInput
                        style={{ color: T.text, fontSize: 14, fontWeight: '600', minHeight: 60, textAlignVertical: 'top', padding: 0 }}
                        value={sellPaymentDetails}
                        onChangeText={setSellPaymentDetails}
                        placeholder={
                          sellMethod === 'UPI'
                            ? "Enter UPI ID (e.g. yourname@upi)"
                            : sellMethod === 'PayPal'
                            ? "Enter PayPal Email (e.g. name@paypal.com)"
                            : "Enter Bank Account Number, Bank Name, IFSC code & Beneficiary Name"
                        }
                        placeholderTextColor={T.textDim}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                    <Text style={{ color: T.textDim, fontSize: 10, fontWeight: '600', marginTop: 6, lineHeight: 14 }}>
                      Provide clear payment instructions. The buyer will see this to transfer fiat funds when they accept your listing.
                    </Text>
                  </View>

                  <View style={[s.infoBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                    <Feather name="shield" size={14} color={T.success} />
                    <Text style={{ color: T.textDim, fontSize: 12, flex: 1, lineHeight: 18 }}>
                      Your crypto will be locked in escrow until the buyer confirms payment. You release it only after receiving funds.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 3: Review ── */}
              {sellStep === 3 && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <Text style={[s.stepHint, { color: T.textDim }]}>Review your listing before going live.</Text>

                  {/* Token hero */}
                  <View style={[s.reviewHero, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                    <TokenSymbolIcon token={sellToken} size={52} />
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <Text style={[s.reviewHeroAmount, { color: T.text }]}>{sellAmount} {sellToken}</Text>
                      <Text style={[s.reviewHeroFiat, { color: T.primary }]}>
                        {formatOrderFiat(parseFloat(sellAmount) * parseFloat(sellRate), sellFiat)}
                      </Text>
                      <Text style={[s.reviewHeroRate, { color: T.textDim }]}>
                        @ {formatOrderFiat(parseFloat(sellRate), sellFiat)}/{sellToken}
                      </Text>
                    </View>
                  </View>

                  {/* Details grid */}
                  {[
                    { icon: 'credit-card', label: 'Payment', value: sellMethod, color: T.primary },
                    { icon: 'map-pin',    label: 'Country',  value: sellCountry, color: '#6366F1' },
                    { icon: 'dollar-sign', label: 'Currency', value: sellFiat, color: T.success },
                    { icon: 'edit-3',      label: 'Details',  value: sellPaymentDetails.trim() ? (sellPaymentDetails.trim().length > 20 ? `${sellPaymentDetails.trim().slice(0, 20)}…` : sellPaymentDetails.trim()) : 'Simulated Defaults', color: '#F59E0B' },
                  ].map(row => (
                    <View key={row.label} style={[s.reviewRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                      <View style={[s.reviewRowIcon, { backgroundColor: row.color + '15' }]}>
                        <Feather name={row.icon as any} size={15} color={row.color} />
                      </View>
                      <Text style={[s.reviewRowLabel, { color: T.textDim }]}>{row.label}</Text>
                      <Text style={[s.reviewRowValue, { color: T.text }]}>{row.value}</Text>
                    </View>
                  ))}

                  {/* Fee summary */}
                  <View style={[s.feeSummary, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                    <View style={s.feeSummaryRow}>
                      <Text style={[s.feeSummaryLabel, { color: T.textDim }]}>Gross total</Text>
                      <Text style={[s.feeSummaryValue, { color: T.text }]}>{formatOrderFiat(parseFloat(sellAmount) * parseFloat(sellRate), sellFiat)}</Text>
                    </View>
                    <View style={[s.feeSummaryDivider, { backgroundColor: T.border }]} />
                    <View style={s.feeSummaryRow}>
                      <Text style={[s.feeSummaryLabel, { color: T.textDim }]}>Platform fee (0.5%)</Text>
                      <Text style={{ color: T.error, fontSize: 13, fontWeight: '700' }}>−{formatOrderFiat(parseFloat(sellAmount) * parseFloat(sellRate) * 0.005, sellFiat)}</Text>
                    </View>
                    <View style={[s.feeSummaryDivider, { backgroundColor: T.border }]} />
                    <View style={s.feeSummaryRow}>
                      <Text style={[s.feeSummaryLabel, { color: T.text, fontWeight: '800' }]}>You receive</Text>
                      <Text style={{ color: T.success, fontSize: 16, fontWeight: '900' }}>{formatOrderFiat(parseFloat(sellAmount) * parseFloat(sellRate) * 0.995, sellFiat)}</Text>
                    </View>
                  </View>
                  {network !== 'Sepolia' && network !== 'TRON Nile' && (
                    <Text style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
                      *Mainnet Escrow smart contract is pending deployment. This is a simulated placeholder flow.
                    </Text>
                  )}
                </View>
              )}

            </ScrollView>

            {/* Bottom CTA */}
            <View style={[s.wizardFooter, { borderTopColor: T.border, backgroundColor: T.surface }]}>
              {sellStep < 3 ? (
                <TouchableOpacity
                  style={[s.wizardNextBtn, {
                    backgroundColor: T.primary,
                    opacity: [canNextStep0, canNextStep1, canNextStep2][sellStep] ? 1 : 0.4
                  }]}
                  onPress={() => setSellStep(s2 => s2 + 1)}
                  disabled={![canNextStep0, canNextStep1, canNextStep2][sellStep]}
                >
                  <Text style={s.wizardNextText}>Continue</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.wizardNextBtn, { backgroundColor: T.primary, opacity: sellLoading ? 0.6 : 1 }]}
                  onPress={handleCreateSellOrder}
                  disabled={sellLoading}
                >
                  {sellLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="zap" size={18} color="#FFF" />
                      <Text style={s.wizardNextText}>List Order Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            <TransactionLoader visible={sellLoading} title="Creating Order" subtitle="Locking your crypto in escrow..." isDarkMode={isDarkMode} type="p2p" />
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row' }}>
           <Text style={[s.headerTitle, { color: T.primary }]}>P2P </Text>
           <Text style={[s.headerTitle, { color: T.text }]}>Marketplace</Text>
        </View>
        <TouchableOpacity 
          style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Feather name="settings" size={20} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { borderBottomColor: T.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity style={[s.tabItem, tab === 'buy' && [s.tabItemActive, { borderBottomColor: T.primary }]]} onPress={() => setTab('buy')}>
          <Text style={[s.tabText, { color: tab === 'buy' ? T.primary : T.textMuted }]}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabItem, tab === 'sell' && [s.tabItemActive, { borderBottomColor: T.primary }]]} onPress={() => setTab('sell')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.tabText, { color: tab === 'sell' ? T.primary : T.textMuted }]}>My Orders</Text>
            {(() => {
              const activeBuyCount = orders.filter(o =>
                o.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase() &&
                ['escrow_locked', 'payment_pending', 'payment_verification'].includes(o.status)
              ).length;
              return activeBuyCount > 0 ? (
                <View style={{ backgroundColor: T.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{activeBuyCount}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </TouchableOpacity>
      </View>

      {/* Fiat & Token Filter Bars */}
      {tab === 'buy' && (
        <View style={{ borderBottomColor: T.border, borderBottomWidth: 1, backgroundColor: T.surfaceLow }}>
          {/* Fiat chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
            {['ALL', ...FIAT_CURRENCIES].map(f => (
              <TouchableOpacity key={f}
                style={[s.chip, { backgroundColor: filterFiat === f ? T.primary : T.surface, borderColor: filterFiat === f ? T.primary : T.border, paddingHorizontal: 14, paddingVertical: 6 }]}
                onPress={() => setFilterFiat(f)}>
                <Text style={[s.chipText, { color: filterFiat === f ? '#FFF' : T.text }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Token chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
            {['ALL', ...TOKENS].map(t => {
              const active = filterToken === t;
              return (
                <TouchableOpacity key={t}
                  style={[s.chip, { 
                    backgroundColor: active ? T.primary : T.surface, 
                    borderColor: active ? T.primary : T.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: t === 'ALL' ? 14 : 8,
                    paddingRight: 14,
                    paddingVertical: 6
                  }]}
                  onPress={() => setFilterToken(t)}>
                  {t !== 'ALL' && <TokenSymbolIcon token={t} size={16} />}
                  <Text style={[s.chipText, { color: active ? '#FFF' : T.text, fontWeight: active ? '800' : '700' }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}



      {/* List */}
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} T={T} />)}
        </View>
      ) : tab === 'sell' ? (
        // My Orders tab — split into selling vs buying
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {(() => {
            const selling = orders.filter(o => o.seller_wallet.toLowerCase() === walletAddress.toLowerCase());
            const buying  = orders.filter(o => o.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase());
            return (
              <>
                {selling.length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { color: T.textDim }]}>MY SELL LISTINGS</Text>
                    {selling.map(item => (
                      <OrderCard key={item.id} order={item} T={T} walletAddress={walletAddress} formatOrderFiat={formatOrderFiat}
                        onPress={() => navigation.navigate('P2POrderDetail', { order: item })} />
                    ))}
                  </>
                )}
                {buying.length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { color: T.textDim, marginTop: selling.length > 0 ? 8 : 0 }]}>ORDERS I'M BUYING</Text>
                    {buying.map(item => (
                      <OrderCard key={item.id} order={item} T={T} walletAddress={walletAddress} formatOrderFiat={formatOrderFiat}
                        onPress={() => navigation.navigate('P2POrderDetail', { order: item })} />
                    ))}
                  </>
                )}
                {selling.length === 0 && buying.length === 0 && (
                  <View style={s.empty}>
                    <View style={[s.emptyIcon, { backgroundColor: T.surfaceLow }]}>
                      <Feather name="inbox" size={32} color={T.textDim} />
                    </View>
                    <Text style={[s.emptyTitle, { color: T.text }]}>No orders yet</Text>
                    <Text style={[s.emptySub, { color: T.textMuted }]}>
                      {isBusiness
                        ? 'Tap + to create a merchant sell listing.'
                        : 'Tap + to sell crypto or go to Buy tab to buy from sellers.'}
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </ScrollView>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={({ item }) => (
            <OrderCard order={item} T={T} walletAddress={walletAddress} formatOrderFiat={formatOrderFiat}
              onPress={() => navigation.navigate('P2POrderDetail', { order: item })} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => loadOrders(true)}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: T.surfaceLow }]}>
                <Feather name="inbox" size={32} color={T.textDim} />
              </View>
              <Text style={[s.emptyTitle, { color: T.text }]}>No orders found</Text>
              <Text style={[s.emptySub, { color: T.textMuted }]}>No open orders for this currency yet.</Text>
            </View>
          }
        />
      )}

      {/* FAB — anyone can create sell orders now */}
      {tab === 'sell' && (
        <TouchableOpacity style={[s.fab, { backgroundColor: T.primary, shadowColor: T.primary }]} onPress={() => { resetSellModal(); setShowSellModal(true); }} activeOpacity={0.85}>
          <Feather name="plus" size={26} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  tabBar: { flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '800' },

  filterBar: { borderBottomWidth: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },

  list: { padding: 16, paddingBottom: 110 },

  // Order card
  card: { borderRadius: 24, padding: 20, marginBottom: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  tokenAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tokenAvatarText: { fontSize: 13, fontWeight: '900' },
  tokenName: { fontSize: 16, fontWeight: '800' },
  sellerAddr: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  minePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  minePillText: { fontSize: 9, fontWeight: '900' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusLabel: { fontSize: 10, fontWeight: '900' },
  statsRow: { marginBottom: 20, gap: 12 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 13, fontWeight: '500' },
  statValue: { fontSize: 14, fontWeight: '800' },
  statValueBig: { fontSize: 18, fontWeight: '900' },
  buyBtn: { width: '100%', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 72, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // FAB
  fab: { position: 'absolute', bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '65%' },
  sellSheet:    { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 0, maxHeight: '92%' },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  modalSubtitle:{ fontSize: 13, fontWeight: '500', marginTop: 3 },
  sellSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sellFormContent: { paddingBottom: 32 },
  modalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  modalRowText: { fontSize: 15, fontWeight: '600' },
  // Wizard styles
  wizardHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  wizardBackBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  wizardTitle:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  wizardStepText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  progressTrack:  { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 4, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 2 },
  stepHint:       { fontSize: 13, fontWeight: '500', lineHeight: 20, marginBottom: 4 },

  // Token card (step 0)
  tokenCard:      { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 14 },
  tokenCardIcon:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tokenCardName:  { fontSize: 17, fontWeight: '800' },
  tokenCardBal:   { fontSize: 12, fontWeight: '500', marginTop: 2 },
  zeroBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  radioOuter:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner:     { width: 11, height: 11, borderRadius: 6 },

  // Big input card (step 1)
  bigInputCard:   { borderRadius: 20, borderWidth: 1.5, padding: 16 },
  bigInputLabel:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  bigInput:       { fontSize: 28, fontWeight: '800', padding: 0, minWidth: 80 },
  bigInputDivider:{ height: 1, marginVertical: 10 },
  bigInputSub:    { fontSize: 12, fontWeight: '500' },
  maxBtn:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tokenPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  tokenPillText:  { fontSize: 14, fontWeight: '800' },
  previewBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 12 },

  // Detail rows (step 2)
  detailRow2:     { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 14 },
  detailRowIcon:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailRowLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  detailRowValue: { fontSize: 15, fontWeight: '700' },
  infoBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },

  // Review (step 3)
  reviewHero:     { alignItems: 'center', borderRadius: 24, borderWidth: 1.5, padding: 24, gap: 12 },
  reviewHeroAmount:{ fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  reviewHeroFiat: { fontSize: 20, fontWeight: '800' },
  reviewHeroRate: { fontSize: 13, fontWeight: '500' },
  reviewRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  reviewRowIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewRowLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  reviewRowValue: { fontSize: 14, fontWeight: '800' },
  feeSummary:     { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 0 },
  feeSummaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  feeSummaryLabel:{ fontSize: 13, fontWeight: '600' },
  feeSummaryValue:{ fontSize: 13, fontWeight: '700' },
  feeSummaryDivider:{ height: 1, marginVertical: 2 },

  // Wizard footer
  wizardFooter:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, borderTopWidth: 1 },
  wizardNextBtn:  { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  wizardNextText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  // Professional chart card
  chartCard:       { borderRadius: 20, borderWidth: 1.5, marginTop: 20, overflow: 'hidden' },
  chartTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  chartLabel:      { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  chartGross:      { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  chartFiatLabel:  { fontSize: 14, fontWeight: '700' },
  livePill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  livePillText:    { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  livePillRate:    { fontSize: 11, fontWeight: '800' },
  changePill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  changePillText:  { fontSize: 11, fontWeight: '800' },
  chartArea:       { paddingHorizontal: 16, paddingBottom: 4 },
  chartFooter:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartFooterText: { fontSize: 9, fontWeight: '600' },
  chartDivider:    { height: 1, marginHorizontal: 16, marginVertical: 12 },
  feeGrid:         { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  feeGridItem:     { flex: 1, alignItems: 'center', gap: 4 },
  feeGridLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  feeGridValue:    { fontSize: 15, fontWeight: '800' },
  feeGridDivider:  { width: 1, marginHorizontal: 4 },
  totalPreviewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 20 },
  totalPreviewEmptyText: { fontSize: 13, fontWeight: '600' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:    { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  cancelBtnText:{ fontSize: 15, fontWeight: '700' },
  confirmBtn:   { flex: 2, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  confirmBtnText:{ color: '#FFF', fontSize: 15, fontWeight: '900' },});
