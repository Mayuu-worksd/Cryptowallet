import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView, Animated, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { VCCCard, VCCCardVariant } from '../services/supabaseService';

function shadeColor(hex: string, amount: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return '#0a0a0a'; }
}

export default function VCCSuccessScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { vccCard, cardNumber, cvv, variant, isPhysical }: {
    vccCard: VCCCard; cardNumber: string; cvv: string; variant: VCCCardVariant; isPhysical: boolean;
  } = route?.params ?? {};

  const [revealed, setRevealed] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const cardAnim  = useRef(new Animated.Value(0.88)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkAnim, { toValue: 1, speed: 16, bounciness: 10, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.spring(cardAnim,  { toValue: 1, speed: 12, bounciness: 7, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const masked = cardNumber?.replace(/\d(?=(\d{4} |\d{4}$))/g, '•') ?? '•••• •••• •••• ••••';
  const cardColor = variant?.card_color_hex ?? T.primary;

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Success mark */}
        <Animated.View style={[s.topSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={[s.checkRing, { transform: [{ scale: checkAnim }], borderColor: T.success + '30' }]}>
            <LinearGradient colors={[T.success, shadeColor(T.success, -20)]} style={s.checkCircle}>
              <Feather name="check" size={32} color="#FFF" />
            </LinearGradient>
          </Animated.View>
          <Text style={[s.title, { color: T.text }]}>Card Issued</Text>
          <Text style={[s.subtitle, { color: T.textMuted }]}>
            Your {variant?.variant_name ?? 'Virtual'} card is active and ready to use.
          </Text>
        </Animated.View>

        {/* Card visual */}
        <Animated.View style={[s.cardWrap, { transform: [{ scale: cardAnim }] }]}>
          <LinearGradient
            colors={[cardColor, shadeColor(cardColor, -40)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.card}
          >
            {/* Decorative circles */}
            <View style={[s.deco, { top: -50, right: -50, width: 180, height: 180, opacity: 0.1 }]} />
            <View style={[s.deco, { bottom: -40, left: -40, width: 140, height: 140, opacity: 0.08 }]} />

            <View style={s.cardTop}>
              <View style={s.chip}>
                <View style={s.chipLine} />
                <View style={s.chipLine} />
              </View>
              <Text style={s.network}>{variant?.network ?? 'Visa'}</Text>
            </View>

            <Text style={s.cardNumber}>{revealed ? cardNumber : masked}</Text>

            <View style={s.cardBottom}>
              <View>
                <Text style={s.cardMeta}>CARD HOLDER</Text>
                <Text style={s.cardMetaVal}>{vccCard?.card_holder_name ?? '—'}</Text>
              </View>
              <View>
                <Text style={s.cardMeta}>EXPIRES</Text>
                <Text style={s.cardMetaVal}>{vccCard?.expiry_mm_yy ?? '—'}</Text>
              </View>
              <View>
                <Text style={s.cardMeta}>CVV</Text>
                <Text style={s.cardMetaVal}>{revealed ? cvv : '•••'}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Reveal toggle */}
        <TouchableOpacity 
          style={[s.revealBtn, { backgroundColor: T.primary + '12', borderColor: T.primary + '30' }]} 
          onPress={() => setRevealed(p => !p)} 
          activeOpacity={0.8}
        >
          <Feather name={revealed ? 'eye-off' : 'eye'} size={15} color={T.primary} />
          <Text style={[s.revealBtnText, { color: T.primary }]}>{revealed ? 'Hide Details' : 'Reveal Card Details'}</Text>
        </TouchableOpacity>

        {/* Info rows */}
        <Animated.View style={[s.infoCard, { opacity: fadeAnim, backgroundColor: T.surface, borderColor: T.border }]}>
          {[
            { label: 'Card Type', value: variant?.variant_name ?? '—' },
            { label: 'Network',   value: variant?.network ?? '—' },
            { label: 'Status',    value: 'Active' },
            { label: 'Delivery',  value: isPhysical ? 'Physical + Virtual' : 'Virtual Only' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[s.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}>
              <Text style={[s.infoLabel, { color: T.textMuted }]}>{row.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {row.label === 'Status' && <View style={[s.activeDot, { backgroundColor: T.success }]} />}
                <Text style={[s.infoValue, { color: T.text }, row.label === 'Status' && { color: T.success }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Security note */}
        <View style={[s.secNote, { backgroundColor: T.primary + '10', borderColor: T.primary + '20' }]}>
          <Feather name="shield" size={14} color={T.primary} />
          <Text style={[s.secText, { color: T.textMuted }]}>Card details are encrypted and never stored in full. Keep your CVV private.</Text>
        </View>

        {/* Physical upsell */}
        {!isPhysical && (
          <TouchableOpacity
            style={[s.upsellCard, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => navigation.navigate('VCCPhysical', { variant, vccCard })}
            activeOpacity={0.85}
          >
            <View style={[s.upsellIcon, { backgroundColor: T.primary + '12' }]}>
              <Feather name="package" size={20} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.upsellTitle, { color: T.text }]}>Order Physical Card</Text>
              <Text style={[s.upsellSub, { color: T.textMuted }]}>Get a premium card delivered to your door</Text>
            </View>
            <Feather name="chevron-right" size={18} color={T.textDim} />
          </TouchableOpacity>
        )}

        {/* CTAs */}
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('Main')} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Go to Dashboard</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={[s.cardBtn, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => navigation.navigate('Card')} activeOpacity={0.7}>
          <Text style={[s.cardBtnText, { color: T.textMuted }]}>Manage Card</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: Platform.OS === 'ios' ? 72 : 52, alignItems: 'center' },

  topSection: { alignItems: 'center', marginBottom: 36, gap: 14 },
  checkRing:  { width: 94, height: 94, borderRadius: 47, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  checkCircle:{ width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  subtitle:   { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

  cardWrap: { width: '100%', marginBottom: 20 },
  card: {
    width: '100%', height: 220, borderRadius: 28, padding: 26,
    justifyContent: 'space-between', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 28, elevation: 20,
  },
  deco:     { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip:     { width: 44, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  chipLine: { height: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1 },
  network:  { fontSize: 16, fontWeight: '900', color: 'rgba(255,255,255,0.95)', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardNumber:{ fontSize: 20, color: '#FFF', fontWeight: '700', letterSpacing: 4, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardBottom:{ flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta:  { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardMetaVal:{ fontSize: 14, color: '#FFF', fontWeight: '800' },

  revealBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, marginBottom: 32 },
  revealBtnText: { fontSize: 14, fontWeight: '800' },

  infoCard:   { width: '100%', borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  infoLabel:  { fontSize: 14, fontWeight: '600' },
  infoValue:  { fontSize: 15, fontWeight: '800' },
  activeDot:  { width: 8, height: 8, borderRadius: 4 },

  secNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24, width: '100%' },
  secText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },

  upsellCard:  { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 28, width: '100%' },
  upsellIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  upsellTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  upsellSub:   { fontSize: 13, fontWeight: '500' },

  doneBtn:     { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 64, borderRadius: 20, width: '100%', marginBottom: 14, 
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 
  },
  doneBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  cardBtn:     { height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', width: '100%', borderWidth: 1 },
  cardBtnText: { fontSize: 16, fontWeight: '700' },
});
