import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Platform, Animated, Dimensions, PanResponder,
  Modal, Pressable, RefreshControl, AppState
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  Svg, Path, Defs, LinearGradient, Stop,
  Line, Circle, Rect, Text as SvgText,
} from 'react-native-svg';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { marketService, SYMBOL_TO_COINGECKO_ID } from '../services/marketService';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import { SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';
import { CurrencyText } from '../components/CurrencyText';
import { parseDateSafe, formatDateShort } from '../utils/date';

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
  { label: 'LIVE', value: 'LIVE' },
  { label: '1H', value: '1H' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '1Y', value: '1Y' },
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
  formatPrice: (p: number) => string;
}

const TradingChart = React.memo(({ prices, color, isDark, formatPrice }: TradingChartProps) => {
  const [crosshair, setCrosshair] = useState<{ xi: number } | null>(null);

  const tooltipBg  = isDark ? '#2A2B31' : '#ffffff';
  const tooltipTxt = isDark ? '#ffffff' : '#131313';

  const prevPricesRef = useRef<number[]>([]);
  const shiftAnim = useRef(new Animated.Value(0)).current;

  // Downsample to max 120 pts
  const sample = useMemo(() => {
    if (prices.length <= 120) return prices;
    const step = Math.ceil(prices.length / 120);
    return prices.filter((_, i) => i % step === 0);
  }, [prices]);

  useEffect(() => {
    const prev = prevPricesRef.current;
    if (prev.length > 0 && sample.length > 0) {
      const hasShifted = prev.length === sample.length && Math.abs(prev[1] - sample[0]) < 0.00001;
      if (hasShifted) {
        const dx = PLOT_W / (sample.length - 1);
        shiftAnim.setValue(dx);
        Animated.timing(shiftAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    }
    prevPricesRef.current = sample;
  }, [sample, prices]);

  const min   = useMemo(() => Math.min(...sample), [sample]);
  const max   = useMemo(() => Math.max(...sample), [sample]);
  const range = max - min || 1;

  const toX = (i: number) => (i / (sample.length - 1)) * PLOT_W;
  const toY = (p: number) => PAD_T + (1 - (p - min) / range) * PLOT_H;

  const xs = useMemo(() => sample.map((_, i) => toX(i)), [sample]);
  const ys = useMemo(() => sample.map(p => toY(p)), [sample, min, range]);

  const linePath = useMemo(() => buildBezierPath(xs, ys), [xs, ys]);

  const areaPath = useMemo(() => {
    if (xs.length < 2 || !linePath) return '';
    const bottomY = PLOT_H + PAD_T;
    return `${linePath} L ${xs[xs.length - 1].toFixed(1)} ${bottomY.toFixed(1)} L ${xs[0].toFixed(1)} ${bottomY.toFixed(1)} Z`;
  }, [xs, ys, linePath]);

  const fmtTooltip = useCallback((p: number): string => {
    return formatPrice(p);
  }, [formatPrice]);

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

  // Grid coordinates
  const gridY1 = PAD_T;
  const gridY2 = PAD_T + PLOT_H / 2;
  const gridY3 = PAD_T + PLOT_H;
  const gridColor = isDark ? 'rgba(42, 43, 49, 0.4)' : 'rgba(229, 231, 235, 0.6)';
  const labelColor = isDark ? '#7F848E' : '#9CA3AF';

  // Live price guide & badge details
  const lastPrice = sample[sample.length - 1] ?? 0;
  const lastPriceStr = formatPrice(lastPrice);
  const lastY = ys[ys.length - 1] ?? PAD_T + PLOT_H / 2;
  const badgeW = 68;
  const badgeH = 18;
  const badgeX = PLOT_W - badgeW - 2;
  const badgeY = lastY - 9;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 10, overflow: 'hidden', width: PLOT_W }}>
      {/* ── Plot area (touch-enabled) ── */}
      <View {...panResponder.panHandlers} style={{ width: PLOT_W, height: CHART_H, overflow: 'hidden' }}>
        <Animated.View style={{ width: PLOT_W, height: CHART_H, transform: [{ translateX: shiftAnim }] }}>
          <Svg width={PLOT_W} height={CHART_H}>
            <Defs>
              <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <Stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            <Line x1={0} y1={gridY1} x2={PLOT_W} y2={gridY1} stroke={gridColor} strokeWidth={1} strokeDasharray="3 4" />
            <Line x1={0} y1={gridY2} x2={PLOT_W} y2={gridY2} stroke={gridColor} strokeWidth={1} strokeDasharray="3 4" />
            <Line x1={0} y1={gridY3} x2={PLOT_W} y2={gridY3} stroke={gridColor} strokeWidth={1} strokeDasharray="3 4" />

            {/* Grid labels */}
            <SvgText x={PLOT_W - 5} y={gridY1 - 4} fontSize={8} fill={labelColor} fontWeight="600" textAnchor="end">{formatPrice(max)}</SvgText>
            <SvgText x={PLOT_W - 5} y={gridY2 - 4} fontSize={8} fill={labelColor} fontWeight="600" textAnchor="end">{formatPrice((max + min) / 2)}</SvgText>
            <SvgText x={PLOT_W - 5} y={gridY3 - 4} fontSize={8} fill={labelColor} fontWeight="600" textAnchor="end">{formatPrice(min)}</SvgText>

            {/* Gradient Area Fill */}
            {areaPath ? <Path d={areaPath} fill="url(#chartGradient)" /> : null}

            {/* Price line */}
            <Path d={linePath} stroke={color} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* Last-price dot */}
            <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={5} fill={color} />

            {/* Horizontal guide line pointing to current price */}
            <Line 
              x1={0} 
              y1={lastY} 
              x2={PLOT_W - badgeW - 6} 
              y2={lastY} 
              stroke={color} 
              strokeWidth={1} 
              strokeDasharray="2 3" 
              strokeOpacity={0.6} 
            />

            {/* Live price badge on Y axis */}
            <Rect 
              x={badgeX} 
              y={badgeY} 
              width={badgeW} 
              height={badgeH} 
              rx={4} 
              fill={color} 
            />
            <SvgText
              x={badgeX + badgeW / 2}
              y={badgeY + 12}
              textAnchor="middle"
              fontSize={9}
              fontWeight="800"
              fill="#ffffff"
            >
              {lastPriceStr}
            </SvgText>

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
        </Animated.View>
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
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange]         = useState<string>('1D');
  const [tradeModalVisible, setTradeModalVisible] = useState(false);

  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  const [high24h, setHigh24h] = useState<number | null>(null);
  const [low24h, setLow24h] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restFallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTimeRef = useRef<number>(0);
  const chartCandlesRef = useRef<{ time: number; close: number }[]>([]);
  const activeSymbolRef = useRef(symbol);
  const isWsConnectedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    activeSymbolRef.current = symbol;
  }, [symbol]);

  // Always reflect live context price; chart fetch may override with latest candle
  const contextPrice = prices[symbol]?.usd ?? 0;
  const [priceNow, setPriceNow]   = useState(contextPrice);
  const priceTransitionRef = useRef<any>(null);
  const currentPriceRef = useRef<number>(contextPrice);

  useEffect(() => {
    currentPriceRef.current = priceNow;
  }, [priceNow]);

  useEffect(() => {
    if (contextPrice > 0) setPriceNow(contextPrice);
  }, [contextPrice]);

  const transitionLastPrice = useCallback((targetPrice: number) => {
    if (priceTransitionRef.current) {
      cancelAnimationFrame(priceTransitionRef.current);
      priceTransitionRef.current = null;
    }
    
    setPriceNow(targetPrice);
    
    setChartData(prev => {
      if (prev.length === 0) return prev;
      if (prev[prev.length - 1] === targetPrice) return prev;
      const next = [...prev];
      next[next.length - 1] = targetPrice;
      return next;
    });
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const balance  = symbol === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[symbol] ?? 0);
  const usdValue = balance * priceNow;
  // For BTC/SOL we have live price data but no on-chain balance yet
  const isWatchOnly = balance === 0 && (symbol === 'BTC' || symbol === 'SOL');

  const change24h = prices[symbol]?.change24h ?? 0;
  const isUp      = change24h >= 0;

  const fetchTickerStats = async (sym: string) => {
    const binanceSymbols: Record<string, string> = {
      BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
      XRP: 'XRPUSDT', TON: 'TONUSDT', TRX: 'TRXUSDT', SUI: 'SUIUSDT',
      USDC: 'USDCUSDT', USDT: 'USDCUSDT',
    };
    const binanceSym = binanceSymbols[sym];
    if (!binanceSym) {
      // INRX or local currency mock
      setHigh24h(sym === 'INRX' ? 0.0121 : 1.01);
      setLow24h(sym === 'INRX' ? 0.0119 : 0.99);
      setVolume24h(sym === 'INRX' ? 150000 : 2500000);
      return;
    }

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSym}`);
      if (res.ok) {
        const data = await res.json();
        setHigh24h(parseFloat(data.highPrice));
        setLow24h(parseFloat(data.lowPrice));
        setVolume24h(parseFloat(data.quoteVolume));
      }
    } catch (e) {
      console.warn('Error fetching ticker stats:', e);
    }
  };

  const fetchChart = async (timeframe: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      fadeAnim.setValue(0);
    }

    try {
      const pts = await marketService.fetchChartData(symbol, timeframe);
      if (pts && pts.length >= 2) {
        setChartData(pts);
        setPriceNow(pts[pts.length - 1]);
        
        if (timeframe === 'LIVE') {
          const nowMs = Date.now();
          chartCandlesRef.current = pts.map((p, index) => {
            const time = nowMs - (pts.length - 1 - index) * 60 * 1000;
            return {
              time: Math.floor(time / 60000) * 60000,
              close: p
            };
          });
        }
      } else {
        setChartData([]);
      }
    } catch (e) {
      console.warn('Error fetching chart data:', e);
      setChartData([]);
    } finally {
      if (showLoading) {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    }
  };

  const startRestFallback = useCallback(() => {
    if (restFallbackTimerRef.current) return;
    console.log('[WebSocket] Starting REST fallback polling...');
    restFallbackTimerRef.current = setInterval(() => {
      fetchChart(range, false);
      fetchTickerStats(symbol);
    }, 10000);
  }, [symbol, range]);

  const stopRestFallback = useCallback(() => {
    if (restFallbackTimerRef.current) {
      clearInterval(restFallbackTimerRef.current);
      restFallbackTimerRef.current = null;
      console.log('[WebSocket] Stopped REST fallback polling.');
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const binanceSymbols: Record<string, string> = {
      BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
      XRP: 'XRPUSDT', TON: 'TONUSDT', TRX: 'TRXUSDT', SUI: 'SUIUSDT',
      USDC: 'USDCUSDT', USDT: 'USDCUSDT',
    };

    const binanceSym = binanceSymbols[symbol];
    if (!binanceSym) {
      isWsConnectedRef.current = false;
      startRestFallback();
      return;
    }

    const symbolLower = binanceSym.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${symbolLower}@ticker/${symbolLower}@kline_1m`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log(`[WebSocket] Connected for ${symbol}`);
      isWsConnectedRef.current = true;
      lastMsgTimeRef.current = Date.now();
      stopRestFallback();
    };

    socket.onmessage = (event) => {
      lastMsgTimeRef.current = Date.now();
      try {
        const msg = JSON.parse(event.data);
        const { stream, data } = msg;

        if (activeSymbolRef.current !== symbol) return;

        if (stream.endsWith('@ticker')) {
          const livePrice = parseFloat(data.c);
          setHigh24h(parseFloat(data.h));
          setLow24h(parseFloat(data.l));
          setVolume24h(parseFloat(data.q));

          if (range !== 'LIVE') {
            transitionLastPrice(livePrice);
          } else {
            setPriceNow(livePrice);
          }
        } else if (stream.endsWith('@kline_1m')) {
          const kline = data.k;
          const klineTime = kline.t;
          const klineClose = parseFloat(kline.c);

          if (range === 'LIVE') {
            setHigh24h(parseFloat(kline.h));
            setLow24h(parseFloat(kline.l));
            setVolume24h(parseFloat(kline.v) * klineClose);

            const candles = chartCandlesRef.current;
            if (candles.length > 0) {
              const lastCandle = candles[candles.length - 1];
              if (lastCandle.time === klineTime) {
                lastCandle.close = klineClose;
                chartCandlesRef.current = [...candles];
                transitionLastPrice(klineClose);
              } else if (klineTime > lastCandle.time) {
                chartCandlesRef.current = [...candles.slice(1), { time: klineTime, close: klineClose }];
                setChartData(chartCandlesRef.current.map(c => c.close));
                setPriceNow(klineClose);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[WebSocket] Error parsing message:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn(`[WebSocket] Error for ${symbol}:`, err);
      isWsConnectedRef.current = false;
      startRestFallback();
    };

    socket.onclose = (event) => {
      console.log(`[WebSocket] Closed for ${symbol}. Code: ${event.code}`);
      isWsConnectedRef.current = false;
      startRestFallback();

      if (activeSymbolRef.current === symbol) {
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      }
    };
  }, [symbol, range, startRestFallback, stopRestFallback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChart(range, false);
    await fetchTickerStats(symbol);
    setRefreshing(false);
  }, [range, symbol]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => setAppState(nextState));
    return () => sub.remove();
  }, []);

  // Main loader & socket manager
  useEffect(() => {
    fetchChart(range, true);
    fetchTickerStats(symbol);

    if (isFocused && appState === 'active') {
      connectWebSocket();
    } else {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      stopRestFallback();
    }

    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (priceTransitionRef.current) {
        cancelAnimationFrame(priceTransitionRef.current);
        priceTransitionRef.current = null;
      }
      stopRestFallback();
    };
  }, [symbol, range, isFocused, appState, connectWebSocket, startRestFallback, stopRestFallback]);

  // Watchdog effect to detect stale connections
  useEffect(() => {
    if (range !== 'LIVE' || !isFocused || appState !== 'active') return;

    const watchdog = setInterval(() => {
      const binanceSymbols: Record<string, string> = {
        BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
        XRP: 'XRPUSDT', TON: 'TONUSDT', TRX: 'TRXUSDT', SUI: 'SUIUSDT',
        USDC: 'USDCUSDT', USDT: 'USDCUSDT'
      };
      if (!binanceSymbols[symbol]) return;

      const timeSinceLastMsg = Date.now() - lastMsgTimeRef.current;
      if (isWsConnectedRef.current && timeSinceLastMsg > 8000) {
        console.log('[WebSocket] Watchdog detected stalled socket, reconnecting...');
        connectWebSocket();
      }
    }, 4000);

    return () => clearInterval(watchdog);
  }, [symbol, range, isFocused, appState, connectWebSocket]);

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

  const formatPriceNum = useCallback((p: number) => {
    return p; // CurrencyText handles the multiplication and formatting internally now, wait, tooltip still needs formatted string.
  }, []);

  const formatTooltip = useCallback((p: number) => {
    const converted = p * fiatInfo.rate;
    const pre = fiatCurrency === 'AED' ? '' : fiatInfo.symbol;
    if (typeof converted !== 'number' || !isFinite(converted) || converted <= 0) return `${pre}0.00`;
    if (converted >= 1000) return `${pre}${converted.toLocaleString(fiatInfo.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (converted >= 1) return `${pre}${converted.toLocaleString(fiatInfo.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    return `${pre}${converted.toLocaleString(fiatInfo.locale, { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
  }, [fiatInfo, fiatCurrency]);

  const safeNum = (n: number) => (typeof n === 'number' && isFinite(n) ? n : 0);
  const chartLineColor = chartUp ? T.success : T.error;

  const tokenTxs = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => 
      tx.coin === symbol || 
      tx.symbol === symbol || 
      (tx.type === 'swap' && (tx.buyToken === symbol || tx.coin === symbol)) ||
      (tx.type === 'SWAP' && (tx.buyToken === symbol || tx.coin === symbol))
    ).sort((a: any, b: any) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime());
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
          <CurrencyText amount={priceNow} code={fiatCurrency} style={[styles.priceTop, { color: T.text }]} decimals={priceNow * fiatInfo.rate < 1 ? 6 : priceNow * fiatInfo.rate < 1000 ? 4 : 2} />
          <Text style={[styles.changeTop, { color: chartLineColor }]}>
            {chartUp ? '+' : ''}{(typeof pctChange === 'number' && isFinite(pctChange) ? pctChange : 0).toFixed(2)}%
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[color]}
            tintColor={color}
          />
        }
      >

        {/* Chart */}
        <View style={styles.chartBox}>
          {loading ? (
            <View style={{ height: CHART_H, paddingVertical: 20, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: 0.6 }}>
                <SkeletonLoader width={80} height={14} isDark={isDarkMode} />
                <SkeletonLoader width={60} height={14} isDark={isDarkMode} />
              </View>
              <View style={{ height: PLOT_H - 20, justifyContent: 'center', opacity: 0.4 }}>
                <SkeletonLoader width="100%" height={2} isDark={isDarkMode} style={{ marginVertical: 8 }} />
                <SkeletonLoader width="90%" height={2} isDark={isDarkMode} style={{ alignSelf: 'center', marginVertical: 8 }} />
                <SkeletonLoader width="80%" height={2} isDark={isDarkMode} style={{ alignSelf: 'flex-end', marginVertical: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: 0.6 }}>
                <SkeletonLoader width={40} height={10} isDark={isDarkMode} />
                <SkeletonLoader width={40} height={10} isDark={isDarkMode} />
                <SkeletonLoader width={40} height={10} isDark={isDarkMode} />
              </View>
            </View>
          ) : chartData.length < 2 ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Feather name="wifi-off" size={32} color={T.textMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: T.text, fontSize: 15, fontFamily: Fonts.bold, marginBottom: 4 }}>
                Chart Data Unavailable
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', marginBottom: 16 }}>
                We couldn't load historical prices. Please check your network connection.
              </Text>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: T.surfaceLow, borderRadius: 12, borderWidth: 1, borderColor: T.border }}
                onPress={() => fetchChart(range, true)}
              >
                <Text style={{ color: T.primary, fontSize: 13, fontFamily: Fonts.bold }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              <TradingChart
                prices={chartData}
                color={chartLineColor}
                isDark={isDarkMode}
                formatPrice={formatTooltip}
              />
            </Animated.View>
          )}

          {/* Range selector */}
          <View style={styles.rangeRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.label}
                style={[styles.rangeBtn, range === r.value && { backgroundColor: T.surfaceLow }]}
                onPress={() => setRange(r.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rangeBtnText, {
                  color: range === r.value ? T.text : T.textMuted,
                  fontWeight: range === r.value ? '800' : '600',
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
                <CurrencyText amount={usdValue} code={fiatCurrency} style={[styles.balanceFiat, { color: T.text }]} />
                <Text style={[styles.balanceToken, { color: T.textMuted }]}>
                   {balance.toFixed(4)} {symbol}
                </Text>
             </View>
           </View>

           {/* Send, Receive & Swap Pills */}
           <View style={styles.balanceActions}>
              <TouchableOpacity style={[styles.pillBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Send', { symbol })}>
                 <Feather name="arrow-up-right" size={16} color={T.text} style={{ marginRight: 8 }} />
                 <Text style={[styles.pillBtnText, { color: T.text }]}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Receive', { symbol })}>
                 <Ionicons name="qr-code-outline" size={16} color={T.text} style={{ marginRight: 8 }} />
                 <Text style={[styles.pillBtnText, { color: T.text }]}>Receive</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Swap', { fromToken: symbol })}>
                 <Feather name="repeat" size={16} color={T.text} style={{ marginRight: 8 }} />
                 <Text style={[styles.pillBtnText, { color: T.text }]}>Swap</Text>
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
                           {formatDateShort(tx.date)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, { color: amountColor }]}>{amountText}</Text>
                      {tx.usdValue ? (
                        <CurrencyText amount={parseFloat(tx.usdValue)} code={fiatCurrency} style={[styles.txUsd, { color: T.textMuted }]} />
                      ) : <Text style={[styles.txUsd, { color: T.textMuted }]} />}
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
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>24h High</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>
                   {high24h !== null ? (
                     <CurrencyText amount={high24h} code={fiatCurrency} decimals={high24h * fiatInfo.rate < 1 ? 6 : high24h * fiatInfo.rate < 1000 ? 4 : 2} />
                   ) : (
                     '-'
                   )}
                 </Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>24h Low</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>
                   {low24h !== null ? (
                     <CurrencyText amount={low24h} code={fiatCurrency} decimals={low24h * fiatInfo.rate < 1 ? 6 : low24h * fiatInfo.rate < 1000 ? 4 : 2} />
                   ) : (
                     '-'
                   )}
                 </Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>24h Volume</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>
                   {volume24h !== null ? (
                     volume24h >= 1e9 ? `${(volume24h / 1e9).toFixed(2)}B` :
                     volume24h >= 1e6 ? `${(volume24h / 1e6).toFixed(2)}M` :
                     volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })
                   ) : (
                     '-'
                   )}
                 </Text>
              </View>
              <View style={{ width: '50%' }}>
                 <Text style={[styles.statLabel, { color: T.textMuted }]}>Market Cap</Text>
                 <Text style={[styles.statValue, { color: T.text }]}>
                   {symbol === 'BTC' ? '$1.86T' :
                    symbol === 'ETH' ? '$395.2B' :
                    symbol === 'SOL' ? '$74.1B' :
                    symbol === 'BNB' ? '$85.6B' :
                    symbol === 'XRP' ? '$29.4B' :
                    symbol === 'TON' ? '$18.2B' :
                    symbol === 'TRX' ? '$16.5B' :
                    symbol === 'SUI' ? '$9.8B' :
                    symbol === 'USDC' ? '$34.2B' :
                    symbol === 'USDT' ? '$112.5B' :
                    '-'}
                 </Text>
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
                  
                  <TouchableOpacity 
                     style={[styles.modalBtn, { backgroundColor: T.primary }]} 
                     activeOpacity={0.8}
                     onPress={() => {
                        setTradeModalVisible(false);
                        navigation.navigate('P2PMarketplace', { tab: 'sell', token: symbol });
                     }}
                  >
                     <Text style={styles.modalBtnText}>Sell</Text>
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
