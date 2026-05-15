import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
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

export default function CardPreview({ cardNumber, holderName, expiry, cvv = '•••', designKey, frozen = false, compact = false }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const design = getDesign(designKey);

  const formattedNumber = useMemo(() => {
    const clean = cardNumber.replace(/\s/g, '');
    if (showDetails) {
      // Always format as groups of 4
      return clean.replace(/(\d{4})(?=\d)/g, '$1  ');
    }
    const last4 = clean.slice(-4);
    return `••••  ••••  ••••  ${last4}`;
  }, [cardNumber, showDetails]);

  const formattedExpiry = useMemo(() => {
    if (showDetails) return expiry;
    return '••/••';
  }, [expiry, showDetails]);

  const handleToggleDetails = () => {
    if (authenticating) return; // prevent double tap during auth
    if (!showDetails) {
      setAuthenticating(true);
      setTimeout(() => {
        setAuthenticating(false);
        setShowDetails(true);
      }, 800);
    } else {
      setShowDetails(false);
    }
  };

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
            <Text style={[styles.bankName, { color: design.accentColor }]}>CRYPTOWALLET</Text>
            <Text style={[styles.cardType, { color: design.mutedColor }]}>VIRTUAL CARD</Text>
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
            <Text style={[styles.value, { color: design.textColor }]}>{formattedExpiry}</Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={[styles.label, { color: design.mutedColor }]}>CVV</Text>
            <Text style={[styles.value, { color: design.textColor }]}>{showDetails ? cvv : '•••'}</Text>
          </View>
          {!compact && (
            <TouchableOpacity onPress={handleToggleDetails} style={[styles.eyeBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              {authenticating ? (
                <ActivityIndicator size="small" color={design.accentColor} />
              ) : (
                <Feather name={showDetails ? 'eye' : 'eye-off'} size={14} color={design.accentColor} />
              )}
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
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardCompact: {
    padding: 14,
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
  bankName: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  cardType: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  mcWrap: { flexDirection: 'row', alignItems: 'center' },
  mcCircle: { width: 20, height: 20, borderRadius: 10 },
  numberWrap: { marginVertical: 8 },
  number: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
  },
  numberCompact: { fontSize: 16, letterSpacing: 1.5 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'nowrap' },
  footerItem: { marginRight: 16 },
  label: { fontSize: 7, fontWeight: '800', letterSpacing: 0.8, marginBottom: 3, opacity: 0.8 },
  value: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  eyeBtn: { 
    marginLeft: 'auto', 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderRadius: 24,
  },
  frozenText: { color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 10, letterSpacing: 2 },
});
