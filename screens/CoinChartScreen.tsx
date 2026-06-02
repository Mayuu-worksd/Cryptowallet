import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Platform, Animated, Dimensions, PanResponder,
  Modal, Pressable
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  Svg, Path, Defs, LinearGradient, Stop,
  Line, Circle, Rect, Text as SvgText,
} from 'react-native-svg';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { SYMBOL_TO_COINGECKO_ID } from '../services/marketService';
import { SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';

const { width: SCREEN_W } = Dimensions.get('window');

// Chart layout constants
const H_PAD    = 24;
const Y_AXIS_W = 0; // We will hide Y axis to match the image precisely or just keep it small. The image doesn't show a Y axis label for the chart, but let's keep the plot width full.
const CHART_W  = SCREEN_W - H_PAD * 2;
const PLOT_W   = CHART_W; 
const CHART_H  = 220;
const PAD_T    = 18;
const PAD_B    = 18;
const PLOT_H   = CHART_H - PAD_T - PAD_B;

const RANGES = [
  { label: 'LIVE', days: 1   }, // placeholder for 1d
  { label: '1H', days: 1     }, 
  { label: '1D', days: 1     },
  { label: '1W', days: 7     },
  { label: '1M', days: 30    },
  { label: '1Y', days: 365   },
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

// ── Trading Chart ──────────────────────────────────────────────────────────
interface TradingChartProps {
  prices: number[];
  color: string;
  isDark: boolean;
  fiatSymbol: string;
}

const TradingChart = React.memo(({ prices, color, isDark, fiatSymbol }: TradingChartProps) => {
  const [crosshair, setCrosshair] = useState<{ xi: number } | null>(null);

  const tooltipBg  = isDark ? '#2A2B31' : '#ffffff';
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

  const fmtTooltip = useCallback((p: number): string => {
    if (p >= 1_000) return `${fiatSymbol}${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (p >= 1)     return `${fiatSymbol}${p.toFixed(4)}`;
    return `${fiatSymbol}${p.toFixed(6)}`;
  }, [fiatSymbol]);

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
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 10 }}>
      {/* ── Plot area (touch-enabled) ── */}
      <View {...panResponder.panHandlers} style={{ width: PLOT_W, height: CHART_H }}>
        <Svg width={PLOT_W} height={CHART_H}>
          {/* Price line */}
          <Path d={linePath} stroke={color} strokeWidth={2.5}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Last-price dot */}
          <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={5} fill={color} />

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
                fill={tooltipBg} stroke={color} strokeWidth={1} />
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
    </View>
  );
});

// ── Main Screen ────────────────────────────────────────────────────────────
export default function CoinChartScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { symbol } = route.params as { symbol: string };
  const { isDarkMode, balances, ethBalance, formatFiat, fiatCurrency, transactions } = useWallet() as any;
  const { prices } = useMarket();
  const T     = isDarkMode ? Theme.colors : Theme.lightColors;
  const color = COIN_COLORS[symbol] ?? T.primary;
  const meta  = COIN_META[symbol];

  const fiatInfo = SUPPORTED_FIAT_CURRENCIES[fiatCurrency] || { symbol: '$', rate: 1 };
  const fiatSymbolStr = fiatInfo.symbol;

  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading]     = useState(true);
  const [range, setRange]         = useState(1);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);

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
    const converted = p * fiatInfo.rate;
    if (typeof converted !== 'number' || !isFinite(converted) || converted <= 0) return `${fiatInfo.symbol}0.00`;
    if (converted >= 1000) return `${fiatInfo.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (converted >= 1)    return `${fiatInfo.symbol}${converted.toFixed(4)}`;
    return `${fiatInfo.symbol}${converted.toFixed(6)}`;
  }, [fiatInfo]);

  const safeNum = (n: number) => (typeof n === 'number' && isFinite(n) ? n : 0);
  const chartLineColor = chartUp ? T.success : T.error;

  const tokenTxs = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => 
      tx.coin === symbol || 
      tx.symbol === symbol || 
      (tx.type === 'swap' && (tx.buyToken === symbol || tx.coin === symbol)) ||
      (tx.type === 'SWAP' && (tx.buyToken === symbol || tx.coin === symbol))
    ).sort((a: any, b: any) => new Date(b.date || Date.now()).getTime() - new Date(a.date || Date.now()).getTime());
  }, [transactions, symbol]);

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={24} color={T.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 }}>
            {meta ? (
              <Image source={{ uri: meta.iconUrl }} style={styles.headerIcon} />
            ) : (
              <View style={[styles.headerIcon, { backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
              </View>
            )}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.headerSym, { color: T.text }]}>{symbol}</Text>
              </View>
              <Text style={[styles.headerTitle, { color: T.textMuted }]}>{meta?.name ?? symbol}</Text>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.priceTop, { color: T.text }]}>{formatPrice(priceNow)}</Text>
          <Text style={[styles.changeTop, { color: chartLineColor }]}>
            {chartUp ? '+' : ''}{(typeof pctChange === 'number' && isFinite(pctChange) ? pctChange : 0).toFixed(2)}%
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Chart */}
        <View style={styles.chartBox}>
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
                fiatSymbol={fiatSymbolStr}
              />
            </Animated.View>
          )}

          {/* Range selector */}
          <View style={styles.rangeRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.label}
                style={[styles.rangeBtn, range === r.days && { backgroundColor: T.surfaceLow }]}
                onPress={() => setRange(r.days)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rangeBtnText, {
                  color: range === r.days ? T.text : T.textMuted,
                  fontWeight: range === r.days ? '800' : '600',
                }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Your Balance */}
        <View style={styles.balanceSection}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <Text style={[styles.sectionTitle, { color: T.text }]}>Your balance</Text>
             <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.balanceFiat, { color: T.text }]}>
                   {formatFiat(typeof usdValue === 'number' && isFinite(usdValue) ? usdValue : 0)}
                </Text>
                <Text style={[styles.balanceToken, { color: T.textMuted }]}>
                   {balance.toFixed(4)} {symbol}
                </Text>
             </View>
           </View>

           {/* Send & Receive Pills */}
           <View style={styles.balanceActions}>
              <TouchableOpacity style={[styles.pillBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Send', { symbol })}>
                 <Feather name="arrow-up-right" size={16} color={T.text} style={{ marginRight: 8 }} />
                 <Text style={[styles.pillBtnText, { color: T.text }]}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Receive', { symbol })}>
                 <Ionicons name="qr-code-outline" size={16} color={T.text} style={{ marginRight: 8 }} />
                 <Text style={[styles.pillBtnText, { color: T.text }]}>Receive</Text>
              </TouchableOpacity>
           </View>
        </View>

        {/* Recent History */}
        <View style={styles.historySection}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }} onPress={() => navigation.navigate('History', { filterSymbol: symbol })}>
             <Text style={[styles.sectionTitle, { color: T.text }]}>Recent history</Text>
             <Feather name="chevron-right" size={18} color={T.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          
          {tokenTxs.length === 0 ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: T.textMuted, fontSize: 13, fontWeight: '500' }}>
                 Missing a transaction? <Text style={{ color: T.success, fontWeight: '700' }}>View on explorer</Text>
              </Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {tokenTxs.slice(0, 3).map((tx: any, i: number) => {
                const isSent = tx.type === 'sent';
                const isSwap = tx.type === 'swap' || tx.type === 'SWAP';
                
                let iconName = isSent ? 'arrow-up-right' : 'arrow-down-left';
                let iconColor = isSent ? T.text : T.success;
                let bgStyle = isSent ? T.surfaceLow : T.success + '15';
                let title = isSent ? `Sent ${tx.coin}` : `Received ${tx.coin}`;
                let amountText = `${isSent ? '-' : '+'}${tx.amount} ${tx.coin}`;
                let amountColor = isSent ? T.text : T.success;

                if (isSwap) {
                  iconName = 'refresh-cw';
                  iconColor = T.primary;
                  bgStyle = T.primary + '15';
                  title = `Swapped ${tx.coin} to ${tx.buyToken}`;
                  
                  if (tx.coin === symbol) {
                     amountText = `-${tx.amount} ${tx.coin}`;
                     amountColor = T.text;
                  } else {
                     amountText = `+${tx.buyAmount ?? '?'} ${tx.buyToken}`;
                     amountColor = T.success;
                  }
                }

                return (
                  <TouchableOpacity key={tx.id || i} style={styles.txRow} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.txIconBg, { backgroundColor: bgStyle }]}>
                        <Feather name={iconName as any} size={16} color={iconColor} />
                      </View>
                      <View>
                        <Text style={[styles.txTitle, { color: T.text }]}>{title}</Text>
                        <Text style={[styles.txDate, { color: T.textMuted }]}>
                           {new Date(tx.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, { color: amountColor }]}>{amountText}</Text>
                      <Text style={[styles.txUsd, { color: T.textMuted }]}>
                         {tx.usdValue ? formatFiat(parseFloat(tx.usdValue)) : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
           <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 20 }]}>Stats</Text>
           <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 24 }}>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>Market Cap</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>$45.68B</Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>24h Volume</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>$3.65B</Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>Holders</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>-</Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>Created</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>14 Jan 2024</Text>
              </View>
           </View>
        </View>

      </ScrollView>

      {/* Sticky Trade Button */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 20 }]}>
         <TouchableOpacity 
            style={[styles.tradeBtn, { backgroundColor: T.primary }]} 
            activeOpacity={0.8}
            onPress={() => setTradeModalVisible(true)}
         >
            <Text style={styles.tradeBtnText}>Trade</Text>
         </TouchableOpacity>
      </View>

      {/* Trade Modal */}
      <Modal visible={tradeModalVisible} transparent animationType="slide" onRequestClose={() => setTradeModalVisible(false)}>
         <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setTradeModalVisible(false)} />
            <View style={[styles.modalContent, { backgroundColor: T.surface, paddingBottom: insets.bottom + 24 }]}>
               <View style={styles.modalActionsList}>
                  <TouchableOpacity 
                     style={[styles.modalBtn, { backgroundColor: T.primary }]} 
                     activeOpacity={0.8}
                     onPress={() => {
                        setTradeModalVisible(false);
                        navigation.navigate('Swap', { fromToken: symbol });
                     }}
                  >
                     <Text style={styles.modalBtnText}>Swap</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} activeOpacity={0.8}>
                     <Text style={styles.modalBtnText}>Sell</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} activeOpacity={0.8}>
                     <Text style={styles.modalBtnText}>Buy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                     style={[styles.modalCloseBtn, { backgroundColor: T.surfaceLow }]} 
                     activeOpacity={0.8}
                     onPress={() => setTradeModalVisible(false)}
                  >
                     <Feather name="x" size={24} color={T.primary} />
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  headerIcon: { width: 28, height: 28, borderRadius: 14 },
  headerSym: { fontSize: 16, fontFamily: Fonts.bold },
  headerTitle: { fontSize: 13, fontFamily: Fonts.medium },
  priceTop: { fontSize: 20, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  changeTop: { fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 2 },

  scroll: { paddingHorizontal: H_PAD, paddingBottom: 120, paddingTop: 10 },

  chartBox: { marginBottom: 32 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 10 },
  rangeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  rangeBtnText: { fontSize: 12 },

  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold },

  balanceSection: { marginBottom: 32 },
  balanceFiat: { fontSize: 18, fontFamily: Fonts.bold },
  balanceToken: { fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 2 },
  balanceActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  pillBtn: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pillBtnText: { fontSize: 15, fontFamily: Fonts.semiBold },

  historySection: { marginBottom: 36 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  txDate: { fontSize: 13, fontFamily: Fonts.medium },
  txAmount: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  txUsd: { fontSize: 13, fontFamily: Fonts.medium },

  statsSection: { marginBottom: 20 },
  statLabel: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 6 },
  statValue: { fontSize: 15, fontFamily: Fonts.bold },

  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, backgroundColor: 'transparent' },
  tradeBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tradeBtnText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalActionsList: { gap: 12 },
  modalBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold },
  modalCloseBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 }
});
