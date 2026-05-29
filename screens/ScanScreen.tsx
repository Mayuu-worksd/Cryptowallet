import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Vibration, Animated, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { parseQRPayload } from './ReceiveScreen';

const WINDOW_SIZE = 260;
const CORNER_SIZE = 36;

export default function ScanScreen({ navigation }: any) {
  const { isDarkMode, network: appNetwork } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]     = useState(false);
  const [torchOn, setTorchOn]     = useState(false);
  const [lastScan, setLastScan]   = useState('');
  const [scanInfo, setScanInfo]   = useState('');
  const [camReady, setCamReady]   = useState(false);
  const [showCam, setShowCam]     = useState(false);

  // useFocusEffect: mount camera only when screen focused, destroy on leave
  useFocusEffect(
    useCallback(() => {
      // Small delay so the screen transition finishes before camera mounts
      const t = setTimeout(() => setShowCam(true), 400);
      return () => {
        clearTimeout(t);
        setShowCam(false);
        setCamReady(false);
        setScanned(false);
        setLastScan('');
        setScanInfo('');
      };
    }, [])
  );

  // Scan line animation
  const scanLinePos = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePos, { toValue: WINDOW_SIZE - 4, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLinePos, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>QR scanning is mobile only.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#FF3B3B', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#FF3B3B" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: '#0A0A0C' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Ionicons name="camera-outline" size={48} color="#FF3B3B" style={{ marginBottom: 16 }} />
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>Needed to scan QR codes</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#A1A5AB', fontWeight: '700' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(80);

    const trimmed = data.trim();

    // Check specific token URI schemes
    if (trimmed.toLowerCase().startsWith('bitcoin:')) {
      const addr = trimmed.slice(8).split('?')[0];
      setLastScan(addr);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: addr,
        scannedNetwork: 'Bitcoin Network',
        symbol: 'BTC'
      }), 600);
      return;
    }
    if (trimmed.toLowerCase().startsWith('solana:')) {
      const addr = trimmed.slice(7).split('?')[0];
      setLastScan(addr);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: addr,
        scannedNetwork: 'Solana Network',
        symbol: 'SOL'
      }), 600);
      return;
    }
    if (trimmed.toLowerCase().startsWith('tron:')) {
      const addr = trimmed.slice(5).split('?')[0];
      setLastScan(addr);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: addr,
        scannedNetwork: 'TRON Nile',
        symbol: 'TRX'
      }), 600);
      return;
    }
    if (trimmed.toLowerCase().startsWith('usdt:')) {
      const addr = trimmed.slice(5).split('?')[0];
      setLastScan(addr);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: addr,
        scannedNetwork: 'Ethereum',
        symbol: 'USDT'
      }), 600);
      return;
    }
    if (trimmed.toLowerCase().startsWith('usdc:')) {
      const addr = trimmed.slice(5).split('?')[0];
      setLastScan(addr);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: addr,
        scannedNetwork: 'Ethereum',
        symbol: 'USDC'
      }), 600);
      return;
    }

    if (data.startsWith('ethereum:')) {
      try {
        const [addrPart, queryPart] = data.slice(9).split('?');
        const address = addrPart.split('@')[0];
        const params  = new URLSearchParams(queryPart ?? '');
        const label   = params.get('label') ?? params.get('message') ?? '';
        const valueWei = params.get('value');
        const amountEth = valueWei ? (parseFloat(valueWei) / 1e18).toFixed(6) : '';
        setLastScan(address);
        setTimeout(() => navigation.navigate('Card', {
          qrMerchant: { name: label || address.slice(0, 8) + '…', amount: amountEth, icon: '⚡' },
        }), 600);
      } catch {
        setScanInfo('Invalid payment QR');
        setScanned(false);
      }
      return;
    }

    // Direct plain address detection with correct network and token preselection
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'TRON Nile',
        symbol: 'TRX'
      }), 600);
      return;
    }
    if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'Bitcoin Network',
        symbol: 'BTC'
      }), 600);
      return;
    }
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'Solana Network',
        symbol: 'SOL'
      }), 600);
      return;
    }
    if (/^[a-zA-Z0-9_-]{48}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'TON Network',
        symbol: 'TON'
      }), 600);
      return;
    }
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'Sui Network',
        symbol: 'SUI'
      }), 600);
      return;
    }
    if (/^r[0-9a-zA-Z]{24,34}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'Ripple Ledger',
        symbol: 'XRP'
      }), 600);
      return;
    }
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setLastScan(trimmed);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: trimmed,
        scannedNetwork: 'Ethereum',
        symbol: 'ETH'
      }), 600);
      return;
    }

    processQRData(data);
  };

  const processQRData = (data: string) => {
    try {
      const result = parseQRPayload(data);
      if (!result) { setScanInfo('Unrecognised QR'); setScanned(false); return; }
      setLastScan(result.address);
      if (result.network !== appNetwork) setScanInfo(`Network mismatch: ${result.network}`);
      setTimeout(() => navigation.navigate('Send', {
        scannedAddress: result.address,
        scannedNetwork: result.network,
        symbol: result.symbol,
      }), 800);
    } catch {
      setScanInfo('Invalid QR format');
      setScanned(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Black background always — never shows blue */}
      <View style={StyleSheet.absoluteFillObject} />

      {/* Camera — only rendered after focus + delay, destroyed on blur */}
      {showCam && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          onCameraReady={() => setCamReady(true)}
        />
      )}

      {/* Loading overlay — shown until camera is ready */}
      {!camReady && (
        <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color="#FF3B3B" />
          <Text style={styles.loadingText}>Starting camera...</Text>
        </View>
      )}

      {/* Dark overlay with scan window cutout */}
      {camReady && (
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanWindow}>
              {/* Corner brackets */}
              <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14, borderColor: '#FF3B3B' }]} />
              <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14, borderColor: '#FF3B3B' }]} />
              <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14, borderColor: '#FF3B3B' }]} />
              <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14, borderColor: '#FF3B3B' }]} />
              {/* Scan line */}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLinePos }] }]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>{scanned ? '✓ QR DETECTED' : 'ALIGN QR CODE IN FRAME'}</Text>
            {!!scanInfo && (
              <View style={styles.infoPill}>
                <MaterialIcons name="info-outline" size={13} color="#FFF" />
                <Text style={styles.infoPillText}>{scanInfo}</Text>
              </View>
            )}
            {scanned && (
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={() => { setScanned(false); setLastScan(''); setScanInfo(''); }}
              >
                <Feather name="refresh-cw" size={14} color="#FFF" />
                <Text style={styles.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SCAN QR</Text>
        <TouchableOpacity
          style={[styles.iconBtn, torchOn && { backgroundColor: 'rgba(255,193,7,0.25)' }]}
          onPress={() => setTorchOn(p => !p)}
        >
          <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={20} color={torchOn ? '#FFC107' : '#FFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#000' },
  permTitle:      { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  permSub:        { color: '#A1A5AB', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn:        { backgroundColor: '#FF3B3B', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100 },
  permBtnText:    { color: '#FFF', fontWeight: '800', fontSize: 15 },
  loadingOverlay: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  loadingText:    { color: '#A1A5AB', marginTop: 12, fontWeight: '600', fontSize: 13 },
  overlay:        { ...StyleSheet.absoluteFillObject },
  overlayTop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  overlayMiddle:  { flexDirection: 'row', height: WINDOW_SIZE },
  overlaySide:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  overlayBottom:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', paddingTop: 32, gap: 14 },
  scanWindow:     { width: WINDOW_SIZE, height: WINDOW_SIZE },
  corner:         { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  scanLine:       { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: '#FF3B3B', opacity: 0.9 },
  scanHint:       { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100 },
  infoPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  infoPillText:   { color: '#FFF', fontSize: 12, fontWeight: '600' },
  rescanBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 100 },
  rescanText:     { color: '#FFF', fontWeight: '700' },
  header:         { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  iconBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
});
