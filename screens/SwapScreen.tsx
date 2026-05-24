import React, { useState, useEffect, useRef, memo } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Platform, Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import Toast from '../components/Toast';
import { swapService, SwapQuote, SUPPORTED_TOKENS, parseSwapError } from '../services/swapService';
import { haptics } from '../utils/haptics';
import { notificationService } from '../services/notificationService';
import TransactionLoader from '../components/ui/TransactionLoader';

const COIN_NOTES: Record<string, string> = {
  ETH:    'Ethereum — EVM native',
  USDT:   'Tether USD',
  USDC:   'USD Coin',
  DAI:    'Dai Stablecoin',
  TRX:    'TRON — TRX native coin',
  CUSTOM: 'Custom Token',
};

const SWAP_META: Record<string, { name: string; iconUrl: string; color: string }> = {
  ETH:    { name: 'Ethereum', iconUrl: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',           color: '#627EEA' },
  USDT:   { name: 'Tether',   iconUrl: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',            color: '#26A17B' },
  USDC:   { name: 'USD Coin', iconUrl: 'https://coin-images.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',    color: '#2775CA' },
  DAI:    { name: 'Dai',      iconUrl: 'https://coin-images.coingecko.com/coins/images/9956/large/4943.png',             color: '#F4B731' },
  TRX:    { name: 'TRON',     iconUrl: 'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png',        color: '#EF0027' },
  CUSTOM: { name: 'Custom',   iconUrl: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',          color: '#FF3B3B' },
};

function CoinIcon({ sym, url, size = 28 }: { sym: string; url?: string; size?: number }) {
  const meta = SWAP_META[sym];
  const sourceUrl = url || meta?.iconUrl;
  const [failed, setFailed] = React.useState(false);
  if (sourceUrl && !failed) {
    return (
      <Image
        source={{ uri: sourceUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: (meta?.color ?? '#888') + '30', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: '800', color: meta?.color ?? '#888' }}>{sym.slice(0, 2)}</Text>
    </View>
  );
}

const TokenSelector = memo(({ sym, url, onPress, styles, T }: any) => (
  <TouchableOpacity style={styles.tokenPill} onPress={onPress} activeOpacity={0.7}>
    <CoinIcon sym={sym} url={url} size={44} />
    <Text style={[styles.pillText, { color: T.text }]}>{sym}</Text>
    <Feather name="chevron-down" size={20} color={T.textDim} />
  </TouchableOpacity>
));

const TrendingSkeleton = ({ T, styles }: any) => {
  return (
    <View style={styles.trendingRow}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.surfaceHigh }} />
      <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
        <View style={{ width: 100, height: 16, borderRadius: 8, backgroundColor: T.surfaceHigh }} />
        <View style={{ width: 140, height: 12, borderRadius: 6, backgroundColor: T.surfaceHigh }} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={{ width: 60, height: 16, borderRadius: 8, backgroundColor: T.surfaceHigh }} />
        <View style={{ width: 40, height: 12, borderRadius: 6, backgroundColor: T.surfaceHigh }} />
      </View>
    </View>
  );
};

export default function SwapScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { balances, ethBalance, isDarkMode, network, refreshBalance, walletAddress, applySwapBalances, addTx } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = React.useMemo(() => makeStyles(T), [T]);
  
  const walletRef = useRef(walletAddress);
  walletRef.current = walletAddress;

  const [sellToken, setSellToken] = useState('ETH');
  const [buyToken, setBuyToken]   = useState('USDC');
  const [sellAmount, setSellAmount] = useState('');
  
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [swapStatus, setSwapStatus] = useState('');
  const [step, setStep] = useState<'input' | 'quote' | 'swapping' | 'success' | 'error'>('input');
  const stepRef = useRef(step);
  stepRef.current = step;
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [swapResult, setSwapResult] = useState<{ sellAmt: string; sellTok: string; buyAmt: string; buyTok: string } | null>(null);

  const [slippage, setSlippage] = useState(1);
  const [slippageModalVisible, setSlippageModalVisible] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<'sell' | 'buy'>('sell');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Trending tokens state
  const [trendingTokens, setTrendingTokens] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState(false);
  const [customTokens, setCustomTokens] = useState<Record<string, { name: string, iconUrl: string, price: number }>>({});

  const fetchTrending = async () => {
    setTrendingLoading(true);
    setTrendingError(false);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
      if (!res.ok) throw new Error('Failed to fetch trending tokens');
      const data = await res.json();
      setTrendingTokens(data.coins || []);
    } catch (err) {
      console.error(err);
      setTrendingError(true);
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  const isSupported = swapService.isNetworkSupported(network);
  const isTronNetwork = network === 'TRON' || network === 'TRON Nile';
  
  const STABLE_FALLBACK: Record<string, number> = { USDC: 1, USDT: 1, DAI: 1 };
  const sellPrice    = prices[sellToken]?.usd ?? STABLE_FALLBACK[sellToken] ?? customTokens[sellToken]?.price ?? 1;
  const buyPrice     = prices[buyToken]?.usd  ?? STABLE_FALLBACK[buyToken]  ?? customTokens[buyToken]?.price ?? 1;
  const sellBalance  = sellToken === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[sellToken] ?? 0);
  const sellAmtNum   = parseFloat(sellAmount.replace(',', '.')) || 0;
  const sellUsdValue = sellAmtNum > 0 ? (sellAmtNum * sellPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  
  const buyAmount    = quote?.buyAmount ?? '';
  const buyAmtNum    = parseFloat(buyAmount) || 0;
  const buyUsdValue  = buyAmtNum > 0 ? (buyAmtNum * buyPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  
  const isSimulated = quote?.isSimulated === true;
  const isMainnet = network === 'Ethereum' || network === 'Polygon' || network === 'Arbitrum' || network === 'TRON';
  const isSimulatedOnMainnet = isSimulated && isMainnet;
  const hasInsufficientBalance = isMainnet && sellAmtNum > sellBalance;
  const canSwap =
    sellAmtNum > 0 &&
    !!quote &&
    parseFloat(quote.buyAmount) > 0 &&
    !hasInsufficientBalance &&
    isSupported &&
    !isLoadingQuote &&
    !isSimulatedOnMainnet;

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message: msg, type });

  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  
  const customTokensRef = useRef(customTokens);
  customTokensRef.current = customTokens;

  useEffect(() => {
    const normalizedAmt = sellAmount.replace(',', '.');
    if (!normalizedAmt || parseFloat(normalizedAmt) <= 0 || sellToken === buyToken || !isSupported) {
      setQuote(null);
      setIsLoadingQuote(false);
      return;
    }

    setIsLoadingQuote(true);
    setQuote(null);

    const timer = setTimeout(async () => {
      try {
        const { RPC_URLS } = await import('../config');
        const rpcUrl = RPC_URLS[network];
        const q = await swapService.getQuote(sellToken, buyToken, normalizedAmt, network, rpcUrl, walletRef.current);
        setQuote(q);
      } catch {
        const fromPrice = pricesRef.current[sellToken]?.usd ?? customTokensRef.current[sellToken]?.price ?? (sellToken === 'ETH' ? 3500 : 1);
        const toPrice   = pricesRef.current[buyToken]?.usd  ?? customTokensRef.current[buyToken]?.price ?? (buyToken  === 'ETH' ? 3500 : 1);
        const buyAmt    = toPrice > 0 ? (parseFloat(normalizedAmt) * fromPrice) / toPrice : 0;
        const rate      = toPrice > 0 ? fromPrice / toPrice : 0;
        setQuote({
          buyAmount: buyAmt.toFixed(6), sellAmount: normalizedAmt,
          price: rate.toFixed(6), estimatedGas: '0.002',
          isSimulated: true, source: 'cached',
          fromToken: sellToken, toToken: buyToken,
          slippage: '1', minimumReceived: (buyAmt * 0.99).toFixed(6),
          toAmount: buyAmt.toFixed(6), rate: rate.toFixed(6),
        });
      } finally {
        setIsLoadingQuote(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [sellAmount, sellToken, buyToken, network, isSupported]);

  const handleSwap = async () => {
    if (!quote || !canSwap) return;
    setStep('swapping');
    setSwapStatus('Preparing swap...');
    try {
      const { storageService } = await import('../services/storageService');
      const privateKey = await storageService.getPrivateKey();
      if (!privateKey) throw new Error('Wallet not found');
      const { RPC_URLS } = await import('../config');
      const rpcUrl = RPC_URLS[network];
      const result = await swapService.executeSwap(
        quote, privateKey, rpcUrl, walletRef.current, network,
        (status) => setSwapStatus(status)
      );
      if (result.success) {
        const capturedSell = sellAmount;
        const capturedBuy  = quote.buyAmount;
        setSwapResult({ sellAmt: capturedSell, sellTok: sellToken, buyAmt: capturedBuy, buyTok: buyToken });
        await applySwapBalances(sellToken, parseFloat(sellAmount), buyToken, parseFloat(quote.buyAmount));
        addTx({
          type:      'swap',
          coin:      sellToken,
          amount:    sellAmount,
          buyToken:  buyToken,
          buyAmount: quote.buyAmount,
          usdValue:  (parseFloat(sellAmount) * sellPrice).toFixed(2),
          address:   `${sellToken} → ${buyToken}`,
          status:    'success',
          txHash:    result.hash ?? undefined,
        } as any);
        haptics.success();
        notificationService.notifySwapComplete(sellToken, buyToken, parseFloat(quote.buyAmount).toFixed(4)).catch(() => {});
        setStep('success');
        setTimeout(() => refreshBalance(), 1000);
        setTimeout(() => refreshBalance(), 6000);
      } else {
        throw new Error(result.error || 'Swap failed');
      }
    } catch (err: any) {
      haptics.error();
      setSwapStatus(parseSwapError(err));
      setStep('error');
    }
  };

  const openSelector = (target: 'sell' | 'buy') => {
    setSelectorTarget(target);
    setSearchQuery('');
    setSelectorVisible(true);
  };

  const selectToken = (sym: string) => {
    if (selectorTarget === 'sell') {
      if (sym === buyToken) setBuyToken(sellToken);
      setSellToken(sym);
    } else {
      if (sym === sellToken) setSellToken(buyToken);
      setBuyToken(sym);
    }
    setSelectorVisible(false);
    setSellAmount('');
    setQuote(null);
  };

  const selectTrendingToken = (item: any) => {
    const sym = item.item.symbol.toUpperCase();
    const rawPrice = item.item.data?.price;
    const priceNum = typeof rawPrice === 'number'
      ? rawPrice
      : typeof rawPrice === 'string'
      ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 1
      : 1;
    setCustomTokens(prev => ({
      ...prev,
      [sym]: { name: item.item.name, iconUrl: item.item.thumb, price: priceNum }
    }));
    selectToken(sym);
  };

  const handleTrendingPress = (item: any) => {
    const sym = item.item.symbol.toUpperCase();
    const rawPrice = item.item.data?.price;
    const priceNum = typeof rawPrice === 'number'
      ? rawPrice
      : typeof rawPrice === 'string'
      ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 1
      : 1;
    setCustomTokens(prev => ({
      ...prev,
      [sym]: { name: item.item.name, iconUrl: item.item.thumb, price: priceNum }
    }));
    if (sym === sellToken) setSellToken(buyToken);
    setBuyToken(sym);
    setSellAmount('');
    setQuote(null);
  };

  const flipTokens = () => {
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
    setSellAmount('');
    setQuote(null);
  };

  if (step === 'success' && swapResult) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          backgroundColor: T.success + '20',
          alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <Feather name="check" size={48} color={T.success} />
        </View>

        <Text style={{ fontSize: 28, fontWeight: '900', color: T.text, marginBottom: 8, letterSpacing: -0.5 }}>Swap Complete!</Text>
        <Text style={{ fontSize: 14, color: T.textMuted, marginBottom: 32, textAlign: 'center' }}>
          Your swap was executed successfully.
        </Text>

        <View style={[{
          width: '100%', borderRadius: 24, padding: 20, marginBottom: 32,
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <CoinIcon sym={swapResult.sellTok} url={customTokens[swapResult.sellTok]?.iconUrl} size={44} />
              <Text style={{ color: T.text, fontWeight: '800', fontSize: 18, marginTop: 8 }}>
                {parseFloat(swapResult.sellAmt).toFixed(4)}
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 12, fontWeight: '600' }}>{swapResult.sellTok}</Text>
            </View>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: T.primary + '20', alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="arrow-right" size={20} color={T.primary} />
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <CoinIcon sym={swapResult.buyTok} url={customTokens[swapResult.buyTok]?.iconUrl} size={44} />
              <Text style={{ color: T.success, fontWeight: '800', fontSize: 18, marginTop: 8 }}>
                {parseFloat(swapResult.buyAmt).toFixed(4)}
              </Text>
              <Text style={{ color: T.textMuted, fontSize: 12, fontWeight: '600' }}>{swapResult.buyTok}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: T.border, marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: T.textMuted, fontSize: 13, fontWeight: '600' }}>Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.success }} />
              <Text style={{ color: T.success, fontSize: 13, fontWeight: '700' }}>Confirmed</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.primary, width: '100%', marginBottom: 12 }]}
          onPress={() => { setStep('input'); setSellAmount(''); setQuote(null); setSwapResult(null); }}
        >
          <Text style={styles.actionText}>Swap Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.surface, width: '100%', borderWidth: 1, borderColor: T.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.actionText, { color: T.text }]}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          backgroundColor: T.error + '20',
          alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <Feather name="x" size={48} color={T.error} />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '900', color: T.text, marginBottom: 8 }}>Swap Failed</Text>
        <Text style={{ fontSize: 14, color: T.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>{swapStatus}</Text>
        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.primary, width: '100%' }]}
          onPress={() => setStep('input')}
        >
          <Text style={styles.actionText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      <TransactionLoader visible={step === 'swapping'} title="Executing Swap" subtitle={swapStatus || 'Finding best route...'} isDarkMode={isDarkMode} type="swap" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setSlippageModalVisible(true)}>
          <Feather name="settings" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Swap Assets</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Feather name="x" size={24} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!isSupported && (
          <View style={[styles.warnBanner, { backgroundColor: T.pending + '18', borderColor: T.pending + '40' }]}>
            <Feather name="alert-triangle" size={14} color={T.pending} />
            <Text style={[styles.warnText, { color: T.pending }]}>
              Swap is not available on {network}. Switch to Ethereum or Sepolia.
            </Text>
          </View>
        )}
        {isTronNetwork && (
          <View style={[styles.warnBanner, { backgroundColor: '#EF002718', borderColor: '#EF002740' }]}>
            <Feather name="info" size={14} color="#EF0027" />
            <Text style={[styles.warnText, { color: '#EF0027' }]}>
              TRON network — TRX swaps use simulated rates based on live market prices.
            </Text>
          </View>
        )}

        <View style={styles.swapFrame}>
          {/* FROM CARD */}
          <View style={[styles.inputCard, { borderColor: hasInsufficientBalance ? T.pending : 'transparent', borderWidth: 1 }]}>
            <View style={styles.inputCardContent}>
              <View style={styles.inputLeft}>
                <Text style={[styles.cardLabel, { color: T.textMuted, marginBottom: 12 }]}>You Pay</Text>
                <TextInput
                  style={[styles.largeInput, { color: T.text }]}
                  placeholder="0"
                  placeholderTextColor={T.textDim}
                  value={sellAmount}
                  onChangeText={setSellAmount}
                  keyboardType="decimal-pad"
                  editable={step === 'input'}
                />
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${sellUsdValue}</Text>
              </View>
              <View style={styles.inputRight}>
                <TokenSelector sym={sellToken} url={customTokens[sellToken]?.iconUrl} onPress={() => openSelector('sell')} styles={styles} T={T} />
                <Text style={[styles.balanceText, { color: T.textMuted }]}>Balance: {sellBalance.toFixed(4)} {sellToken}</Text>
              </View>
            </View>
            {hasInsufficientBalance && <Text style={{ color: T.pending, fontSize: 12, marginTop: 8, textAlign: 'left' }}>Insufficient balance</Text>}
          </View>

          {/* SWAP FLIP BUTTON WITH DIVIDER */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
            <TouchableOpacity style={[styles.floatingSwapBtn, { backgroundColor: T.primary, borderColor: T.background }]} onPress={flipTokens} activeOpacity={0.9} disabled={step !== 'input'}>
              <MaterialCommunityIcons name="swap-vertical" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
          </View>

          {/* TO CARD */}
          <View style={styles.inputCard}>
            <View style={styles.inputCardContent}>
              <View style={styles.inputLeft}>
                <Text style={[styles.cardLabel, { color: T.textMuted, marginBottom: 12 }]}>You Receive</Text>
                {isLoadingQuote ? (
                  <View style={{ height: 50, justifyContent: 'center', alignItems: 'flex-start' }}>
                    <ActivityIndicator size="small" color={T.primary} />
                  </View>
                ) : (
                  <Text style={[styles.largeAmountDisplay, { color: buyAmtNum > 0 ? T.text : T.textDim }]} numberOfLines={1} adjustsFontSizeToFit>
                    {buyAmtNum > 0 ? buyAmount : (sellAmtNum > 0 ? '...' : '0')}
                  </Text>
                )}
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${buyUsdValue}</Text>
              </View>
              <View style={styles.inputRight}>
                <TokenSelector sym={buyToken} url={customTokens[buyToken]?.iconUrl} onPress={() => openSelector('buy')} styles={styles} T={T} />
                <Text style={[styles.balanceText, { color: T.textMuted }]}>Balance: {(balances[buyToken] || 0).toFixed(4)} {buyToken}</Text>
              </View>
            </View>
          </View>
        </View>

        {isSimulatedOnMainnet && (
          <View style={[styles.warnBanner, { backgroundColor: T.error + '18', borderColor: T.error + '40', marginBottom: 16 }]}>
            <Feather name="alert-triangle" size={14} color={T.error} />
            <Text style={[styles.warnText, { color: T.error }]}>
              Live quote unavailable on mainnet. Waiting for a real price from 0x Protocol. Do not swap until a live quote loads.
            </Text>
          </View>
        )}
        {isSimulated && !isMainnet && (
          <View style={[styles.warnBanner, { backgroundColor: T.primary + '18', borderColor: T.primary + '40', marginBottom: 16 }]}>
            <Feather name="info" size={14} color={T.primary} />
            <Text style={[styles.warnText, { color: T.primary }]}>
              {network === 'Sepolia' ? 'Test network — no real money involved. Safe to practice.' : 'Rate estimated from live market prices. Balances update instantly.'}
            </Text>
          </View>
        )}

        {/* DETAILS */}
        {quote && (
          <View style={[styles.detailsBox, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Rate</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>1 {sellToken} = {quote.rate} {buyToken}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Network Fee</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>~{quote.estimatedGas} ETH</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Min received</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>{quote.minimumReceived} {buyToken}</Text>
            </View>
          </View>
        )}

        {/* ACTION */}
        {step === 'swapping' ? null : (
          <TouchableOpacity
            style={[styles.mainAction, { backgroundColor: T.primary, opacity: canSwap ? 1 : 0.5, marginTop: 0 }]}
            onPress={handleSwap}
            disabled={!canSwap}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>
              {isLoadingQuote
                ? 'Getting Quote...'
                : !sellAmount || parseFloat(sellAmount) <= 0
                ? 'Enter Amount'
                : hasInsufficientBalance
                ? 'Insufficient Balance'
                : isSimulatedOnMainnet
                ? 'Waiting for Live Quote...'
                : canSwap
                ? 'Confirm Swap'
                : 'Enter Details'}
            </Text>
          </TouchableOpacity>
        )}

        {/* TRENDING TOKENS SECTION */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: T.text, marginTop: 40, marginBottom: 16 }}>Trending Tokens</Text>

        {trendingLoading ? (
          Array.from({ length: 6 }).map((_, i) => <TrendingSkeleton key={i} T={T} styles={styles} />)
        ) : trendingError ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ color: T.textMuted, marginBottom: 12 }}>Unable to load trending tokens</Text>
            <TouchableOpacity onPress={fetchTrending} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: T.surfaceHigh, borderRadius: 12 }}>
              <Text style={{ color: T.text, fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          trendingTokens.map(item => {
            const priceChange = item.item.data?.price_change_percentage_24h?.usd || 0;
            const isPositive = priceChange >= 0;
            return (
              <TouchableOpacity key={item.item.id} style={styles.trendingRow} onPress={() => handleTrendingPress(item)} activeOpacity={0.7}>
                <View>
                  <CoinIcon sym={item.item.symbol.toUpperCase()} url={item.item.thumb} size={44} />
                  <View style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Image source={{ uri: SWAP_META['ETH'].iconUrl }} style={{ width: 12, height: 12, borderRadius: 6 }} />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: T.text }}>{item.item.name}</Text>
                  <Text style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                    {typeof item.item.data?.market_cap === 'string' ? item.item.data.market_cap : '?'} cap · {typeof item.item.data?.total_volume === 'string' ? item.item.data.total_volume : '?'} vol
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: T.text }}>
                    {typeof item.item.data?.price === 'number'
                      ? `$${item.item.data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                      : '$—'}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isPositive ? T.success : T.error, marginTop: 2 }}>
                    {isPositive ? '+' : ''}{typeof priceChange === 'number' ? priceChange.toFixed(2) : '0.00'}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* TOKEN SELECTOR MODAL */}
      <Modal visible={selectorVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Select Token</Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                <Feather name="x" size={24} color={T.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.searchBar, { backgroundColor: T.surfaceHigh }]}>
              <Feather name="search" size={20} color={T.textDim} />
              <TextInput
                style={[styles.searchInput, { color: T.text }]}
                placeholder="Search name or paste address"
                placeholderTextColor={T.textDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!searchQuery && <Text style={[styles.sectionTitle, { color: T.textMuted, marginTop: 8 }]}>Supported Tokens</Text>}
              {SUPPORTED_TOKENS.filter(sym => sym.toLowerCase().includes(searchQuery.toLowerCase())).map(sym => {
                const isActive = selectorTarget === 'sell' ? sellToken === sym : buyToken === sym;
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.tokenItem, { borderBottomColor: T.border }, isActive && { backgroundColor: T.primary + '10' }]}
                    onPress={() => selectToken(sym)}
                    activeOpacity={0.7}
                  >
                    <CoinIcon sym={sym} size={44} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.tokenItemSym, { color: T.text }]}>{sym}</Text>
                      <Text style={[styles.tokenItemName, { color: T.textMuted }]}>{COIN_NOTES[sym] || sym}</Text>
                    </View>
                    {isActive && <Feather name="check-circle" size={20} color={T.primary} />}
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.sectionTitle, { color: T.textMuted, marginTop: 24 }]}>Trending Tokens</Text>
              {trendingLoading ? (
                <ActivityIndicator size="small" color={T.primary} style={{ marginTop: 20 }} />
              ) : trendingError ? (
                <View style={{ alignItems: 'center', marginTop: 30 }}>
                  <Text style={{ color: T.textMuted }}>Failed to load tokens.</Text>
                  <TouchableOpacity onPress={fetchTrending} style={{ marginTop: 10 }}>
                    <Text style={{ color: T.primary, fontWeight: 'bold' }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                trendingTokens.filter(item => 
                   item.item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   item.item.name.toLowerCase().includes(searchQuery.toLowerCase())
                ).map(item => {
                  const sym = item.item.symbol.toUpperCase();
                  const isActive = selectorTarget === 'sell' ? sellToken === sym : buyToken === sym;
                  const priceChange = item.item.data?.price_change_percentage_24h?.usd || 0;
                  const isPositive = priceChange >= 0;
                  return (
                    <TouchableOpacity
                      key={item.item.id}
                      style={[styles.tokenItem, { borderBottomColor: T.border }, isActive && { backgroundColor: T.primary + '10' }]}
                      onPress={() => selectTrendingToken(item)}
                      activeOpacity={0.7}
                    >
                      <CoinIcon sym={sym} url={item.item.thumb} size={44} />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.tokenItemSym, { color: T.text }]}>{sym}</Text>
                        <Text style={[styles.tokenItemName, { color: T.textMuted }]}>{item.item.name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.tokenItemSym, { color: T.text }]}>
                          {typeof item.item.data?.price === 'number'
                            ? `$${item.item.data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                            : '$—'}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isPositive ? T.success : T.error }}>
                          {isPositive ? '+' : ''}{typeof priceChange === 'number' ? priceChange.toFixed(2) : '0.00'}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SLIPPAGE MODAL */}
      <Modal visible={slippageModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: T.surface, maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setSlippageModalVisible(false)}>
                <Feather name="x" size={24} color={T.text} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Max Slippage</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {[0.5, 1, 2].map(val => (
                <TouchableOpacity
                  key={val}
                  style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: slippage === val ? T.primary : T.border, alignItems: 'center', backgroundColor: slippage === val ? T.primary + '20' : 'transparent' }}
                  onPress={() => { setSlippage(val); setSlippageModalVisible(false); }}
                >
                  <Text style={{ color: slippage === val ? T.primary : T.text, fontWeight: '600' }}>{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.mainAction, { backgroundColor: T.primary }]} onPress={() => setSlippageModalVisible(false)}>
              <Text style={styles.actionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  warnText: { flex: 1, fontSize: 12, fontFamily: Fonts.semiBold, lineHeight: 18 },
  swapFrame: { marginBottom: 16 },
  
  inputCard: { 
    borderRadius: 28, 
    backgroundColor: T.surface, 
    padding: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4, 
  },
  inputCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLeft: { flex: 1, paddingRight: 16, alignItems: 'flex-start' },
  inputRight: { alignItems: 'flex-end', justifyContent: 'center' },
  cardLabel: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  largeInput: { fontSize: 40, fontFamily: Fonts.extraBold, padding: 0, height: 50, width: '100%' },
  largeAmountDisplay: { fontSize: 40, fontFamily: Fonts.extraBold, height: 50, lineHeight: 50 },
  usdValue: { fontSize: 14, marginTop: 4, fontFamily: Fonts.semiBold },
  
  tokenPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceHigh, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  pillText: { fontSize: 18, fontFamily: Fonts.bold },
  balanceText: { fontSize: 13, marginTop: 8, fontFamily: Fonts.semiBold },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: -20, zIndex: 10, paddingHorizontal: 24 },
  dividerLine: { flex: 1, height: 1 },
  floatingSwapBtn: { 
    width: 52, height: 52, borderRadius: 26, 
    alignItems: 'center', justifyContent: 'center', 
    borderWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6
  },
  
  filterChip: { borderRadius: 20, backgroundColor: T.surfaceHigh, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  trendingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  
  detailsBox: { borderRadius: 20, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  detailDivider: { height: 1 },
  detailLabel: { fontSize: 13, fontFamily: Fonts.semiBold },
  detailValue: { fontSize: 13, fontFamily: Fonts.bold },
  
  mainAction: { height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  actionText: { color: '#FFF', fontSize: 17, fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: Fonts.extraBold },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, borderRadius: 16, gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: Fonts.semiBold, height: '100%' },
  sectionTitle: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: 12 },
  tokenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderRadius: 12, paddingHorizontal: 8 },
  tokenItemSym: { fontSize: 16, fontFamily: Fonts.extraBold, marginBottom: 2 },
  tokenItemName: { fontSize: 13 },
});
