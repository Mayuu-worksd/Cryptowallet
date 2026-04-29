import React, { useState, useRef } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Image, Animated, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import LivenessCheck from '../components/kyc/LivenessCheck';

const TOTAL_STEPS = 5;
type Phase = 'face_align' | 'liveness' | 'take_selfie' | 'captured';

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${(step / total) * 100}%` }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 4, backgroundColor: Theme.colors.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: 4, backgroundColor: Theme.colors.primary, borderRadius: 2 },
});

export default function KYCLivenessScreen({ navigation, route }: any) {
  const { docType, kycData, docImages } = route?.params ?? {};
  const [permission, requestPerm] = useCameraPermissions();
  const [phase, setPhase]         = useState<Phase>('face_align');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const shutterAnim = useRef(new Animated.Value(0)).current;
  const cameraRef   = useRef<CameraView>(null);

  const handleCaptureSelfie = async () => {
    if (capturing) return;
    setCapturing(true);

    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 1, duration: 80,  useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        exif: false,
      });

      if (photo?.uri) {
        setSelfieUri(photo.uri);
        setPhase('captured');
      } else {
        Alert.alert('Capture Failed', 'Could not take a photo. Please try again.');
      }
    } catch {
      Alert.alert('Camera Error', 'Failed to capture selfie. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = () => {
    if (!selfieUri) {
      Alert.alert('Selfie Required', 'Please capture your selfie before submitting.');
      return;
    }
    navigation.navigate('KYCProcessing', { kycData, docType, docImages, selfieUri, selfieMode: 'liveness' });
  };

  if (!permission) return <View style={s.root} />;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center]}>
        <Feather name="camera-off" size={48} color={Theme.colors.textDim} />
        <Text style={s.permTitle}>Camera Access Required</Text>
        <Text style={s.permSub}>We need camera access for the selfie and liveness check.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPerm}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ProgressBar step={5} total={TOTAL_STEPS} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {phase === 'face_align'  ? 'Align Your Face'  :
           phase === 'liveness'    ? 'Liveness Check'   :
           phase === 'take_selfie' ? 'Take Selfie'      :
                                     'Selfie Captured'}
        </Text>
        <Text style={s.stepLabel}>5 of {TOTAL_STEPS}</Text>
      </View>

      <View style={s.phaseRow}>
        {([
          { key: 'face_align',  label: 'Align' },
          { key: 'liveness',    label: 'Liveness' },
          { key: 'take_selfie', label: 'Selfie' },
        ] as { key: Phase; label: string }[]).map((p, i) => {
          const order: Phase[] = ['face_align', 'liveness', 'take_selfie', 'captured'];
          const done   = order.indexOf(phase) > order.indexOf(p.key);
          const active = phase === p.key;
          return (
            <View key={p.key} style={[s.phasePill, active && s.phasePillActive, done && s.phasePillDone]}>
              {done
                ? <Feather name="check" size={11} color={Theme.colors.success} />
                : <Text style={[s.phasePillNum, active && { color: Theme.colors.primary }]}>{i + 1}</Text>
              }
              <Text style={[s.phasePillText, active && { color: Theme.colors.primary }, done && { color: Theme.colors.success }]}>
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={s.cameraWrap}>
        {phase === 'captured' && selfieUri ? (
          <View style={{ flex: 1 }}>
            <Image source={{ uri: selfieUri }} style={{ flex: 1 }} resizeMode="cover" />
            <View style={s.checkOverlay}>
              <Feather name="check-circle" size={64} color={Theme.colors.success} />
            </View>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={s.camera} facing="front" />
            <Animated.View style={[s.shutter, { opacity: shutterAnim }]} />

            <View style={s.overlayWrap}>
              <View style={s.ovalGuide} />
            </View>

            {phase === 'liveness' && (
              <View style={s.livenessOverlay}>
                <LivenessCheck onComplete={() => {
                  setTimeout(() => setPhase('take_selfie'), 700);
                }} />
              </View>
            )}
          </>
        )}
      </View>

      <View style={s.footer}>
        {phase === 'face_align' && (
          <>
            <Text style={s.hint}>
              Center your face fully inside the oval with good lighting, then tap Continue
            </Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => setPhase('liveness')}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>My Face is Ready</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </TouchableOpacity>
          </>
        )}

        {phase === 'liveness' && (
          <Text style={s.hint}>
            Follow each instruction shown — complete the action before the timer runs out
          </Text>
        )}

        {phase === 'take_selfie' && (
          <>
            <Text style={s.hint}>
              Keep your face in the oval and tap the button to capture
            </Text>
            <TouchableOpacity
              style={[s.captureBtn, capturing && s.captureBtnDisabled]}
              onPress={handleCaptureSelfie}
              disabled={capturing}
              activeOpacity={0.7}
            >
              <View style={[s.captureBtnInner, capturing && { backgroundColor: Theme.colors.textDim }]} />
            </TouchableOpacity>
          </>
        )}

        {phase === 'captured' && (
          <>
            <Text style={s.capturedLabel}>Selfie captured</Text>
            <Text style={s.matchNote}>
              Your selfie will be matched against your ID — no codes needed
            </Text>
            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Text style={s.submitBtnText}>Submit for Review</Text>
              <Feather name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.surfaceHigh,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Theme.colors.surfaceLow },
  headerTitle: { fontSize: 18, fontWeight: '900', color: Theme.colors.text, letterSpacing: -0.5 },
  stepLabel: { fontSize: 12, fontWeight: '800', color: Theme.colors.textMuted, opacity: 0.7 },
  phaseRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 20 },
  phasePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Theme.roundness.full,
    backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.surfaceHigh,
  },
  phasePillActive: { borderColor: Theme.colors.primary, backgroundColor: `${Theme.colors.primary}10` },
  phasePillDone:   { borderColor: Theme.colors.success, backgroundColor: `${Theme.colors.success}10` },
  phasePillNum:  { fontSize: 11, fontWeight: '900', color: Theme.colors.textMuted },
  phasePillText: { fontSize: 13, fontWeight: '800', color: Theme.colors.textMuted },
  cameraWrap: {
    flex: 1, margin: 20, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 1, borderColor: Theme.colors.surfaceHigh,
  },
  camera: { flex: 1 },
  shutter: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFF' },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  ovalGuide: {
    width: 220, height: 280, borderRadius: 110,
    borderWidth: 2.5, borderColor: '#FFFFFF60',
  },
  livenessOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00000080',
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00000080',
  },
  footer: {
    paddingHorizontal: 24, paddingBottom: 40, gap: 16,
    alignItems: 'center', zIndex: 10,
  },
  hint: { fontSize: 14, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: Theme.roundness.xl, backgroundColor: Theme.colors.primary, width: '100%',
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  captureBtn: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 4, borderColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  captureBtnDisabled: { borderColor: Theme.colors.textDim, opacity: 0.5 },
  captureBtnInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primary,
  },
  capturedLabel: { fontSize: 18, fontWeight: '900', color: Theme.colors.success, marginBottom: 4 },
  matchNote: { fontSize: 14, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: Theme.roundness.xl, backgroundColor: Theme.colors.primary, width: '100%',
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.2 },
  permTitle: { fontSize: 22, fontWeight: '900', color: Theme.colors.text, textAlign: 'center', letterSpacing: -0.5 },
  permSub: { fontSize: 15, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  permBtn: {
    height: 58, paddingHorizontal: 36, borderRadius: Theme.roundness.xl,
    backgroundColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  permBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});


