import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
  Animated, Modal, StatusBar,
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { ethereumService } from '../services/ethereumService';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../utils/haptics';

export default function SendScreen({ navigation, route }: any) {
  const { ethBalance, sendETH, isDarkMode, walletAddress, network } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = React.useMemo(() => makeStyles(T), [T]);

  const scannedAddr = route?.params?.scannedAddress ?? '';

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

  const ethPrice     = prices.ETH?.usd ?? 3450;
  const parsedAmount = parseFloat(amount) || 0;
  const gasEthNum    = parseFloat(gasEth) || 0;
  const totalETH     = (parsedAmount + gasEthNum).toFixed(6);
  const usdValue     = (parsedAmount * ethPrice).toFixed(2);
  const gasUSD       = (gasEthNum * ethPrice).toFixed(4);
  const totalUSD     = ((parsedAmount + gasEthNum) * ethPrice).toFixed(2);
  const availBal     = parseFloat(ethBalance) || 0;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const validateAddress = useCallback((val: string) => {
    if (!val) { setAddressError(''); return; }
    setAddressError(/^0x[0-9a-fA-F]{40}$/.test(val) ? '' : 'Invalid Ethereum address');
  }, []);

  const validateAmount = useCallback((val: string, currentGasEth?: string) => {
    if (!val) { setAmountError(''); return; }
    const p = parseFloat(val);
    if (isNaN(p) || p <= 0) { setAmountError('Enter a valid amount'); return; }
    if (p > availBal)        { setAmountError(`Exceeds balance (${availBal.toFixed(6)} ETH)`); return; }
    const gas = parseFloat(currentGasEth ?? gasEth) || 0.0005;
    if (p + gas > availBal)  { setAmountError(`Insufficient for gas. Max sendable: ${Math.max(0, availBal - gas).toFixed(6)} ETH`); return; }
    setAmountError('');
  }, [availBal, gasEth]);

  useEffect(() => {
    if (!address || !amount || addressError || !parsedAmount) {
      setGasEth('');
      return;
    }
    const t = setTimeout(async () => {
      setEstimating(true);
      try {
        const { gasCostEth } = await ethereumService.estimateGas(walletAddress, address, amount, network);
        setGasEth(gasCostEth);
        // Re-validate amount now that we have a real gas estimate
        validateAmount(amount, gasCostEth);
      } catch (_e) {
        setGasEth('0.000042');
        validateAmount(amount, '0.000042');
      } finally {
        setEstimating(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [address, amount, addressError, walletAddress, network]);

  const handleReview = () => {
    let err = false;
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) { setAddressError('Valid Ethereum address required'); err = true; }
    if (!amount || parsedAmount <= 0)                       { setAmountError('Enter a valid amount'); err = true; }
    else if (parsedAmount > availBal)                       { setAmountError('Insufficient balance'); err = true; }
    else if (parsedAmount + (gasEthNum || 0.0005) > availBal) { setAmountError(`Insufficient for gas. Max sendable: ${Math.max(0, availBal - (gasEthNum || 0.0005)).toFixed(6)} ETH`); err = true; }
    if (err) { haptics.error(); return; }
    haptics.selection();

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, speed: 30, bounciness: 4 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    if (network !== 'Sepolia') {
      const { Alert } = require('react-native');
      Alert.alert(
        '⚠️ Real Funds Warning',
        `You are on ${network} Mainnet. This transaction uses REAL ETH.\n\nAmount: ${parsedAmount.toFixed(6)} ETH ($${usdValue})`,
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

    setTimeout(() => setSendStatus('Broadcasting to network...'), 1500);
    setTimeout(() => setSendStatus('Waiting for confirmation...'), 4000);

    const result = await sendETH(address, amount);
    setSending(false);
    setSendStatus('');
    sendingRef.current = false;

    if (result.success) {
      haptics.success();
      showToast(`ETH sent! Your transaction is on its way. ✓`, 'success');
      setTimeout(() => navigation.goBack(), 2200);
    } else {
      haptics.error();
      // Plain English error messages
      let msg = result.error ?? 'Transfer failed. Please try again.';
      if (msg.includes('insufficient funds')) msg = 'Not enough ETH to cover gas fees. Add more ETH to your wallet.';
      else if (msg.includes('nonce')) msg = 'Transaction conflict. Please try again in a moment.';
      else if (msg.includes('gas')) msg = 'Gas estimation failed. Network may be busy. Try again.';
      else if (msg.includes('network') || msg.includes('timeout')) msg = 'No internet connection. Check your connection and try again.';
      showToast(msg, 'error');
    }
  };

  const canReview = !addressError && !amountError && !!address && !!amount && parsedAmount > 0;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: T.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />

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
                { label: 'Amount',      value: `${parsedAmount.toFixed(6)} ETH`, sub: `$${usdValue}` },
                { label: 'Network Fee', value: gasEth ? `${parseFloat(gasEth).toFixed(6)} ETH` : 'Estimating...', sub: gasEth ? `$${gasUSD}` : '' },
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
                  <Text style={styles.totalValue}>{totalETH} ETH</Text>
                  <Text style={styles.totalSub}>${totalUSD}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SEND CRYPTO</Text>
        <TouchableOpacity style={styles.qrBtn} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <Ionicons name="qr-code-outline" size={22} color={T.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Balance Badge */}
        <View style={styles.balanceContainer}>
          <View style={styles.balanceBadge}>
            <View style={styles.balanceDot} />
            <Text style={styles.balanceTitle}>Available to Send</Text>
          </View>
          <Text style={styles.balanceAmount}>{availBal.toFixed(6)} ETH</Text>
          <Text style={styles.balanceUsd}>Total Balance: ${(availBal * ethPrice).toFixed(2)}</Text>
        </View>

        {/* Input: Recipient */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECIPIENT ADDRESS</Text>
          <View style={[styles.addressInputBox, addressError ? styles.inputError : null]}>
            <TextInput
              style={styles.addressInput}
              placeholder="0x... or ENS domain"
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
                const maxAmt = Math.max(0, availBal - gasBuf);
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
              <Text style={styles.ethBrand}>ETH</Text>
            </View>
            <View style={styles.usdPreviewContainer}>
               <Text style={styles.usdPreviewText}>≈ ${usdValue}</Text>
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
                  A small fee paid to process your transaction on the blockchain
                </Text>
              </View>
           </View>
           
           <View style={styles.gasRow}>
              <Text style={styles.gasLabel}>Transaction Fee</Text>
              {estimating ? (
                <ActivityIndicator size="small" color={T.primary} />
              ) : (
                <Text style={styles.gasValue}>
                  {gasEth ? `${parseFloat(gasEth).toFixed(6)} ETH ($${gasUSD})` : '—'}
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
      <View style={styles.actionBar}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[styles.mainBtn, !canReview && styles.btnDisabled]}
            onPress={handleReview}
            disabled={!canReview || sending}
            activeOpacity={0.8}
          >
            {sending ? (
               <View style={{ alignItems: 'center', gap: 6 }}>
                 <ActivityIndicator color="#FFF" />
                 {!!sendStatus && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>{sendStatus}</Text>}
               </View>
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
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20,
  },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: T.text, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  qrBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingBottom: 140 },

  balanceContainer: { marginTop: 24, marginBottom: 32 },
  balanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  balanceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.success },
  balanceTitle: { color: T.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  balanceAmount: { color: T.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  balanceUsd: { color: T.textDim, fontSize: 14, fontWeight: '600', marginTop: 4 },

  section: { marginBottom: 28 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { color: T.textDim, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  maxText: { color: T.primary, fontSize: 12, fontWeight: '800' },
  
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
  addressInput: { flex: 1, color: T.text, fontSize: 15, fontWeight: '600' },
  scanActionBtn: { padding: 8 },
  
  amountInputBox: { 
    backgroundColor: T.surface, 
    borderRadius: 24, 
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  amountDisplay: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 8 },
  amountField: { color: T.text, fontSize: 32, fontWeight: '800', minWidth: 120 },
  ethBrand: { color: T.textMuted, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  usdPreviewContainer: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 },
  usdPreviewText: { color: T.textMuted, fontSize: 15, fontWeight: '600' },
  
  inputError: { borderColor: T.primary + '80' },
  errorLabel: { color: T.primary, fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4 },

  gasSection: { backgroundColor: T.surfaceLow, borderRadius: 24, padding: 20 },
  gasHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  gasIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.primary + '18', alignItems: 'center', justifyContent: 'center' },
  gasTitle: { color: T.text, fontSize: 14, fontWeight: '700' },
  gasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gasLabel: { color: T.textDim, fontSize: 13, fontWeight: '600' },
  gasValue: { color: T.text, fontSize: 13, fontWeight: '700' },

  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 20, backgroundColor: T.background + 'F0' },
  mainBtn: { height: 64, borderRadius: 100, overflow: 'hidden' },
  btnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: T.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 50 : 32 },
  modalIndicator: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 28 },
  modalIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  modalSub: { color: T.textMuted, fontSize: 14, textAlign: 'center' },
  modalDetails: { backgroundColor: T.surfaceLow, borderRadius: 24, padding: 20, marginBottom: 28 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { color: T.textDim, fontSize: 13, fontWeight: '700' },
  detailValue: { color: T.text, fontSize: 14, fontWeight: '700' },
  detailSub: { color: T.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: T.border, marginVertical: 8 },
  totalLabel: { color: T.text, fontSize: 15, fontWeight: '800' },
  totalValue: { color: T.primary, fontSize: 18, fontWeight: '900' },
  totalSub: { color: T.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 56, borderRadius: 28, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: T.textMuted, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  modalConfirm: { flex: 2, height: 56, borderRadius: 28, overflow: 'hidden' },
  confirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
