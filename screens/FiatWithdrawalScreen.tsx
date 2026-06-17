import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, StatusBar, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import Toast from '../components/Toast';
import { fiatRequestService } from '../services/supabaseService';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

const CRYPTO_ASSETS = ['USDT', 'USDC', 'ETH', 'BTC'];
const FIAT_CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'INR'];

export default function FiatWithdrawalScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, walletAddress, balances } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [cryptoAsset, setCryptoAsset] = useState('USDT');
  const [fiatCurrency, setFiatCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  
  // Bank details form
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Get user balance for the selected asset
  const balance = useMemo(() => {
    if (!balances) return 0;
    return balances[cryptoAsset] || 0;
  }, [balances, cryptoAsset]);

  // Convert crypto to fiat estimate
  const fiatEstimate = useMemo(() => {
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) return '0.00';
    
    // Check asset price in USD
    const usdPrice = prices?.[cryptoAsset]?.usd || 1;
    const valueUsd = amtNum * usdPrice;
    
    // Conversions from USD to other fiat currencies
    const fiatRates: Record<string, number> = {
      USD: 1.0,
      AED: 3.6725,
      EUR: 0.92,
      GBP: 0.78,
      INR: 83.50
    };
    const rate = fiatRates[fiatCurrency] || 1.0;
    return (valueUsd * rate).toFixed(2);
  }, [amount, cryptoAsset, fiatCurrency, prices]);

  const handleSubmit = async () => {
    if (!walletAddress) return;
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      showToast('Please enter a valid crypto quantity', 'error');
      haptics.error();
      return;
    }
    if (amtNum > balance) {
      showToast(`Insufficient balance. You only have ${balance} ${cryptoAsset}`, 'error');
      haptics.error();
      return;
    }
    if (!accountName.trim() || !bankName.trim() || !accountNumber.trim()) {
      showToast('Please complete all required bank fields', 'error');
      haptics.error();
      return;
    }

    setSubmitting(true);
    haptics.selection();

    try {
      const bankDetails = {
        accountName: accountName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        swiftCode: swiftCode.trim() || undefined,
        notes: notes.trim() || undefined
      };

      const res = await fiatRequestService.submitWithdrawal(
        walletAddress,
        cryptoAsset,
        fiatCurrency,
        amtNum,
        bankDetails
      );

      haptics.success();
      setSuccessTicket(res.ticket_id);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit withdrawal request', 'error');
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: T.border }]}>
        <TouchableOpacity
          onPress={() => { haptics.selection(); navigation.goBack(); }}
          style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
        >
          <Feather name="chevron-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Fiat Withdrawal</Text>
        <View style={{ width: 44 }} />
      </View>

      {successTicket ? (
        // Success View
        <View style={styles.successContainer}>
          <View style={[styles.successIconBox, { backgroundColor: T.success + '18', borderColor: T.success }]}>
            <Feather name="check-circle" size={48} color={T.success} />
          </View>
          <Text style={[styles.successTitle, { color: T.text }]}>Withdrawal Submitted</Text>
          <Text style={[styles.successSub, { color: T.textMuted }]}>
            Your crypto assets have been debited and are held in escrow. The admin desk is processing your manual wire payout.
          </Text>

          <View style={[styles.ticketCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Text style={[styles.ticketLabel, { color: T.textMuted }]}>TICKET NUMBER</Text>
            <Text style={[styles.ticketId, { color: T.primary }]}>{successTicket}</Text>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: T.text }]}
            onPress={() => { haptics.selection(); navigation.navigate('History'); }}
          >
            <Text style={[styles.btnPrimaryText, { color: T.background }]}>Go to History</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Form View
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Section 1: Sell Crypto */}
          <Text style={[styles.sectionTitle, { color: T.text }]}>1. Sell Crypto Asset</Text>
          <View style={styles.selectorRow}>
            {CRYPTO_ASSETS.map((asset) => {
              const selected = cryptoAsset === asset;
              return (
                <TouchableOpacity
                  key={asset}
                  onPress={() => { haptics.selection(); setCryptoAsset(asset); }}
                  style={[
                    styles.selectorBtn,
                    {
                      borderColor: selected ? T.primary : T.border,
                      backgroundColor: selected ? T.primary + '10' : T.surface
                    }
                  ]}
                >
                  <Text style={[styles.selectorText, { color: selected ? T.primary : T.text, fontFamily: Fonts.bold }]}>{asset}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Balance Display */}
          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceLabel, { color: T.textDim }]}>Available Balance:</Text>
            <TouchableOpacity onPress={() => { haptics.selection(); setAmount(balance.toString()); }}>
              <View style={[styles.maxBadge, { borderColor: T.primary + '30', backgroundColor: T.primary + '0a' }]}>
                <Text style={[styles.maxBadgeText, { color: T.primary }]}>
                  {balance.toFixed(6)} {cryptoAsset} (Max)
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Section 2: Payout Currency */}
          <Text style={[styles.sectionTitle, { color: T.text, marginTop: 12 }]}>2. Receive Payout Currency</Text>
          <View style={styles.selectorRow}>
            {FIAT_CURRENCIES.map((fiat) => {
              const selected = fiatCurrency === fiat;
              return (
                <TouchableOpacity
                  key={fiat}
                  onPress={() => { haptics.selection(); setFiatCurrency(fiat); }}
                  style={[
                    styles.selectorBtn,
                    {
                      borderColor: selected ? T.primary : T.border,
                      backgroundColor: selected ? T.primary + '10' : T.surface
                    }
                  ]}
                >
                  <Text style={[styles.selectorText, { color: selected ? T.primary : T.text, fontFamily: Fonts.bold }]}>{fiat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section 3: Sell quantity */}
          <Text style={[styles.sectionTitle, { color: T.text, marginTop: 20 }]}>3. Quantity to Sell</Text>
          <View style={[styles.inputContainer, { borderColor: T.border, backgroundColor: T.surface }]}>
            <TextInput
              style={[styles.input, { color: T.text }]}
              placeholder="0.00"
              placeholderTextColor={T.textDim}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={[styles.suffix, { color: T.textDim }]}>{cryptoAsset}</Text>
          </View>

          {/* Calculator estimate */}
          <View style={[styles.estimateBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Text style={[styles.estimateLabel, { color: T.textDim }]}>Estimated Fiat Payout:</Text>
            <Text style={[styles.estimateValue, { color: T.success, fontFamily: Fonts.bold }]}>
              {fiatEstimate} {fiatCurrency}
            </Text>
          </View>

          {/* Section 4: Bank account details */}
          <Text style={[styles.sectionTitle, { color: T.text, marginTop: 24, marginBottom: 8 }]}>4. Bank Payout Details</Text>
          
          <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border, padding: 16, gap: 14 }]}>
            
            <View>
              <Text style={[styles.subLabel, { color: T.textDim }]}>Account Holder Name *</Text>
              <TextInput
                style={[styles.brutalInput, { borderColor: T.border, color: T.text, backgroundColor: T.background }]}
                placeholder="John Doe"
                placeholderTextColor={T.textDim}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            <View>
              <Text style={[styles.subLabel, { color: T.textDim }]}>Bank Name *</Text>
              <TextInput
                style={[styles.brutalInput, { borderColor: T.border, color: T.text, backgroundColor: T.background }]}
                placeholder="e.g. JPMorgan Chase / Emirates NBD"
                placeholderTextColor={T.textDim}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            <View>
              <Text style={[styles.subLabel, { color: T.textDim }]}>IBAN / Account Number *</Text>
              <TextInput
                style={[styles.brutalInput, { borderColor: T.border, color: T.text, backgroundColor: T.background }]}
                placeholder="AE000000000000000000000"
                placeholderTextColor={T.textDim}
                value={accountNumber}
                onChangeText={setAccountNumber}
              />
            </View>

            <View>
              <Text style={[styles.subLabel, { color: T.textDim }]}>SWIFT / BIC Code (Optional)</Text>
              <TextInput
                style={[styles.brutalInput, { borderColor: T.border, color: T.text, backgroundColor: T.background }]}
                placeholder="e.g. CHASUS33"
                placeholderTextColor={T.textDim}
                value={swiftCode}
                onChangeText={setSwiftCode}
              />
            </View>

            <View>
              <Text style={[styles.subLabel, { color: T.textDim }]}>Additional Wire Notes (Optional)</Text>
              <TextInput
                style={[
                  styles.brutalInput, 
                  { 
                    borderColor: T.border, 
                    color: T.text, 
                    backgroundColor: T.background, 
                    height: 80, 
                    textAlignVertical: 'top', 
                    paddingVertical: 12 
                  }
                ]}
                placeholder="e.g. Intermediary bank routing, memo info..."
                placeholderTextColor={T.textDim}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>

          {/* Compliance warnings */}
          <View style={[styles.warningBox, { backgroundColor: T.pending + '0a', borderColor: T.pending + '40' }]}>
            <Feather name="shield" size={16} color={T.pending} style={{ marginTop: 2 }} />
            <Text style={[styles.warningText, { color: T.textDim }]}>
              Funds are held in escrow instantly. Verification and wire transfers are processed during business days and typically arrive in 1-2 banking days. Ensure the target account belongs to you.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.btnSubmit,
              { backgroundColor: submitting ? T.surfaceLow : T.text, borderColor: T.border }
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={T.text} />
            ) : (
              <Text style={[styles.btnSubmitText, { color: T.background }]}>Submit Withdrawal Request</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.extraBold },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 14, fontFamily: Fonts.extraBold, marginBottom: 12 },
  subLabel: { fontSize: 10, fontFamily: Fonts.extraBold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  selectorBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  selectorText: { fontSize: 13 },
  balanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  balanceLabel: { fontSize: 12, fontFamily: Fonts.medium },
  maxBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1.5 },
  maxBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 2, paddingHorizontal: 16 },
  suffix: { fontSize: 15, fontFamily: Fonts.bold, marginLeft: 8 },
  input: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, padding: 0 },
  estimateBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 2, marginTop: 16 },
  estimateLabel: { fontSize: 13, fontFamily: Fonts.bold },
  estimateValue: { fontSize: 16 },
  card: { borderRadius: 16, borderWidth: 2 },
  brutalInput: { height: 48, borderRadius: 12, borderWidth: 2, paddingHorizontal: 16, fontSize: 14, fontFamily: Fonts.semiBold },
  warningBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 20, marginBottom: 24 },
  warningText: { flex: 1, fontSize: 11, lineHeight: 16 },
  btnSubmit: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnSubmitText: { fontSize: 15, fontFamily: Fonts.extraBold },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successIconBox: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontFamily: Fonts.extraBold, marginBottom: 8, textAlign: 'center' },
  successSub: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  ticketCard: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', marginBottom: 36, width: '100%' },
  ticketLabel: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1, marginBottom: 4 },
  ticketId: { fontSize: 20, fontFamily: Fonts.extraBold },
  btnPrimary: { width: '100%', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontFamily: Fonts.extraBold },
});
