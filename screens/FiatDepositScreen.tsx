import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, StatusBar, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import Toast from '../components/Toast';
import { fiatRequestService } from '../services/supabaseService';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

const CRYPTO_ASSETS = ['USDT', 'USDC', 'ETH', 'BTC'];
const FIAT_CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'INR'];

export default function FiatDepositScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [cryptoAsset, setCryptoAsset] = useState('USDT');
  const [fiatCurrency, setFiatCurrency] = useState('AED');
  const [amount, setAmount] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const pickImage = async () => {
    haptics.selection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access camera roll is required!', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!walletAddress) return;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      showToast('Please enter a valid fiat amount', 'error');
      haptics.error();
      return;
    }
    if (!imageUri) {
      showToast('Please upload payment proof screenshot', 'error');
      haptics.error();
      return;
    }

    setSubmitting(true);
    setUploading(true);
    haptics.selection();

    try {
      // 1. Upload payment proof to storage bucket
      const mime = 'image/jpeg';
      const proofPath = await fiatRequestService.uploadProof(walletAddress, imageUri, mime);

      // 2. Submit Deposit Ticket
      const amtNum = parseFloat(amount);
      const res = await fiatRequestService.submitDeposit(
        walletAddress,
        fiatCurrency,
        cryptoAsset,
        amtNum,
        proofPath
      );

      haptics.success();
      setSuccessTicket(res.ticket_id);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit deposit request', 'error');
      haptics.error();
    } finally {
      setUploading(false);
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
        <Text style={[styles.headerTitle, { color: T.text }]}>Fiat Deposit</Text>
        <View style={{ width: 44 }} />
      </View>

      {successTicket ? (
        // Success View
        <View style={styles.successContainer}>
          <View style={[styles.successIconBox, { backgroundColor: T.success + '18', borderColor: T.success }]}>
            <Feather name="check-circle" size={48} color={T.success} />
          </View>
          <Text style={[styles.successTitle, { color: T.text }]}>Request Submitted!</Text>
          <Text style={[styles.successSub, { color: T.textMuted }]}>
            Your fiat deposit request is under review. Our team will verify the payment and credit your wallet.
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
          {/* Select Crypto */}
          <Text style={[styles.inputLabel, { color: T.text }]}>1. Receive Crypto Asset</Text>
          <View style={styles.selectorRow}>
            {CRYPTO_ASSETS.map((asset) => {
              const selected = cryptoAsset === asset;
              return (
                <TouchableOpacity
                  key={asset}
                  onPress={() => { haptics.selection(); setCryptoAsset(asset); }}
                  style={[
                    styles.selectorBtn,
                    { borderColor: selected ? T.primary : T.border, backgroundColor: selected ? T.primary + '12' : T.surface }
                  ]}
                >
                  <Text style={[styles.selectorText, { color: selected ? T.primary : T.text }]}>{asset}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Select Fiat */}
          <Text style={[styles.inputLabel, { color: T.text }]}>2. Pay With Fiat Currency</Text>
          <View style={styles.selectorRow}>
            {FIAT_CURRENCIES.map((fiat) => {
              const selected = fiatCurrency === fiat;
              return (
                <TouchableOpacity
                  key={fiat}
                  onPress={() => { haptics.selection(); setFiatCurrency(fiat); }}
                  style={[
                    styles.selectorBtn,
                    { borderColor: selected ? T.primary : T.border, backgroundColor: selected ? T.primary + '12' : T.surface }
                  ]}
                >
                  <Text style={[styles.selectorText, { color: selected ? T.primary : T.text }]}>{fiat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Enter Amount */}
          <Text style={[styles.inputLabel, { color: T.text }]}>3. Payment Amount ({fiatCurrency})</Text>
          <View style={[styles.inputContainer, { borderColor: T.border, backgroundColor: T.surface }]}>
            <Text style={[styles.prefix, { color: T.textMuted }]}>{fiatCurrency}</Text>
            <TextInput
              style={[styles.input, { color: T.text }]}
              placeholder="0.00"
              placeholderTextColor={T.textDim}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* Upload Proof */}
          <Text style={[styles.inputLabel, { color: T.text }]}>4. Upload Payment Proof</Text>
          <TouchableOpacity
            style={[styles.uploadBox, { borderColor: T.border, backgroundColor: T.surfaceLow }]}
            onPress={pickImage}
          >
            {imageUri ? (
              <View style={styles.proofPreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.proofPreview} />
                <View style={styles.changeImageOverlay}>
                  <Feather name="camera" size={20} color="#FFF" />
                  <Text style={styles.changeImageText}>Change Proof Screenshot</Text>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Feather name="image" size={32} color={T.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.uploadTitle, { color: T.text }]}>Upload Bank Receipt / Screenshot</Text>
                <Text style={[styles.uploadSub, { color: T.textMuted }]}>PNG, JPG images up to 5MB</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.warningBox, { backgroundColor: T.pending + '10', borderColor: T.pending + '50' }]}>
            <Feather name="alert-triangle" size={16} color={T.pending} style={{ marginTop: 2 }} />
            <Text style={[styles.warningText, { color: T.textMuted }]}>
              Deposits are processed manually. Only submit a request after sending the funds. Providing false proof of payment may result in account termination.
            </Text>
          </View>

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
              <Text style={[styles.btnSubmitText, { color: T.background }]}>Submit Deposit Request</Text>
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
  inputLabel: { fontSize: 14, fontFamily: Fonts.extraBold, marginBottom: 12, marginTop: 16 },
  selectorRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  selectorBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  selectorText: { fontSize: 13, fontFamily: Fonts.extraBold },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16 },
  prefix: { fontSize: 16, fontFamily: Fonts.bold, marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: Fonts.bold, padding: 0 },
  uploadBox: { height: 180, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadTitle: { fontSize: 13, fontFamily: Fonts.bold, marginBottom: 4 },
  uploadSub: { fontSize: 11, fontFamily: Fonts.medium },
  proofPreviewWrap: { width: '100%', height: '100%', position: 'relative' },
  proofPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  changeImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  changeImageText: { color: '#FFF', fontSize: 11, fontFamily: Fonts.bold },
  warningBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 20, marginBottom: 24 },
  warningText: { flex: 1, fontSize: 11, fontFamily: Fonts.medium, lineHeight: 16 },
  btnSubmit: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnSubmitText: { fontSize: 15, fontFamily: Fonts.extraBold },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successIconBox: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontFamily: Fonts.extraBold, marginBottom: 8 },
  successSub: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  ticketCard: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', marginBottom: 36, width: '100%' },
  ticketLabel: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1, marginBottom: 4 },
  ticketId: { fontSize: 20, fontFamily: Fonts.extraBold },
  btnPrimary: { width: '100%', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontFamily: Fonts.extraBold },
});
