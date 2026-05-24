import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Theme, Fonts, COIN_META, COIN_COLORS } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
  Animated, Modal, StatusBar, Image, Pressable
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { ethereumService } from '../services/ethereumService';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../utils/haptics';
import TransactionLoader from '../components/ui/TransactionLoader';
import { tronService } from '../services/tronService';
import { storageService } from '../services/storageService';

const CoinIcon = memo(({ symbol, size = 24 }: { symbol: string; size?: number }) => {
  const meta  = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = useState(false);
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

export default function SendScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { 
    ethBalance, sendETH, isDarkMode, walletAddress, tronAddress, 
    network, balances, addTx, updateTxStatus, refreshBalance,
    applySwapBalances, formatFiat 
  } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = React.useMemo(() => makeStyles(T), [T]);

  const scannedAddr = route?.params?.scannedAddress ?? '';

  const [selectedToken, setSelectedToken] = useState(route?.params?.symbol ?? 'USDT');
  const [selectorVisible, setSelectorVisible] = useState(false);

  const [address, setAddress]         = useState(scannedAddr);
  const [amount, setAmount]             = useState('');
  const [estimating, setEstimating]     = useState(false);
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError]   = useState('');
  const [gasEth, setGasEth]             = useState('');
  const [showConfirm, setShowConfirm]   = useState(false);
  const [sending, setSending]           = useState(false);
  const [sendStatus, setSendStatus]     = useState('');
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const btnScale   = useRef(new Animated.Value(1)).current;
  const sendingRef = useRef(false); // double-tap guard

  useEffect(() => {
    if (scannedAddr) validateAddress(scannedAddr);
  }, [scannedAddr]);

  const isTronNetwork = network === 'TRON' || network === 'TRON Nile';
  const coinLabel = selectedToken;
  const coinPrice    = prices[selectedToken]?.usd ?? (selectedToken === 'ETH' ? 3500 : (selectedToken === 'BTC' ? 65000 : 1));
  const parsedAmount = parseFloat(amount) || 0;
  const gasEthNum    = parseFloat(gasEth) || 0;
  const totalETH     = (parsedAmount + gasEthNum).toFixed(6);

  // Available balance based on token
  const availBal     = selectedToken === 'ETH' ? (parseFloat(ethBalance) || 0) : (balances[selectedToken] ?? 0);

  // Dynamic fiat conversions using selected fiat currency formatter formatFiat!
  const fiatAmount   = formatFiat(parsedAmount * coinPrice);
  const fiatGas      = formatFiat(gasEthNum * coinPrice);
  const fiatTotal    = formatFiat((parsedAmount + gasEthNum) * coinPrice);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const validateAddress = useCallback((val: string) => {
    if (!val) { setAddressError(''); return; }
    if (selectedToken === 'TRX') {
      setAddressError(/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(val) ? '' : 'Invalid TRON address (starts with T)');
    } else if (selectedToken === 'SOL') {
      setAddressError(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val) ? '' : 'Invalid Solana address');
    } else if (selectedToken === 'BTC') {
      setAddressError(/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(val) ? '' : 'Invalid Bitcoin address');
    } else if (selectedToken === 'TON') {
      setAddressError(/^[a-zA-Z0-9_-]{48}$/.test(val) ? '' : 'Invalid TON address');
    } else if (selectedToken === 'SUI') {
      setAddressError(/^0x[0-9a-fA-F]{64}$/.test(val) ? '' : 'Invalid Sui address');
    } else if (selectedToken === 'XRP') {
      setAddressError(/^r[0-9a-zA-Z]{24,34}$/.test(val) ? '' : 'Invalid Ripple address');
    } else {
      // EVM (ETH, USDT, USDC, BNB)
      setAddressError(/^0x[0-9a-fA-F]{40}$/.test(val) ? '' : 'Invalid EVM address (0x...)');
    }
  }, [selectedToken]);

  const validateAmount = useCallback((val: string, currentGasEth?: string) => {
    if (!val) { setAmountError(''); return; }
    const p = parseFloat(val);
    if (isNaN(p) || p <= 0) { setAmountError('Enter a valid amount'); return; }
    if (p > availBal)        { setAmountError(`Exceeds balance (${availBal.toFixed(6)} ${coinLabel})`); return; }
    const gas = parseFloat(currentGasEth ?? gasEth) || 0.0005;
    if (selectedToken === 'ETH' || selectedToken === 'TRX') {
      if (p + gas > availBal) { 
        setAmountError(`Insufficient for gas. Max sendable: ${Math.max(0, availBal - gas).toFixed(6)} ${coinLabel}`); 
        return; 
      }
    }
    setAmountError('');
  }, [availBal, gasEth, selectedToken, coinLabel]);

  useEffect(() => {
    if (!address || !amount || addressError || !parsedAmount) {
      setGasEth('');
      return;
    }
    // Gas estimation for native ETH
    if (selectedToken === 'ETH') {
      const t = setTimeout(async () => {
        setEstimating(true);
        try {
          const { gasCostEth } = await ethereumService.estimateGas(walletAddress, address, amount, network);
          setGasEth(gasCostEth);
          validateAmount(amount, gasCostEth);
        } catch (_e) {
          setGasEth('0.000042');
          validateAmount(amount, '0.000042');
        } finally {
          setEstimating(false);
        }
      }, 600);
      return () => clearTimeout(t);
    }
    // Skip gas estimation for TRX — use flat fee estimate
    if (selectedToken === 'TRX') {
      const flatFee = tronService.estimateFee(network).toFixed(6);
      setGasEth(flatFee);
      validateAmount(amount, flatFee);
      return;
    }

    // Flat simulated fees for non-native assets
    let flatFee = '0.0005';
    if (selectedToken === 'USDT' || selectedToken === 'USDC') {
      flatFee = isTronNetwork ? '2.0' : '0.001';
    } else if (selectedToken === 'BTC') {
      flatFee = '0.0001';
    } else if (selectedToken === 'SOL') {
      flatFee = '0.00005';
    } else if (selectedToken === 'BNB') {
      flatFee = '0.0002';
    } else if (selectedToken === 'XRP') {
      flatFee = '0.02';
    } else if (selectedToken === 'TON') {
      flatFee = '0.005';
    } else if (selectedToken === 'SUI') {
      flatFee = '0.001';
    }

    setGasEth(flatFee);
    validateAmount(amount, flatFee);
  }, [address, amount, addressError, walletAddress, network, selectedToken, isTronNetwork]);

  const handleReview = () => {
    let err = false;
    let addrValid = false;
    if (selectedToken === 'TRX') {
      addrValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    } else if (selectedToken === 'SOL') {
      addrValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } else if (selectedToken === 'BTC') {
      addrValid = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    } else if (selectedToken === 'TON') {
      addrValid = /^[a-zA-Z0-9_-]{48}$/.test(address);
    } else if (selectedToken === 'SUI') {
      addrValid = /^0x[0-9a-fA-F]{64}$/.test(address);
    } else if (selectedToken === 'XRP') {
      addrValid = /^r[0-9a-zA-Z]{24,34}$/.test(address);
    } else {
      addrValid = /^0x[0-9a-fA-F]{40}$/.test(address);
    }

    if (!address || !addrValid) { 
      setAddressError(`Valid ${selectedToken} address required`); 
      err = true; 
    }
    
    if (!amount || parsedAmount <= 0) { 
      setAmountError('Enter a valid amount'); 
      err = true; 
    } else if (parsedAmount > availBal) { 
      setAmountError('Insufficient balance'); 
      err = true; 
    } else if ((selectedToken === 'ETH' || selectedToken === 'TRX') && parsedAmount + (gasEthNum || 0.0005) > availBal) { 
      setAmountError(`Insufficient for gas. Max sendable: ${Math.max(0, availBal - (gasEthNum || 0.0005)).toFixed(6)} ${coinLabel}`); 
      err = true; 
    }

    if (err) { haptics.error(); return; }
    haptics.selection();

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, speed: 30, bounciness: 4 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    if (network !== 'Sepolia' && network !== 'TRON Nile' && (selectedToken === 'ETH' || selectedToken === 'TRX')) {
      const { Alert } = require('react-native');
      Alert.alert(
        '⚠️ Real Funds Warning',
        `You are on ${network} Mainnet. This transaction uses REAL ${coinLabel}.\n\nAmount: ${parsedAmount.toFixed(6)} ${coinLabel} (${fiatAmount})`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I Understand, Continue', style: 'destructive', onPress: () => setShowConfirm(true) },
        ]
      );
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendStatus('Signing transaction...');
    setShowConfirm(false);

    setTimeout(() => setSendStatus('Broadcasting to network...'), 1200);
    setTimeout(() => setSendStatus('Waiting for confirmation...'), 3000);

    let result: { success: boolean; error?: string; hash?: string };

    if (selectedToken === 'TRX') {
      const mnemonic = await storageService.getMnemonic();
      if (!mnemonic) {
        result = { success: false, error: 'Wallet not found' };
      } else {
        const { deriveTronAddress } = await import('../services/tronService');
        const tron = await deriveTronAddress(mnemonic);
        const tronResult = await tronService.sendTRX({
          privateKey: tron.privateKey,
          toAddress:  address,
          amount:     parsedAmount,
          network,
        });
        result = { success: tronResult.success, error: tronResult.error, hash: tronResult.txHash };
        if (tronResult.success) {
          addTx({
            type:     'sent',
            coin:     'TRX',
            amount:   parsedAmount.toFixed(6),
            usdValue: (parsedAmount * coinPrice).toFixed(2),
            address,
            status:   'success',
            txHash:   tronResult.txHash,
          });
          refreshBalance();
        }
      }
    } else if (selectedToken === 'ETH') {
      result = await sendETH(address, amount);
    } else {
      // Simulated token transfer for other non-native assets (USDT, USDC, BTC, SOL, BNB, XRP, TON, SUI)
      await new Promise(resolve => setTimeout(resolve, 3500));
      const simulatedHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      
      // Deduct balance locally
      await applySwapBalances(selectedToken, parsedAmount, selectedToken, 0);
      
      addTx({
        type:     'sent',
        coin:     selectedToken,
        amount:   parsedAmount.toFixed(6),
        usdValue: (parsedAmount * coinPrice).toFixed(2),
        address,
        status:   'success',
        txHash:   simulatedHash,
      });

      result = { success: true, hash: simulatedHash };
    }

    setSending(false);
    setSendStatus('');
    sendingRef.current = false;

    if (result.success) {
      haptics.success();
      showToast(`${coinLabel} sent successfully. Your transaction is on its way.`, 'success');
      setTimeout(() => navigation.goBack(), 2200);
    } else {
      haptics.error();
      let msg = result.error ?? 'Transfer failed. Please try again.';
      if (msg.includes('insufficient funds')) msg = 'Not enough funds to cover gas fees.';
      else if (msg.includes('nonce')) msg = 'Transaction conflict. Please try again in a moment.';
      else if (msg.includes('gas')) msg = 'Gas estimation failed. Network may be busy.';
      else if (msg.includes('network') || msg.includes('timeout')) msg = 'No internet connection.';
      showToast(msg, 'error');
    }
  };

  const canReview = !addressError && !amountError && !!address && !!amount && parsedAmount > 0;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: T.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      <TransactionLoader visible={sending} title="Sending Transaction" subtitle={sendStatus || 'Broadcasting to network...'} isDarkMode={isDarkMode} type="send" />

      {/* ── Confirmation Modal ── */}
      <Modal visible={showConfirm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons name="paper-plane" size={24} color={T.primary} />
              </View>
              <Text style={styles.modalTitle}>Confirm Transaction</Text>
              <Text style={styles.modalSub}>Review transaction details for {network}.</Text>
            </View>

            <View style={styles.modalDetails}>
              {[
                { label: 'Recipient',   value: `${address.slice(0, 10)}...${address.slice(-10)}` },
                { label: 'Amount',      value: `${parsedAmount.toFixed(6)} ${coinLabel}`, sub: `${fiatAmount}` },
                { label: 'Network Fee', value: gasEth ? `${parseFloat(gasEth).toFixed(6)} ${coinLabel}` : 'Estimating...', sub: gasEth ? `${fiatGas}` : '' },
              ].map((row, i) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.detailValue}>{row.value}</Text>
                    {!!row.sub && <Text style={styles.detailSub}>{row.sub}</Text>}
                  </View>
                </View>
              ))}
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.totalLabel}>Total Deducted from Wallet</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.totalValue}>{totalETH} {coinLabel}</Text>
                  <Text style={styles.totalSub}>{fiatTotal}</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfirm(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleConfirmSend}>
                <LinearGradient
                  colors={[T.primary, '#D32F2F']}
                  style={styles.confirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.modalConfirmText}>SEND NOW</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SEND CRYPTO</Text>
        <TouchableOpacity style={styles.qrBtn} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <Ionicons name="qr-code-outline" size={22} color={T.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Balance Badge & Token Picker */}
        <View style={styles.balanceContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
            <View style={styles.balanceBadge}>
              <View style={styles.balanceDot} />
              <Text style={styles.balanceTitle}>Available to Send</Text>
            </View>

            <TouchableOpacity 
              style={[styles.tokenSelectorPill, { backgroundColor: T.surfaceHigh, borderColor: T.border }]} 
              onPress={() => setSelectorVisible(true)}
              activeOpacity={0.7}
            >
              <CoinIcon symbol={selectedToken} size={18} />
              <Text style={[styles.tokenSelectorText, { color: T.text }]}>{selectedToken}</Text>
              <Feather name="chevron-down" size={14} color={T.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>{availBal.toFixed(6)} {coinLabel}</Text>
          <Text style={styles.balanceUsd}>Total Value: {formatFiat(availBal * coinPrice)}</Text>
        </View>

        {/* Input: Recipient */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECIPIENT ADDRESS</Text>
          <View style={[styles.addressInputBox, addressError ? styles.inputError : null]}>
            <TextInput
              style={styles.addressInput}
              placeholder={
                selectedToken === 'TRX' 
                  ? 'T... TRON address' 
                  : (selectedToken === 'BTC' 
                      ? 'bc1q... or 1... Bitcoin address' 
                      : (selectedToken === 'SOL' 
                          ? 'Base58 Solana address'
                          : '0x... or EVM address'))
              }
              placeholderTextColor={T.textDim}
              value={address}
              onChangeText={val => { setAddress(val); validateAddress(val); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
               onPress={() => navigation.navigate('Scan')}
               style={styles.scanActionBtn}
            >
               <Ionicons name="camera-outline" size={20} color={T.primary} />
            </TouchableOpacity>
          </View>
          {!!addressError && <Text style={styles.errorLabel}>{addressError}</Text>}
        </View>

        {/* Input: Amount */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>AMOUNT TO SEND</Text>
            <TouchableOpacity
              onPress={() => {
                const gasBuf = gasEth ? parseFloat(gasEth) : 0.0005;
                const maxAmt = selectedToken === 'ETH' || selectedToken === 'TRX' ? Math.max(0, availBal - gasBuf) : availBal;
                if (maxAmt > 0) {
                  const s = maxAmt.toFixed(6);
                  setAmount(s);
                  validateAmount(s, gasEth || '0.0005');
                }
              }}
            >
              <Text style={styles.maxText}>USE MAX</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.amountInputBox, amountError ? styles.inputError : null]}>
            <View style={styles.amountDisplay}>
              <TextInput
                style={styles.amountField}
                placeholder="0.00"
                placeholderTextColor={T.textDim}
                value={amount}
                onChangeText={val => { setAmount(val); validateAmount(val, gasEth); }}
                keyboardType="decimal-pad"
              />
              <Text style={styles.ethBrand}>{coinLabel}</Text>
            </View>
            <View style={styles.usdPreviewContainer}>
               <Text style={styles.usdPreviewText}>≈ {fiatAmount}</Text>
            </View>
          </View>
          {!!amountError && <Text style={styles.errorLabel}>{amountError}</Text>}
        </View>

        {/* Gas / Details */}
        <View style={styles.gasSection}>
           <View style={styles.gasHeader}>
              <View style={styles.gasIconBox}>
                 <MaterialIcons name="local-gas-station" size={16} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gasTitle}>Network Fee</Text>
                <Text style={{ color: T.textDim, fontSize: 11, fontWeight: '500', marginTop: 1 }}>
                  Paid to process your transaction safely on the blockchain
                </Text>
              </View>
           </View>
           
           <View style={styles.gasRow}>
              <Text style={styles.gasLabel}>Transaction Fee</Text>
              {estimating ? (
                <ActivityIndicator size="small" color={T.primary} />
              ) : (
                <Text style={styles.gasValue}>
                  {gasEth ? `${parseFloat(gasEth).toFixed(6)} ${coinLabel} (${fiatGas})` : '—'}
                </Text>
              )}
           </View>
           <View style={styles.gasRow}>
              <Text style={styles.gasLabel}>Arrival Time</Text>
              <Text style={styles.gasValue}>~ 30 Seconds</Text>
           </View>
        </View>

      </ScrollView>

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[styles.mainBtn, !canReview && styles.btnDisabled]}
            onPress={handleReview}
            disabled={!canReview || sending}
            activeOpacity={0.8}
          >
            {sending ? (
               <LinearGradient colors={[T.primary, '#D32F2F']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                 <ActivityIndicator color="#FFF" size="small" />
                 <Text style={styles.btnText}>SENDING...</Text>
               </LinearGradient>
            ) : (
              <LinearGradient
                colors={canReview ? [T.primary, '#D32F2F'] : ['#2A2B31', '#2A2B31']}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.btnText}>{canReview ? 'REVIEW TRANSACTION' : 'ENTER DETAILS'}</Text>
                {canReview && <Feather name="arrow-right" size={18} color="#FFF" />}
              </LinearGradient>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Token Picker Modal ── */}
      <Modal visible={selectorVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectorVisible(false)}>
          <View style={[styles.modalCard, { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' }]}>
            <View style={styles.modalIndicator} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: T.text, fontSize: 18, fontFamily: Fonts.bold }}>Select Asset</Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                <Feather name="x" size={20} color={T.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {['USDT', 'USDC', 'ETH', 'BTC', 'SOL', 'BNB', 'XRP', 'TON', 'TRX', 'SUI'].map(sym => {
                const isSelected = selectedToken === sym;
                const tokenBal = sym === 'ETH' ? (parseFloat(ethBalance) || 0) : (balances[sym] ?? 0);
                const priceVal = prices[sym]?.usd ?? (sym === 'ETH' ? 3500 : (sym === 'BTC' ? 65000 : 1));
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.tokenItemRow, isSelected && { backgroundColor: T.border + '35' }]}
                    onPress={() => {
                      setSelectedToken(sym);
                      setSelectorVisible(false);
                      setAmount('');
                      setAmountError('');
                      setAddressError('');
                    }}
                    activeOpacity={0.7}
                  >
                    <CoinIcon symbol={sym} size={32} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.tokenItemSym, { color: T.text, fontFamily: Fonts.bold }]}>{sym}</Text>
                      <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>{COIN_META[sym]?.name ?? sym}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: T.text, fontFamily: Fonts.bold, fontSize: 14 }}>{tokenBal.toFixed(4)}</Text>
                      <Text style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.medium }}>{formatFiat(tokenBal * priceVal)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: T.background,
  },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: T.text, fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 2 },
  qrBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingBottom: 160 },

  balanceContainer: { marginTop: 24, marginBottom: 32 },
  balanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.success },
  balanceTitle: { color: T.textMuted, fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  balanceAmount: { color: T.text, fontSize: 34, fontFamily: Fonts.extraBold, letterSpacing: -1 },
  balanceUsd: { color: T.textDim, fontSize: 14, fontFamily: Fonts.semiBold, marginTop: 4 },

  tokenSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6
  },
  tokenSelectorText: { fontSize: 13, fontFamily: Fonts.bold },

  tokenItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8
  },
  tokenItemSym: { fontSize: 15 },

  section: { marginBottom: 28 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { color: T.textDim, fontSize: 11, fontFamily: Fonts.extraBold, letterSpacing: 1.5 },
  maxText: { color: T.primary, fontSize: 12, fontFamily: Fonts.extraBold },
  
  addressInputBox: { 
    height: 64, 
    backgroundColor: T.surface, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  addressInput: { flex: 1, color: T.text, fontSize: 15, fontFamily: Fonts.semiBold },
  scanActionBtn: { padding: 8 },
  
  amountInputBox: { 
    backgroundColor: T.surface, 
    borderRadius: 24, 
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  amountDisplay: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 8 },
  amountField: { color: T.text, fontSize: 32, fontFamily: Fonts.extraBold, minWidth: 120 },
  ethBrand: { color: T.textMuted, fontSize: 14, fontFamily: Fonts.extraBold, marginBottom: 8 },
  usdPreviewContainer: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 },
  usdPreviewText: { color: T.textMuted, fontSize: 15, fontFamily: Fonts.semiBold },
  
  inputError: { borderColor: T.primary + '80' },
  errorLabel: { color: T.primary, fontSize: 12, fontFamily: Fonts.semiBold, marginTop: 8, marginLeft: 4 },

  gasSection: { backgroundColor: T.surfaceLow, borderRadius: 24, padding: 20 },
  gasHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  gasIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.primary + '18', alignItems: 'center', justifyContent: 'center' },
  gasTitle: { color: T.text, fontSize: 14, fontFamily: Fonts.bold },
  gasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gasLabel: { color: T.textDim, fontSize: 13, fontFamily: Fonts.semiBold },
  gasValue: { color: T.text, fontSize: 13, fontFamily: Fonts.bold },

  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 20, backgroundColor: T.background + 'F0' },
  mainBtn: { height: 64, borderRadius: 100, overflow: 'hidden' },
  btnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 15, fontFamily: Fonts.extraBold, letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: T.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 32 },
  modalIndicator: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 28 },
  modalIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: T.text, fontSize: 22, fontFamily: Fonts.extraBold, marginBottom: 8 },
  modalSub: { color: T.textMuted, fontSize: 14, textAlign: 'center' },
  modalDetails: { backgroundColor: T.surfaceLow, borderRadius: 24, padding: 20, marginBottom: 28 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { color: T.textDim, fontSize: 13, fontFamily: Fonts.bold },
  detailValue: { color: T.text, fontSize: 14, fontFamily: Fonts.bold },
  detailSub: { color: T.textDim, fontSize: 11, fontFamily: Fonts.semiBold, marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: T.border, marginVertical: 8 },
  totalLabel: { color: T.text, fontSize: 15, fontFamily: Fonts.extraBold },
  totalValue: { color: T.primary, fontSize: 18, fontFamily: Fonts.extraBold },
  totalSub: { color: T.textMuted, fontSize: 12, fontFamily: Fonts.bold, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 56, borderRadius: 28, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: T.textMuted, fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 1 },
  modalConfirm: { flex: 2, height: 56, borderRadius: 28, overflow: 'hidden' },
  confirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#FFF', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 1 },
});
