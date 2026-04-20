import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { getDesign } from './CardDesigns';

type Props = {
  cardNumber: string;
  holderName: string;
  expiry: string;
  designKey: string;
  frozen?: boolean;
  compact?: boolean;
};

export default function CardPreview({ cardNumber, holderName, expiry, designKey, frozen = false, compact = false }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const design = getDesign(designKey);

  const formattedNumber = useMemo(() => {
    if (showDetails) return cardNumber;
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    return `••••  ••••  ••••  ${last4}`;
  }, [cardNumber, showDetails]);

  return (
    <View style={[styles.shadow, compact && styles.shadowCompact]}>
      <LinearGradient
        colors={design.colors}
        start={design.start}
        end={design.end}
        style={[styles.card, compact && styles.cardCompact, frozen && styles.frozenCard]}
      >
        <View style={[styles.glow, { backgroundColor: design.accentColor + '18' }]} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.bankName, { color: design.accentColor }]}>CRIMSON</Text>
            <Text style={[styles.cardType, { color: design.mutedColor }]}>ELITE RESERVE</Text>
          </View>
          <View style={styles.mcWrap}>
            <View style={[styles.mcCircle, { backgroundColor: '#EB001B', opacity: 0.85 }]} />
            <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', opacity: 0.85, marginLeft: -10 }]} />
          </View>
        </View>

        {/* Number */}
        <View style={styles.numberWrap}>
          <Text style={[styles.number, { color: design.textColor }, compact && styles.numberCompact]}>
            {formattedNumber}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={[styles.label, { color: design.mutedColor }]}>CARD HOLDER</Text>
            <Text style={[styles.value, { color: design.textColor }]} numberOfLines={1}>{holderName}</Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={[styles.label, { color: design.mutedColor }]}>EXPIRES</Text>
            <Text style={[styles.value, { color: design.textColor }]}>{expiry}</Text>
          </View>
          {!compact && (
            <TouchableOpacity onPress={() => setShowDetails(v => !v)} style={styles.eyeBtn}>
              <Feather name={showDetails ? 'eye-off' : 'eye'} size={13} color={design.mutedColor} />
            </TouchableOpacity>
          )}
        </View>

        {frozen && (
          <View style={styles.frozenOverlay}>
            <Feather name="lock" size={28} color="#FFF" />
            <Text style={styles.frozenText}>CARD FROZEN</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  shadowCompact: {
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    aspectRatio: 1.586,
    borderRadius: 22,
    padding: 28,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardCompact: {
    padding: 18,
    borderRadius: 16,
  },
  frozenCard: { opacity: 0.75 },
  glow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bankName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  cardType: { fontSize: 9, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  mcWrap: { flexDirection: 'row', alignItems: 'center' },
  mcCircle: { width: 22, height: 22, borderRadius: 11 },
  numberWrap: { marginVertical: 20 },
  number: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  numberCompact: { fontSize: 15, letterSpacing: 2 },
  footer: { flexDirection: 'row', alignItems: 'flex-end' },
  footerItem: { marginRight: 20 },
  label: { fontSize: 7, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  value: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  eyeBtn: { marginLeft: 'auto', padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderRadius: 22,
  },
  frozenText: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 10, letterSpacing: 2 },
});
