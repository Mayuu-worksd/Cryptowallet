import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, Alert, Dimensions, StatusBar, Easing, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useWallet } from '../store/WalletContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const { width, height } = Dimensions.get('window');
const CODE_DISPLAY_SECONDS = 30;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function KYCCodeSelfieScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { docType, kycData, docImages } = route?.params ?? {};
  const [permission, requestPerm] = useCameraPermissions();
  const [phase, setPhase]         = useState<'show_code' | 'camera' | 'captured'>('show_code');
  const [code]                    = useState(generateCode);
  const [countdown, setCountdown] = useState(CODE_DISPLAY_SECONDS);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  
  const cameraRef   = useRef<CameraView>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Animations
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const arcAnim = useRef(new Animated.Value(1)).current;
  const shutterAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'show_code') {
      Animated.loop(
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      ).start();

      Animated.timing(arcAnim, { toValue: 0, duration: CODE_DISPLAY_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();

      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setPhase('camera');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      shimmerAnim.stopAnimation();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'camera') {
      Animated.loop(
        Animated.sequence([
           Animated.timing(arrowAnim, { toValue: 10, duration: 800, useNativeDriver: true }),
           Animated.timing(arrowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase]);

  const handleAccept = () => {
    navigation.navigate('KYCProcessing', {
      kycData,
      docImages,
      docType,
      selfieUri,
      selfieMode: 'code',
      uniqueCode: code,
    });
  };

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    
    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 1, duration: 80,  useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) {
        setSelfieUri(photo.uri);
        setPhase('captured');
      }
    } catch {
      Alert.alert('Error', 'Capture failed.');
    } finally {
      setCapturing(false);
    }
  };

  if (phase === 'show_code') {
    const shimmerX = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width]
    });

    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={s.header}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
              <Feather name="arrow-left" size={24} color={T.text} />
           </TouchableOpacity>
           <Text style={[s.headerTitle, { color: T.text }]}>Identity Check</Text>
           <View style={{ width: 44 }} />
        </View>

        <View style={s.body}>
           <View style={s.stepIndicator}>
              <View style={[s.step, { backgroundColor: T.primary, borderColor: T.primary }]}>
                 <Text style={[s.stepTextActive, { color: '#FFF' }]}>1</Text>
              </View>
              <View style={[s.stepLine, { backgroundColor: T.border }]} />
              <View style={[s.step, { borderColor: T.border }]}>
                 <Text style={[s.stepText, { color: T.textDim }]}>2</Text>
              </View>
              <View style={[s.stepLine, { backgroundColor: T.border }]} />
              <View style={[s.step, { borderColor: T.border }]}>
                 <Text style={[s.stepText, { color: T.textDim }]}>3</Text>
              </View>
           </View>
           
           <View style={s.stepLabels}>
              <Text style={[s.stepLabel, { color: T.text }]}>Write Code</Text>
              <Text style={[s.stepLabel, { color: T.textDim }]}>Take Selfie</Text>
              <Text style={[s.stepLabel, { color: T.textDim }]}>Submit</Text>
           </View>

           <View style={[s.codeCard, { backgroundColor: T.surface, borderColor: T.primary }]}>
              <Text style={[s.codeTitle, { color: T.textDim }]}>YOUR UNIQUE CODE</Text>
              <View style={s.codeContainer}>
                 <Text style={[s.codeText, { color: T.primary }]}>{code}</Text>
                 <Animated.View style={[s.shimmerWrap, { transform: [{ translateX: shimmerX }] }]}>
                    <LinearGradient colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={StyleSheet.absoluteFill} />
                 </Animated.View>
              </View>
              <Text style={[s.codeHint, { color: T.textDim }]}>Write this on paper in large letters</Text>
           </View>

           <View style={s.timerContainer}>
              <Svg width={120} height={120} style={s.timerSvg}>
                 <Circle cx="60" cy="60" r="54" stroke={T.surfaceLow} strokeWidth="4" fill="none" />
                 <AnimatedCircle 
                   cx="60" cy="60" r="54" stroke={T.primary} strokeWidth="4" fill="none" 
                   strokeDasharray={`${2 * Math.PI * 54}`}
                   strokeDashoffset={arcAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2 * Math.PI * 54, 0]
                   })}
                   strokeLinecap="round"
                   transform="rotate(-90 60 60)"
                 />
              </Svg>
              <View style={s.timerContent}>
                 <Text style={[s.timerNum, { color: T.text }]}>{countdown}</Text>
                 <Text style={[s.timerSec, { color: T.textDim }]}>SEC</Text>
              </View>
           </View>

           <TouchableOpacity style={[s.readyBtn, { backgroundColor: T.primary }]} onPress={() => { clearInterval(timerRef.current!); setPhase('camera'); }}>
              <Text style={s.readyBtnText}>I'm Ready</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
           </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.cameraRoot, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={s.cameraHeader}>
        <TouchableOpacity onPress={() => setPhase('show_code')} style={[s.backBtnDark, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={[s.codeBanner, { backgroundColor: T.primary }]}>
           <Text style={s.bannerLabel}>CODE: </Text>
           <Text style={s.bannerCode}>{code}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.cameraViewWrap}>
        {phase === 'captured' ? (
          <Image source={{ uri: selfieUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            <View style={s.cameraOverlay}>
               <View style={[s.ovalHole, { borderColor: T.surfaceHigh }]} />
               <Animated.View style={[s.paperGuide, { transform: [{ translateY: arrowAnim }] }]}>
                  <View style={[s.arrow, { borderBottomColor: T.primary }]} />
                  <Text style={[s.guideText, { color: T.primary }]}>HOLD PAPER HERE</Text>
               </Animated.View>
            </View>
            <Animated.View style={[s.shutterFlash, { opacity: shutterAnim }]} />
          </>
        )}
      </View>

      <View style={s.cameraFooter}>
        {phase === 'camera' ? (
          <>
            <Text style={[s.cameraHint, { color: T.text }]}>Show your face and the code clearly</Text>
            <TouchableOpacity style={[s.captureCircle, { borderColor: T.text }]} onPress={handleCapture}>
               <View style={[s.captureInnerCircle, { backgroundColor: T.primary }]} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.capturedActions}>
             <TouchableOpacity style={[s.retakeBtnDark, { backgroundColor: T.surfaceLow }]} onPress={() => setPhase('camera')}>
                <Feather name="refresh-cw" size={18} color={T.text} />
                <Text style={[s.btnTextDark, { color: T.text }]}>Retake</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[s.confirmBtn, { backgroundColor: T.success }]} onPress={handleAccept}>
                <Text style={s.confirmText}>Confirm & Submit</Text>
                <Feather name="check" size={20} color="#FFF" />
             </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  cameraRoot: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 20 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  
  body: { flex: 1, paddingHorizontal: 30, alignItems: 'center', paddingTop: 20 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  step: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 12, fontWeight: '900' },
  stepTextActive: { fontSize: 12, fontWeight: '900' },
  stepLine: { width: 40, height: 2, marginHorizontal: 8 },
  stepLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 40 },
  stepLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center', flex: 1 },
  
  codeCard: { width: '100%', padding: 24, borderRadius: 24, borderWidth: 2, alignItems: 'center', marginBottom: 40 },
  codeTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  codeContainer: { position: 'relative', overflow: 'hidden', paddingHorizontal: 20 },
  codeText: { fontSize: 56, fontWeight: '900', letterSpacing: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  shimmerWrap: { ...StyleSheet.absoluteFillObject, width: '200%' },
  codeHint: { fontSize: 13, fontWeight: '600', marginTop: 16 },
  
  timerContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  timerSvg: { position: 'absolute' },
  timerContent: { alignItems: 'center' },
  timerNum: { fontSize: 28, fontWeight: '900' },
  timerSec: { fontSize: 10, fontWeight: '800' },
  
  readyBtn: { width: '100%', height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  readyBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 20 },
  backBtnDark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  codeBanner: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  bannerLabel: { color: '#FFF', fontSize: 12, fontWeight: '800', opacity: 0.8 },
  bannerCode: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  
  cameraViewWrap: { flex: 1, position: 'relative' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ovalHole: { width: 220, height: 300, borderRadius: 110, borderWidth: 2 },
  paperGuide: { position: 'absolute', bottom: 40, alignItems: 'center' },
  arrow: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 15, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginBottom: 8 },
  guideText: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  shutterFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFF' },
  
  cameraFooter: { paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingTop: 20, alignItems: 'center' },
  cameraHint: { fontSize: 14, fontWeight: '700', marginBottom: 20, opacity: 0.7 },
  captureCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  captureInnerCircle: { width: 64, height: 64, borderRadius: 32 },
  
  capturedActions: { flexDirection: 'row', width: '100%', paddingHorizontal: 24, gap: 16 },
  retakeBtnDark: { flex: 1, height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  confirmBtn: { flex: 2, height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  btnTextDark: { fontSize: 16, fontWeight: '800' },
  confirmText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});
