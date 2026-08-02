import React, { useEffect, useState } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { vccService, kycService, VCCCardVariant } from '../services/supabaseService';
import { CurrencyText } from '../components/CurrencyText';

export default function VCCPreviewScreen({ navigation, route }: any) {
  const variant: VCCCardVariant = route?.params?.variant;
  const { isDarkMode, walletAddress, fiatCurrency } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [holderName,  setHolderName]  = useState('');
  const [kycLoading,  setKycLoading]  = useState(true);
  const [kycError,    setKycError]    = useState<string | null>(null);
  const [showNumber,  setShowNumber]  = useState(false);
  const [showCVV,     setShowCVV]     = useState(false);

  // Generate card credentials once — stable for this session
  const [previewNumber] = useState(() => vccService.generateCardNumber(variant.network));
  const [previewExpiry] = useState(() => vccService.generateExpiry());
  const [previewCVV]    = useState(() => vccService.generateCVV());
  const maskedNumber    = previewNumber.replace(/\d(?=\d{4})/g, '*');

  // Fetch KYC name on mount — no manual input needed
  useEffect(() => {
    if (!walletAddress) return;
    kycService.getStatus(walletAddress)
      .then(kyc => {
        if (kyc?.status === 'verified' && kyc.full_name?.trim()) {
          setHolderName(kyc.full_name.trim().toUpperCase());
        } else if (kyc && kyc.status !== 'verified') {
          setKycError('Your KYC is not approved yet. Complete identity verification first.');
        } else {
          setKycError('No verified KYC name found. Please complete KYC first.');
        }
      })
      .catch(() => setKycError('Failed to load your profile. Please try again.'))
      .finally(() => setKycLoading(false));
  }, [walletAddress]);

  const handleContinue = () => {
    navigation.navigate('VCCPhysical', {
      variant,
      holderName,
      previewNumber,
      previewExpiry,
      previewCVV,
    });
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Card Preview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Visual card */}
        <View style={[s.visualCard, { backgroundColor: variant.card_color_hex || T.primary }]}>
          <View style={s.cardTopRow}>
            <Text style={s.cardVariantLabel}>{variant.variant_name}</Text>
            <Text style={s.cardNetworkLabel}>{variant.network}</Text>
          </View>
          <Text style={s.cardNumber}>
            {showNumber ? previewNumber : maskedNumber}
          </Text>
          <View style={s.cardBottomRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardFieldLabel}>CARD HOLDER</Text>
              <Text style={s.cardFieldValue} numberOfLines={1}>
                {kycLoading ? '...' : holderName || 'YOUR NAME'}
              </Text>
            </View>
            <View>
              <Text style={s.cardFieldLabel}>EXPIRES</Text>
              <Text style={s.cardFieldValue}>{previewExpiry}</Text>
            </View>
            <View>
              <Text style={s.cardFieldLabel}>CVV</Text>
              <Text style={s.cardFieldValue}>{showCVV ? previewCVV : '***'}</Text>
            </View>
          </View>
        </View>

        {/* Toggle buttons */}
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => setShowNumber(p => !p)}
            activeOpacity={0.8}
          >
            <Feather name={showNumber ? 'eye-off' : 'eye'} size={15} color={T.textMuted} />
            <Text style={[s.toggleBtnText, { color: T.textMuted }]}>{showNumber ? 'Hide' : 'Show'} Number</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => setShowCVV(p => !p)}
            activeOpacity={0.8}
          >
            <Feather name={showCVV ? 'eye-off' : 'eye'} size={15} color={T.textMuted} />
            <Text style={[s.toggleBtnText, { color: T.textMuted }]}>{showCVV ? 'Hide' : 'Show'} CVV</Text>
          </TouchableOpacity>
        </View>

        {/* Cardholder name — auto-filled from KYC, no input */}
        <Text style={[s.sectionTitle, { color: T.textMuted }]}>CARDHOLDER NAME</Text>

        {kycLoading ? (
          <View style={[s.nameDisplay, { backgroundColor: T.surface, borderColor: T.border }]}>
            <ActivityIndicator size="small" color={T.primary} />
            <Text style={[s.nameLoadingText, { color: T.textDim }]}>Loading verified name...</Text>
          </View>
        ) : kycError ? (
          <View style={[s.nameDisplay, { backgroundColor: T.error + '12', borderColor: T.error + '40' }]}>
            <Feather name="alert-circle" size={16} color={T.error} />
            <Text style={[s.nameErrorText, { color: T.error }]}>{kycError}</Text>
          </View>
        ) : (
          <View style={[s.nameDisplay, { backgroundColor: T.surface, borderColor: T.success + '60' }]}>
            <Feather name="check-circle" size={16} color={T.success} />
            <Text style={[s.nameText, { color: T.text }]}>{holderName}</Text>
            <View style={[s.kycBadge, { backgroundColor: T.success + '15' }]}>
              <Text style={[s.kycBadgeText, { color: T.success }]}>KYC VERIFIED</Text>
            </View>
          </View>
        )}

        <Text style={[s.sectionSub, { color: T.textDim }]}>
          Cardholder name is automatically set from your verified identity.
        </Text>

        {/* Features */}
        <Text style={[s.sectionTitle, { color: T.textMuted, marginTop: 24 }]}>CARD FEATURES</Text>
        <View style={[s.featuresBox, { backgroundColor: T.surface }]}>
          {variant.features.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Feather name="check-circle" size={15} color={T.success} />
              <Text style={[s.featureText, { color: T.textMuted }]}>{f}</Text>
            </View>
          ))}
          <View style={[s.featureRow, { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12, marginTop: 4 }]}>
            <Feather name="dollar-sign" size={15} color={T.textDim} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Text style={[s.featureText, { color: T.textMuted }]}>Annual fee: </Text>
              {variant.annual_fee_usd === 0
                ? <Text style={[s.featureText, { color: T.textMuted }]}>Free</Text>
                : <><CurrencyText amount={variant.annual_fee_usd} code={fiatCurrency} style={[s.featureText, { color: T.textMuted }]} /><Text style={[s.featureText, { color: T.textMuted }]}>/yr</Text></>
              }
            </View>
          </View>
          <View style={s.featureRow}>
            <Feather name="trending-up" size={15} color={T.textDim} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Text style={[s.featureText, { color: T.textMuted }]}>Transaction limit: </Text>
              <CurrencyText amount={variant.transaction_limit_usd} code={fiatCurrency} style={[s.featureText, { color: T.textMuted }]} />
              <Text style={[s.featureText, { color: T.textMuted }]}>/transaction</Text>
            </View>
          </View>
        </View>

        <View style={[s.noteBox, { backgroundColor: T.primary + '15' }]}>
          <Feather name="info" size={14} color={T.primary} />
          <Text style={[s.noteText, { color: T.primary }]}>
            Card details shown are a preview. Final card is generated and saved when you confirm.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.continueBtn, { backgroundColor: T.primary }, (!holderName || !!kycError || kycLoading) && { opacity: 0.4 }]}
          onPress={handleContinue}
          disabled={!holderName || !!kycError || kycLoading}
          activeOpacity={0.85}
        >
          <Text style={s.continueBtnText}>Apply for This Card</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 20 },
  visualCard: {
    borderRadius: 24, padding: 24, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  cardVariantLabel: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  cardNetworkLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 },
  cardNumber: { fontSize: 19, fontWeight: '700', color: '#FFF', letterSpacing: 3, marginBottom: 28, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  cardFieldLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardFieldValue: { fontSize: 14, color: '#FFF', fontWeight: '800' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 14, borderWidth: 1,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  sectionSub: { fontSize: 12, fontWeight: '500', marginTop: 8, marginBottom: 4, lineHeight: 17 },
  // Name display — read-only, no TextInput
  nameDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 4,
  },
  nameText: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  nameLoadingText: { fontSize: 14, fontWeight: '600' },
  nameErrorText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  kycBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  kycBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  featuresBox: { borderRadius: 20, padding: 20, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 14, fontWeight: '600', flex: 1 },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 16, marginTop: 20, marginBottom: 24,
  },
  noteText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: 20,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  continueBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});
