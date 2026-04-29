import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity, Dimensions, StatusBar, Easing, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { kycService } from '../services/supabaseService';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

type StepState = 'waiting' | 'loading' | 'done' | 'error';

const STEP_LABELS = [
  'Verifying identity data',
  'Analyzing document quality',
  'Processing facial biometrics',
  'Finalizing security review',
];

export default function KYCProcessingScreen({ navigation, route }: any) {
  const { walletAddress, refreshKYCStatus, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { kycData, docImages, selfieUri, selfieVideoUri, selfieMode, uniqueCode, docType } = route?.params ?? {};

  const [steps, setSteps]     = useState<StepState[]>(['loading', 'waiting', 'waiting', 'waiting']);
  const [failed, setFailed]   = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Animations
  const shieldAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnims = STEP_LABELS.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shieldAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shieldAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    fadeAnims.forEach((anim, i) => {
      Animated.timing(anim, { toValue: 1, duration: 500, delay: i * 200, useNativeDriver: true }).start();
    });
  }, []);

  useEffect(() => {
    const doneCount = steps.filter(s => s === 'done').length;
    const loadingCount = steps.filter(s => s === 'loading').length;
    const total = STEP_LABELS.length;
    const targetProgress = (doneCount / total) + (loadingCount > 0 ? (0.5 / total) : 0);
    
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 800,
      useNativeDriver: false
    }).start();
  }, [steps]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const setStep = (i: number, state: StepState) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? state : s));
    if (state === 'error') triggerShake();
  };

  const run = async () => {
    setFailed(null);
    setSteps(['loading', 'waiting', 'waiting', 'waiting']);

    try {
      const docTypeValue = kycData?.document_type ?? docType ?? '';
      try {
        await kycService.submitKYC(walletAddress, {
          full_name: kycData?.name ?? '', email: kycData?.email ?? '',
          phone: kycData?.phone ?? '', nationality: kycData?.nationality ?? '',
          dob: kycData?.dob ?? '', address: kycData?.address ?? '',
          document_type: docTypeValue,
        });
      } catch (err: any) {
        const msg = err?.message ?? '';
        if (msg.startsWith('ALREADY_SUBMITTED')) {
          await kycService.updateDetails(walletAddress, { document_type: docTypeValue } as any);
        } else throw err;
      }
      setStep(0, 'done');
    } catch {
      setStep(0, 'error');
      setFailed('Unable to save details. Please check your network.');
      return;
    }

    setStep(1, 'loading');
    let documentUrl: string;
    try {
      const frontUri = docImages?.frontUri;
      if (!frontUri) throw new Error('Document photo missing.');
      documentUrl = await kycService.uploadFile(walletAddress, frontUri, 'document', 'image/jpeg');
      setStep(1, 'done');
    } catch (e: any) {
      setStep(1, 'error');
      setFailed(e?.message ?? 'Document upload failed.');
      return;
    }

    setStep(2, 'loading');
    let selfieUrl: string;
    try {
      if (selfieMode === 'video') {
        if (!selfieVideoUri) throw new Error('Video record missing.');
        selfieUrl = await kycService.uploadFile(walletAddress, selfieVideoUri, 'selfie_video', 'video/mp4');
      } else {
        if (!selfieUri) throw new Error('Selfie photo missing.');
        selfieUrl = await kycService.uploadFile(walletAddress, selfieUri, 'selfie', 'image/jpeg');
      }
      setStep(2, 'done');
    } catch (e: any) {
      setStep(2, 'error');
      setFailed(e?.message ?? 'Biometric upload failed.');
      return;
    }

    setStep(3, 'loading');
    try {
      await kycService.finalizeSubmission(walletAddress, documentUrl, selfieUrl, {
        selfieVideoUrl: selfieMode === 'video' ? selfieUrl : undefined,
        uniqueCode:     selfieMode === 'code'  ? uniqueCode : undefined,
      });
      if (refreshKYCStatus) await refreshKYCStatus();
      setStep(3, 'done');
      setTimeout(() => navigation.replace('KYCResult'), 1000);
    } catch {
      setStep(3, 'error');
      setFailed('Submission failed. Please try again.');
    }
  };

  useEffect(() => { run(); }, []);

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={s.body}>
        <Animated.View style={[s.shieldContainer, { transform: [{ translateX: shakeAnim }] }]}>
          <Svg width={180} height={180} style={s.progressRing}>
             <Circle cx="90" cy="90" r="82" stroke={T.surfaceLow} strokeWidth="6" fill="none" />
             <AnimatedCircle 
               cx="90" cy="90" r="82" stroke={T.primary} strokeWidth="6" fill="none" 
               strokeDasharray={`${2 * Math.PI * 82}`}
               strokeDashoffset={progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2 * Math.PI * 82, 0]
               })}
               strokeLinecap="round"
               transform="rotate(-90 90 90)"
             />
          </Svg>
          <Animated.View style={[s.shieldCircle, { backgroundColor: `${T.primary}10`, transform: [{ scale: shieldAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }]}>
             <Feather name="shield" size={60} color={T.primary} />
          </Animated.View>
        </Animated.View>

        <Text style={[s.title, { color: T.text }]}>Processing Verification</Text>
        <Text style={[s.sub, { color: T.textDim }]}>We are encrypting and uploading your documents to our secure servers.</Text>

        <View style={s.checklist}>
          {STEP_LABELS.map((label, i) => (
            <StepCard key={i} label={label} state={steps[i]} T={T} fadeAnim={fadeAnims[i]} />
          ))}
        </View>

        {failed && (
          <Animated.View style={[s.errorCard, { backgroundColor: `${T.error}10`, borderColor: `${T.error}30`, transform: [{ translateX: shakeAnim }] }]}>
            <Feather name="alert-circle" size={20} color={T.error} />
            <View style={{ flex: 1 }}>
               <Text style={[s.errorTitle, { color: T.error }]}>Upload Error</Text>
               <Text style={[s.errorSub, { color: T.error }]}>{failed}</Text>
            </View>
            <TouchableOpacity style={[s.retryBtnSmall, { backgroundColor: T.error }]} onPress={() => { setRetrying(true); run().finally(() => setRetrying(false)); }}>
               <Feather name="refresh-cw" size={16} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function StepCard({ label, state, T, fadeAnim }: { label: string, state: StepState, T: any, fadeAnim: Animated.Value }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'loading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }

    if (state === 'done') {
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }).start();
    }
  }, [state]);

  return (
    <Animated.View style={[
      s.stepCard, 
      { 
        backgroundColor: T.surface, 
        borderColor: state === 'loading' ? T.primary : T.border,
        opacity: fadeAnim,
        transform: [{ scale: pulse }]
      }
    ]}>
       {state === 'loading' && <Shimmer T={T} />}
       <View style={[s.stepIconWrap, { backgroundColor: state === 'done' ? `${T.success}15` : state === 'error' ? `${T.error}15` : T.surfaceLow }]}>
          {state === 'done' ? (
            <Animated.View style={{ transform: [{ scale: pop }] }}>
               <Feather name="check" size={16} color={T.success} />
            </Animated.View>
          ) : state === 'error' ? (
            <Feather name="x" size={16} color={T.error} />
          ) : state === 'loading' ? (
            <ActivityIndicator size="small" color={T.primary} />
          ) : (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.border }} />
          )}
       </View>
       <Text style={[s.stepLabelText, { color: state === 'waiting' ? T.textDim : T.text, fontWeight: state === 'loading' ? '800' : '700' }]}>{label}</Text>
    </Animated.View>
  );
}

const isDarkMode = (T: any) => T.background === '#131313';

function Shimmer({ T }: { T: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  const dark = isDarkMode(T);

  return (
    <View style={StyleSheet.absoluteFill}>
       <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient colors={['transparent', dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ flex: 1 }} />
       </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 24 },
  shieldContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  progressRing: { position: 'absolute' },
  shieldCircle: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginBottom: 12 },
  sub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40, opacity: 0.7 },
  
  checklist: { width: '100%', gap: 12 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  stepIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepLabelText: { fontSize: 15 },
  
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 20, borderWidth: 1.5, marginTop: 32, width: '100%' },
  errorTitle: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  errorSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  retryBtnSmall: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});
