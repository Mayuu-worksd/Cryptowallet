/**
 * VCCCardDetailScreen.tsx
 * Shows full virtual card details: 16-digit number, holder name, expiry, CVV.
 * CVV is masked by default — tap eye to reveal.
 * All fields are ready to be replaced with a live card API response.
 *
 * To integrate a live card API:
 *   1. Replace the `cardData` fetch in useEffect with your API call
 *   2. The API should return: { cardNumber, holderName, expiryMmYy, cvv, balance, status }
 *   3. CVV should only be returned after re-auth (PIN/biometric) — enforce server-side
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { vccService, dbCardService, cardVariantService } from '../services/supabaseService';
import Toast from '../components/Toast';
import { usePreventScreenCapture } from 'expo-screen-capture';
type CardData = {
  cardNumber: string;   // full 16-digit (shown masked by default)
  holderName: string;
  expiryMmYy: string;
  cvv: string;          // masked until revealed
  balance: number;
  status: string;
  network: string;
  variant: string;
};

export default function VCCCardDetailScreen({ navigation }: any) {
  usePreventScreenCapture();
  const { walletAddress, isDarkMode, cardDetails, cardCreated, formatFiat, fiatCurrency, cardBalance } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [cardData, setCardData]         = useState<CardData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showNumber, setShowNumber]     = useState(false);
  const [showCVV, setShowCVV]           = useState(false);
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as any });
  const [gradientColors, setGradientColors] = useState<string[]>(['#1C1C2E', '#2D1B69']);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const load = useCallback(async () => {
    setLoading(true);
    let vcc = null;
    let dbCard = null;
    let allVariants: any[] = [];
    try {
      const [vccRes, dbCardRes, variantsRes] = await Promise.all([
        vccService.getCard(walletAddress).catch(() => null),
        dbCardService.getCard(walletAddress).catch(() => null),
        cardVariantService.getVariants().catch(() => []),
      ]);
      vcc = vccRes;
      dbCard = dbCardRes;
      allVariants = variantsRes;
    } catch (e: any) {
      console.warn('Error fetching card from database, using local state fallback:', e);
    }

    let activeVariantId = 'classic';
    let activeNetwork = 'Visa';

    if (vcc) {
      activeVariantId = vcc.card_variant || 'classic';
      activeNetwork = vcc.card_network || 'Visa';
      // Decrypt from Supabase — source of truth
      const decryptedNumber = dbCard ? dbCardService.decryptNumber(dbCard, walletAddress) : '';
      const decryptedCvv    = dbCard ? dbCardService.decryptCvv(dbCard, walletAddress)    : '';
      setCardData({
        cardNumber:  decryptedNumber || `•••• •••• •••• ${vcc.card_last4}`,
        holderName:  vcc.card_holder_name,
        expiryMmYy:  vcc.expiry_mm_yy,
        cvv:         decryptedCvv || '•••',
        balance:     vcc.balance,
        status:      vcc.card_status,
        network:     vcc.card_network,
        variant:     vcc.card_variant,
      });
    } else if (dbCard) {
      activeVariantId = dbCard.card_type || 'classic';
      const decryptedNumber = dbCardService.decryptNumber(dbCard, walletAddress);
      const decryptedCvv    = dbCardService.decryptCvv(dbCard, walletAddress);
      setCardData({
        cardNumber:  decryptedNumber || `•••• •••• •••• ${dbCard.card_last4}`,
        holderName:  dbCard.holder_name,
        expiryMmYy:  `${dbCard.expiry_month}/${dbCard.expiry_year}`,
        cvv:         decryptedCvv || '•••',
        balance:     dbCard.balance,
        status:      dbCard.status,
        network:     'Visa',
        variant:     dbCard.card_type,
      });
    } else if (cardCreated && cardDetails) {
      activeVariantId = 'classic';
      activeNetwork = cardDetails.brand || 'Visa';
      setCardData({
        cardNumber:  cardDetails.number,
        holderName:  cardDetails.holderName,
        expiryMmYy:  cardDetails.expiry,
        cvv:         cardDetails.cvv,
        balance:     cardBalance,
        status:      'active',
        network:     cardDetails.brand,
        variant:     'classic',
      });
    }

    // Configure Dynamic Colors
    const matched = allVariants.find(v => v.id.toLowerCase() === activeVariantId.toLowerCase());
    if (matched?.gradient_colors && matched.gradient_colors.length >= 2) {
      setGradientColors(matched.gradient_colors);
    } else if (matched?.card_color_hex) {
      setGradientColors([matched.card_color_hex, matched.color_hex || '#1a1a1a']);
    } else {
      if (activeNetwork === 'Mastercard') {
        setGradientColors(['#1A1A2E', '#16213E']);
      } else {
        setGradientColors(['#1C1C2E', '#2D1B69']);
      }
    }
    setLoading(false);
  }, [walletAddress, cardCreated, cardDetails, cardBalance]);

  useEffect(() => { load(); }, [load]);

  const copyToClipboard = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    showToast(`${label} copied!`, 'success');
  };

  const handleRevealCVV = () => {
    Alert.alert(
      'Reveal CVV',
      'CVV is sensitive. Only reveal in a secure environment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reveal', onPress: () => setShowCVV(true) },
      ]
    );
  };

  const statusColor = cardData?.status === 'active' ? T.success
    : cardData?.status === 'frozen' ? '#F59E0B'
    : T.error;

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!cardData) {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Card Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Feather name="credit-card" size={48} color={T.textDim} />
          <Text style={[{ color: T.text, fontSize: 18, fontWeight: '800', marginTop: 16 }]}>No Card Found</Text>
          <Text style={[{ color: T.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 }]}>
            Create a virtual card first to view details.
          </Text>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: T.primary, marginTop: 24 }]}
            onPress={() => navigation.navigate('Card')}
          >
            <Text style={s.btnText}>Go to Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Card Details</Text>
        <TouchableOpacity onPress={load} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={18} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Card Visual ── */}
        <LinearGradient colors={gradientColors} style={s.cardVisual} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* Network logo */}
          <View style={s.cardTop}>
            <View style={s.chipIcon}>
              <Feather name="cpu" size={20} color="#FFD700" />
            </View>
            <Text style={s.cardNetworkLabel}>{cardData.network}</Text>
          </View>

          {/* Card number */}
          <Text style={s.cardNumber}>
            {showNumber ? cardData.cardNumber : `•••• •••• •••• ${cardData.cardNumber.replace(/\s/g, '').slice(-4)}`}
          </Text>

          {/* Bottom row */}
          <View style={s.cardBottom}>
            <View>
              <Text style={s.cardFieldLabel}>CARD HOLDER</Text>
              <Text style={s.cardFieldValue}>{cardData.holderName.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.cardFieldLabel}>EXPIRES</Text>
              <Text style={s.cardFieldValue}>{cardData.expiryMmYy}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: statusColor + '30' }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[s.statusText, { color: statusColor }]}>{cardData.status.toUpperCase()}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Balance ── */}
        <View style={[s.balanceCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[s.balanceLabel, { color: T.textDim }]}>CARD BALANCE</Text>
          <Text style={[s.balanceValue, { color: T.text }]}>{formatFiat(cardData.balance)}</Text>
          <Text style={[s.balanceSub, { color: T.textMuted }]}>Direct settlement from crypto assets</Text>
        </View>

        {/* ── Card Details ── */}
        <Text style={[s.sectionTitle, { color: T.textDim }]}>CARD INFORMATION</Text>
        <View style={[s.detailsCard, { backgroundColor: T.surface, borderColor: T.border }]}>

          {/* Card Number */}
          <View style={[s.detailRow, { borderBottomColor: T.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.detailLabel, { color: T.textDim }]}>CARD NUMBER</Text>
              <Text style={[s.detailValue, { color: T.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                {showNumber ? cardData.cardNumber : '•••• •••• •••• ' + cardData.cardNumber.replace(/\s/g, '').slice(-4)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.actionIcon, { backgroundColor: T.surfaceLow }]}
                onPress={() => setShowNumber(v => !v)}
              >
                <Feather name={showNumber ? 'eye-off' : 'eye'} size={16} color={T.textMuted} />
              </TouchableOpacity>
              {showNumber && (
                <TouchableOpacity
                  style={[s.actionIcon, { backgroundColor: T.primary + '20' }]}
                  onPress={() => copyToClipboard(cardData.cardNumber.replace(/\s/g, ''), 'Card number')}
                >
                  <Feather name="copy" size={16} color={T.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Holder Name */}
          <View style={[s.detailRow, { borderBottomColor: T.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.detailLabel, { color: T.textDim }]}>CARD HOLDER NAME</Text>
              <Text style={[s.detailValue, { color: T.text }]}>{cardData.holderName.toUpperCase()}</Text>
            </View>
            <TouchableOpacity
              style={[s.actionIcon, { backgroundColor: T.primary + '20' }]}
              onPress={() => copyToClipboard(cardData.holderName, 'Holder name')}
            >
              <Feather name="copy" size={16} color={T.primary} />
            </TouchableOpacity>
          </View>

          {/* Expiry */}
          <View style={[s.detailRow, { borderBottomColor: T.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.detailLabel, { color: T.textDim }]}>EXPIRY DATE</Text>
              <Text style={[s.detailValue, { color: T.text }]}>{cardData.expiryMmYy}</Text>
            </View>
            <TouchableOpacity
              style={[s.actionIcon, { backgroundColor: T.primary + '20' }]}
              onPress={() => copyToClipboard(cardData.expiryMmYy, 'Expiry date')}
            >
              <Feather name="copy" size={16} color={T.primary} />
            </TouchableOpacity>
          </View>

          {/* CVV */}
          <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.detailLabel, { color: T.textDim }]}>CVV / CVC</Text>
              <Text style={[s.detailValue, { color: T.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                {showCVV ? cardData.cvv : '•••'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[s.actionIcon, { backgroundColor: T.surfaceLow }]}
                onPress={showCVV ? () => setShowCVV(false) : handleRevealCVV}
              >
                <Feather name={showCVV ? 'eye-off' : 'eye'} size={16} color={T.textMuted} />
              </TouchableOpacity>
              {showCVV && (
                <TouchableOpacity
                  style={[s.actionIcon, { backgroundColor: T.primary + '20' }]}
                  onPress={() => copyToClipboard(cardData.cvv, 'CVV')}
                >
                  <Feather name="copy" size={16} color={T.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Security Notice ── */}
        <View style={[s.securityNote, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}>
          <Feather name="shield" size={14} color={T.primary} />
          <Text style={[s.securityText, { color: T.textMuted }]}>
            Never share your card details. CVV is only shown once at issuance — if lost, request a new card.
          </Text>
        </View>

        {/* ── API Integration Note (dev only) ── */}
        <View style={[s.apiNote, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
          <Feather name="code" size={14} color="#F59E0B" />
          <Text style={[s.securityText, { color: '#F59E0B' }]}>
            Ready for live API: Replace the fetch in VCCCardDetailScreen.tsx with your card issuer endpoint.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  // Card visual
  cardVisual: {
    borderRadius: 24, padding: 24, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  chipIcon: { width: 36, height: 28, borderRadius: 6, backgroundColor: '#FFD70030', alignItems: 'center', justifyContent: 'center' },
  cardNetworkLabel: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  cardNumber: { color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: 3, marginBottom: 24, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardFieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardFieldValue: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Balance
  balanceCard: { borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, alignItems: 'center' },
  balanceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  balanceValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  balanceSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Details
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  detailsCard: { borderRadius: 20, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  detailLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '700' },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Notes
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  apiNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  securityText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },

  btn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
