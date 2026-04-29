import React, { useState } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { vccService, VCCCardVariant } from '../services/supabaseService';

export default function VCCPreviewScreen({ navigation, route }: any) {
  const variant: VCCCardVariant = route?.params?.variant;
  const { isDarkMode, walletAddress } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [holderName, setHolderName] = useState('');
  const [nameError,  setNameError]  = useState('');
  const [showNumber, setShowNumber] = useState(false);
  const [showCVV,    setShowCVV]    = useState(false);

  // Generate card details once and keep them stable for this session
  const [previewNumber] = useState(() => vccService.generateCardNumber(variant.network));
  const [previewExpiry] = useState(() => vccService.generateExpiry());
  const [previewCVV]    = useState(() => vccService.generateCVV());
  const maskedNumber  = previewNumber.replace(/\d(?=\d{4})/g, '*');

  const handleContinue = () => {
    if (!holderName.trim() || holderName.trim().length < 3) {
      setNameError('Enter your full name as it appears on your KYC');
      return;
    }
    navigation.navigate('VCCPhysical', { variant, holderName: holderName.trim(), previewNumber, previewExpiry, previewCVV });
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: T.border }]}>
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
            <View>
              <Text style={s.cardFieldLabel}>CARD HOLDER</Text>
              <Text style={s.cardFieldValue}>{holderName.trim() || 'YOUR NAME'}</Text>
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

        {/* Cardholder name input */}
        <Text style={[s.sectionTitle, { color: T.textMuted }]}>CARDHOLDER NAME</Text>
        <Text style={[s.sectionSub, { color: T.textDim }]}>Must match your KYC verified name exactly</Text>
        <View style={[s.nameInput, { backgroundColor: T.surface, borderColor: nameError ? T.error : T.border }]}>
          <TextInput
            style={[s.nameInputText, { color: T.text }]}
            value={holderName}
            onChangeText={v => { setHolderName(v); setNameError(''); }}
            placeholder="Enter your full legal name"
            placeholderTextColor={T.textDim}
            autoCapitalize="words"
          />
        </View>
        {nameError ? <Text style={[s.errorText, { color: T.error }]}>{nameError}</Text> : null}

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
            <Text style={[s.featureText, { color: T.textMuted }]}>Annual fee: {variant.annual_fee_usd === 0 ? 'Free' : `$${variant.annual_fee_usd}/yr`}</Text>
          </View>
          <View style={s.featureRow}>
            <Feather name="trending-up" size={15} color={T.textDim} />
            <Text style={[s.featureText, { color: T.textMuted }]}>Transaction limit: ${variant.transaction_limit_usd.toLocaleString()}/transaction</Text>
          </View>
        </View>

        <View style={[s.noteBox, { backgroundColor: T.primary + '15' }]}>
          <Feather name="info" size={14} color={T.primary} />
          <Text style={[s.noteText, { color: T.primary }]}>Card details shown are a preview. Final card is generated and saved when you confirm.</Text>
        </View>

        <TouchableOpacity 
          style={[s.continueBtn, { backgroundColor: T.primary }]} 
          onPress={handleContinue} 
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
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
    borderBottomWidth: 1,
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
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardFieldLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardFieldValue: { fontSize: 14, color: '#FFF', fontWeight: '800' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 14, borderWidth: 1,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionSub: { fontSize: 13, marginBottom: 12, fontWeight: '500' },
  nameInput: {
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, height: 58,
  },
  nameInputText: { flex: 1, fontSize: 16, fontWeight: '700', height: '100%' },
  errorText: { fontSize: 13, fontWeight: '700', marginTop: 6 },
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});

