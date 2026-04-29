import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../constants';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { vccService, VCCCardVariant } from '../services/supabaseService';

type StepState = 'waiting' | 'loading' | 'done' | 'error';

const STEP_LABELS = [
  'Checking KYC status...',
  'Matching your identity...',
  'Generating card details...',
  'Saving card to wallet...',
  'Linking to your wallet...',
];

export default function VCCProcessingScreen({ navigation, route }: any) {
  const { isDarkMode, walletAddress } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { variant, holderName, isPhysical, shippingFeeUsd, previewNumber, previewExpiry, previewCVV }: {
    variant: VCCCardVariant; holderName: string; isPhysical: boolean; shippingFeeUsd: number;
    previewNumber?: string; previewExpiry?: string; previewCVV?: string;
  } = route?.params ?? {};

  const [steps,    setSteps]    = useState<StepState[]>(['loading', 'waiting', 'waiting', 'waiting', 'waiting']);
  const [failed,   setFailed]   = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.88)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.88, duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
  }, []);

  const setStep = (i: number, state: StepState) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? state : s));

  const run = async () => {
    setFailed(null);
    setSteps(['loading', 'waiting', 'waiting', 'waiting', 'waiting']);

    try {
      setStep(0, 'loading');
      await new Promise(r => setTimeout(r, 800));

      const result = await vccService.applyCard(
        walletAddress, variant, holderName, isPhysical, shippingFeeUsd,
      );

      setStep(0, 'done'); setStep(1, 'loading');
      await new Promise(r => setTimeout(r, 600));
      setStep(1, 'done'); setStep(2, 'loading');
      await new Promise(r => setTimeout(r, 600));
      setStep(2, 'done'); setStep(3, 'loading');
      await new Promise(r => setTimeout(r, 600));
      setStep(3, 'done'); setStep(4, 'loading');
      await new Promise(r => setTimeout(r, 500));
      setStep(4, 'done');

      setTimeout(() => navigation.replace('VCCSuccess', {
        vccCard:    result.vccCard,
        cardNumber: previewNumber ?? result.cardNumber,
        cvv:        previewCVV    ?? result.cvv,
        variant,
        isPhysical,
      }), 800);

    } catch (e: any) {
      const msg = e?.message ?? '';
      setSteps(prev => {
        const idx = prev.findIndex(s => s === 'loading');
        return prev.map((s, i) => i === (idx >= 0 ? idx : 0) ? 'error' : s);
      });
      if (msg === 'KYC_NOT_VERIFIED') {
        setFailed('Complete identity verification first before applying for a card.');
      } else if (msg === 'NAME_MISMATCH') {
        setFailed('Card name must match your KYC verified name exactly. Go back and correct it.');
      } else {
        setFailed(msg || 'Something went wrong. Please try again.');
      }
    }
  };

  useEffect(() => { run(); }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={s.body}>
        <Animated.View style={[s.iconRing, { transform: [{ scale: pulseAnim }], backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
          <Feather name="credit-card" size={44} color={T.primary} />
        </Animated.View>

        <Text style={[s.title, { color: T.text }]}>Issuing Your Card</Text>
        <Text style={[s.subtitle, { color: T.textMuted }]}>
          Please wait while we secure your unique card credentials on the network.
        </Text>

        <View style={[s.steps, { backgroundColor: T.surface, borderColor: T.border }]}>
          {steps.map((step, i) => (
            <View key={i} style={s.row}>
              <View style={s.iconWrap}>
                {step === 'done' ? (
                  <Feather name="check-circle" size={20} color={T.success} />
                ) : step === 'error' ? (
                  <Feather name="x-circle" size={20} color={T.error} />
                ) : step === 'loading' ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Feather name="loader" size={20} color={T.primary} />
                  </Animated.View>
                ) : (
                  <Feather name="circle" size={20} color={T.border} />
                )}
              </View>
              <Text style={[
                s.label,
                step === 'done'    && { color: T.text, fontWeight: '700' },
                step === 'loading' && { color: T.text, fontWeight: '800' },
                step === 'error'   && { color: T.error, fontWeight: '700' },
                step === 'waiting' && { color: T.textDim, fontWeight: '500' },
              ]}>
                {STEP_LABELS[i]}
              </Text>
            </View>
          ))}
        </View>

        {failed && (
          <View style={[s.errorBox, { backgroundColor: T.error + '12', borderColor: T.error + '30' }]}>
            <Feather name="alert-circle" size={16} color={T.error} />
            <Text style={[s.errorText, { color: T.error }]}>{failed}</Text>
          </View>
        )}

        {failed && (
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: T.primary }, retrying && { opacity: 0.6 }]}
            onPress={() => { setRetrying(true); run().finally(() => setRetrying(false)); }}
            disabled={retrying}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#FFF" />
            <Text style={s.retryBtnText}>Retry Issuance</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 20,
    paddingTop: Platform.OS === 'web' ? 0 : 40,
  },
  iconRing: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20,
  },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20, fontWeight: '500' },
  steps: { width: '100%', gap: 18, padding: 24, borderRadius: 24, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 24, alignItems: 'center' },
  label: { fontSize: 15, flex: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 16, padding: 16, width: '100%',
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 60, borderRadius: 20, width: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});

