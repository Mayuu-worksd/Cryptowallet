import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Theme } from '../../constants';

type Props = { onCreatePress: () => void; isDarkMode: boolean };

export default function NoCardState({ onCreatePress, isDarkMode }: Props) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconBg, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Feather name="credit-card" size={36} color={T.textDim} />
        </View>
        <View style={styles.plusBadge}>
          <Feather name="plus" size={13} color="#FFF" />
        </View>
      </View>

      <Text style={[styles.title, { color: T.text }]}>No Card Yet</Text>
      <Text style={[styles.subtitle, { color: T.textMuted }]}>
        Create your virtual card to start{'\n'}spending crypto worldwide
      </Text>

      <TouchableOpacity onPress={onCreatePress} activeOpacity={0.85}>
        <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.cta}>
          <Feather name="credit-card" size={17} color="#FFF" />
          <Text style={styles.ctaText}>Create Virtual Card</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={[styles.featuresBox, { backgroundColor: T.surface }]}>
        {[
          { icon: 'zap',        label: 'Instant virtual card' },
          { icon: 'globe',      label: 'Spend crypto globally' },
          { icon: 'shield',     label: 'Freeze or unfreeze anytime' },
        ].map(f => (
          <View key={f.label} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(255,59,59,0.1)' }]}>
              <Feather name={f.icon as any} size={14} color="#FF3B3B" />
            </View>
            <Text style={[styles.featureText, { color: T.textMuted }]}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  iconWrap: { position: 'relative', marginBottom: 28 },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  plusBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF3B3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 32,
  },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  featuresBox: { width: '100%', borderRadius: 18, padding: 18, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, fontWeight: '500' },
});
