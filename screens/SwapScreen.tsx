import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, COIN_META } from '../constants';
import Toast from '../components/Toast';
import { swapService, SwapQuote } from '../services/swapService';

const COINS = ['ETH', 'USDT', 'BTC', 'SOL'];

export default function SwapScreen({ navigation }: any) {
  const { balances, ethBalance, prices, isDarkMode, network, refreshBalance, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = makeStyles(T);

  const [fromCoin, setFromCoin] = useState('ETH');
  const [toCoin, setToCoin]     = useState('USDT');
  const [amount, setAmount]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [quoting, setQuoting]   = useState(false);
  const [quote, setQuote]       = useState<SwapQuote | null>(null);
  const [toast, setToast]       = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  
  const isSupported = swapService.isNetworkSupported(network);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message: msg, type });

  const fromPrice   = prices[fromCoin]?.usd ?? 1;
  const fromBalance = fromCoin === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[fromCoin] ?? 0);
  const usdValue    = amount ? (parseFloat(amount) * fromPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';
  const toAmount    = quote?.toAmount ?? '';
  const rate        = quote?.rate ?? '—';

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || fromCoin === toCoin || !isSupported) {
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      setQuoting(true);
      const q = await swapService.getQuote(fromCoin, toCoin, amount, network);
      setQuote(q);
      setQuoting(false);
    }, 700);
    return () => clearTimeout(t);
  }, [amount, fromCoin, toCoin, network, isSupported]);

  const handleSwap = async () => {
    const parsed = parseFloat(amount);
    if (!amount || parsed <= 0)  { showToast('Enter a valid amount', 'error'); return; }
    if (parsed > fromBalance)    { showToast('Insufficient balance.', 'error'); return; }
    if (!isSupported)            { showToast('Switch to Ethereum, Polygon or Arbitrum to swap.', 'error'); return; }
    if (!quote)                  { showToast('Waiting for quote. Please try again.', 'info'); return; }

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
        showToast(result.error ?? 'Swap failed. Please try again.', 'error');
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Swap failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const TokenBadge = ({ sym, current, onSelect }: any) => (
    <TouchableOpacity 
      style={[styles.tokenBadge, current === sym && { borderColor: T.primary, backgroundColor: T.primary + '10' }]} 
      onPress={() => onSelect(sym)} 
      activeOpacity={0.8}
    >
      <Image source={{ uri: COIN_META[sym]?.iconUrl }} style={styles.badgeIcon} />
      <Text style={[styles.badgeText, current === sym && { color: T.primary }]}>{sym}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Swap Assets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={styles.swapContainer}>
          {/* FROM CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>You Pay</Text>
              <Text style={styles.balanceInfo}>Balance: {fromBalance.toFixed(4)}</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={T.textDim}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                maxLength={12}
              />
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.usdSub}>≈ ${usdValue}</Text>
              <TouchableOpacity onPress={() => setAmount(fromBalance.toString())}>
                <Text style={styles.maxText}>USE MAX</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectorRow}>
               {COINS.map(c => <TokenBadge key={c} sym={c} current={fromCoin} onSelect={setFromCoin} />)}
            </View>
          </View>

          {/* SWAP ICON DIVIDER */}
          <View style={styles.dividerArea}>
            <TouchableOpacity 
              style={[styles.swapCircle, { backgroundColor: T.surfaceHigh }]}
              onPress={() => { setFromCoin(toCoin); setToCoin(fromCoin); setAmount(''); }}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name="swap-vertical" size={24} color={T.primary} />
            </TouchableOpacity>
          </View>

          {/* TO CARD */}
          <View style={[styles.inputCard, { backgroundColor: T.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>You Receive</Text>
            </View>
            <View style={styles.inputRow}>
              <View style={{ flex: 1, height: 50, justifyContent: 'center' }}>
                {quoting ? (
                  <ActivityIndicator size="small" color={T.primary} style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <Text style={[styles.amountInput, !toAmount && { color: T.textDim }]}>
                    {toAmount || '0'}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.usdSub}>Rate: 1 {fromCoin} = {rate} {toCoin}</Text>
            </View>
            <View style={styles.selectorRow}>
               {COINS.map(c => <TokenBadge key={c} sym={c} current={toCoin} onSelect={setToCoin} />)}
            </View>
          </View>
        </View>

        {/* Unsupported network warning */}
        {!isSupported && (
          <View style={[styles.warnBanner, { backgroundColor: T.pending + '18', borderColor: T.pending + '40' }]}>
            <Feather name="alert-triangle" size={14} color={T.pending} />
            <Text style={[styles.warnText, { color: T.pending }]}>
              Swap is not available on {network}. Switch to Ethereum, Polygon, or Arbitrum in Settings.
            </Text>
          </View>
        )}

        {/* DETAILS SECTION */}
        <View style={[styles.details, { borderTopColor: T.border }]}>
           <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Network Fee</Text>
              <Text style={styles.detailValue}>
                {quote?.estimatedGas ? `${quote.estimatedGas} ETH` : quoting ? 'Estimating...' : '—'}
              </Text>
           </View>
           <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Slippage</Text>
              <Text style={styles.detailValue}>1%</Text>
           </View>
        </View>

        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.primary, opacity: loading || !amount || !isSupported ? 0.6 : 1 }]}
          onPress={handleSwap}
          disabled={loading || !amount || !isSupported}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.actionText}>Confirm Swap</Text>
          )}
        </TouchableOpacity>

        <View style={styles.secureBanner}>
           <Feather name="shield" size={14} color={T.success} />
           <Text style={[styles.secureText, { color: T.success }]}>Powered by 0x Protocol</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 64, paddingBottom: 20 
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.6 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  swapContainer: { gap: 6, marginBottom: 20 },
  inputCard: { borderRadius: 28, padding: 20, borderWidth: 1, borderColor: T.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel: { fontSize: 13, fontWeight: '800', color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceInfo: { fontSize: 12, fontWeight: '700', color: T.textDim },

  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '800', color: T.text, padding: 0 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  usdSub: { fontSize: 14, fontWeight: '600', color: T.textDim },
  maxText: { fontSize: 12, fontWeight: '900', color: T.primary, letterSpacing: 0.5 },

  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tokenBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: T.surfaceLow, paddingHorizontal: 12, paddingVertical: 8, 
    borderRadius: 16, borderWidth: 1, borderColor: T.border 
  },
  badgeIcon: { width: 22, height: 22, borderRadius: 11 },
  badgeText: { fontSize: 14, fontWeight: '800', color: T.text },

  dividerArea: { height: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  swapCircle: { 
    width: 48, height: 48, borderRadius: 24, 
    alignItems: 'center', justifyContent: 'center', 
    borderWidth: 4, borderColor: T.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6
  },

  details: { marginTop: 12, borderTopWidth: 1, paddingTop: 20, gap: 10 },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 14, color: T.textMuted, fontWeight: '600' },
  detailValue: { fontSize: 14, color: T.text, fontWeight: '700' },

  mainAction: { height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  actionText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  secureBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  secureText: { fontSize: 12, fontWeight: '700' },
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  warnText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
});
