import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Platform, Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import { swapService, SwapQuote, SUPPORTED_TOKENS, parseSwapError } from '../services/swapService';
import { haptics } from '../utils/haptics';

const COIN_NOTES: Record<string, string> = {
  ETH:   'Ethereum — EVM native',
  USDT:  'Tether USD',
  USDC:  'USD Coin',
  DAI:   'Dai Stablecoin',
};

const SWAP_META: Record<string, { name: string; iconUrl: string; color: string }> = {
  ETH:   { name: 'Ethereum', iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: '#627EEA' },
  USDT:  { name: 'Tether', iconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', color: '#26A17B' },
  USDC:  { name: 'USD Coin', iconUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', color: '#2775CA' },
  DAI:   { name: 'Dai', iconUrl: 'https://assets.coingecko.com/coins/images/9956/large/4943.png', color: '#F4B731' },
};

function CoinIcon({ sym, size = 28 }: { sym: string; size?: number }) {
  const meta = SWAP_META[sym];
  const [failed, setFailed] = React.useState(false);
  if (meta && !failed) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
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

const TokenSelector = memo(({ sym, onPress, styles, T }: any) => (
  <TouchableOpacity style={styles.tokenSelector} onPress={onPress} activeOpacity={0.7}>
    <CoinIcon sym={sym} size={28} />
    <Text style={[styles.selectorText, { color: T.text }]}>{sym}</Text>
    <Feather name="chevron-down" size={16} color={T.textDim} />
  </TouchableOpacity>
));

export default function SwapScreen({ navigation }: any) {
  const { balances, ethBalance, isDarkMode, network, refreshBalance, walletAddress, applySwapBalances } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = useMemo(() => makeStyles(T), [T]);

  const [sellToken, setSellToken] = useState('ETH');
  const [buyToken, setBuyToken]   = useState('USDC');
  const [sellAmount, setSellAmount] = useState('');
  
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [swapStatus, setSwapStatus] = useState('');
  const [step, setStep] = useState<'input' | 'quote' | 'swapping' | 'success' | 'error'>('input');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [swapResult, setSwapResult] = useState<{ sellAmt: string; sellTok: string; buyAmt: string; buyTok: string } | null>(null);

  const [slippage, setSlippage] = useState(1);
  const [slippageModalVisible, setSlippageModalVisible] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<'sell' | 'buy'>('sell');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const isSupported = swapService.isNetworkSupported(network);
  
  const STABLE_FALLBACK: Record<string, number> = { USDC: 1, USDT: 1, DAI: 1 };
  const sellPrice    = prices[sellToken]?.usd ?? STABLE_FALLBACK[sellToken] ?? 1;
  const buyPrice     = prices[buyToken]?.usd  ?? STABLE_FALLBACK[buyToken]  ?? 1;
  const sellBalance  = sellToken === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[sellToken] ?? 0);
  const sellAmtNum   = parseFloat(sellAmount.replace(',', '.')) || 0;
  const sellUsdValue = sellAmtNum > 0 ? (sellAmtNum * sellPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  
  const buyAmount    = quote?.buyAmount ?? '';
  const buyAmtNum    = parseFloat(buyAmount) || 0;
  const buyUsdValue  = buyAmtNum > 0 ? (buyAmtNum * buyPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  
  const isSimulated = quote?.isSimulated === true;
  // On testnet don't block on balance — it's fake money and balance may not reflect yet
  const hasInsufficientBalance = network !== 'Sepolia' && sellAmtNum > sellBalance;
  const canSwap =
    sellAmtNum > 0 &&
    !!quote &&
    parseFloat(quote.buyAmount) > 0 &&
    !hasInsufficientBalance &&
    isSupported &&
    !isLoadingQuote;

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message: msg, type });

  // keep a ref to latest prices so the quote effect doesn't re-run on every price tick
  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  // Debounced quote fetch — only re-runs when the swap inputs change, NOT on price updates
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
        const q = await swapService.getQuote(sellToken, buyToken, normalizedAmt, network, rpcUrl, walletAddress);
        setQuote(q);
      } catch {
        const fromPrice = pricesRef.current[sellToken]?.usd ?? (sellToken === 'ETH' ? 3500 : 1);
        const toPrice   = pricesRef.current[buyToken]?.usd  ?? (buyToken  === 'ETH' ? 3500 : 1);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellAmount, sellToken, buyToken, network, isSupported, walletAddress]);

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
        quote,
        privateKey,
        rpcUrl,
        walletAddress,
        network,
        (status) => setSwapStatus(status)
      );

      if (result.success) {
        const capturedSell = sellAmount;
        const capturedBuy  = quote.buyAmount;
        setSwapResult({ sellAmt: capturedSell, sellTok: sellToken, buyAmt: capturedBuy, buyTok: buyToken });
        await applySwapBalances(sellToken, parseFloat(sellAmount), buyToken, parseFloat(quote.buyAmount));
        haptics.success();
        setStep('success');
        setTimeout(() => refreshBalance(), 1000);
        setTimeout(() => refreshBalance(), 6000);
        
        // Also save to cw_transactions so HistoryScreen picks it up immediately
        try {
          const { default: AS } = Platform.OS === 'web'
            ? { default: { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) } }
            : await import('@react-native-async-storage/async-storage');
          const raw = await AS.getItem('cw_transactions');
          const existing = raw ? JSON.parse(raw) : [];
          const newTx = {
            id:        Date.now().toString(),
            type:      'swap',
            coin:      sellToken,
            amount:    sellAmount,
            buyToken:  buyToken,
            buyAmount: quote.buyAmount,
            usdValue:  (parseFloat(sellAmount) * sellPrice).toFixed(2),
            address:   `${sellToken} → ${buyToken}`,
            status:    'success',
            date:      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            txHash:    result.hash ?? undefined,
          };
          await AS.setItem('cw_transactions', JSON.stringify([newTx, ...existing]));
        } catch (_e) {}
      } else {
        throw new Error(result.error || 'Swap failed');
      }
    } catch (err: any) {
      haptics.error();
      setSwapStatus(err.message || 'An error occurred');
      setStep('error');
    }
  };

  const openSelector = (target: 'sell' | 'buy') => {
    setSelectorTarget(target);
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
        {/* Success icon */}
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

        {/* Swap summary card */}
        <View style={[{
          width: '100%', borderRadius: 24, padding: 20, marginBottom: 32,
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <CoinIcon sym={swapResult.sellTok} size={44} />
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
              <CoinIcon sym={swapResult.buyTok} size={44} />
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
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Swap Assets</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setSlippageModalVisible(true)}>
          <Feather name="settings" size={24} color={T.text} />
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


        <View style={styles.swapFrame}>
          {/* FROM CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface, borderColor: hasInsufficientBalance ? T.pending : 'transparent', borderWidth: 1 }]}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardLabel, { color: T.textMuted }]}>You Pay</Text>
              <Text style={[styles.balanceLabel, { color: T.textDim }]}>Balance: {sellBalance.toFixed(4)} {sellToken}</Text>
            </View>
            <View style={styles.cardContent}>
              <TokenSelector sym={sellToken} onPress={() => openSelector('sell')} styles={styles} T={T} />
              <View style={styles.amountContainer}>
                <TextInput
                  style={[styles.amountInput, { color: T.text }]}
                  placeholder="0"
                  placeholderTextColor={T.textDim}
                  value={sellAmount}
                  onChangeText={setSellAmount}
                  keyboardType="decimal-pad"
                  editable={step === 'input'}
                />
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${sellUsdValue}</Text>
              </View>
            </View>
            {hasInsufficientBalance && <Text style={{ color: T.pending, fontSize: 12, marginTop: 5, textAlign: 'right' }}>Insufficient balance</Text>}
          </View>

          {/* SWAP FLIP BUTTON */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity style={[styles.floatingSwapBtn, { backgroundColor: T.primary, borderColor: T.background }]} onPress={flipTokens} activeOpacity={0.9} disabled={step !== 'input'}>
              <MaterialCommunityIcons name="swap-vertical" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* TO CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface, marginTop: -12 }]}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardLabel, { color: T.textMuted }]}>You Receive</Text>
            </View>
            <View style={styles.cardContent}>
              <TokenSelector sym={buyToken} onPress={() => openSelector('buy')} styles={styles} T={T} />
              <View style={styles.amountContainer}>
                {isLoadingQuote ? (
                  <ActivityIndicator size="small" color={T.primary} style={{ alignSelf: 'flex-end', marginBottom: 10 }} />
                ) : (
                  <Text style={[styles.amountDisplay, { color: buyAmtNum > 0 ? T.text : T.textDim }]}>
                    {buyAmtNum > 0 ? buyAmount : (sellAmtNum > 0 ? '...' : '0')}
                  </Text>
                )}
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${buyUsdValue}</Text>
              </View>
            </View>
          </View>
        </View>

        {isSimulated && (
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
            <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Source</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="check-circle" size={12} color={T.success} />
                <Text style={[styles.detailValue, { color: T.success }]}>
                  {quote.source === '0x' ? '0x Protocol' : quote.source === 'uniswap_v3' ? 'Uniswap V3' : 'Live Price Estimate'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STATUS / ACTION */}
        {step === 'swapping' ? (
          <View style={[styles.statusBox, { backgroundColor: T.surface, borderColor: T.primary, borderWidth: 1 }]}>
            <ActivityIndicator size="small" color={T.primary} style={{ marginRight: 10 }} />
            <Text style={{ color: T.text, fontWeight: '600' }}>{swapStatus}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.mainAction, { backgroundColor: T.primary, opacity: canSwap ? 1 : 0.5 }]}
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
                : canSwap
                ? 'Confirm Swap'
                : 'Enter Details'}
            </Text>
          </TouchableOpacity>
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
            <ScrollView showsVerticalScrollIndicator={false}>
              {SUPPORTED_TOKENS.map(sym => {
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 64, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  warnText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  swapFrame: { marginBottom: 20 },
  inputCard: { borderRadius: 24, padding: 20, marginBottom: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceLabel: { fontSize: 12, fontWeight: '600' },
  cardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tokenSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 8 },
  selectorText: { fontSize: 18, fontWeight: '800' },
  amountContainer: { alignItems: 'flex-end', flex: 1 },
  amountInput: { fontSize: 32, fontWeight: '800', textAlign: 'right', padding: 0, minWidth: 100 },
  amountDisplay: { fontSize: 32, fontWeight: '800', textAlign: 'right' },
  usdValue: { fontSize: 13, marginTop: 4 },
  swapButtonContainer: { height: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  floatingSwapBtn: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  detailsBox: { borderRadius: 20, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  detailDivider: { height: 1 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700' },
  statusBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 20 },
  mainAction: { height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  tokenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderRadius: 12, paddingHorizontal: 8 },
  tokenItemSym: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  tokenItemName: { fontSize: 13 },
});
