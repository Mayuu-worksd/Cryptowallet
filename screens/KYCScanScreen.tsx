import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Image, Animated, Alert, Dimensions, StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import Svg, { Path, Rect, G } from 'react-native-svg';
import type { DocType } from './KYCDocumentScreen';

const { width, height } = Dimensions.get('window');
const TOTAL_STEPS = 5;

const DOC_LABELS: Record<DocType, string> = {
  national_id:     'National ID',
  passport:        'Passport',
  drivers_license: "Driver's License",
};
const NEEDS_BACK: DocType[] = ['national_id', 'drivers_license'];

const FRAME_W = width * 0.85;
const FRAME_H = FRAME_W * 0.63;

export default function KYCScanScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const docType: DocType = route?.params?.docType ?? 'passport';
  const kycData          = route?.params?.kycData ?? {};
  const needsBack        = NEEDS_BACK.includes(docType);

  const [side, setSide]           = useState<'front' | 'back'>('front');
  const [permission, requestPerm] = useCameraPermissions();
  const [captured, setCaptured]   = useState<string | null>(null);
  const [frontUri, setFrontUri]   = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [feedback, setFeedback]   = useState('Position document');
  
  const cameraRef   = useRef<CameraView>(null);
  const shutterAnim = useRef(new Animated.Value(0)).current;
  const scanAnim    = useRef(new Animated.Value(0)).current;
  const cornerAnim  = useRef(new Animated.Value(0)).current;
  const rippleAnim  = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    // Start corner animation
    Animated.spring(cornerAnim, { toValue: 1, useNativeDriver: true, tension: 40, friction: 8 }).start();
  }, []);

  useEffect(() => {
    if (captured) {
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    } else {
      successAnim.setValue(0);
    }
  }, [captured]);

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    setFeedback('Hold steady...');

    // Ripple animation
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Shutter flash
    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setFeedback('Captured!');
        setCaptured(photo.uri);
      }
    } catch (err) {
      setFeedback('Capture failed');
      Alert.alert('Error', 'Could not capture photo.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCaptured(null);
    setFeedback('Position document');
  };

  const handleAccept = () => {
    if (!captured) return;
    if (side === 'front' && needsBack) {
      setFrontUri(captured);
      setCaptured(null);
      setSide('back');
      setFeedback('Scan back side');
    } else {
      const docs = needsBack
        ? { frontUri, backUri: captured }
        : { frontUri: captured, backUri: null };
      navigation.navigate('KYCSelfieMode', { docType, kycData, docImages: docs });
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: T.background }} />;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center, { backgroundColor: T.background }]}>
        <Feather name="camera-off" size={64} color={T.textDim} />
        <Text style={[s.permTitle, { color: T.text }]}>Camera Permission</Text>
        <Text style={[s.permSub, { color: T.textDim }]}>We need camera access to scan your documents for verification.</Text>
        <TouchableOpacity style={[s.permBtn, { backgroundColor: T.primary }]} onPress={requestPerm}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const docLabel  = DOC_LABELS[docType];

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Text style={[s.headerTitle, { color: T.text }]}>Scan {docLabel}</Text>
          <View style={s.progressContainer}>
             <View style={[s.progressPill, { backgroundColor: T.surfaceHigh }]}>
               <View style={[s.progressFill, { width: side === 'front' ? '50%' : '100%', backgroundColor: T.primary }]} />
             </View>
             <Text style={[s.progressText, { color: T.text }]}>{side === 'front' ? 'FRONT' : 'BACK'}</Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Camera Section */}
      <View style={s.cameraContainer}>
        {captured ? (
          <View style={s.previewContainer}>
            <Image source={{ uri: captured }} style={s.previewImage} resizeMode="cover" />
            <Animated.View style={[s.successOverlay, { opacity: successAnim }]}>
              <LinearGradient colors={['transparent', '#00C85380']} style={StyleSheet.absoluteFill} />
              <Animated.View style={{ transform: [{ scale: successAnim }] }}>
                <View style={s.successCheckCircle}>
                  <Feather name="check" size={48} color="#FFF" />
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={s.camera} facing="back" />
            
            {/* Overlay */}
            <View style={s.overlayLayer}>
              {/* Dark edges */}
              <View style={s.edgeBox} />
              <View style={s.centerRow}>
                <View style={s.edgeSide} />
                <View style={s.frameContainer}>
                  {/* Corners */}
                  <Animated.View style={[s.cornerTL, { transform: [{ scale: cornerAnim }] }]} />
                  <Animated.View style={[s.cornerTR, { transform: [{ scale: cornerAnim }] }]} />
                  <Animated.View style={[s.cornerBL, { transform: [{ scale: cornerAnim }] }]} />
                  <Animated.View style={[s.cornerBR, { transform: [{ scale: cornerAnim }] }]} />
                  
                  {/* Scan Line */}
                  <Animated.View style={[s.scanLine, { 
                    transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H] }) }] 
                  }]}>
                    <LinearGradient colors={['transparent', '#EC262960', 'transparent']} style={{ flex: 1 }} />
                  </Animated.View>
                </View>
                <View style={s.edgeSide} />
              </View>
              <View style={s.edgeBox} />
            </View>

            <Animated.View style={[s.shutterFlash, { opacity: shutterAnim }]} />
          </>
        )}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={[s.feedbackPill, { backgroundColor: captured ? `${T.success}20` : T.surfaceLow }]}>
          <Text style={[s.feedbackText, { color: captured ? T.success : T.text }]}>{feedback}</Text>
        </View>

        {captured ? (
          <View style={s.footerActions}>
            <TouchableOpacity style={[s.retakeBtn, { backgroundColor: T.surfaceLow }]} onPress={handleRetake}>
              <Feather name="refresh-cw" size={18} color={T.text} />
              <Text style={[s.btnTextLabel, { color: T.text }]}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.acceptBtn, { backgroundColor: T.primary }]} onPress={handleAccept}>
              <Text style={s.acceptBtnText}>{side === 'front' && needsBack ? 'Scan Back' : 'Continue'}</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.captureContainer}>
             <Animated.View style={[s.ripple, { 
               backgroundColor: T.text,
               opacity: rippleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0] }),
               transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }]
             }]} />
             <TouchableOpacity style={[s.captureBtn, { borderColor: T.text }]} onPress={handleCapture} activeOpacity={1}>
                <View style={[s.captureInner, { backgroundColor: T.primary }]} />
             </TouchableOpacity>
             <Text style={[s.hintText, { color: T.text }]}>Tap to capture</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 48, 
    paddingBottom: 20 
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  progressPill: { width: 60, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, fontWeight: '900', opacity: 0.7, letterSpacing: 1 },
  
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  previewContainer: { flex: 1 },
  previewImage: { flex: 1 },
  successOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  successCheckCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#00C853', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFF' },
  
  overlayLayer: { ...StyleSheet.absoluteFillObject },
  edgeBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  centerRow: { flexDirection: 'row', height: FRAME_H },
  edgeSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  frameContainer: { width: FRAME_W, position: 'relative' },
  
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FFF', borderTopLeftRadius: 16 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FFF', borderTopRightRadius: 16 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFF', borderBottomLeftRadius: 16 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFF', borderBottomRightRadius: 16 },
  
  scanLine: { position: 'absolute', left: 0, right: 0, height: 40, zIndex: 5, overflow: 'hidden' },
  shutterFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFF' },
  
  footer: { paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingTop: 20, alignItems: 'center' },
  feedbackPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 30 },
  feedbackText: { fontSize: 15, fontWeight: '800' },
  
  footerActions: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, width: '100%' },
  retakeBtn: { flex: 1, height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  acceptBtn: { flex: 2, height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnTextLabel: { fontSize: 16, fontWeight: '800' },
  acceptBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  
  captureContainer: { alignItems: 'center', position: 'relative' },
  captureBtn: { width: 84, height: 84, borderRadius: 42, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32 },
  ripple: { position: 'absolute', top: 0, width: 84, height: 84, borderRadius: 42 },
  hintText: { fontSize: 13, fontWeight: '700', marginTop: 12, opacity: 0.6 },
  
  permTitle: { fontSize: 24, fontWeight: '900', marginTop: 20 },
  permSub: { fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 },
  permBtn: { marginTop: 30, height: 60, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' }
});
