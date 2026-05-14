import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Platform, Animated, Dimensions, PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Svg, Path, Defs, LinearGradient, Stop,
  Line, Circle, Rect, Text as SvgText,
} from 'react-native-svg';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { SYMBOL_TO_COINGECKO_ID } from '../services/marketService';

const { width: SCREEN_W } = Dimensions.get('window');

// Chart layout constants
const H_PAD    = 24;
const Y_AXIS_W = 58;
const CHART_W  = SCREEN_W - H_PAD * 2;
const PLOT_W   = CHART_W - Y_AXIS_W;
const CHART_H  = 210;
const PAD_T    = 18;
const PAD_B    = 18;
const PLOT_H   = CHART_H - PAD_T - PAD_B;

const RANGES = [
  { label: '1D', days: 1   },
  { label: '7D', days: 7   },
  { label: '1M', days: 30  },
  { label: '3M', days: 90  },
  { label: '1Y', days: 365 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function buildBezierPath(xs: number[], ys: number[]): string {
  if (xs.length < 2) return '';
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 1; i < xs.length; i++) {
    const cpx = ((xs[i - 1] + xs[i]) / 2).toFixed(1);
    d += ` C ${cpx} ${ys[i - 1].toFixed(1)}, ${cpx} ${ys[i].toFixed(1)}, ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
  }
  return d;
}

function fmtYLabel(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000)     return `$${(p / 1_000).toFixed(1)}k`;
  if (p >= 1)         return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

function fmtTooltip(p: number): string {
  if (p >= 1_000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1)     return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

// ── Trading Chart ──────────────────────────────────────────────────────────
interface TradingChartProps {
  prices: number[];
  color: string;
  isDark: boolean;
}

const TradingChart = React.memo(({ prices, color, isDark }: TradingChartProps) => {
  const [crosshair, setCrosshair] = useState<{ xi: number } | null>(null);

  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.4)';
  const tooltipBg  = isDark ? '#1c1b1b' : '#ffffff';
  const tooltipTxt = isDark ? '#ffffff' : '#131313';

  // Downsample to max 120 pts
  const sample = useMemo(() => {
    if (prices.length <= 120) return prices;
    const step = Math.ceil(prices.length / 120);
    return prices.filter((_, i) => i % step === 0);
  }, [prices]);

  const min   = useMemo(() => Math.min(...sample), [sample]);
  const max   = useMemo(() => Math.max(...sample), [sample]);
  const range = max - min || 1;

  const toX = (i: number) => (i / (sample.length - 1)) * PLOT_W;
  const toY = (p: number) => PAD_T + (1 - (p - min) / range) * PLOT_H;

  const xs = useMemo(() => sample.map((_, i) => toX(i)), [sample]);
  const ys = useMemo(() => sample.map(p => toY(p)), [sample, min, range]);

  const linePath = useMemo(() => buildBezierPath(xs, ys), [xs, ys]);
  const areaPath = useMemo(() =>
    linePath +
    ` L ${xs[xs.length - 1].toFixed(1)} ${CHART_H}` +
    ` L ${xs[0].toFixed(1)} ${CHART_H} Z`,
    [linePath, xs]);

  // 5 horizontal grid levels
  const gridLevels = useMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map(t => ({
      y:     PAD_T + (1 - t) * PLOT_H,
      label: fmtYLabel(min + t * range),
    })),
    [min, range]);

  // Crosshair data
  const cx = crosshair != null ? xs[crosshair.xi] : null;
  const cy = crosshair != null ? ys[crosshair.xi] : null;
  const cPrice = crosshair != null ? sample[crosshair.xi] : null;

  // Tooltip bubble: keep it inside plot area
  const TOOLTIP_W = 80;
  const tooltipX = cx != null ? Math.max(0, Math.min(cx - TOOLTIP_W / 2, PLOT_W - TOOLTIP_W)) : 0;

  const sampleLenRef = useRef(sample.length);
  useEffect(() => { sampleLenRef.current = sample.length; }, [sample.length]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const clamped = Math.max(0, Math.min(e.nativeEvent.locationX, PLOT_W));
      setCrosshair({ xi: Math.round((clamped / PLOT_W) * (sampleLenRef.current - 1)) });
    },
    onPanResponderMove: (e) => {
      const clamped = Math.max(0, Math.min(e.nativeEvent.locationX, PLOT_W));
      setCrosshair({ xi: Math.round((clamped / PLOT_W) * (sampleLenRef.current - 1)) });
    },
    onPanResponderRelease:   () => setCrosshair(null),
    onPanResponderTerminate: () => setCrosshair(null),
  }), []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* ── Plot area (touch-enabled) ── */}
      <View {...panResponder.panHandlers} style={{ width: PLOT_W, height: CHART_H }}>
        <Svg width={PLOT_W} height={CHART_H}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.3" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Horizontal grid lines */}
          {gridLevels.map((g, i) => (
            <Line key={i}
              x1={0} y1={g.y} x2={PLOT_W} y2={g.y}
              stroke={gridColor} strokeWidth={1} strokeDasharray="4 5"
            />
          ))}

          {/* Area fill */}
          <Path d={areaPath} fill="url(#areaGrad)" />

          {/* Price line */}
          <Path d={linePath} stroke={color} strokeWidth={2.2}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Last-price dot */}
          <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={4} fill={color} />
          <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={8} fill={color} fillOpacity={0.18} />

          {/* Crosshair */}
          {cx != null && cy != null && cPrice != null && (
            <>
              {/* Vertical line */}
              <Line x1={cx} y1={PAD_T} x2={cx} y2={CHART_H - PAD_B}
                stroke={color} strokeWidth={1.2} strokeDasharray="3 4" strokeOpacity={0.7} />
              {/* Dot */}
              <Circle cx={cx} cy={cy} r={5} fill={color} />
              <Circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.15} />
              {/* Tooltip */}
              <Rect x={tooltipX} y={PAD_T - 2} width={TOOLTIP_W} height={22} rx={7}
                fill={tooltipBg} stroke={color} strokeWidth={1} strokeOpacity={0.5} />
              <SvgText
                x={tooltipX + TOOLTIP_W / 2} y={PAD_T + 14}
                textAnchor="middle" fontSize={11} fontWeight="700" fill={tooltipTxt}
              >
                {fmtTooltip(cPrice)}
              </SvgText>
            </>
          )}
        </Svg>
      </View>

      {/* ── Y-axis labels ── */}
      <Svg width={Y_AXIS_W} height={CHART_H}>
        {gridLevels.map((g, i) => (
          <SvgText key={i} x={6} y={g.y + 4}
            fontSize={10} fontWeight="600" fill={labelColor}
          >
            {g.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
});

// ── Main Screen ────────────────────────────────────────────────────────────
export default function CoinChartScreen({ route, navigation }: any) {
  const { symbol } = route.params as { symbol: string };
  const { isDarkMode, balances, ethBalance } = useWallet();
  const { prices } = useMarket();
  const T     = isDarkMode ? Theme.colors : Theme.lightColors;
  const color = COIN_COLORS[symbol] ?? T.primary;
  const meta  = COIN_META[symbol];

  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading]     = useState(true);
  const [range, setRange]         = useState(7);
  // Always reflect live context price; chart fetch may override with latest candle
  const contextPrice = prices[symbol]?.usd ?? 0;
  const [priceNow, setPriceNow]   = useState(contextPrice);
  useEffect(() => {
    if (contextPrice > 0) setPriceNow(contextPrice);
  }, [contextPrice]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const balance  = symbol === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[symbol] ?? 0);
  const usdValue = balance * priceNow;
  // For BTC/SOL we have live price data but no on-chain balance yet
  const isWatchOnly = balance === 0 && (symbol === 'BTC' || symbol === 'SOL');

  const change24h = prices[symbol]?.change24h ?? 0;
  const isUp      = change24h >= 0;

  const fetchChart = async (days: number) => {
    setLoading(true);
    fadeAnim.setValue(0);
    const id = SYMBOL_TO_COINGECKO_ID[symbol];
    if (!id) { setLoading(false); return; }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
          { headers: { Accept: 'application/json' } }
        );
        if (res.status === 429) continue;
        if (!res.ok) break;
        const data = await res.json();
        const pts  = (data.prices ?? []).map((p: [number, number]) => p[1]) as number[];
        if (pts.length > 1) {
          setChartData(pts);
          setPriceNow(pts[pts.length - 1]);
          setLoading(false);
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          return;
        }
        break;
      } catch {
        if (attempt === 1) break;
      }
    }

    // Fallback simulated data
    const fallback = prices[symbol]?.usd ?? 0;
    if (fallback > 0) {
      let prev = fallback;
      const pts = Array.from({ length: 60 }, (_, i) => {
        if (i === 59) return fallback;
        prev = prev * (1 + (Math.random() * 0.012 - 0.006));
        return prev;
      });
      setChartData(pts);
      setPriceNow(fallback);
    } else {
      setChartData([]);
    }
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  useEffect(() => { fetchChart(range); }, [range, symbol]);

  const chartMin = useMemo(() =>
    chartData.length >= 2 ? Math.min(...chartData) : 0, [chartData]);
  const chartMax = useMemo(() =>
    chartData.length >= 2 ? Math.max(...chartData) : 0, [chartData]);
  const pctChange = useMemo(() => {
    if (chartData.length >= 2)
      return ((chartData[chartData.length - 1] - chartData[0]) / chartData[0]) * 100;
    return change24h;
  }, [chartData, change24h]);
  const chartUp = pctChange >= 0;

  const formatPrice = useCallback((p: number) => {
    if (typeof p !== 'number' || !isFinite(p) || p <= 0) return '$0.00';
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (p >= 1)    return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  }, []);

  const safeNum = (n: number) => (typeof n === 'number' && isFinite(n) ? n : 0);

  const stats = useMemo(() => [
    { label: 'Current Price', value: formatPrice(safeNum(priceNow)) },
    { label: '24h Change',    value: `${isUp ? '+' : ''}${safeNum(change24h).toFixed(2)}%`, color: isUp ? T.success : T.error },
    { label: 'Range High',    value: chartData.length >= 2 ? `$${safeNum(chartMax).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—' },
    { label: 'Range Low',     value: chartData.length >= 2 ? `$${safeNum(chartMin).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—' },
  ], [priceNow, isUp, change24h, chartData, chartMax, chartMin, formatPrice, T]);

  const chartLineColor = chartUp ? T.success : T.error;

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {meta && <Image source={{ uri: meta.iconUrl }} style={styles.headerIcon} />}
          <View>
            <Text style={[styles.headerTitle, { color: T.text }]}>{meta?.name ?? symbol}</Text>
            <Text style={[styles.headerSym, { color: T.textMuted }]}>{symbol}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Price + change */}
        <View style={styles.priceSection}>
          <Text style={[styles.price, { color: T.text }]}>{formatPrice(priceNow)}</Text>
          <View style={[styles.changePill, { backgroundColor: chartUp ? T.success + '22' : T.error + '22' }]}>
            <Feather name={chartUp ? 'trending-up' : 'trending-down'} size={13} color={chartLineColor} />
            <Text style={[styles.changeText, { color: chartLineColor }]}>
              {chartUp ? '+' : ''}{(typeof pctChange === 'number' && isFinite(pctChange) ? pctChange : 0).toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Chart card */}
        <View style={[styles.chartBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          {loading ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={color} size="large" />
            </View>
          ) : chartData.length < 2 ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="wifi-off" size={24} color={T.textMuted} />
              <Text style={{ color: T.textMuted, marginTop: 8, fontSize: 13 }}>Chart unavailable</Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              <TradingChart
                prices={chartData}
                color={chartLineColor}
                isDark={isDarkMode}
              />
            </Animated.View>
          )}

          {/* Range selector */}
          <View style={[styles.rangeRow, { borderTopColor: T.border }]}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.label}
                style={[styles.rangeBtn, range === r.days && { backgroundColor: color + '22' }]}
                onPress={() => setRange(r.days)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rangeBtnText, {
                  color: range === r.days ? color : T.textMuted,
                  fontWeight: range === r.days ? '800' : '600',
                }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Holdings */}
        <View style={[styles.holdingsCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.sectionLabel, { color: T.textMuted }]}>YOUR HOLDINGS</Text>
          {isWatchOnly ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: T.primary + '18' }]}>
                <Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}>Coming Soon</Text>
              </View>
              <Text style={[styles.holdingsUsd, { color: T.textMuted }]}>{COIN_META[symbol]?.name} on-chain support coming soon</Text>
            </View>
          ) : (
            <View style={styles.holdingsRow}>
              <View>
                <Text style={[styles.holdingsAmount, { color: T.text }]}>
                  {balance.toFixed(6)} {symbol}
                </Text>
                <Text style={[styles.holdingsUsd, { color: T.textMuted }]}>
                  ≈ ${(typeof usdValue === 'number' && isFinite(usdValue) ? usdValue : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[styles.holdingsBadge, { backgroundColor: color + '18' }]}>
                <Text style={[styles.holdingsBadgeText, { color }]}>{symbol}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.sectionLabel, { color: T.textMuted }]}>MARKET STATS</Text>
          {stats.map((stat, i, arr) => (
            <View key={stat.label} style={[
              styles.statRow,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border },
            ]}>
              <Text style={[styles.statLabel, { color: T.textMuted }]}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color ?? T.text }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  headerIcon: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSym: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  scroll: { paddingHorizontal: H_PAD, paddingBottom: 80, paddingTop: 20 },

  priceSection: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  price: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  changeText: { fontSize: 13, fontWeight: '700' },

  chartBox: { borderRadius: 20, paddingTop: 16, paddingBottom: 4, paddingHorizontal: 0, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 8, borderTopWidth: 1 },
  rangeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  rangeBtnText: { fontSize: 13 },

  holdingsCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 14 },
  holdingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  holdingsAmount: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  holdingsUsd: { fontSize: 14, fontWeight: '500' },
  holdingsBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  holdingsBadgeText: { fontSize: 14, fontWeight: '800' },

  statsCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  statLabel: { fontSize: 14, fontWeight: '500' },
  statValue: { fontSize: 14, fontWeight: '700' },
});
