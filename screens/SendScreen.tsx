import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
  Animated, Modal,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { ethereumService } from '../services/ethereumService';
import { Theme } from '../constants';
import Toast from '../components/Toast';

export default function SendScreen({ navigation, route }: any) {
  const { ethBalance, sendETH, isDarkMode, prices, walletAddress, network } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const scannedAddr = route?.params?.scannedAddress ?? '';
  const scannedNet  = route?.params?.scannedNetwork ?? '';

  const [address, setAddress]           = useState(scannedAddr);
  const [scannedNetwork, setScannedNetwork] = useState(scannedNet);
  const [amount, setAmount]             = useState('');
  const [estimating, setEstimating]     = useState(false);
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError]   = useState('');
  const [gasEth, setGasEth]             = useState('');
  const [showConfirm, setShowConfirm]   = useState(false);
  const [sending, setSending]           = useState(false);
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const btnScale   = useRef(new Animated.Value(1)).current;
  const sendingRef = useRef(false); // double-tap guard

  useEffect(() => {
    if (scannedAddr) validateAddress(scannedAddr);
  }, []);

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

  const validateAmount = useCallback((val: string) => {
    if (!val) { setAmountError(''); return; }
    const p = parseFloat(val);
    if (isNaN(p) || p <= 0) { setAmountError('Enter a valid amount'); return; }
    if (p > availBal)        { setAmountError(`Exceeds balance (${availBal.toFixed(6)} ETH)`); return; }
    setAmountError('');
  }, [availBal]);

  // Fetch real gas estimate when address + amount are valid
  useEffect(() => {
    if (!address || !amount || addressError || amountError || !parsedAmount) {
      setGasEth('');
      return;
    }
    const t = setTimeout(async () => {
      setEstimating(true);
      try {
        const { gasCostEth } = await ethereumService.estimateGas(walletAddress, address, amount, network);
        setGasEth(gasCostEth);
      } catch {
        setGasEth('0.000042');
      } finally {
        setEstimating(false);
      }
    }, 600); // debounce
    return () => clearTimeout(t);
  }, [address, amount, addressError, amountError, walletAddress, network]);

  const handleReview = () => {
    let err = false;
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) { setAddressError('Valid Ethereum address required'); err = true; }
    if (!amount || parsedAmount <= 0)                       { setAmountError('Enter a valid amount'); err = true; }
    else if (parsedAmount > availBal)                       { setAmountError('Insufficient balance'); err = true; }
    if (err) return;

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, speed: 30, bounciness: 4 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    // Extra warning on mainnet — real funds at risk
    if (network !== 'Sepolia') {
      const { Alert } = require('react-native');
      Alert.alert(
        '⚠️ Real Funds Warning',
        `You are on ${network} Mainnet. This transaction uses REAL ETH and cannot be reversed.\n\nAmount: ${parsedAmount.toFixed(6)} ETH ($${usdValue})`,
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
    if (sendingRef.current) return; // double-tap guard
    sendingRef.current = true;
    setSending(true);
    setShowConfirm(false);

    const result = await sendETH(address, amount);
    setSending(false);
    sendingRef.current = false;

    if (result.success) {
      showToast(`✓ Sent! Tx: ${result.hash?.slice(0, 14)}...`, 'success');
      setTimeout(() => navigation.goBack(), 2200);
    } else {
      showToast(result.error ?? 'Transfer failed. Please try again.', 'error');
    }
  };

  const styles   = makeStyles(T);
  const canReview = !addressError && !amountError && !!address && !!amount && parsedAmount > 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* ── Confirmation Modal ── */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: T.primary + '18' }]}>
              <MaterialIcons name="send" size={28} color={T.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Confirm Transaction</Text>
            <Text style={[styles.modalSub, { color: T.textMuted }]}>Review before sending. This cannot be undone.</Text>

            <View style={[styles.modalDetails, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              {[
                { label: 'To',          value: `${address.slice(0, 10)}...${address.slice(-8)}` },
                { label: 'Amount',      value: `${parsedAmount.toFixed(6)} ETH  ($${usdValue})` },
                { label: 'Network Fee', value: gasEth ? `${parseFloat(gasEth).toFixed(6)} ETH  ($${gasUSD})` : 'Estimating...' },
                { label: 'Network',     value: network },
              ].map((row, i, arr) => (
                <View key={row.label} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}>
                  <Text style={[styles.detailLabel, { color: T.textMuted }]}>{row.label}</Text>
                  <Text style={[styles.detailValue, { color: T.text }]}>{row.value}</Text>
                </View>
              ))}
              <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={[styles.detailLabel, { color: T.text, fontWeight: '800' }]}>Total</Text>
                <Text style={[styles.detailValue, { color: T.primary, fontWeight: '800' }]}>{totalETH} ETH  (${totalUSD})</Text>
              </View>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.surfaceLow }]} onPress={() => setShowConfirm(false)}>
                <Text style={[styles.modalBtnText, { color: T.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} onPress={handleConfirmSend}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Send Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send ETH</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <MaterialIcons name="qr-code-scanner" size={24} color={T.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Network Badge for Scanned Address */}
        {!!scannedNetwork && (
          <View style={[styles.scannedNetBadge, { backgroundColor: T.primary + '15' }]}>
            <MaterialIcons name="lan" size={14} color={T.primary} />
            <Text style={[styles.scannedNetText, { color: T.primary }]}>Network: {scannedNetwork}</Text>
          </View>
        )}

        {/* Balance pill */}
        <View style={[styles.balancePill, { backgroundColor: T.surface, borderColor: T.border }]}>
          <MaterialIcons name="account-balance-wallet" size={16} color={T.primary} />
          <Text style={[styles.balancePillText, { color: T.textMuted }]}>
            Available: <Text style={{ color: T.text, fontWeight: '700' }}>{availBal.toFixed(6)} ETH</Text>
            {'  '}≈ <Text style={{ color: T.text, fontWeight: '700' }}>${(availBal * ethPrice).toFixed(2)}</Text>
          </Text>
        </View>

        {/* Recipient */}
        <Text style={styles.sectionLabel}>Recipient Address</Text>
        <View style={[styles.inputWrap, { borderColor: addressError ? T.error : T.border, backgroundColor: T.surface }]}>
          <View style={[styles.inputIconBox, { backgroundColor: (addressError ? T.error : T.primary) + '18' }]}>
            <Feather name="user" size={17} color={addressError ? T.error : T.primary} />
          </View>
          <TextInput
            style={[styles.inputAddr, { color: T.text }]}
            placeholder="0x... Ethereum address"
            placeholderTextColor={T.textDim}
            value={address}
            onChangeText={val => { setAddress(val); validateAddress(val); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {address.length > 0 ? (
            <TouchableOpacity onPress={() => { setAddress(''); setAddressError(''); }} style={{ padding: 6 }}>
              <Feather name="x" size={16} color={T.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Scan')}
              style={[styles.scanBtn, { backgroundColor: T.primary + '18' }]}
            >
              <Feather name="camera" size={16} color={T.primary} />
              <Text style={[styles.scanBtnText, { color: T.primary }]}>Scan</Text>
            </TouchableOpacity>
          )}
        </View>
        {!!addressError && <View style={styles.errorRow}><Feather name="alert-circle" size={12} color={T.error} /><Text style={[styles.errorText, { color: T.error }]}>{addressError}</Text></View>}

        {/* Amount */}
        <Text style={styles.sectionLabel}>Amount (ETH)</Text>
        <View style={[styles.amountWrap, { borderColor: amountError ? T.error : T.border, backgroundColor: T.surface }]}>
          <View style={styles.amountTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.amountCurrency, { color: T.text }]}>ETH</Text>
              {parsedAmount > 0 && <Text style={[styles.usdPreview, { color: T.textMuted }]}>≈ ${usdValue}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.maxBtn, { backgroundColor: T.primary + '18' }]}
              onPress={() => {
                // Subtract estimated gas so tx doesn't fail — fallback to 0.0005 ETH if not yet estimated
                const gasBuf = gasEth ? parseFloat(gasEth) : 0.0005;
                const maxAmt = Math.max(0, availBal - gasBuf);
                if (maxAmt <= 0) return;
                const maxStr = maxAmt.toFixed(6);
                setAmount(maxStr);
                validateAmount(maxStr);
              }}
            >
              <Text style={[styles.maxBtnText, { color: T.primary }]}>MAX</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.amountInput, { color: T.text }]}
            placeholder="0.00"
            placeholderTextColor={T.textMuted}
            value={amount}
            onChangeText={val => { setAmount(val); validateAmount(val); }}
            keyboardType="decimal-pad"
          />
        </View>
        {!!amountError && <View style={styles.errorRow}><Feather name="alert-circle" size={12} color={T.error} /><Text style={[styles.errorText, { color: T.error }]}>{amountError}</Text></View>}

        {/* Live Gas Estimate */}
        <View style={[styles.gasBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="local-gas-station" size={16} color={T.primary} />
            <Text style={[styles.gasLabel, { color: T.textMuted }]}>Live Network Fee</Text>
            {estimating && <ActivityIndicator size="small" color={T.primary} />}
          </View>
          <Text style={[styles.gasValue, { color: T.text }]}>
            {gasEth ? `${parseFloat(gasEth).toFixed(6)} ETH  ($${gasUSD})` : estimating ? 'Fetching...' : '—'}
          </Text>
        </View>

        {/* Summary */}
        {!!gasEth && parsedAmount > 0 && (
          <View style={[styles.summaryWrap, { backgroundColor: T.surface, borderColor: T.border }]}>
            {[
              { label: 'Amount',      value: `${parsedAmount.toFixed(6)} ETH` },
              { label: 'Network Fee', value: `${parseFloat(gasEth).toFixed(6)} ETH` },
            ].map(row => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[styles.summaryValue, { color: T.text }]}>{row.value}</Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: T.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelBold, { color: T.text }]}>Total</Text>
              <Text style={[styles.summaryValueBold, { color: T.primary }]}>{totalETH} ETH  (${totalUSD})</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: T.background }]}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canReview ? T.primary : T.surfaceLow, opacity: canReview ? 1 : 0.6 }]}
            onPress={handleReview}
            disabled={!canReview || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.submitBtnText}>Sending...</Text>
              </View>
            ) : (
              <Text style={[styles.submitBtnText, { color: canReview ? '#FFF' : T.textMuted }]}>
                {canReview ? 'Review & Send' : 'Fill in details above'}
              </Text>
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
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  scannedNetBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 10, marginBottom: -10 },
  scannedNetText: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { color: T.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 24, letterSpacing: 0.6 },

  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  balancePillText: { fontSize: 13, fontWeight: '500' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5 },
  inputIconBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  inputAddr: { flex: 1, fontSize: 14, fontWeight: '500' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  scanBtnText: { fontSize: 12, fontWeight: '700' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  errorText: { fontSize: 12, fontWeight: '600' },

  amountWrap: { borderRadius: 20, padding: 20, borderWidth: 1.5 },
  amountTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  amountCurrency: { fontSize: 17, fontWeight: '800' },
  usdPreview: { fontSize: 14, fontWeight: '500' },
  maxBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  maxBtnText: { fontSize: 12, fontWeight: '800' },
  amountInput: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },

  gasBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 16 },
  gasLabel: { fontSize: 13, fontWeight: '600' },
  gasValue: { fontSize: 13, fontWeight: '700' },

  summaryWrap: { borderRadius: 16, padding: 18, marginTop: 16, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  summaryLabel: { fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 10 },
  summaryLabelBold: { fontSize: 14, fontWeight: '700' },
  summaryValueBold: { fontSize: 15, fontWeight: '800' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  submitBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, borderWidth: 1 },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modalSub: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  modalDetails: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
