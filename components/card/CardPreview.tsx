import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { getDesign } from './CardDesigns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  cardNumber?: string;
  holderName: string;
  expiry?: string;
  cvv?: string;
  designKey: string;
  frozen?: boolean;
  compact?: boolean;
};

export default function CardPreview({ holderName, designKey, frozen = false, compact = false }: Props) {
  const design = getDesign(designKey);

  return (
    <View style={[styles.shadowWrapper, compact && styles.shadowCompact]}>
      <LinearGradient 
        colors={design.colors} 
        start={design.start}
        end={design.end}
        style={[styles.portraitCard, compact && styles.cardCompact, frozen && { opacity: 0.65 }]}
      >
        <View style={styles.glow} />
        
        {/* EMV Chip */}
        <View style={styles.cardChip}>
          <View style={styles.chipLineHorizontal} />
          <View style={styles.chipLineVertical} />
        </View>
        
        {/* Contactless Icon */}
        <View style={styles.cardWifi}>
          <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
        
        {/* Brand Text (Rotated right) */}
        <View style={styles.brandRotatedContainer}>
          <View style={[styles.brandDot, { backgroundColor: design.accentColor || '#EC2629' }]} />
          <Text style={styles.brandRotatedText}>{design.label ? design.label.toUpperCase() : 'CRYPTOWALLET'}</Text>
        </View>
        
        {/* Card Holder (Bottom Right) */}
        <View style={styles.cardFaceHolderWrap}>
          <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
          <Text style={styles.cardFaceHolderName} numberOfLines={1}>
            {holderName ? holderName.toUpperCase() : 'CARD HOLDER'}
          </Text>
        </View>
        
        {/* VISA Logo (Rotated bottom left) */}
        <View style={styles.visaRotatedContainer}>
          <Text style={styles.visaRotatedText}>VISA</Text>
        </View>
        
        {/* Frozen Overlay */}
        {frozen && (
          <View style={styles.frozenOverlay}>
            <Feather name="lock" size={32} color="#FFFFFF" />
            <Text style={styles.frozenText}>CARD LOCKED</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowCompact: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  portraitCard: {
    width: 230,
    height: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardCompact: {
    width: 140,
    height: 220,
    borderRadius: 16,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E5A93C', 
    position: 'absolute',
    top: 100,
    left: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#D4942A',
    padding: 3,
  },
  chipLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
    height: 1,
    backgroundColor: '#B57C1E',
  },
  chipLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    width: 1,
    backgroundColor: '#B57C1E',
  },
  cardWifi: {
    position: 'absolute',
    top: 105,
    right: 24,
  },
  brandRotatedContainer: {
    position: 'absolute',
    top: 75,
    right: -35,
    transform: [{ rotate: '90deg' }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandRotatedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 4,
    opacity: 0.85,
  },
  cardFaceHolderWrap: {
    position: 'absolute',
    bottom: 50,
    right: 24,
    alignItems: 'flex-end',
    maxWidth: 150,
  },
  cardFaceHolderLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardFaceHolderName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  visaRotatedContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    transform: [{ rotate: '270deg' }],
  },
  visaRotatedText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  frozenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 12,
  },
});
