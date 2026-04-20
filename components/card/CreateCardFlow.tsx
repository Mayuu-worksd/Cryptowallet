import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CARD_DESIGNS, CardDesignKey } from './CardDesigns';
import CardPreview from './CardPreview';

type Props = {
  onComplete: (holderName: string, design: CardDesignKey) => void;
  onCancel: () => void;
};

export default function CreateCardFlow({ onComplete, onCancel }: Props) {
  const [step, setStep]                     = useState<1 | 2 | 3>(1);
  const [holderName, setHolderName]         = useState('');
  const [selectedDesign, setSelectedDesign] = useState<CardDesignKey>('dark');
  const [nameError, setNameError]           = useState('');

  const handleStep1Next = () => {
    if (!holderName.trim()) { setNameError('Card holder name is required'); return; }
    setNameError('');
    setStep(2);
  };

  const handleCreate = async () => {
    setStep(3);
    await new Promise(r => setTimeout(r, 1400));
    onComplete(holderName.trim().toUpperCase(), selectedDesign);
  };

  // ── Step 1: Enter Details ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <StepDots current={1} />
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
            <Text style={styles.title}>Card Details</Text>
            <Text style={styles.subtitle}>Enter your name exactly as you want it on the card</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>CARD HOLDER NAME</Text>
              <TextInput
                style={[styles.input, !!nameError && styles.inputError]}
                placeholder="e.g. JOHN DOE"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={holderName}
                onChangeText={t => { setHolderName(t.toUpperCase()); setNameError(''); }}
                autoCapitalize="characters"
                maxLength={26}
                autoFocus
              />
              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
              <Text style={styles.hint}>Displayed in uppercase on your card</Text>
            </View>

            <TouchableOpacity onPress={handleStep1Next} activeOpacity={0.85}>
              <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Feather name="arrow-right" size={17} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Select Design ──────────────────────────────────────────────────
  if (step === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <StepDots current={2} />
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepLabel}>STEP 2 OF 2</Text>
          <Text style={styles.title}>Choose Design</Text>
          <Text style={styles.subtitle}>Pick a style for your virtual card</Text>

          {/* Live preview of selected design */}
          <View style={styles.previewWrap}>
            <CardPreview
              cardNumber="•••• •••• •••• ••••"
              holderName={holderName || 'YOUR NAME'}
              expiry="••/••"
              designKey={selectedDesign}
            />
          </View>

          <View style={styles.designGrid}>
            {CARD_DESIGNS.map(d => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setSelectedDesign(d.key)}
                activeOpacity={0.8}
                style={[styles.designOption, selectedDesign === d.key && styles.designOptionSelected]}
              >
                <CardPreview
                  cardNumber="•••• •••• •••• ••••"
                  holderName={holderName || 'YOUR NAME'}
                  expiry="••/••"
                  designKey={d.key}
                  compact
                />
                <View style={styles.designLabelRow}>
                  <Text style={[styles.designLabel, selectedDesign === d.key && styles.designLabelActive]}>
                    {d.label}
                  </Text>
                  {selectedDesign === d.key && <Feather name="check-circle" size={14} color="#FF3B3B" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={handleCreate} activeOpacity={0.85}>
            <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Create My Card</Text>
              <Feather name="credit-card" size={17} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Step 3: Creating ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, styles.creatingWrap]}>
      <ActivityIndicator size="large" color="#FF3B3B" />
      <Text style={styles.creatingTitle}>Creating your card</Text>
      <Text style={styles.creatingSub}>Generating secure card details…</Text>
    </View>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2].map(s => (
        <View key={s} style={[dotStyles.dot, current >= s && dotStyles.dotActive]} />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a' },
  dotActive: { backgroundColor: '#FF3B3B' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#101114' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 58 : 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#1c1b1b',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 24, paddingBottom: 48 },
  stepLabel: { fontSize: 11, fontWeight: '800', color: '#FF3B3B', letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 20 },
  fieldWrap: { marginBottom: 28 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 10 },
  input: {
    backgroundColor: '#1c1b1b',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inputError: { borderColor: '#FF3B3B' },
  errorText: { color: '#FF3B3B', fontSize: 12, fontWeight: '600', marginTop: 6 },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 7 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  previewWrap: { marginBottom: 24 },
  designGrid: { gap: 14, marginBottom: 24 },
  designOption: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1b1b',
    padding: 12,
  },
  designOptionSelected: { borderColor: '#FF3B3B' },
  designLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 10,
  },
  designLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  designLabelActive: { color: '#FFF' },
  creatingWrap: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  creatingTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginTop: 8 },
  creatingSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
});
