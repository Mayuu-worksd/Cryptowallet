import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, Alert, Dimensions, StatusBar, Easing
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const { width, height } = Dimensions.get('window');
const RECORD_SECONDS = 6;

const INSTRUCTIONS = [
  "Center your face",
  "Blink slowly twice",
  "Turn slightly left",
  "Now look forward",
  "Hold still...",
  "Done!"
];

import { useWallet } from '../store/WalletContext';

export default function KYCVideoLivenessScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { docType, kycData, docImages } = route?.params ?? {};
  const [permission, requestPerm] = useCameraPermissions();
  const [micPermission, requestMicPerm] = useMicrophonePermissions();
  const [phase, setPhase]         = useState<'ready' | 'recording' | 'done'>('ready');
  const [countdown, setCountdown] = useState(RECORD_SECONDS);
  const [instrIdx, setInstrIdx]   = useState(0);
  const [videoUri, setVideoUri]   = useState<string | null>(null);
  const [recordingStarted, setRecordingStarted] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const instrAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'recording') {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      ).start();
      Animated.timing(progressAnim, { toValue: 1, duration: RECORD_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    } else {
      spinAnim.stopAnimation();
      progressAnim.setValue(0);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording') {
      const interval = (RECORD_SECONDS * 1000) / (INSTRUCTIONS.length - 1);
      const instrTimer = setInterval(() => {
         setInstrIdx(prev => Math.min(prev + 1, INSTRUCTIONS.length - 1));
      }, interval);
      return () => clearInterval(instrTimer);
    }
  }, [phase]);

  useEffect(() => {
     Animated.sequence([
        Animated.timing(instrAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(instrAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
     ]).start();
  }, [instrIdx]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current || recordingStarted) return;
    setRecordingStarted(true);
    setPhase('recording');
    setCountdown(RECORD_SECONDS);
    setInstrIdx(0);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-stop recording after duration
    stopTimerRef.current = setTimeout(() => {
      try { cameraRef.current?.stopRecording(); } catch {}
    }, RECORD_SECONDS * 1000);

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: RECORD_SECONDS });
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (video?.uri) {
        setVideoUri(video.uri);
        setPhase('done');
        Animated.timing(successFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      } else {
        setPhase('ready');
        setRecordingStarted(false);
      }
    } catch (e: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      // If stopped normally, video may still be valid — check videoUri
      if (!videoUri) {
        setPhase('ready');
        setRecordingStarted(false);
      }
    }
  };

  const handleRetake = () => {
    setVideoUri(null);
    setPhase('ready');
    setCountdown(RECORD_SECONDS);
    setInstrIdx(0);
    setRecordingStarted(false);
    successFade.setValue(0);
  };

  const handleAccept = () => {
    navigation.navigate('KYCProcessing', {
      docType, kycData, docImages,
      selfieUri: null,
      selfieVideoUri: videoUri,
      selfieMode: 'video',
    });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: T.background }} />;

  if (!permission.granted || !micPermission?.granted) {
    return (
      <View style={[s.root, s.center, { backgroundColor: T.background }]}>
        <Feather name="camera-off" size={64} color={T.textDim} />
        <Text style={[s.permTitle, { color: T.text }]}>Camera & Mic Required</Text>
        <Text style={[s.permSub, { color: T.textDim }]}>Video recording needs both camera and microphone access.</Text>
        <TouchableOpacity style={[s.permBtn, { backgroundColor: T.primary }]} onPress={async () => {
          if (!permission.granted) await requestPerm();
          if (!micPermission?.granted) await requestMicPerm();
        }}>
          <Text style={s.permBtnText}>Enable Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Face Recording</Text>
        <View style={[s.stepPill, { backgroundColor: T.surfaceHigh }]}>
           <Text style={[s.stepPillText, { color: T.text }]}>5 of 6</Text>
        </View>
      </View>

      {/* Main Area */}
      <View style={s.cameraContainer}>
        {/* Always keep CameraView mounted — unmounting mid-record crashes */}
        <CameraView
          ref={cameraRef}
          style={[s.camera, phase === 'done' && { opacity: 0 }]}
          facing="front"
          mode="video"
        />
        
        {/* Overlay Layers */}
        <View style={s.overlayLayer}>
           <View style={s.edge} />
           <View style={s.centerRow}>
              <View style={s.edge} />
              <View style={s.ovalFrame}>
                 <Animated.View style={[s.spinContainer, { transform: [{ rotate: spin }] }]}>
                    <LinearGradient 
                      colors={phase === 'recording' ? [T.primary, 'transparent', T.primary] : ['#FFF', 'transparent']} 
                      style={s.gradientBorder} 
                    />
                 </Animated.View>
                 <View style={s.ovalHole} />
              </View>
              <View style={s.edge} />
           </View>
           <View style={s.edge} />
        </View>

        {/* Success Overlay */}
        {phase === 'done' && (
          <Animated.View style={[s.successOverlay, { opacity: successFade }]}>
             <LinearGradient colors={['#00C853', '#009624']} style={StyleSheet.absoluteFill} />
             <View style={s.successContent}>
                <View style={s.checkCircle}>
                   <Feather name="check" size={50} color="#00C853" />
                </View>
                <Text style={s.successTitle}>Verified Successfully</Text>
                <Text style={s.successSub}>Your face scan matches your document.</Text>
             </View>
          </Animated.View>
        )}
      </View>

      {/* Bottom UI */}
      <View style={s.footer}>
         {phase !== 'done' ? (
           <View style={s.instructionCard}>
              <Animated.Text style={[s.instructionText, { color: T.text, opacity: instrAnim, transform: [{ translateY: instrAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
                 {INSTRUCTIONS[instrIdx]}
              </Animated.Text>
              
              <View style={s.controls}>
                 {phase === 'ready' ? (
                    <TouchableOpacity style={s.startBtn} onPress={startRecording}>
                       <LinearGradient colors={[T.primary, T.primaryDark || T.primary]} style={s.startBtnGrad}>
                          <Feather name="video" size={24} color="#FFF" />
                       </LinearGradient>
                       <Text style={[s.btnHint, { color: T.text }]}>Tap to Start</Text>
                    </TouchableOpacity>
                 ) : (
                    <View style={s.recordingControl}>
                       <Svg width={100} height={100} style={s.progressRing}>
                          <Circle cx="50" cy="50" r="45" stroke={T.surfaceHigh} strokeWidth="6" fill="none" />
                          <AnimatedCircle 
                            cx="50" cy="50" r="45" stroke={T.primary} strokeWidth="6" fill="none" 
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={progressAnim.interpolate({
                               inputRange: [0, 1],
                               outputRange: [2 * Math.PI * 45, 0]
                            })}
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                          />
                       </Svg>
                       <View style={[s.recSquare, { backgroundColor: T.primary }]} />
                       <Text style={[s.timerText, { color: T.text }]}>{countdown}s</Text>
                    </View>
                 )}
              </View>
           </View>
         ) : (
           <View style={s.doneActions}>
              <TouchableOpacity style={[s.retakeBtn, { backgroundColor: T.surfaceLow }]} onPress={handleRetake}>
                 <Feather name="refresh-cw" size={18} color={T.text} />
                 <Text style={[s.retakeText, { color: T.text }]}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.continueBtn, { backgroundColor: T.success }]} onPress={handleAccept}>
                 <Text style={s.continueText}>Continue</Text>
                 <Feather name="arrow-right" size={20} color="#FFF" />
              </TouchableOpacity>
           </View>
         )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  stepPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stepPillText: { fontSize: 12, fontWeight: '800', opacity: 0.8 },
  
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  
  overlayLayer: { ...StyleSheet.absoluteFillObject },
  edge: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  centerRow: { flexDirection: 'row', height: Math.min(320, height * 0.42) },
  ovalFrame: { width: 240, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ovalHole: { width: 240, height: Math.min(320, height * 0.42), borderRadius: 120, borderWidth: 2, borderColor: '#FFFFFF40' },
  spinContainer: { position: 'absolute', width: 250, height: Math.min(330, height * 0.44), alignItems: 'center', justifyContent: 'center' },
  gradientBorder: { width: '100%', height: '100%', borderRadius: 125 },
  
  successOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  successContent: { alignItems: 'center' },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  successSub: { color: '#FFF', fontSize: 16, opacity: 0.9, textAlign: 'center', paddingHorizontal: 40 },
  
  footer: { paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingTop: 20 },
  instructionCard: { alignItems: 'center', paddingHorizontal: 40 },
  instructionText: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 40, height: 60 },
  
  controls: { alignItems: 'center' },
  startBtn: { alignItems: 'center' },
  startBtnGrad: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnHint: { color: '#FFF', fontSize: 14, fontWeight: '700', opacity: 0.6 },
  
  recordingControl: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  progressRing: { position: 'absolute' },
  recSquare: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#EC2629' },
  timerText: { color: '#FFF', fontSize: 12, fontWeight: '900', position: 'absolute', bottom: -20 },
  
  doneActions: { flexDirection: 'row', paddingHorizontal: 24, gap: 16, width: '100%' },
  retakeBtn: { flex: 1, height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  continueBtn: { flex: 2, height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  retakeText: { fontSize: 16, fontWeight: '800' },
  continueText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  permTitle: { fontSize: 24, fontWeight: '900', marginTop: 20 },
  permSub: { fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 },
  permBtn: { marginTop: 30, height: 60, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' }
});
