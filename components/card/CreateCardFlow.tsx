import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CARD_DESIGNS, CardDesignKey } from './CardDesigns';
import CardPreview from './CardPreview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  onComplete: (holderName: string, design: CardDesignKey) => void;
  onCancel: () => void;
};

export default function CreateCardFlow({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [holderName, setHolderName] = useState('');
  const [selectedDesign, setSelectedDesign] = useState<CardDesignKey>(CARD_DESIGNS[0].key);
  const [nameError, setNameError] = useState('');
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

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

  const onScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (CARD_DESIGNS[index] && selectedDesign !== CARD_DESIGNS[index].key) {
      setSelectedDesign(CARD_DESIGNS[index].key);
    }
  };

  const handleIndicatorPress = (key: CardDesignKey, index: number) => {
    setSelectedDesign(key);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const renderTopBar = (currentStep: 1 | 2) => (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 50) }]}>
      <TouchableOpacity 
        onPress={currentStep === 1 ? onCancel : () => setStep(1)} 
        style={styles.backBtn} 
        activeOpacity={0.7} 
        hitSlop={{top:15, bottom:15, left:15, right:15}}
      >
        <Feather name={currentStep === 1 ? "x" : "chevron-left"} size={22} color="#FFF" />
      </TouchableOpacity>
      <View style={styles.dotsRow}>
        <View style={[styles.dot, currentStep >= 1 && styles.dotActive]} />
        <View style={[styles.dot, currentStep >= 2 && styles.dotActive]} />
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  // ── Step 1: Enter Details ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {renderTopBar(1)}

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>STEP 1</Text>
            <Text style={styles.title}>Personalize Your Card</Text>
            <Text style={styles.subtitle}>Enter your name exactly as you want it embossed on your premium virtual card.</Text>

            <View style={styles.livePreviewWrap}>
              <View style={{ width: '100%', paddingHorizontal: 20 }}>
                <CardPreview
                  cardNumber="•••• •••• •••• ••••"
                  holderName={holderName || 'CARD HOLDER'}
                  expiry="••/••"
                  designKey="dark"
                />
              </View>
            </View>

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
            </View>

            <TouchableOpacity onPress={handleStep1Next} activeOpacity={0.85} style={styles.btnWrapper}>
              <View style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Feather name="arrow-right" size={20} color="#000" />
              </View>
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
        {renderTopBar(2)}

        <View style={styles.step2Header}>
          <Text style={styles.stepLabel}>STEP 2</Text>
          <Text style={styles.title}>Choose Your Style</Text>
          <Text style={styles.subtitle}>Swipe to select a premium finish for your virtual card.</Text>
        </View>

        <View style={styles.carouselWrapper}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.carouselScroll}
            contentContainerStyle={styles.carouselContent}
          >
            {CARD_DESIGNS.map(d => (
              <View key={d.key} style={styles.carouselItem}>
                <View style={{ width: '100%' }}>
                  <CardPreview
                    cardNumber="•••• •••• •••• ••••"
                    holderName={holderName || 'CARD HOLDER'}
                    expiry="••/••"
                    designKey={d.key}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.indicatorContainer}>
          {CARD_DESIGNS.map((s, idx) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => handleIndicatorPress(s.key, idx)}
              style={[styles.indicatorDot, selectedDesign === s.key && styles.indicatorDotActive, { backgroundColor: s.colors[0] }]}
            />
          ))}
        </View>
        
        <View style={styles.selectedLabelWrap}>
            <Text style={styles.selectedLabelText}>
                {CARD_DESIGNS.find(d => d.key === selectedDesign)?.label?.toUpperCase()}
            </Text>
        </View>

        <View style={styles.footerWrap}>
          <TouchableOpacity onPress={handleCreate} activeOpacity={0.85} style={styles.btnWrapper}>
            <View style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Activate Virtual Card</Text>
              <Feather name="check" size={20} color="#000" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 3: Creating ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, styles.creatingWrap]}>
      <ActivityIndicator size="large" color="#FFF" />
      <Text style={styles.creatingTitle}>Activating Card</Text>
      <Text style={styles.creatingSub}>Generating your secure virtual credentials...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#101114',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 24, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#FFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 10,
  },
  step2Header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFF',
    opacity: 0.5,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#A0A0A0',
    marginBottom: 30,
    lineHeight: 24,
  },
  livePreviewWrap: {
    marginBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  fieldWrap: {
    marginBottom: 40,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  input: {
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
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
  footerWrap: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    marginTop: 'auto',
  },
  btnWrapper: {
    marginTop: 10,
  },
  primaryBtn: {
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 17,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  carouselWrapper: {
    height: 260,
    width: SCREEN_WIDTH,
  },
  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  indicatorDot: {
    width: 12, height: 12,
    borderRadius: 6,
    opacity: 0.3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  indicatorDotActive: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
    borderColor: '#FFF',
  },
  selectedLabelWrap: {
    alignItems: 'center',
    marginTop: 24,
  },
  selectedLabelText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 2,
  },
  creatingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatingTitle: {
    color: '#FFF',
    fontSize: 26,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  creatingSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
});
