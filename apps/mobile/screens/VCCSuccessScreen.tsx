import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView, Animated, StatusBar, Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { VCCCard, VCCCardVariant } from '../services/supabaseService';

const { width } = Dimensions.get('window');
const ICON_SIZE = 100;

function shadeColor(hex: string, amount: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return '#0a0a0a'; }
}

function GlowingOrb({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[s.glowingOrb, { backgroundColor: color, transform: [{ scale: pulse }] }]} />
  );
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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      Animated.spring(cardAnim,  { toValue: 1, speed: 12, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const masked = cardNumber?.replace(/\d(?=(\d{4} |\d{4}$))/g, '•') ?? '•••• •••• •••• ••••';
  const cardColor = variant?.card_color_hex ?? T.primary;

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Premium Hero Section */}
        <Animated.View style={[s.heroWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.iconWrap}>
            <GlowingOrb color={T.success + '30'} />
            <LinearGradient
              colors={[T.success, shadeColor(T.success, -20)]}
              style={s.iconCircle}
            >
              <Feather name="check" size={44} color="#FFF" />
            </LinearGradient>
          </View>
          
          <View style={[s.statusBadge, { backgroundColor: T.success + '15' }]}>
            <Text style={[s.statusBadgeText, { color: T.success }]}>ACTIVE</Text>
          </View>

          <Text style={[s.title, { color: T.text }]}>Card Issued</Text>
          <Text style={[s.subtitle, { color: T.textDim }]}>
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
          style={[s.revealBtn, { backgroundColor: T.surfaceLow }]} 
          onPress={() => setRevealed(p => !p)} 
          activeOpacity={0.8}
        >
          <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color={T.primary} />
          <Text style={[s.revealBtnText, { color: T.primary }]}>{revealed ? 'Hide Details' : 'Reveal Details'}</Text>
        </TouchableOpacity>

        {/* Info rows */}
        <Animated.View style={[s.infoCard, { opacity: fadeAnim, backgroundColor: T.surfaceLow }]}>
          {[
            { label: 'Card Type', value: variant?.variant_name ?? '—' },
            { label: 'Network',   value: variant?.network ?? '—' },
            { label: 'Delivery',  value: isPhysical ? 'Physical + Virtual' : 'Virtual Only' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[s.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[s.infoLabel, { color: T.textDim }]}>{row.label}</Text>
              <Text style={[s.infoValue, { color: T.text }]}>{row.value}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Security note */}
        <View style={[s.secNote, { backgroundColor: T.surfaceLow }]}>
          <Feather name="shield" size={16} color={T.primary} />
          <Text style={[s.secText, { color: T.textDim }]}>Card details are encrypted. Keep your CVV private.</Text>
        </View>

        {/* Physical upsell */}
        {!isPhysical && (
          <TouchableOpacity
            style={[s.upsellCard, { backgroundColor: T.surfaceLow }]}
            onPress={() => navigation.navigate('Card', { initialTab: 'physical' })}
            activeOpacity={0.85}
          >
            <View style={[s.upsellIcon, { backgroundColor: T.primary + '15' }]}>
              <Feather name="package" size={20} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.upsellTitle, { color: T.text }]}>Order Physical Card</Text>
              <Text style={[s.upsellSub, { color: T.textDim }]}>Get a premium card delivered to your door</Text>
            </View>
            <Feather name="chevron-right" size={20} color={T.textDim} />
          </TouchableOpacity>
        )}

        {/* CTAs */}
        <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Main')} activeOpacity={0.85}>
          <LinearGradient colors={['#10B981', '#059669']} style={s.doneBtnGrad}>
            <Feather name="check" size={20} color="#FFF" />
            <Text style={s.doneBtnText}>Go to Dashboard</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={s.cardBtn} onPress={() => navigation.navigate('Card')} activeOpacity={0.7}>
          <Text style={[s.cardBtnText, { color: T.text }]}>Manage Card</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 32, alignItems: 'center' },

  heroWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  iconWrap: { width: ICON_SIZE + 40, height: ICON_SIZE + 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  glowingOrb: { position: 'absolute', width: ICON_SIZE + 40, height: ICON_SIZE + 40, borderRadius: (ICON_SIZE + 40) / 2 },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },

  statusBadge:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  statusBadgeText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1 },
  title:      { fontSize: 32, fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -1, marginBottom: 12 },
  subtitle:   { fontSize: 16, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 24, marginBottom: 8 },

  cardWrap: { width: '100%', marginBottom: 24 },
  card: {
    width: '100%', height: 220, borderRadius: 28, padding: 26,
    justifyContent: 'space-between', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 16,
  },
  deco:     { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip:     { width: 44, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  chipLine: { height: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1 },
  network:  { fontSize: 16, fontFamily: Fonts.extraBold, color: 'rgba(255,255,255,0.95)', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardNumber:{ fontSize: 20, color: '#FFF', fontFamily: Fonts.bold, letterSpacing: 4, textAlign: 'center' },
  cardBottom:{ flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta:  { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 4 },
  cardMetaVal:{ fontSize: 15, color: '#FFF', fontFamily: Fonts.bold },

  revealBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 20, marginBottom: 32, width: '100%' },
  revealBtnText: { fontSize: 15, fontFamily: Fonts.bold },

  infoCard:   { width: '100%', borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18 },
  infoLabel:  { fontSize: 14, fontFamily: Fonts.medium },
  infoValue:  { fontSize: 15, fontFamily: Fonts.bold },

  secNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, padding: 16, marginBottom: 24, width: '100%' },
  secText: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, lineHeight: 20 },

  upsellCard:  { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 24, marginBottom: 28, width: '100%' },
  upsellIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  upsellTitle: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 },
  upsellSub:   { fontSize: 13, fontFamily: Fonts.medium },

  doneBtn:     { height: 64, borderRadius: 32, overflow: 'hidden', width: '100%', marginBottom: 14 },
  doneBtnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  doneBtnText: { color: '#FFF', fontSize: 18, fontFamily: Fonts.bold },
  cardBtn:     { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', width: '100%' },
  cardBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});
