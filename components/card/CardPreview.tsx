import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getDesign } from './CardDesigns';

type Props = {
  cardNumber: string;
  holderName: string;
  expiry: string;
  cvv?: string;
  designKey: string;
  frozen?: boolean;
  compact?: boolean;
};

// Render each digit/bullet as individual fixed-width Text to guarantee
// equal spacing on every Android OEM and iOS device — no system font dependency.
function CardDigits({ value, color, fontSize = 18 }: { value: string; color: string; fontSize?: number }) {
  return (
    <View style={s.digitsRow}>
      {value.split('').map((ch, i) => (
        <Text
          key={i}
          style={[s.digit, { color, fontSize, fontFamily: 'Inter_700Bold', width: ch === ' ' ? fontSize * 0.55 : fontSize * 0.62 }]}
          allowFontScaling={false}
        >
          {ch === ' ' ? '' : ch}
        </Text>
      ))}
    </View>
  );
}

export default function CardPreview({ cardNumber, holderName, expiry, cvv = '•••', designKey, frozen = false, compact = false }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const design = getDesign(designKey);

  const digits = useMemo(() => {
    const clean = cardNumber.replace(/\s/g, '');
    if (showDetails) {
      // groups of 4 separated by a space
      return clean.replace(/(.{4})(?=.)/g, '$1 ');
    }
    const last4 = clean.slice(-4) || '••••';
    return `•••• •••• •••• ${last4}`;
  }, [cardNumber, showDetails]);

  const displayExpiry = showDetails ? expiry : '••/••';
  const displayCvv    = showDetails ? cvv    : '•••';

  const handleToggle = () => {
    if (authenticating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!showDetails) {
      setAuthenticating(true);
      setTimeout(() => { setAuthenticating(false); setShowDetails(true); }, 600);
    } else {
      setShowDetails(false);
    }
  };

  const digitSize = compact ? 14 : 17;

  return (
    <View style={[s.shadow, compact && s.shadowCompact]}>
      <LinearGradient
        colors={design.colors}
        start={design.start}
        end={design.end}
        style={[s.card, compact && s.cardCompact, frozen && s.frozenCard]}
      >
        <View style={[s.glow, { backgroundColor: design.accentColor + '18' }]} />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.bankName, { color: design.accentColor, fontFamily: 'Inter_800ExtraBold' }]} allowFontScaling={false}>
              CRYPTOWALLET
            </Text>
            <Text style={[s.cardType, { color: design.mutedColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>
              VIRTUAL CARD
            </Text>
          </View>
          {/* Mastercard circles */}
          <View style={s.mcWrap}>
            <View style={[s.mcCircle, { backgroundColor: '#EB001B' }]} />
            <View style={[s.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -10 }]} />
          </View>
        </View>

        {/* Card Number — individual digit rendering */}
        <View style={s.numberWrap}>
          <CardDigits value={digits} color={design.textColor} fontSize={digitSize} />
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerItem}>
            <Text style={[s.label, { color: design.mutedColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>CARD HOLDER</Text>
            <Text style={[s.value, { color: design.textColor, fontFamily: 'Inter_700Bold' }]} numberOfLines={1} allowFontScaling={false}>
              {holderName.toUpperCase()}
            </Text>
          </View>
          <View style={s.footerItem}>
            <Text style={[s.label, { color: design.mutedColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>EXPIRES</Text>
            <Text style={[s.value, { color: design.textColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>
              {displayExpiry}
            </Text>
          </View>
          <View style={s.footerItem}>
            <Text style={[s.label, { color: design.mutedColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>CVV</Text>
            <Text style={[s.value, { color: design.textColor, fontFamily: 'Inter_700Bold' }]} allowFontScaling={false}>
              {displayCvv}
            </Text>
          </View>
          {!compact && (
            <TouchableOpacity onPress={handleToggle} style={[s.eyeBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]} activeOpacity={0.7}>
              {authenticating
                ? <ActivityIndicator size="small" color={design.accentColor} />
                : <Feather name={showDetails ? 'eye' : 'eye-off'} size={14} color={design.accentColor} />
              }
            </TouchableOpacity>
          )}
        </View>

        {frozen && (
          <View style={s.frozenOverlay}>
            <Feather name="lock" size={28} color="#FFF" />
            <Text style={[s.frozenText, { fontFamily: 'Inter_800ExtraBold' }]} allowFontScaling={false}>CARD FROZEN</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  shadow: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
  },
  shadowCompact: { shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  card: {
    aspectRatio: 1.586,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardCompact: { padding: 14, borderRadius: 16 },
  frozenCard: { opacity: 0.75 },
  glow: {
    position: 'absolute',
    top: -60, right: -60,
    width: 220, height: 220,
    borderRadius: 110,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bankName: { fontSize: 16, letterSpacing: 0.5 },
  cardType: { fontSize: 8, letterSpacing: 1.5, marginTop: 2 },
  mcWrap: { flexDirection: 'row', alignItems: 'center' },
  mcCircle: { width: 22, height: 22, borderRadius: 11, opacity: 0.9 },
  numberWrap: { marginVertical: 4 },
  digitsRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' },
  digit: { textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  footer: { flexDirection: 'row', alignItems: 'flex-end' },
  footerItem: { marginRight: 14 },
  label: { fontSize: 7, letterSpacing: 0.8, marginBottom: 3, opacity: 0.8 },
  value: { fontSize: 12, letterSpacing: 0.5 },
  eyeBtn: { marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderRadius: 24,
  },
  frozenText: { color: '#FFF', fontSize: 13, marginTop: 10, letterSpacing: 2 },
});
