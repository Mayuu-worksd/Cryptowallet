import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, StatusBar, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme, Fonts, COIN_META, NETWORK_INFO } from '../constants';
import Toast from '../components/Toast';
import { fiatRequestService, FiatCryptoRequest } from '../services/supabaseService';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

const CRYPTO_ASSETS = ['USDT', 'USDC', 'ETH', 'BTC'];
const FIAT_CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'INR'];

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

export default function FiatWithdrawalScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, walletAddress, balances, network } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  // Flow steps: 1=Crypto, 2=Fiat, 3=Amount, 4=Bank details, 5=Confirm summary
  const [step, setStep] = useState<number>(1);
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
  const [activeRequest, setActiveRequest] = useState<FiatCryptoRequest | null>(null);
  const [checkingRequests, setCheckingRequests] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const loadData = async () => {
    if (!walletAddress) {
      setCheckingRequests(false);
      return;
    }
    setCheckingRequests(true);
    try {
      const requests = await fiatRequestService.getRequests(walletAddress);
      const pendingWd = requests.find(r => r.type === 'withdrawal' && (r.status === 'pending' || r.status === 'under_review'));
      if (pendingWd) {
        setActiveRequest(pendingWd);
      }
    } catch (e: any) {
      console.error('Error loading requests:', e);
    } finally {
      setCheckingRequests(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [walletAddress]);

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

  const handleNext = () => {
    haptics.selection();
    if (step === 3) {
      const amtNum = parseFloat(amount);
      if (isNaN(amtNum) || amtNum <= 0) {
        showToast('Please enter a valid amount to sell', 'error');
        haptics.error();
        return;
      }
      if (amtNum > balance) {
        showToast(`Insufficient balance. You only have ${balance} ${cryptoAsset}`, 'error');
        haptics.error();
        return;
      }
    }
    if (step === 4) {
      if (!accountName.trim() || !bankName.trim() || !accountNumber.trim()) {
        showToast('Please complete all required bank payout fields', 'error');
        haptics.error();
        return;
      }
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
      await loadData();
      if (!activeRequest) {
        setActiveRequest({
          id: res?.id || '',
          ticket_id: res?.ticket_id || 'WDR-PENDING',
          wallet_address: walletAddress,
          user_uuid: '',
          type: 'withdrawal',
          fiat_currency: fiatCurrency,
          crypto_asset: cryptoAsset,
          amount: amtNum,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to submit withdrawal request', 'error');
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
  };

  const renderTimeline = (status: string) => {
    const steps = [
      { id: 'submitted', label: 'Submitted', desc: 'Crypto debited to escrow', done: true },
      { id: 'under_review', label: 'Processing', desc: 'Admin desk initiating wire', done: status === 'under_review' || status === 'completed' },
      { id: 'completed', label: 'Sent', desc: 'Wire transfer dispatched', done: status === 'completed' }
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
          <Text style={[styles.headerTitle, { color: T.text }]}>Track Withdrawal</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border, padding: 20 }]}>
            <View style={styles.ticketHeader}>
              <View>
                <Text style={[styles.ticketBadgeLabel, { color: T.textDim }]}>TICKET ID</Text>
                <Text style={[styles.ticketBadgeId, { color: T.primary }]}>{activeRequest.ticket_id}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: T.pending + '18', borderColor: T.pending }]}>
                <Text style={[styles.statusText, { color: T.pending }]}>
                  {activeRequest.status === 'under_review' ? 'Processing' : 'Pending Review'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: T.border, marginVertical: 20 }]} />

            <View style={styles.ticketDetails}>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Asset Sold</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {COIN_META[activeRequest.crypto_asset]?.iconUrl && (
                    <Image source={{ uri: COIN_META[activeRequest.crypto_asset].iconUrl }} style={{ width: 16, height: 16, borderRadius: 8 }} />
                  )}
                  <Text style={[styles.detailValue, { color: T.text }]}>{activeRequest.crypto_asset}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Fiat Payout</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FiatIcon currency={activeRequest.fiat_currency} size={16} />
                  <Text style={[styles.detailValue, { color: T.text }]}>{activeRequest.amount} {activeRequest.fiat_currency}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <Text style={[styles.detailLabel, { color: T.textDim }]}>Date Submitted</Text>
                <Text style={[styles.detailValue, { color: T.text }]}>{new Date(activeRequest.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: T.text, marginTop: 32, marginBottom: 20, fontFamily: Fonts.extraBold }]}>Verification Timeline</Text>
          
          <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border, padding: 20 }]}>
            {renderTimeline(activeRequest.status)}
          </View>

          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: T.border, marginTop: 32 }]}
            onPress={handleReset}
          >
            <Text style={[styles.btnSecondaryText, { color: T.text }]}>Submit New Withdrawal</Text>
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
        <Text style={[styles.headerTitle, { color: T.text }]}>Fiat Withdrawal</Text>
        <View style={{ width: 44 }} />
      </View>

      <>
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
                {step === 5 && 'Confirm Request'}
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
                <Text style={[styles.inputLabel, { color: T.text }]}>Choose a Crypto Asset to sell</Text>
                <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Select the digital asset you want to debit from your wallet balance to cash out.</Text>
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

            {/* STEP 2: Select Payout Currency */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.inputLabel, { color: T.text }]}>Choose your Payout Currency</Text>
                <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Select the fiat currency you wish to receive in your bank account.</Text>
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

            {/* STEP 3: Enter Quantity */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.inputLabel, { color: T.text }]}>Enter Quantity to Sell</Text>
                <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Specify how much crypto you wish to liquidate.</Text>
                
                {/* Available Balance max badge */}
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

                <View style={[styles.inputFieldContainer, { borderColor: T.border, backgroundColor: T.surface }]}>
                  <TextInput
                    style={[styles.inputField, { color: T.text }]}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    autoFocus
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {COIN_META[cryptoAsset]?.iconUrl && (
                      <Image source={{ uri: COIN_META[cryptoAsset].iconUrl }} style={{ width: 18, height: 18, borderRadius: 9 }} />
                    )}
                    <Text style={[styles.suffix, { color: T.textDim }]}>{cryptoAsset}</Text>
                  </View>
                </View>

                {/* Calculator Payout Estimate */}
                <View style={[styles.estimateCard, { backgroundColor: T.surfaceLow, borderColor: T.border, marginTop: 24 }]}>
                  <View style={styles.estimateRow}>
                    <Text style={[styles.estimateLabel, { color: T.textDim }]}>Estimated Fiat Payout</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FiatIcon currency={fiatCurrency} size={16} />
                      <Text style={[styles.estimateValue, { color: T.success, fontFamily: Fonts.bold }]}>
                        {fiatEstimate} {fiatCurrency}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.estimateRow}>
                    <Text style={[styles.estimateLabel, { color: T.textDim }]}>Processing Fee</Text>
                    <Text style={[styles.estimateValue, { color: T.text, fontFamily: Fonts.bold }]}>0.00% (Free)</Text>
                  </View>
                  <View style={styles.estimateRow}>
                    <Text style={[styles.estimateLabel, { color: T.textDim }]}>Wire Transfer Speed</Text>
                    <Text style={[styles.estimateValue, { color: T.text, fontFamily: Fonts.medium }]}>1 - 2 business days</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: T.text, marginTop: 30 }]}
                  onPress={handleNext}
                >
                  <Text style={[styles.btnPrimaryText, { color: T.background }]}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: Bank Details Form */}
            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.inputLabel, { color: T.text }]}>Target Bank Details</Text>
                <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Specify the personal bank account where payouts should be sent. Wire clearing takes 1-2 days.</Text>

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
                      placeholder="e.g. Intermediary routing, memo info..."
                      placeholderTextColor={T.textDim}
                      multiline
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: T.text, marginTop: 30 }]}
                  onPress={handleNext}
                >
                  <Text style={[styles.btnPrimaryText, { color: T.background }]}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 5: Confirm summary & submit */}
            {step === 5 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.inputLabel, { color: T.text }]}>Confirm Withdrawal Request</Text>
                <Text style={[styles.inputSubLabel, { color: T.textDim }]}>Please review your request before submitting. Escrow locking will occur instantly.</Text>

                <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border, padding: 18, gap: 16 }]}>
                  
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: T.textDim }]}>Asset to Sell</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {COIN_META[cryptoAsset]?.iconUrl && (
                        <Image source={{ uri: COIN_META[cryptoAsset].iconUrl }} style={{ width: 18, height: 18, borderRadius: 9 }} />
                      )}
                      <Text style={[styles.reviewValue, { color: T.text, fontFamily: Fonts.bold }]}>{amount} {cryptoAsset}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: T.textDim }]}>Payout Currency</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FiatIcon currency={fiatCurrency} size={18} />
                      <Text style={[styles.reviewValue, { color: T.success, fontFamily: Fonts.bold }]}>{fiatEstimate} {fiatCurrency}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, { color: T.textDim }]}>Network</Text>
                    <Text style={[styles.reviewValue, { color: T.text, fontFamily: Fonts.semiBold }]}>{network} Chain</Text>
                  </View>

                  <View style={[styles.cardLine, { backgroundColor: T.border }]} />

                  <View style={styles.reviewBlock}>
                    <Text style={[styles.reviewLabel, { color: T.textDim, marginBottom: 4 }]}>Beneficiary Account</Text>
                    <Text style={[styles.reviewText, { color: T.text, fontFamily: Fonts.bold }]}>{accountName}</Text>
                    <Text style={[styles.reviewText, { color: T.textMuted }]}>{bankName} ({accountNumber})</Text>
                    {swiftCode ? <Text style={[styles.reviewText, { color: T.textDim }]}>SWIFT: {swiftCode}</Text> : null}
                  </View>

                </View>

                {/* Compliance warning */}
                <View style={[styles.warningBox, { backgroundColor: T.pending + '0a', borderColor: T.pending + '40' }]}>
                  <Feather name="shield" size={16} color={T.pending} style={{ marginTop: 2 }} />
                  <Text style={[styles.warningText, { color: T.textDim }]}>
                    Funds are held in escrow instantly. Verification and wire transfers are processed during business days and typically arrive in 1-2 banking days. Ensure the target account belongs to you.
                  </Text>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    { backgroundColor: submitting ? T.surfaceLow : T.text, marginTop: 10 }
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={T.text} />
                  ) : (
                    <Text style={[styles.btnPrimaryText, { color: T.background }]}>Confirm & Submit Escrow</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </>
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
  fiatName: { fontSize: 15 },
  radioActive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioInactive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  balanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  balanceLabel: { fontSize: 12, fontFamily: Fonts.medium },
  maxBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1.5 },
  maxBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
  inputFieldContainer: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 16, borderWidth: 2, paddingHorizontal: 20 },
  suffix: { fontSize: 16, fontFamily: Fonts.bold, marginLeft: 8 },
  inputField: { flex: 1, fontSize: 22, fontFamily: Fonts.extraBold, padding: 0 },
  estimateCard: { padding: 16, borderRadius: 16, borderWidth: 2, gap: 12 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estimateLabel: { fontSize: 13 },
  estimateValue: { fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 2 },
  subLabel: { fontSize: 10, fontFamily: Fonts.extraBold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  brutalInput: { height: 48, borderRadius: 12, borderWidth: 2, paddingHorizontal: 16, fontSize: 14, fontFamily: Fonts.semiBold },
  btnPrimary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontFamily: Fonts.extraBold },
  warningBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 20, marginBottom: 24 },
  warningText: { flex: 1, fontSize: 11, lineHeight: 16 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successIconBox: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontFamily: Fonts.extraBold, marginBottom: 8, textAlign: 'center' },
  successSub: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  ticketCard: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', marginBottom: 36, width: '100%' },
  ticketLabel: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1, marginBottom: 4 },
  ticketId: { fontSize: 20, fontFamily: Fonts.extraBold },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
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
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: { fontSize: 13, fontFamily: Fonts.medium },
  reviewValue: { fontSize: 14 },
  cardLine: { height: 1 },
  reviewBlock: { gap: 2 },
  reviewText: { fontSize: 13, fontFamily: Fonts.medium },
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
