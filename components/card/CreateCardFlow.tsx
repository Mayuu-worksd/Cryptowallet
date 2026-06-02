import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

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
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 50) }]}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn} activeOpacity={0.7} hitSlop={{top:15, bottom:15, left:15, right:15}}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <StepDots current={1} />
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
            <Text style={styles.title}>Personalize Your Card</Text>
            <Text style={styles.subtitle}>Enter your name as it will appear on your premium virtual card.</Text>

            {/* Live Preview in Step 1 */}
            <View style={styles.livePreviewWrap}>
              <CardPreview
                cardNumber="•••• •••• •••• ••••"
                holderName={holderName || 'YOUR NAME'}
                expiry="••/••"
                designKey="dark"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>CARD HOLDER NAME</Text>
              <TextInput
                style={[styles.input, !!nameError && styles.inputError]}
                placeholder="e.g. JOHN DOE"
                placeholderTextColor="rgba(255,255,255,0.15)"
                value={holderName}
                onChangeText={t => { setHolderName(t.toUpperCase()); setNameError(''); }}
                autoCapitalize="characters"
                maxLength={26}
                autoFocus
              />
              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
              <Text style={styles.hint}>This name will be embossed on your virtual card</Text>
            </View>

            <TouchableOpacity onPress={handleStep1Next} activeOpacity={0.85} style={styles.btnWrapper}>
              <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Continue to Design</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
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
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 50) }]}>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn} activeOpacity={0.7} hitSlop={{top:15, bottom:15, left:15, right:15}}>
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <StepDots current={2} />
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepLabel}>STEP 2 OF 2</Text>
          <Text style={styles.title}>Choose Your Style</Text>
          <Text style={styles.subtitle}>Select a premium finish for your virtual card.</Text>

          {/* Live preview of selected design */}
          <View style={styles.livePreviewWrap}>
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
                  {selectedDesign === d.key && <Feather name="check-circle" size={16} color="#FF3B3B" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={handleCreate} activeOpacity={0.85} style={styles.btnWrapper}>
            <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Activate Virtual Card</Text>
              <Feather name="credit-card" size={18} color="#FFF" />
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
      <Text style={styles.creatingTitle}>Activating Card</Text>
      <Text style={styles.creatingSub}>Generating your secure virtual credentials...</Text>
    </View>
  );
}

function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <View style={styles.dotsRow}>
      <View style={[styles.dot, current >= 1 && styles.dotActive]} />
      <View style={[styles.dot, current >= 2 && styles.dotActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 24, height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#FF3B3B',
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 10,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FF3B3B',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#A0A0A0',
    marginBottom: 30,
    lineHeight: 22,
  },
  livePreviewWrap: {
    marginBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  fieldWrap: {
    marginBottom: 40,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 10,
  },
  input: {
    height: 60,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    letterSpacing: 1.5,
  },
  inputError: {
    borderColor: '#FF3B3B',
    backgroundColor: 'rgba(255,59,59,0.05)',
  },
  errorText: {
    color: '#FF3B3B',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
    marginLeft: 4,
  },
  hint: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
    marginLeft: 4,
  },
  btnWrapper: {
    marginTop: 10,
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  previewWrap: {
    marginBottom: 30,
    alignItems: 'center',
  },
  designGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  designOption: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  designOptionSelected: {
    borderColor: '#FF3B3B',
    backgroundColor: '#1A0B0B',
  },
  designLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  designLabel: {
    color: '#888',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  designLabelActive: {
    color: '#FFF',
  },
  creatingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatingTitle: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 24,
    marginBottom: 8,
  },
  creatingSub: {
    color: '#888',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
