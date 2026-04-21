import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Vibration, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';

export default function ScanScreen({ navigation, route }: any) {
  const { isDarkMode, network: appNetwork } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [torchOn, setTorchOn]           = useState(false);
  const [lastScan, setLastScan]         = useState('');
  const [scanInfo, setScanInfo]         = useState('');

  // Corner bracket animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Camera not supported on web — after hooks
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.center, { backgroundColor: T.background }]}>
        <View style={[styles.permBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={[styles.permIcon, { backgroundColor: T.primary + '20' }]}>
            <Feather name="monitor" size={36} color={T.primary} />
          </View>
          <Text style={[styles.permTitle, { color: T.text }]}>Not Available on Web</Text>
          <Text style={[styles.permSub, { color: T.textMuted }]}>
            QR scanning requires camera access. Please use the mobile app to scan QR codes.
          </Text>
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Feather name="arrow-left" size={16} color="#FFF" />
            <Text style={styles.permBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    processQRData(data);
  };

  const processQRData = (data: string) => {
    try {
      const { parseQRPayload } = require('./ReceiveScreen');
      const result = parseQRPayload(data);
      if (!result) return;
      setScanned(true);
      Vibration.vibrate(80);
      setLastScan(result.address);
      if (result.network !== appNetwork) {
        setScanInfo(`⚠️ QR is for ${result.network}, you are on ${appNetwork}`);
      }
      setTimeout(() => {
        navigation.navigate('Send', {
          scannedAddress: result.address,
          scannedNetwork: result.network,
        });
      }, 800);
    } catch {}
  };

  const handleGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setScanInfo('Gallery permission denied');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      // expo-image-picker doesn't decode QR natively
      // Show a helpful message to user
      setScanInfo('📌 Tip: Use camera to scan QR directly for best results');
    } catch {
      setScanInfo('Could not open gallery');
    }
  };

  // ── Permission not yet determined ──
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: T.background }]}>
        <Text style={{ color: T.textMuted, fontSize: 14 }}>Requesting camera permission...</Text>
      </View>
    );
  }

  // ── Permission denied ──
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: T.background }]}>
        <View style={[styles.permBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={[styles.permIcon, { backgroundColor: T.primary + '20' }]}>
            <Feather name="camera-off" size={36} color={T.primary} />
          </View>
          <Text style={[styles.permTitle, { color: T.text }]}>Camera Access Required</Text>
          <Text style={[styles.permSub, { color: T.textMuted }]}>
            Allow camera access to scan QR codes and autofill wallet addresses.
          </Text>
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: T.primary }]}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={16} color="#FFF" />
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={{ color: T.textMuted, fontSize: 14, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Dark overlay with cutout */}
      <View style={styles.overlay}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />

        {/* Middle row: dark | clear window | dark */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />

          {/* Scanner window */}
          <Animated.View style={[styles.scanWindow, { transform: [{ scale: pulse }] }]}>
            {/* Corner brackets */}
            {[
              { top: 0,    left: 0,    borderTopWidth: 3,    borderLeftWidth: 3  },
              { top: 0,    right: 0,   borderTopWidth: 3,    borderRightWidth: 3 },
              { bottom: 0, left: 0,    borderBottomWidth: 3, borderLeftWidth: 3  },
              { bottom: 0, right: 0,   borderBottomWidth: 3, borderRightWidth: 3 },
            ].map((corner, i) => (
              <View key={i} style={[styles.corner, corner, { borderColor: '#FF3B3B' }]} />
            ))}
            {/* Scan line */}
            <View style={styles.scanLine} />
          </Animated.View>

          <View style={styles.overlaySide} />
        </View>

        {/* Bottom area */}
        <View style={styles.overlayBottom}>
          <Text style={styles.scanHint}>
            {scanned ? '✓ QR Code detected!' : 'Point camera at a wallet QR code'}
          </Text>
          {!!scanInfo && (
            <View style={styles.scanInfoPill}>
              <Text style={styles.scanInfoText}>{scanInfo}</Text>
            </View>
          )}
          {scanned ? (
            <>
              <Text style={styles.scanResult} numberOfLines={1}>
                {lastScan.length > 30 ? `${lastScan.slice(0, 16)}...${lastScan.slice(-8)}` : lastScan}
              </Text>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={() => { setScanned(false); setLastScan(''); setScanInfo(''); }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={14} color="#FFF" />
                <Text style={styles.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={handleGallery}
              activeOpacity={0.8}
            >
              <Feather name="image" size={18} color="#FFF" />
              <Text style={styles.galleryText}>Choose from Gallery</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <TouchableOpacity
          style={[styles.headerBtn, torchOn && styles.headerBtnActive]}
          onPress={() => setTorchOn(p => !p)}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={20} color={torchOn ? '#FF3B3B' : '#FFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const WINDOW_SIZE = 260;
const CORNER_SIZE = 28;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Permission screen
  permBox: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 28, borderWidth: 1, alignItems: 'center', gap: 12 },
  permIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  permSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
  permBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayMiddle: { flexDirection: 'row', height: WINDOW_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', paddingTop: 28, gap: 10 },

  // Scanner window
  scanWindow: { width: WINDOW_SIZE, height: WINDOW_SIZE, position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  scanLine: {
    position: 'absolute', left: 12, right: 12, top: '50%',
    height: 2, backgroundColor: '#FF3B3B', opacity: 0.85,
    shadowColor: '#FF3B3B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6,
  },

  // Bottom hints
  scanHint: { color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  scanResult: { color: '#FF3B3B', fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  scanInfoPill: { backgroundColor: 'rgba(255,158,11,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B', marginHorizontal: 20 },
  scanInfoText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,59,59,0.25)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#FF3B3B' },
  rescanText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  galleryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16,
  },
  headerBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  headerBtnActive: { backgroundColor: 'rgba(255,59,59,0.25)', borderWidth: 1, borderColor: '#FF3B3B' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
