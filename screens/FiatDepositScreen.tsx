import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, StatusBar, Dimensions, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme, Fonts, COIN_META, NETWORK_INFO } from '../constants';
import Toast from '../components/Toast';
import { fiatRequestService, AdminBankAccount, FiatCryptoRequest } from '../services/supabaseService';
import { BankAccountService } from '../services/bankAccountService';
import { haptics } from '../utils/haptics';

const FIAT_FLAGS: Record<string, string> = {
  USD: 'us',
  INR: 'in',
  EUR: 'eu',
  GBP: 'gb',
  AED: 'ae',
  AUD: 'au',
  SGD: 'sg',
  RUB: 'ru',
  BHD: 'bh',
  VND: 'vn',
  SAR: 'sa',
  KWD: 'kw',
  THB: 'th'
};

const FiatIcon = ({ currency, size = 24 }: { currency: string; size?: number }) => {
  const code = FIAT_FLAGS[currency.toUpperCase()] || 'us';
  return (
    <Image 
      source={{ uri: `https://flagcdn.com/w80/${code}.png` }} 
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
};


const { width } = Dimensions.get('window');

const CRYPTO_ASSETS = ['USDT', 'USDC', 'BTC', 'ETH'];
const FIAT_CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'INR'];

const FIAT_RATES: Record<string, number> = {
  USD: 1.0,
  AED: 3.6725,
  EUR: 0.92,
  GBP: 0.78,
  INR: 83.50
};

export default function FiatDepositScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, walletAddress, userUid, network } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  // Flow steps: 1=Crypto, 2=Fiat, 3=Amount, 4=Bank Transfer, 5=Upload Receipt
  const [step, setStep] = useState<number>(1);
  const [cryptoAsset, setCryptoAsset] = useState('USDT');
  const [fiatCurrency, setFiatCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  
  // File upload state
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isPdf, setIsPdf] = useState<boolean>(false);

  // Loaded active bank details
  const [bankAccounts, setBankAccounts] = useState<AdminBankAccount[]>([]);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // Existing/submitted request tracking
  const [activeRequest, setActiveRequest] = useState<FiatCryptoRequest | null>(null);
  const [checkingRequests, setCheckingRequests] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const loadData = async () => {
    if (!walletAddress) {
      setCheckingRequests(false);
      return;
    }
    setLoadingBanks(true);
    setCheckingRequests(true);
    try {
      // Use new BankAccountService for better bank account handling
      const banks = await BankAccountService.getAllActiveBankAccounts();
      setBankAccounts(banks);
      
      // Get and store supported currencies
      const currencies = await BankAccountService.getSupportedCurrencies();
      setSupportedCurrencies(currencies);
      console.log('Supported currencies:', currencies);
      console.log('Available banks:', banks);

      const requests = await fiatRequestService.getRequests(walletAddress);
      // Look for any pending or under_review deposit requests
      const pendingDep = requests.find(r => r.type === 'deposit' && (r.status === 'pending' || r.status === 'under_review'));
      if (pendingDep) {
        setActiveRequest(pendingDep);
      }
    } catch (e: any) {
      console.error('Error loading bank data:', e);
      showToast('Error loading details from server: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setLoadingBanks(false);
      setCheckingRequests(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [walletAddress]);

  const bankDetails = useMemo(() => {
    return bankAccounts.find(
      (b) => b.currency?.toUpperCase() === fiatCurrency.toUpperCase()
    );
  }, [bankAccounts, fiatCurrency]);

  // Dynamic reference code
  const referenceNumber = useMemo(() => {
    const cleanUid = userUid || '000000';
    return `DEP-${cleanUid}`;
  }, [userUid]);

  // Calculate estimated crypto amount
  const cryptoEstimate = useMemo(() => {
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) return '0.00';

    const coinPriceUsd = prices?.[cryptoAsset]?.usd || 1.0;
    const rate = FIAT_RATES[fiatCurrency] || 1.0;
    const valueUsd = amtNum / rate;
    const cryptoAmt = valueUsd / coinPriceUsd;

    if (cryptoAsset === 'BTC' || cryptoAsset === 'ETH') {
      return cryptoAmt.toFixed(6);
    }
    return cryptoAmt.toFixed(2);
  }, [amount, cryptoAsset, fiatCurrency, prices]);

  const copyToClipboard = async (text: string, label: string) => {
    haptics.selection();
    await Clipboard.setStringAsync(text);
    showToast(`${label} copied to clipboard!`, 'success');
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
      const asset = result.assets[0];
      setFileUri(asset.uri);
      setFileName(asset.fileName || 'screenshot.jpg');
      setMimeType('image/jpeg');
      setIsPdf(false);
    }
  };

  const pickDocument = async () => {
    haptics.selection();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.name);
        const mime = asset.mimeType || '';
        setMimeType(mime);
        setIsPdf(mime.includes('pdf') || asset.name.toLowerCase().endsWith('.pdf'));
      }
    } catch (err: any) {
      showToast('Failed to pick document', 'error');
    }
  };

  const handleNext = () => {
    haptics.selection();
    if (step === 3) {
      const amtNum = parseFloat(amount);
      if (isNaN(amtNum) || amtNum <= 0) {
        showToast('Please enter a valid deposit amount', 'error');
        haptics.error();
        return;
      }
    }
    if (step === 4 && !bankDetails) {
      showToast(`No bank details found for ${fiatCurrency}. Please contact support.`, 'error');
      haptics.error();
      return;
    }
    setStep(s => s + 1);
  };

  const handlePrev = () => {
    haptics.selection();
    if (step > 1) {
      setStep(s => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!walletAddress) return;
    if (!fileUri) {
      showToast('Please upload a transfer receipt screenshot or PDF', 'error');
      haptics.error();
      return;
    }

    setSubmitting(true);
    haptics.selection();

    try {
      // 1. Upload payment proof to storage bucket
      const proofPath = await fiatRequestService.uploadProof(walletAddress, fileUri, mimeType);

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
      setActiveRequest({
        id: res.id,
        ticket_id: res.ticket_id,
        wallet_address: walletAddress,
        user_uuid: res.user_uuid,
        type: 'deposit',
        fiat_currency: fiatCurrency,
        crypto_asset: cryptoAsset,
        amount: amtNum,
        payment_proof_url: proofPath,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setStep(6);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit deposit request', 'error');
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    haptics.selection();
    setActiveRequest(null);
    setStep(1);
    setAmount('');
    setFileUri(null);
    setFileName(null);
    setIsPdf(false);
  };

  // Render Status Timeline for dynamic tracking
  const renderTimeline = (status: string) => {
    const steps = [
      { id: 'submitted', label: 'Submitted', desc: 'Request sent to admin', done: true },
      { id: 'under_review', label: 'Under Review', desc: 'Verifying payment proof', done: status === 'under_review' || status === 'completed' },
      { id: 'completed', label: 'Credited', desc: 'Crypto added to your wallet', done: status === 'completed' }
    ];

    return (
      <View style={styles.timeline}>
        {steps.map((st, i) => (
          <View key={st.id} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineDot,
                { backgroundColor: st.done ? T.success : T.surfaceHigh, borderColor: st.done ? T.success : T.border }
              ]}>
                {st.done && <Feather name="check" size={12} color="#FFF" />}
              </View>
              {i < steps.length - 1 && (
                <View style={[
                  styles.timelineLine,
                  { backgroundColor: st.done && steps[i + 1].done ? T.success : T.border }
                ]} />
              )}
            </View>
            <View style={styles.timelineRight}>
              <Text style={[styles.timelineLabel, { color: T.text, fontFamily: Fonts.bold }]}>{st.label}</Text>
              <Text style={[styles.timelineDesc, { color: T.textDim }]}>{st.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (checkingRequests) {
    return (
      <View style={[styles.root, { backgroundColor: T.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  // Active / Pending request tracking screen overrides standard form
  if (activeRequest) {
    return (
      <View style={[styles.root, { backgroundColor: T.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: T.border }]}>
          <TouchableOpacity
            onPress={() => { haptics.selection(); navigation.goBack(); }}
            style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
          >
            <Feather name="chevron-left" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Track Deposit</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={styles.ticketHeader}>
              <View>
                <Text style={[styles.ticketBadgeLabel, { color: T.textDim }]}>TICKET NUMBER</Text>
                <Text style={[styles.ticketBadgeId, { color: T.text }]}>{activeRequest.ticket_id}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: T.pending + '18', borderColor: T.pending }]}>
                <Text style={[styles.statusText, { color: T.pending }]}>
                  {activeRequest.status === 'under_review' ? 'Under Review' : 'Pending Review'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: T.border }]} />

            <View style={styles.ticketDetails}>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Crypto Asset</Text>
                <Text style={[styles.detailValue, { color: T.text }]}>{activeRequest.crypto_asset}</Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Fiat Paid</Text>
                <Text style={[styles.detailValue, { color: T.text }]}>{activeRequest.amount} {activeRequest.fiat_currency}</Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Date Submitted</Text>
                <Text style={[styles.detailValue, { color: T.text }]}>{new Date(activeRequest.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: T.text, marginTop: 24, marginBottom: 16 }]}>Verification Progress</Text>
          {renderTimeline(activeRequest.status)}

          <View style={[styles.infoCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Feather name="info" size={18} color={T.textDim} />
            <Text style={[styles.infoCardText, { color: T.textMuted }]}>
              Deposits are verified manually by institutional desk managers. Verification typically completes within 1 business hour, depending on the banking clearance speed.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: T.border, marginTop: 12 }]}
            onPress={handleReset}
          >
            <Text style={[styles.btnSecondaryText, { color: T.text }]}>Submit Another Deposit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

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
        {step > 1 ? (
          <TouchableOpacity
            onPress={handlePrev}
            style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
          >
            <Feather name="chevron-left" size={24} color={T.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { haptics.selection(); navigation.goBack(); }}
            style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
          >
            <Feather name="x" size={20} color={T.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: T.text }]}>Fiat Deposit</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Steps Progress Indicator */}
      <View style={styles.progressHeader}>
        <View style={[styles.progressBarBg, { backgroundColor: T.surfaceHigh }]}>
          <View style={[styles.progressBarFill, { width: `${(step / 5) * 100}%`, backgroundColor: T.primary }]} />
        </View>
        <View style={styles.stepLabelsRow}>
          <Text style={[styles.stepIndicatorText, { color: T.textDim }]}>Step {step} of 5</Text>
          <Text style={[styles.stepDescText, { color: T.primary, fontFamily: Fonts.bold }]}>
            {step === 1 && 'Select Asset'}
            {step === 2 && 'Select Currency'}
            {step === 3 && 'Enter Amount'}
            {step === 4 && 'Bank Details'}
            {step === 5 && 'Upload Proof'}
          </Text>
        </View>
      </View>

      {/* Network Indicator Banner */}
      {(() => {
        const netInfo = NETWORK_INFO[network] || NETWORK_INFO['Sepolia'];
        return (
          <View style={[styles.networkBanner, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {netInfo?.iconUrl ? (
                <Image source={{ uri: netInfo.iconUrl }} style={styles.networkBannerIcon} />
              ) : (
                <Feather name="globe" size={16} color={T.textDim} />
              )}
              <Text style={[styles.networkBannerText, { color: T.text, fontFamily: Fonts.bold }]}>
                {netInfo?.name || network} Network
              </Text>
            </View>
            <View style={[styles.networkStatusPill, { backgroundColor: T.success + '15' }]}>
              <View style={[styles.networkStatusDot, { backgroundColor: T.success }]} />
              <Text style={[styles.networkStatusText, { color: T.success, fontFamily: Fonts.bold }]}>Active</Text>
            </View>
          </View>
        );
      })()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* STEP 1: Select Crypto */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.inputLabel, { color: T.text }]}>Choose a Crypto Asset to receive</Text>
            <Text style={[styles.inputSubLabel, { color: T.textDim }]}>This token will be credited to your wallet balance once deposited funds are approved.</Text>
            <View style={styles.assetGrid}>
              {CRYPTO_ASSETS.map((asset) => {
                const selected = cryptoAsset === asset;
                return (
                  <TouchableOpacity
                    key={asset}
                    onPress={() => { haptics.selection(); setCryptoAsset(asset); }}
                    style={[
                      styles.gridCard,
                      {
                        borderColor: selected ? T.primary : T.border,
                        backgroundColor: selected ? T.primary + '10' : T.surface
                      }
                    ]}
                  >
                    <View style={[styles.assetIconCircle, { backgroundColor: T.surfaceHigh }]}>
                      {COIN_META[asset]?.iconUrl ? (
                        <Image source={{ uri: COIN_META[asset].iconUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                      ) : (
                        <MaterialCommunityIcons 
                          name={asset === 'BTC' ? 'bitcoin' : asset === 'ETH' ? 'ethereum' : 'currency-usd'} 
                          size={24} 
                          color={selected ? T.primary : T.textDim} 
                        />
                      )}
                    </View>
                    <Text style={[styles.gridText, { color: T.text, fontFamily: Fonts.bold }]}>{asset}</Text>
                    {selected && (
                      <View style={[styles.checkCircle, { backgroundColor: T.primary }]}>
                        <Feather name="check" size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: T.text, marginTop: 40 }]}
              onPress={handleNext}
            >
              <Text style={[styles.btnPrimaryText, { color: T.background }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Select Fiat Currency */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.inputLabel, { color: T.text }]}>Choose your Fiat Currency</Text>
            <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Select the currency that you will transfer from your bank account.</Text>
            <View style={styles.fiatList}>
              {FIAT_CURRENCIES.map((fiat) => {
                const selected = fiatCurrency === fiat;
                return (
                  <TouchableOpacity
                    key={fiat}
                    onPress={() => { haptics.selection(); setFiatCurrency(fiat); }}
                    style={[
                      styles.fiatRow,
                      {
                        borderColor: selected ? T.primary : T.border,
                        backgroundColor: selected ? T.primary + '0a' : T.surface
                      }
                    ]}
                  >
                    <View style={styles.fiatLeft}>
                      <View style={[styles.currencySymbolCircle, { backgroundColor: T.surfaceHigh }]}>
                        <FiatIcon currency={fiat} size={24} />
                      </View>
                      <Text style={[styles.fiatName, { color: T.text, fontFamily: Fonts.bold }]}>{fiat}</Text>
                    </View>
                    {selected ? (
                      <View style={[styles.radioActive, { borderColor: T.primary }]}>
                        <View style={[styles.radioDot, { backgroundColor: T.primary }]} />
                      </View>
                    ) : (
                      <View style={[styles.radioInactive, { borderColor: T.border }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: T.text, marginTop: 40 }]}
              onPress={handleNext}
            >
              <Text style={[styles.btnPrimaryText, { color: T.background }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Enter Amount */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.inputLabel, { color: T.text }]}>Enter Deposit Amount</Text>
            <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Enter the amount of fiat money you plan to send.</Text>
            
            <View style={[styles.inputFieldContainer, { borderColor: T.border, backgroundColor: T.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12 }}>
                <FiatIcon currency={fiatCurrency} size={20} />
                <Text style={[styles.inputPrefix, { color: T.textDim, marginRight: 0 }]}>{fiatCurrency}</Text>
              </View>
              <TextInput
                style={[styles.inputField, { color: T.text }]}
                placeholder="0.00"
                placeholderTextColor={T.textDim}
                keyboardType="decimal-pad"
                autoFocus
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={[styles.estimateCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: T.textDim }]}>Estimated Crypto</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {COIN_META[cryptoAsset]?.iconUrl && (
                    <Image source={{ uri: COIN_META[cryptoAsset].iconUrl }} style={{ width: 16, height: 16, borderRadius: 8 }} />
                  )}
                  <Text style={[styles.estimateValue, { color: T.success, fontFamily: Fonts.bold }]}>
                    {cryptoEstimate} {cryptoAsset}
                  </Text>
                </View>
              </View>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: T.textDim }]}>Processing Fee</Text>
                <Text style={[styles.estimateValue, { color: T.text, fontFamily: Fonts.bold }]}>0.00% (Free)</Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: T.textDim }]}>Average Processing Time</Text>
                <Text style={[styles.estimateValue, { color: T.text, fontFamily: Fonts.medium }]}>1 - 24 hours</Text>
              </View>
            </View>

            <View style={[styles.warningBoxSmall, { backgroundColor: T.pending + '08', borderColor: T.pending + '40' }]}>
              <Feather name="info" size={14} color={T.pending} />
              <Text style={[styles.warningBoxText, { color: T.textDim }]}>
                Exchange rates fluctuate. The final crypto credited matches the rate at approval.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: T.text, marginTop: 30 }]}
              onPress={handleNext}
            >
              <Text style={[styles.btnPrimaryText, { color: T.background }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Bank Details */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.inputLabel, { color: T.text }]}>Send Money to Bank Account</Text>
            <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Please transfer the exact amount using the bank details below. Use the generated reference number.</Text>

            {loadingBanks ? (
              <ActivityIndicator size="small" color={T.primary} style={{ marginVertical: 20 }} />
            ) : !bankDetails ? (
              <View style={[styles.alertBox, { backgroundColor: T.error + '10', borderColor: T.error }]}>
                <Feather name="alert-circle" size={18} color={T.error} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertText, { color: T.text, fontFamily: Fonts.bold, marginBottom: 8 }]}>
                    No bank accounts configured for {fiatCurrency}
                  </Text>
                  <Text style={[styles.alertText, { color: T.textDim, fontSize: 12 }]}>
                    Please contact the administration desk to enable this asset.
                  </Text>
                  <Text style={[styles.alertText, { color: T.textDim, fontSize: 11, marginTop: 4 }]}>
                    Available currencies: {bankAccounts.map(b => b.currency).filter((c, i, arr) => arr.indexOf(c) === i).join(', ') || 'None'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.bankCardWrapper}>
                <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border }]}>
                  
                  {/* Beneficiary */}
                  <View style={styles.bankField}>
                    <View style={styles.bankFieldLeft}>
                      <Text style={[styles.bankFieldTitle, { color: T.textDim }]}>BENEFICIARY NAME</Text>
                      <Text style={[styles.bankFieldValue, { color: T.text }]}>{bankDetails.beneficiary_name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => copyToClipboard(bankDetails.beneficiary_name, 'Beneficiary name')} style={styles.copyButton}>
                      <Feather name="copy" size={16} color={T.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  {/* Bank Name */}
                  <View style={styles.bankField}>
                    <View style={styles.bankFieldLeft}>
                      <Text style={[styles.bankFieldTitle, { color: T.textDim }]}>BANK NAME</Text>
                      <Text style={[styles.bankFieldValue, { color: T.text }]}>{bankDetails.bank_name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => copyToClipboard(bankDetails.bank_name, 'Bank name')} style={styles.copyButton}>
                      <Feather name="copy" size={16} color={T.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  {/* Account Number */}
                  <View style={styles.bankField}>
                    <View style={styles.bankFieldLeft}>
                      <Text style={[styles.bankFieldTitle, { color: T.textDim }]}>ACCOUNT NUMBER</Text>
                      <Text style={[styles.bankFieldValue, { color: T.text }]}>{bankDetails.account_number}</Text>
                    </View>
                    <TouchableOpacity onPress={() => copyToClipboard(bankDetails.account_number, 'Account number')} style={styles.copyButton}>
                      <Feather name="copy" size={16} color={T.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* IBAN (If available) */}
                  {bankDetails.iban ? (
                    <>
                      <View style={[styles.cardLine, { backgroundColor: T.border }]} />
                      <View style={styles.bankField}>
                        <View style={styles.bankFieldLeft}>
                          <Text style={[styles.bankFieldTitle, { color: T.textDim }]}>IBAN</Text>
                          <Text style={[styles.bankFieldValue, { color: T.text }]}>{bankDetails.iban}</Text>
                        </View>
                        <TouchableOpacity onPress={() => copyToClipboard(bankDetails.iban || '', 'IBAN')} style={styles.copyButton}>
                          <Feather name="copy" size={16} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}

                  {/* SWIFT Code (If available) */}
                  {bankDetails.swift_code ? (
                    <>
                      <View style={[styles.cardLine, { backgroundColor: T.border }]} />
                      <View style={styles.bankField}>
                        <View style={styles.bankFieldLeft}>
                          <Text style={[styles.bankFieldTitle, { color: T.textDim }]}>SWIFT / BIC CODE</Text>
                          <Text style={[styles.bankFieldValue, { color: T.text }]}>{bankDetails.swift_code}</Text>
                        </View>
                        <TouchableOpacity onPress={() => copyToClipboard(bankDetails.swift_code || '', 'SWIFT code')} style={styles.copyButton}>
                          <Feather name="copy" size={16} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  {/* REFERENCE NUMBER */}
                  <View style={[styles.bankField, { backgroundColor: T.primary + '0c' }]}>
                    <View style={styles.bankFieldLeft}>
                      <View style={styles.row}>
                        <Text style={[styles.bankFieldTitle, { color: T.primary, fontFamily: Fonts.bold }]}>REQUIRED REFERENCE CODE</Text>
                        <View style={styles.requiredPill}>
                          <Text style={styles.requiredPillText}>Mandatory</Text>
                        </View>
                      </View>
                      <Text style={[styles.bankFieldValue, { color: T.text, fontFamily: Fonts.bold, fontSize: 16 }]}>{referenceNumber}</Text>
                    </View>
                    <TouchableOpacity onPress={() => copyToClipboard(referenceNumber, 'Reference code')} style={styles.copyButton}>
                      <Feather name="copy" size={16} color={T.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bank Instructions text */}
                {bankDetails.deposit_instructions ? (
                  <View style={[styles.instructionsCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                    <Text style={[styles.instructionsTitle, { color: T.text, fontFamily: Fonts.bold }]}>Bank Specific Instructions</Text>
                    <Text style={[styles.instructionsText, { color: T.textDim }]}>{bankDetails.deposit_instructions}</Text>
                  </View>
                ) : null}

                {/* Transfer Instructions Box */}
                <View style={[styles.infoBorderCard, { borderColor: T.border }]}>
                  <Text style={[styles.infoBorderTitle, { color: T.text, fontFamily: Fonts.bold }]}>Important Transfer Instructions</Text>
                  <View style={styles.instItem}>
                    <Text style={[styles.instNum, { color: T.primary }]}>1</Text>
                    <Text style={[styles.instText, { color: T.textDim }]}>Transfer funds using your bank account (personal accounts only).</Text>
                  </View>
                  <View style={styles.instItem}>
                    <Text style={[styles.instNum, { color: T.primary }]}>2</Text>
                    <Text style={[styles.instText, { color: T.textDim }]}>Use the reference number provided above. Without it, payments cannot be automatically identified.</Text>
                  </View>
                  <View style={styles.instItem}>
                    <Text style={[styles.instNum, { color: T.primary }]}>3</Text>
                    <Text style={[styles.instText, { color: T.textDim }]}>Only send the selected currency: {fiatCurrency}.</Text>
                  </View>
                  <View style={styles.instItem}>
                    <Text style={[styles.instNum, { color: T.primary }]}>4</Text>
                    <Text style={[styles.instText, { color: T.textDim }]}>Save the transfer receipt (PNG, JPG or PDF) to upload in the next step.</Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.btnPrimary,
                { backgroundColor: T.text, marginTop: 20, opacity: bankDetails ? 1 : 0.5 }
              ]}
              onPress={handleNext}
              disabled={!bankDetails}
            >
              <Text style={[styles.btnPrimaryText, { color: T.background }]}>I Have Transferred the Funds</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 5: Upload Proof */}
        {step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.inputLabel, { color: T.text }]}>Upload Transfer Receipt</Text>
            <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Upload a screenshot or PDF document of your bank receipt showing the transfer confirmation.</Text>

            {fileUri ? (
              <View style={[styles.uploadPreviewCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                {isPdf ? (
                  <View style={styles.pdfPreviewContainer}>
                    <View style={styles.pdfIconCircle}>
                      <Feather name="file-text" size={36} color={T.primary} />
                    </View>
                    <Text style={[styles.pdfFileName, { color: T.text, fontFamily: Fonts.bold }]} numberOfLines={1}>
                      {fileName}
                    </Text>
                    <Text style={[styles.pdfFileMeta, { color: T.textDim }]}>PDF Document</Text>
                  </View>
                ) : (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: fileUri }} style={styles.imagePreview} />
                  </View>
                )}

                <View style={styles.previewActions}>
                  <TouchableOpacity onPress={pickDocument} style={[styles.actionBtn, { backgroundColor: T.surfaceHigh }]}>
                    <Feather name="file" size={16} color={T.text} />
                    <Text style={[styles.actionBtnText, { color: T.text }]}>Change PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickImage} style={[styles.actionBtn, { backgroundColor: T.surfaceHigh }]}>
                    <Feather name="image" size={16} color={T.text} />
                    <Text style={[styles.actionBtnText, { color: T.text }]}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.uploadGridRow}>
                <TouchableOpacity
                  style={[styles.uploadCardBtn, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={pickImage}
                >
                  <View style={[styles.iconBox, { backgroundColor: T.primary + '12' }]}>
                    <Feather name="image" size={24} color={T.primary} />
                  </View>
                  <Text style={[styles.uploadCardTitle, { color: T.text, fontFamily: Fonts.bold }]}>Photo Library</Text>
                  <Text style={[styles.uploadCardDesc, { color: T.textDim }]}>Upload JPG or PNG screenshot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadCardBtn, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={pickDocument}
                >
                  <View style={[styles.iconBox, { backgroundColor: T.primary + '12' }]}>
                    <Feather name="file-text" size={24} color={T.primary} />
                  </View>
                  <Text style={[styles.uploadCardTitle, { color: T.text, fontFamily: Fonts.bold }]}>PDF Document</Text>
                  <Text style={[styles.uploadCardDesc, { color: T.textDim }]}>Upload bank transfer slip</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: T.surfaceLow, borderColor: T.border, marginTop: 24 }]}>
              <Feather name="shield" size={16} color={T.success} />
              <Text style={[styles.infoCardText, { color: T.textMuted }]}>
                Providing fraudulent payment receipts will trigger compliance desks and result in immediate ban and balance locking.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.btnPrimary,
                { backgroundColor: submitting ? T.surfaceLow : T.text, marginTop: 30 }
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={T.text} />
              ) : (
                <Text style={[styles.btnPrimaryText, { color: T.background }]}>Submit Deposit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  networkBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  networkBannerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  networkBannerText: {
    fontSize: 13,
  },
  networkStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  networkStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkStatusText: {
    fontSize: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.extraBold },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
  progressHeader: { paddingHorizontal: 20, paddingTop: 16 },
  progressBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  stepLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stepIndicatorText: { fontSize: 11, fontFamily: Fonts.medium },
  stepDescText: { fontSize: 11 },
  stepContainer: { width: '100%', marginTop: 8 },
  inputLabel: { fontSize: 18, fontFamily: Fonts.extraBold, marginBottom: 6 },
  inputSubLabel: { fontSize: 13, lineHeight: 18, marginBottom: 20 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: (width - 52) / 2, padding: 16, borderRadius: 16, borderWidth: 2, position: 'relative' },
  assetIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridText: { fontSize: 15 },
  checkCircle: { position: 'absolute', top: 12, right: 12, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fiatList: { gap: 12 },
  fiatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, borderWidth: 2 },
  fiatLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currencySymbolCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  symbolText: { fontSize: 14, fontFamily: Fonts.bold },
  fiatName: { fontSize: 15 },
  radioActive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioInactive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  inputFieldContainer: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 16, borderWidth: 2, paddingHorizontal: 20 },
  inputPrefix: { fontSize: 18, fontFamily: Fonts.extraBold, marginRight: 12 },
  inputField: { flex: 1, fontSize: 22, fontFamily: Fonts.extraBold, padding: 0 },
  estimateCard: { padding: 16, borderRadius: 16, borderWidth: 2, marginTop: 20, gap: 12 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estimateLabel: { fontSize: 13 },
  estimateValue: { fontSize: 14 },
  warningBoxSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  warningBoxText: { flex: 1, fontSize: 11, lineHeight: 15 },
  alertBox: { flexDirection: 'row', gap: 10, padding: 16, borderRadius: 14, borderWidth: 1.5, marginVertical: 12 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bankCardWrapper: { gap: 16, marginTop: 12 },
  card: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  bankField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bankFieldLeft: { flex: 1, paddingRight: 8 },
  bankFieldTitle: { fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.5, marginBottom: 4 },
  bankFieldValue: { fontSize: 14, fontFamily: Fonts.semiBold },
  copyButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(236,38,41,0.06)' },
  requiredPill: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  requiredPillText: { color: '#000', fontSize: 8, fontFamily: Fonts.extraBold, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardLine: { height: 1 },
  instructionsCard: { padding: 14, borderRadius: 12, borderWidth: 1.5 },
  instructionsTitle: { fontSize: 12, marginBottom: 4 },
  instructionsText: { fontSize: 11, lineHeight: 16 },
  infoBorderCard: { borderStyle: 'dashed', borderWidth: 2, borderRadius: 16, padding: 16 },
  infoBorderTitle: { fontSize: 13, marginBottom: 12 },
  instItem: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  instNum: { fontSize: 12, fontFamily: Fonts.extraBold, width: 16, textAlign: 'center' },
  instText: { flex: 1, fontSize: 11, lineHeight: 15 },
  btnPrimary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontFamily: Fonts.extraBold },
  btnSecondary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  btnSecondaryText: { fontSize: 15, fontFamily: Fonts.bold },
  uploadPreviewCard: { borderRadius: 16, borderWidth: 2, overflow: 'hidden', padding: 12 },
  pdfPreviewContainer: { alignItems: 'center', paddingVertical: 24 },
  pdfIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(236,38,41,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pdfFileName: { fontSize: 14, width: '80%', textAlign: 'center' },
  pdfFileMeta: { fontSize: 11, marginTop: 4 },
  imagePreviewContainer: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { fontSize: 12, fontFamily: Fonts.bold },
  uploadGridRow: { flexDirection: 'row', gap: 12 },
  uploadCardBtn: { flex: 1, height: 160, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadCardTitle: { fontSize: 13, marginBottom: 4 },
  uploadCardDesc: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  infoCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  infoCardText: { flex: 1, fontSize: 11, lineHeight: 16 },
  divider: { height: 1.5, marginVertical: 16 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketBadgeLabel: { fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  ticketBadgeId: { fontSize: 18, fontFamily: Fonts.extraBold },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 11, fontFamily: Fonts.bold },
  ticketDetails: { gap: 10 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 13, fontFamily: Fonts.bold },
  sectionTitle: { fontSize: 15 },
  timeline: { paddingLeft: 10, gap: 4 },
  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginVertical: -4 },
  timelineRight: { flex: 1, paddingLeft: 12, paddingTop: 2 },
  timelineLabel: { fontSize: 13 },
  timelineDesc: { fontSize: 11 }
});
