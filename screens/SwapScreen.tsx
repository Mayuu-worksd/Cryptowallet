import React, { useState, useEffect, useRef, memo } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Platform, Modal,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import Toast from '../components/Toast';
import { swapService, SwapQuote, SUPPORTED_TOKENS, parseSwapError } from '../services/swapService';
import { haptics } from '../utils/haptics';
import { notificationService } from '../services/notificationService';
import TransactionLoader from '../components/ui/TransactionLoader';
import { commissionService } from '../services/commissionService';

import { SUPPORTED_TOKENS as CONFIG_SUPPORTED_TOKENS } from '../constants/currencyConfig';

const COIN_NOTES: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG_SUPPORTED_TOKENS).map(([k, v]) => [k, v.name])
);

const SWAP_META: Record<string, { name: string; iconUrl: string; color: string }> = Object.fromEntries(
  Object.entries(CONFIG_SUPPORTED_TOKENS).map(([k, v]) => [k, { name: v.name, iconUrl: v.iconUrl, color: v.color }])
);

function CoinIcon({ sym, url, size = 24 }: { sym: string; url?: string; size?: number }) {
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: (meta?.color ?? '#888') + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: '800', color: meta?.color ?? '#888' }}>{sym.slice(0, 2)}</Text>
    </View>
  );
}

const TokenSelector = memo(({ sym, url, onPress, styles, T }: any) => (
  <TouchableOpacity style={styles.tokenPill} onPress={onPress} activeOpacity={0.7}>
    <CoinIcon sym={sym} url={url} size={24} />
    <Text style={[styles.pillText, { color: T.text }]}>{sym}</Text>
    <Feather name="chevron-down" size={16} color={T.textDim} />
  </TouchableOpacity>
));

const NETWORK_TOKENS: Record<string, string[]> = {
  Ethereum:           ['ETH', 'USDT', 'USDC'],
  Polygon:            ['ETH', 'USDT', 'USDC'],
  Arbitrum:           ['ETH', 'USDT', 'USDC'],
  Sepolia:            ['ETH', 'USDT', 'USDC'],
  TRON:               ['TRX', 'USDT', 'USDC'],
  'TRON Nile':        ['TRX', 'USDT', 'USDC'],
  Solana:             ['SOL', 'USDT', 'USDC'],
  'Solana Devnet':    ['SOL', 'USDT', 'USDC'],
};

export default function SwapScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { balances, ethBalance, isDarkMode, network, refreshBalance, walletAddress, applySwapBalances, addTx, formatFiat } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = React.useMemo(() => makeStyles(T), [T]);
  
  const walletRef = useRef(walletAddress);
  walletRef.current = walletAddress;

  const [sellToken, setSellToken] = useState(() => route?.params?.fromToken || 'ETH');
  const [buyToken, setBuyToken]   = useState('USDT');
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

  const [customTokens, setCustomTokens] = useState<Record<string, { name: string, iconUrl: string, price: number }>>({});

  const CLEAN_TOKENS = NETWORK_TOKENS[network] ?? ['ETH', 'USDT', 'USDC'];

  const isSupported = swapService.isNetworkSupported(network);
  const isTronNetwork = network === 'TRON' || network === 'TRON Nile';
  
  const STABLE_FALLBACK: Record<string, number> = { USDT: 1, USDC: 1, ETH: 3500, BTC: 65000, SOL: 150, BNB: 600, XRP: 0.50, TON: 7.5, TRX: 0.12, SUI: 1.80 };
  const sellPrice    = prices[sellToken]?.usd ?? STABLE_FALLBACK[sellToken] ?? customTokens[sellToken]?.price ?? 1;
  const buyPrice     = prices[buyToken]?.usd  ?? STABLE_FALLBACK[buyToken]  ?? customTokens[buyToken]?.price ?? 1;
  const sellBalance  = sellToken === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[sellToken] ?? 0);
  const buyBalance   = buyToken === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[buyToken] ?? 0);
  const sellAmtNum   = parseFloat(sellAmount.replace(',', '.')) || 0;
  const sellUsdValue = sellAmtNum > 0 ? formatFiat(sellAmtNum * sellPrice) : formatFiat(0);
  
  const buyAmount    = quote?.buyAmount ?? '';
  const buyAmtNum    = parseFloat(buyAmount) || 0;
  const buyUsdValue  = buyAmtNum > 0 ? formatFiat(buyAmtNum * buyPrice) : formatFiat(0);
  
  const isSimulated = quote?.isSimulated === true;
  const isMainnet = network === 'Ethereum' || network === 'Polygon' || network === 'Arbitrum' || network === 'TRON';
  const isSimulatedOnMainnet = isSimulated && isMainnet;
  const hasInsufficientBalance = sellAmtNum > sellBalance;
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

  const isFirstRender = useRef(true);

  // Reset tokens when network changes to avoid invalid pairs
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const available = NETWORK_TOKENS[network] ?? ['ETH', 'USDT', 'USDC'];
    const nativeSell = available[0];
    const nativeBuy  = available[1] ?? available[0];
    setSellToken(nativeSell);
    setBuyToken(nativeBuy);
    setSellAmount('');
    setQuote(null);
  }, [network]);


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
        let finalBuyAmtNum = parseFloat(quote.buyAmount);
        
        // Calculate swap fee
        const swapUsdValue = parseFloat(sellAmount) * sellPrice;
        const swapFeeUSD = commissionService.calculateFee('swap_fee', swapUsdValue);
        let feeDeductedFromBuy = 0;
        
        if (swapFeeUSD > 0) {
          feeDeductedFromBuy = swapFeeUSD / buyPrice;
          finalBuyAmtNum = Math.max(0, finalBuyAmtNum - feeDeductedFromBuy);
          // Log the fee
          const { txService } = await import('../services/supabaseService');
          addTx({ type: 'fee', coin: 'USD', amount: swapFeeUSD.toFixed(2), usdValue: swapFeeUSD.toFixed(2), address: 'Swap Fee', status: 'success' });
          txService.log({ wallet_address: walletAddress, type: 'fee', token: 'USD', amount: swapFeeUSD, usd_value: swapFeeUSD, status: 'success', label: 'Swap Fee' }).catch(() => {});
        }
        
        const capturedBuy  = finalBuyAmtNum.toString();
        setSwapResult({ sellAmt: capturedSell, sellTok: sellToken, buyAmt: capturedBuy, buyTok: buyToken });
        await applySwapBalances(sellToken, parseFloat(sellAmount), buyToken, finalBuyAmtNum);
        
        addTx({
          type:      'swap',
          coin:      sellToken,
          amount:    sellAmount,
          buyToken:  buyToken,
          buyAmount: capturedBuy,
          usdValue:  swapUsdValue.toFixed(2),
          address:   `${sellToken} → ${buyToken}`,
          status:    'success',
          txHash:    result.hash ?? undefined,
        } as any);

        const { txService } = await import('../services/supabaseService');
        txService.log({
          wallet_address: walletAddress,
          type: 'swap',
          token: sellToken,
          amount: parseFloat(sellAmount),
          usd_value: swapUsdValue,
          status: 'success',
          tx_hash: result.hash ?? undefined,
          label: `${sellToken} → ${buyToken}`,
          swap_to_token: buyToken,
          swap_to_amount: parseFloat(capturedBuy)
        }).catch(() => {});
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

  const flipTokens = () => {
    haptics.selection();
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
    setSellAmount('');
    setQuote(null);
  };

  const useMaxBalance = () => {
    haptics.selection();
    const safeMax = sellToken === 'ETH' ? Math.max(0, sellBalance - 0.005) : sellBalance;
    setSellAmount(safeMax.toFixed(6).replace(/\.?0+$/, ''));
  };

  if (step === 'success' && swapResult) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: insets.top }]}>
        <View style={styles.successIconWrapper}>
          <Feather name="check" size={44} color="#FFFFFF" />
        </View>

        <Text style={styles.successTitle}>Swap Completed!</Text>
        <Text style={styles.successSubtitle}>
          Your tokens have been swapped successfully.
        </Text>

        <View style={styles.successCard}>
          <View style={styles.successRow}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <CoinIcon sym={swapResult.sellTok} size={40} />
              <Text style={styles.successAmount}>
                {parseFloat(swapResult.sellAmt).toLocaleString('en-US', { maximumFractionDigits: 6 })}
              </Text>
              <Text style={styles.successTokenLabel}>{swapResult.sellTok}</Text>
            </View>
            
            <View style={styles.successArrowWrapper}>
              <Feather name="arrow-right" size={18} color={T.primary} />
            </View>

            <View style={{ alignItems: 'center', flex: 1 }}>
              <CoinIcon sym={swapResult.buyTok} size={40} />
              <Text style={[styles.successAmount, { color: T.success }]}>
                {parseFloat(swapResult.buyAmt).toLocaleString('en-US', { maximumFractionDigits: 6 })}
              </Text>
              <Text style={styles.successTokenLabel}>{swapResult.buyTok}</Text>
            </View>
          </View>
          
          <View style={styles.cardDivider} />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: Fonts.medium }}>Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.success }} />
              <Text style={{ color: T.success, fontSize: 13, fontFamily: Fonts.bold }}>Confirmed</Text>
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
          style={[styles.secondaryAction, { width: '100%' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.actionText, { color: T.text }]}>Back to Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: insets.top }]}>
        <View style={styles.errorIconWrapper}>
          <Feather name="x" size={44} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>Swap Failed</Text>
        <Text style={styles.errorSubtitle}>{swapStatus}</Text>
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

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setSlippageModalVisible(true)}>
          <Feather name="settings" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Swap</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Feather name="x" size={20} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* BANNER NOTIFICATIONS */}
        {!isSupported && (
          <View style={[styles.warnBanner, { backgroundColor: T.pending + '12', borderColor: T.pending + '30' }]}>
            <Feather name="alert-triangle" size={14} color={T.pending} />
            <Text style={[styles.warnText, { color: T.pending }]}>
              Swap not supported on {network}. Switch to Ethereum or Sepolia.
            </Text>
          </View>
        )}
        {isTronNetwork && network === 'TRON Nile' && (
          <View style={[styles.warnBanner, { backgroundColor: '#EF002712', borderColor: '#EF002730' }]}>
            <Feather name="info" size={14} color="#EF0027" />
            <Text style={[styles.warnText, { color: '#EF0027' }]}>
              TRON Nile testnet: swaps use simulated rates.
            </Text>
          </View>
        )}
        {network.startsWith('Solana') && (
          <View style={[styles.warnBanner, { backgroundColor: '#9945FF12', borderColor: '#9945FF30' }]}>
            <Feather name="info" size={14} color="#9945FF" />
            <Text style={[styles.warnText, { color: '#9945FF' }]}>
              Solana network: SOL swaps use simulated live market rates.
            </Text>
          </View>
        )}

        {/* SWAP CARD FRAME */}
        <View style={styles.swapFrame}>
          {/* FROM CARD */}
          <View style={[styles.inputCard, hasInsufficientBalance && { borderColor: T.error + '50' }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardLabel, { color: T.textDim }]}>You Pay</Text>
              <Pressable style={styles.balanceContainer} onPress={useMaxBalance}>
                <Text style={[styles.balanceText, { color: T.textDim }]}>
                  Bal: {sellBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </Text>
                <Text style={styles.maxText}>Max</Text>
              </Pressable>
            </View>
            
            <View style={styles.inputContainerRow}>
              <TextInput
                style={[styles.largeInput, { color: T.text }]}
                placeholder="0"
                placeholderTextColor={T.textDim}
                value={sellAmount}
                onChangeText={setSellAmount}
                keyboardType="decimal-pad"
                editable={step === 'input'}
                maxLength={15}
              />
              <TokenSelector sym={sellToken} url={customTokens[sellToken]?.iconUrl} onPress={() => openSelector('sell')} styles={styles} T={T} />
            </View>
            
            <View style={styles.cardFooterRow}>
              <Text style={[styles.usdValue, { color: T.textDim }]}>≈ {sellUsdValue}</Text>
              {hasInsufficientBalance && (
                <Text style={styles.insufficientText}>Insufficient balance</Text>
              )}
            </View>
          </View>

          {/* FLIPPER BUTTON */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
            <TouchableOpacity 
              style={[styles.floatingSwapBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
              onPress={flipTokens} 
              activeOpacity={0.8} 
              disabled={step !== 'input'}
            >
              <Feather name="refresh-cw" size={16} color={T.primary} />
            </TouchableOpacity>
            <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
          </View>

          {/* TO CARD */}
          <View style={styles.inputCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardLabel, { color: T.textDim }]}>You Receive</Text>
              <Text style={[styles.balanceText, { color: T.textDim }]}>
                Bal: {buyBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </Text>
            </View>
            
            <View style={styles.inputContainerRow}>
              {isLoadingQuote ? (
                <View style={styles.loadingQuoteContainer}>
                  <ActivityIndicator size="small" color={T.primary} />
                </View>
              ) : (
                <Text style={[styles.largeAmountDisplay, { color: buyAmtNum > 0 ? T.text : T.textDim }]} numberOfLines={1} adjustsFontSizeToFit>
                  {buyAmtNum > 0 ? parseFloat(buyAmount).toLocaleString('en-US', { maximumFractionDigits: 6 }) : (sellAmtNum > 0 ? '...' : '0')}
                </Text>
              )}
              <TokenSelector sym={buyToken} url={customTokens[buyToken]?.iconUrl} onPress={() => openSelector('buy')} styles={styles} T={T} />
            </View>
            
            <View style={styles.cardFooterRow}>
              <Text style={[styles.usdValue, { color: T.textDim }]}>≈ {buyUsdValue}</Text>
            </View>
          </View>
        </View>

        {isSimulatedOnMainnet && (
          <View style={[styles.warnBanner, { backgroundColor: T.error + '12', borderColor: T.error + '30', marginBottom: 16 }]}>
            <Feather name="alert-triangle" size={14} color={T.error} />
            <Text style={[styles.warnText, { color: T.error }]}>
              Waiting for live quote from network pool. Do not swap yet.
            </Text>
          </View>
        )}
        {isSimulated && !isMainnet && network !== 'TRON' && network !== 'TRON Nile' && (
          <View style={[styles.warnBanner, { backgroundColor: T.primary + '12', borderColor: T.primary + '30', marginBottom: 16 }]}>
            <Feather name="info" size={14} color={T.primary} />
            <Text style={[styles.warnText, { color: T.primary }]}>
              {network === 'Sepolia' ? 'Test network — simulated swap with test assets.' : 'Instantly swapped at current market prices.'}
            </Text>
          </View>
        )}

        {/* DETAILS SECTION */}
        {quote && (
          <View style={[styles.detailsBox, { borderColor: T.border }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textDim }]}>Quote</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>1 {sellToken} ≈ {parseFloat(quote.rate).toLocaleString('en-US', { maximumFractionDigits: 6 })} {buyToken}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: T.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textDim }]}>Network Fee</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>~{quote.estimatedGas} ETH</Text>
            </View>
          </View>
        )}

        {/* SWAP BUTTON */}
        {step !== 'swapping' && (
          <TouchableOpacity
            style={[styles.mainAction, { backgroundColor: T.primary, opacity: canSwap ? 1 : 0.6 }]}
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
                ? 'Waiting for Quote...'
                : canSwap
                ? 'Confirm Swap'
                : 'Enter Details'}
            </Text>
          </TouchableOpacity>
        )}

        {/* FOOTER INFO */}
        <View style={styles.footerInfo}>
          <View style={styles.footerRow}>
            <Feather name="shield" size={14} color={T.textDim} />
            <Text style={[styles.footerText, { color: T.textDim }]}>Powered by 0x Protocol</Text>
          </View>
          <View style={styles.footerRow}>
            <Feather name="zap" size={14} color={T.textDim} />
            <Text style={[styles.footerText, { color: T.textDim }]}>Best rates across DEXs</Text>
          </View>
        </View>

      </ScrollView>

      {/* TOKEN SELECTOR MODAL */}
      <Modal visible={selectorVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Select Token</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectorVisible(false)}>
                <Feather name="x" size={20} color={T.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.searchBar, { backgroundColor: T.background, borderColor: T.border }]}>
              <Feather name="search" size={16} color={T.textDim} />
              <TextInput
                style={[styles.searchInput, { color: T.text }]}
                placeholder="Search symbol or name"
                placeholderTextColor={T.textDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={16} color={T.textDim} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {CLEAN_TOKENS.filter(sym => sym.toLowerCase().includes(searchQuery.toLowerCase())).map(sym => {
                const isActive = selectorTarget === 'sell' ? sellToken === sym : buyToken === sym;
                const tokenBalance = sym === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[sym] ?? 0);
                const tokenPrice = prices[sym]?.usd ?? STABLE_FALLBACK[sym] ?? customTokens[sym]?.price ?? 0;
                const usdValue = tokenBalance * tokenPrice;
                
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.tokenItem, { borderBottomColor: T.border }, isActive && { backgroundColor: T.background }]}
                    onPress={() => selectToken(sym)}
                    activeOpacity={0.7}
                  >
                    <CoinIcon sym={sym} size={36} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.tokenItemSym, { color: T.text }]}>{sym}</Text>
                      <Text style={[styles.tokenItemName, { color: T.textDim }]}>{COIN_NOTES[sym] || sym}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.tokenItemBalance, { color: T.text }]}>
                        {tokenBalance > 0 ? tokenBalance.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'}
                      </Text>
                      {usdValue > 0 && (
                        <Text style={[styles.tokenItemUsd, { color: T.textDim }]}>
                          ≈ {formatFiat(usdValue)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SLIPPAGE SETTINGS MODAL */}
      <Modal visible={slippageModalVisible} transparent animationType="fade">
        <View style={styles.settingsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSlippageModalVisible(false)} />
          <View style={[styles.settingsContent, { backgroundColor: T.surface }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: T.text }]}>Slippage Tolerance</Text>
              <TouchableOpacity onPress={() => setSlippageModalVisible(false)}>
                <Feather name="x" size={20} color={T.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.slippageRow}>
              {[0.5, 1.0, 2.0].map(val => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.slippagePill,
                    { borderColor: T.border },
                    slippage === val && { backgroundColor: T.primary, borderColor: T.primary }
                  ]}
                  onPress={() => { setSlippage(val); setSlippageModalVisible(false); }}
                >
                  <Text style={[styles.slippageText, { color: slippage === val ? '#FFFFFF' : T.text }]}>
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border + '50'
  },
  headerTitle: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, flexGrow: 1 },
  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  warnText: { flex: 1, fontSize: 12, fontFamily: Fonts.semiBold, lineHeight: 18 },
  
  swapFrame: { marginBottom: 16 },
  inputCard: { 
    borderRadius: 20, 
    backgroundColor: T.surface, 
    padding: 16, 
    borderWidth: 1,
    borderColor: T.border,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  balanceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceText: { fontSize: 12, fontFamily: Fonts.medium },
  maxText: { fontSize: 11, fontFamily: Fonts.bold, color: T.primary, backgroundColor: T.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  
  inputContainerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  largeInput: { fontSize: 32, fontFamily: Fonts.extraBold, padding: 0, height: 44, flex: 1, marginRight: 12 },
  largeAmountDisplay: { fontSize: 32, fontFamily: Fonts.extraBold, height: 44, lineHeight: 44, flex: 1, marginRight: 12 },
  loadingQuoteContainer: { height: 44, justifyContent: 'center', flex: 1 },
  
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  usdValue: { fontSize: 12, fontFamily: Fonts.medium },
  insufficientText: { fontSize: 12, fontFamily: Fonts.bold, color: T.error },
  
  tokenPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: T.background, 
    borderRadius: 20, 
    paddingLeft: 8,
    paddingRight: 12, 
    paddingVertical: 6, 
    gap: 6,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillText: { fontSize: 14, fontFamily: Fonts.bold },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: -14, zIndex: 10, paddingHorizontal: 24 },
  dividerLine: { flex: 1, height: 1 },
  floatingSwapBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 4, 
    elevation: 3
  },
  
  detailsBox: { 
    borderRadius: 16, 
    borderWidth: 1, 
    marginBottom: 20, 
    overflow: 'hidden',
    padding: 14,
    backgroundColor: T.surface,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailDivider: { height: 1, marginVertical: 8 },
  detailLabel: { fontSize: 12, fontFamily: Fonts.medium },
  detailValue: { fontSize: 12, fontFamily: Fonts.bold },
  
  mainAction: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 },
  secondaryAction: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border, backgroundColor: T.surface },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.3 },
  
  // SELECTOR MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold },
  modalCloseButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44, borderRadius: 12, gap: 8, marginBottom: 16, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, height: '100%' },
  
  tokenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderRadius: 12, paddingHorizontal: 10, marginBottom: 4 },
  tokenItemSym: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  tokenItemName: { fontSize: 12, fontFamily: Fonts.medium },
  tokenItemBalance: { fontSize: 14, fontFamily: Fonts.bold },
  tokenItemUsd: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },

  // SETTINGS SLIPPAGE MODAL
  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  settingsContent: { borderRadius: 20, padding: 20, width: '100%', maxWidth: 320 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  settingsTitle: { fontSize: 16, fontFamily: Fonts.bold },
  slippageRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  slippagePill: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  slippageText: { fontSize: 13, fontFamily: Fonts.bold },

  // SUCCESS / ERROR SCREEN
  successIconWrapper: {
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: T.success,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    shadowColor: T.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  successTitle: { fontSize: 24, fontFamily: Fonts.bold, color: T.text, marginBottom: 8, textAlign: 'center' },
  successSubtitle: { fontSize: 14, fontFamily: Fonts.medium, color: T.textDim, marginBottom: 24, textAlign: 'center' },
  successCard: {
    width: '100%', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 28,
    backgroundColor: T.surface, 
    borderWidth: 1, 
    borderColor: T.border,
  },
  successRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  successAmount: { color: T.text, fontFamily: Fonts.extraBold, fontSize: 18, marginTop: 6, textAlign: 'center' },
  successTokenLabel: { color: T.textDim, fontSize: 11, fontFamily: Fonts.bold, marginTop: 2, textTransform: 'uppercase' },
  successArrowWrapper: {
    width: 32, 
    height: 32, 
    borderRadius: 16,
    backgroundColor: T.background, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
  cardDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

  errorIconWrapper: {
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: T.error,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    shadowColor: T.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  errorSubtitle: { fontSize: 14, fontFamily: Fonts.medium, color: T.textDim, textAlign: 'center', marginBottom: 28, paddingHorizontal: 16, lineHeight: 20 },

  // FOOTER INFO
  footerInfo: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: T.border + '30' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  footerText: { fontSize: 12, fontFamily: Fonts.medium },
});
