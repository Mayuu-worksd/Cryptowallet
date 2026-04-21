import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Platform, Modal,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import { swapService, SwapQuote } from '../services/swapService';

const COINS = ['ETH', 'USDT', 'USDC', 'WBTC', 'MATIC', 'LINK', 'UNI'];

const SWAP_META: Record<string, { name: string; iconUrl: string; color: string }> = {
  ETH:   { name: 'Ethereum',       iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',                color: '#627EEA' },
  USDT:  { name: 'Tether',         iconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',                 color: '#26A17B' },
  USDC:  { name: 'USD Coin',       iconUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',          color: '#2775CA' },
  WBTC:  { name: 'Wrapped Bitcoin',iconUrl: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',  color: '#F7931A' },
  MATIC: { name: 'Polygon',        iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',      color: '#8247E5' },
  LINK:  { name: 'Chainlink',      iconUrl: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',    color: '#2A5ADA' },
  UNI:   { name: 'Uniswap',        iconUrl: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png',          color: '#FF007A' },
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

// Defined outside component to avoid recreation on every render
const TokenSelector = memo(({ sym, onPress, styles, T }: any) => (
  <TouchableOpacity style={styles.tokenSelector} onPress={onPress} activeOpacity={0.7}>
    <CoinIcon sym={sym} size={28} />
    <Text style={[styles.selectorText, { color: T.text }]}>{sym}</Text>
    <Feather name="chevron-down" size={16} color={T.textDim} />
  </TouchableOpacity>
));

export default function SwapScreen({ navigation }: any) {
  const { balances, ethBalance, isDarkMode, network, refreshBalance, walletAddress } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  // Memoize styles — only recompute when theme changes
  const styles = useMemo(() => makeStyles(T), [T]);

  const [fromCoin, setFromCoin] = useState('ETH');
  const [toCoin, setToCoin]     = useState('USDT');
  const [amount, setAmount]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [quoting, setQuoting]   = useState(false);
  const [quote, setQuote]       = useState<SwapQuote | null>(null);
  const [isFallbackQuote, setIsFallbackQuote] = useState(false);
  const [toast, setToast]       = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<'from' | 'to'>('from');
  
  const isSupported = swapService.isNetworkSupported(network);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message: msg, type });

  const fromPrice   = prices[fromCoin]?.usd ?? 1;
  const fromBalance = fromCoin === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[fromCoin] ?? 0);
  const usdValue    = amount ? (parseFloat(amount) * fromPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';
  const toAmount    = quote?.toAmount ?? '';
  const toUsdValue  = toAmount ? (parseFloat(toAmount) * (prices[toCoin]?.usd ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';
  const rate        = quote?.rate ?? '—';

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || fromCoin === toCoin || !isSupported) {
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      setQuoting(true);
      let q = await swapService.getQuote(fromCoin, toCoin, amount, network);
      let fallback = false;

      // Fallback: if 0x API fails, estimate from live prices (display only)
      if (!q) {
        const fromUsd = prices[fromCoin]?.usd ?? 0;
        const toUsd   = prices[toCoin]?.usd   ?? 1;
        if (fromUsd > 0 && toUsd > 0) {
          const parsed = parseFloat(amount);
          const toAmt  = (parsed * fromUsd) / toUsd;
          q = {
            toAmount:     toAmt.toFixed(6),
            estimatedGas: '0.002',
            rate:         (fromUsd / toUsd).toFixed(6),
          };
          fallback = true;
        }
      }

      setQuote(q);
      setIsFallbackQuote(fallback);
      setQuoting(false);
    }, 700);
    return () => clearTimeout(t);
  }, [amount, fromCoin, toCoin, network, isSupported, prices]);

  const handleSwap = async () => {
    const parsed = parseFloat(amount);
    if (!amount || parsed <= 0)  { showToast('Enter a valid amount', 'error'); return; }
    if (parsed > fromBalance)    { showToast('Insufficient balance.', 'error'); return; }
    if (!isSupported)            { showToast('Switch to support network to swap.', 'error'); return; }
    if (!quote || isFallbackQuote) { showToast('Waiting for live quote from 0x...', 'info'); return; }

    setLoading(true);
    try {
      const privateKey = await (await import('../services/storageService')).storageService.getPrivateKey();
      if (!privateKey) { showToast('Wallet not found. Please re-import.', 'error'); setLoading(false); return; }
      const { ethereumService } = await import('../services/ethereumService');
      const { ethers } = await import('ethers');
      const { RPC_URLS } = await import('../config');
      const provider = new ethers.providers.JsonRpcProvider(RPC_URLS[network]);

      const result = await swapService.executeSwap(
        fromCoin, toCoin, amount, walletAddress, privateKey, provider, network
      );

      if (result.success) {
        showToast(`✓ Swapped ${amount} ${fromCoin} → ${toCoin}`, 'success');
        refreshBalance();
        setAmount('');
        setTimeout(() => navigation.goBack(), 1800);
      } else {
        showToast(result.error ?? 'Swap failed.', 'error');
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Swap failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openSelector = (target: 'from' | 'to') => {
    setSelectorTarget(target);
    setSelectorVisible(true);
  };

  const selectToken = (sym: string) => {
    if (selectorTarget === 'from') {
      if (sym === toCoin) setToCoin(fromCoin);
      setFromCoin(sym);
    } else {
      if (sym === fromCoin) setFromCoin(toCoin);
      setToCoin(sym);
    }
    setSelectorVisible(false);
    setAmount('');
    setQuote(null);
  };

  const TokenSelectorFrom = useCallback(() => (
    <TokenSelector sym={fromCoin} onPress={() => openSelector('from')} styles={styles} T={T} />
  ), [fromCoin, styles, T]);

  const TokenSelectorTo = useCallback(() => (
    <TokenSelector sym={toCoin} onPress={() => openSelector('to')} styles={styles} T={T} />
  ), [toCoin, styles, T]);

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Swap Assets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Unsupported network warning */}
        {!isSupported && (
          <View style={[styles.warnBanner, { backgroundColor: T.pending + '18', borderColor: T.pending + '40' }]}>
            <Feather name="alert-triangle" size={14} color={T.pending} />
            <Text style={[styles.warnText, { color: T.pending }]}>
              Swap is not available on {network}. Switch to Ethereum, Polygon, or Arbitrum in Settings.
            </Text>
          </View>
        )}

        <View style={styles.swapFrame}>
          {/* FROM CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface }]}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardLabel, { color: T.textMuted }]}>From</Text>
              <Text style={[styles.balanceLabel, { color: T.textDim }]}>Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {fromCoin}</Text>
            </View>
            <View style={styles.cardContent}>
              <TokenSelectorFrom />
              <View style={styles.amountContainer}>
                <TextInput
                  style={[styles.amountInput, { color: T.text }]}
                  placeholder="0"
                  placeholderTextColor={T.textDim}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${usdValue}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.maxBtn, { backgroundColor: T.primary + '18' }]}
              onPress={() => setAmount(fromBalance.toFixed(6))}
            >
              <Text style={[styles.maxBtnText, { color: T.primary }]}>MAX</Text>
            </TouchableOpacity>
          </View>

          {/* SWAP BUTTON */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              style={[styles.floatingSwapBtn, { backgroundColor: T.primary, borderColor: T.background }]}
              onPress={() => { setFromCoin(toCoin); setToCoin(fromCoin); setAmount(''); setQuote(null); }}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name="swap-vertical" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* TO CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface, marginTop: -12 }]}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardLabel, { color: T.textMuted }]}>To</Text>
              <Text style={[styles.balanceLabel, { color: T.textDim }]}>Estimated</Text>
            </View>
            <View style={styles.cardContent}>
              <TokenSelectorTo />
              <View style={styles.amountContainer}>
                {quoting ? (
                  <ActivityIndicator size="small" color={T.primary} style={{ alignSelf: 'flex-end', marginBottom: 10 }} />
                ) : (
                  <Text style={[styles.amountDisplay, { color: toAmount ? T.text : T.textDim }]}>
                    {toAmount || '0'}
                  </Text>
                )}
                <Text style={[styles.usdValue, { color: T.textDim }]}>≈ ${toUsdValue}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fallback quote warning */}
        {isFallbackQuote && quote && (
          <View style={[styles.warnBanner, { backgroundColor: T.pending + '18', borderColor: T.pending + '40', marginBottom: 16 }]}>
            <Feather name="alert-triangle" size={14} color={T.pending} />
            <Text style={[styles.warnText, { color: T.pending }]}>
              Live quote unavailable. Shown amount is an estimate only. Confirm Swap is disabled until a real quote loads.
            </Text>
          </View>
        )}

        {/* DETAILS */}
        <View style={[styles.detailsBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textMuted }]}>Rate</Text>
            <Text style={[styles.detailValue, { color: T.text }]}>1 {fromCoin} = {rate} {toCoin}</Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textMuted }]}>Network Fee</Text>
            <Text style={[styles.detailValue, { color: T.text }]}>
              {quote?.estimatedGas ? `${quote.estimatedGas} ETH` : quoting ? 'Estimating...' : '—'}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textMuted }]}>Slippage</Text>
            <Text style={[styles.detailValue, { color: T.text }]}>1%</Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textMuted }]}>Protocol</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="shield" size={12} color={T.success} />
              <Text style={[styles.detailValue, { color: T.success }]}>0x Protocol</Text>
            </View>
          </View>
        </View>

        {/* SWAP BUTTON */}
        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.primary, opacity: loading || !amount || !isSupported || isFallbackQuote ? 0.6 : 1 }]}
          onPress={handleSwap}
          disabled={loading || !amount || !isSupported || isFallbackQuote}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.actionText}>Confirm Swap</Text>
          )}
        </TouchableOpacity>

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
              {COINS.map(sym => {
                const meta     = SWAP_META[sym];
                const isActive = selectorTarget === 'from' ? fromCoin === sym : toCoin === sym;
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.tokenItem, { borderBottomColor: T.border },
                      isActive && { backgroundColor: T.primary + '10' }]}
                    onPress={() => selectToken(sym)}
                    activeOpacity={0.7}
                  >
                    <CoinIcon sym={sym} size={44} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.tokenItemSym, { color: T.text }]}>{sym}</Text>
                      <Text style={[styles.tokenItemName, { color: T.textMuted }]}>{meta?.name}</Text>
                    </View>
                    {isActive && <Feather name="check-circle" size={20} color={T.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 64, paddingBottom: 20,
  },
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

  tokenSelector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.surfaceHigh, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, gap: 8,
  },
  selectorText: { fontSize: 18, fontWeight: '800' },

  amountContainer: { alignItems: 'flex-end', flex: 1 },
  amountInput: { fontSize: 32, fontWeight: '800', textAlign: 'right', padding: 0, minWidth: 100 },
  amountDisplay: { fontSize: 32, fontWeight: '800', textAlign: 'right' },
  usdValue: { fontSize: 13, marginTop: 4 },

  maxBtn: { alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  maxBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  swapButtonContainer: { height: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  floatingSwapBtn: {
    width: 46, height: 46, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },

  detailsBox: { borderRadius: 20, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  detailDivider: { height: 1 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700' },

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
