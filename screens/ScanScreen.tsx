import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Vibration, Animated, StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { parseQRPayload } from './ReceiveScreen';
import { LinearGradient } from 'expo-linear-gradient';

export default function ScanScreen({ navigation }: any) {
  const { isDarkMode, network: appNetwork } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [torchOn, setTorchOn]           = useState(false);
  const [lastScan, setLastScan]         = useState('');
  const [scanInfo, setScanInfo]         = useState('');

  // Corner bracket pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Scan line animation
  const scanLinePos = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePos, { toValue: WINDOW_SIZE - 4, duration: 2500, useNativeDriver: true }),
        Animated.timing(scanLinePos, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.center, { backgroundColor: '#0A0A0C' }]}>
        <View style={styles.permBox}>
          <View style={[styles.permIcon, { backgroundColor: 'rgba(236, 38, 41, 0.1)' }]}>
            <Feather name="monitor" size={32} color={T.primary} />
          </View>
          <Text style={styles.permTitle}>Mobile Feature</Text>
          <Text style={styles.permSub}>
            Scanning QR codes with a camera is only available on native mobile devices.
          </Text>
          <TouchableOpacity
            style={styles.permBtnPrimary}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.permBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    // ethereum: payment URI — route to Card pay form
    if (data.startsWith('ethereum:')) {
      setScanned(true);
      Vibration.vibrate(80);
      try {
        const [addrPart, queryPart] = data.slice(9).split('?');
        const address = addrPart.split('@')[0];
        const params  = new URLSearchParams(queryPart ?? '');
        const label   = params.get('label') ?? params.get('message') ?? '';
        const valueWei = params.get('value');
        const amountEth = valueWei ? (parseFloat(valueWei) / 1e18).toFixed(6) : '';
        setLastScan(address);
        setTimeout(() => {
          navigation.navigate('Card', {
            qrMerchant: { name: label || address.slice(0, 8) + '…', amount: amountEth, icon: '⚡' },
          });
        }, 800);
      } catch {
        setScanInfo('Invalid payment QR');
        setScanned(false);
      }
      return;
    }

    // Plain address — go to Send
    if (/^0x[0-9a-fA-F]{40}$/.test(data.trim())) {
      processQRData(JSON.stringify({ address: data.trim(), network: 'Ethereum' }));
      return;
    }

    processQRData(data);
  };

  const processQRData = (data: string) => {
    try {
      // This might throw if not JSON, handled by catch
      const result = parseQRPayload(data);
      if (!result) return;
      
      setScanned(true);
      Vibration.vibrate(80);
      setLastScan(result.address);
      
      if (result.network !== appNetwork) {
        setScanInfo(`Network Mismatch: QR is for ${result.network}`);
      }
      
      setTimeout(() => {
        navigation.navigate('Send', {
          scannedAddress: result.address,
          scannedNetwork: result.network,
        });
      }, 1000);
    } catch {
       setScanInfo('Invalid QR Code format');
    }
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
      setScanInfo('Please use the camera for instant scanning');
    } catch {
      setScanInfo('Could not open gallery');
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: '#0A0A0C' }]}>
        <Text style={{ color: T.textMuted, fontSize: 14 }}>Initializing Camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: '#0A0A0C' }]}>
        <View style={styles.permBox}>
          <View style={[styles.permIcon, { backgroundColor: 'rgba(236, 38, 41, 0.1)' }]}>
            <Ionicons name="camera-outline" size={36} color={T.primary} />
          </View>
          <Text style={styles.permTitle}>Camera Access</Text>
          <Text style={styles.permSub}>
            We need your permission to access the camera to scan wallet addresses via QR codes.
          </Text>
          <TouchableOpacity
            style={styles.permBtnPrimary}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.permBtnText}>GRANT ACCESS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={{ color: T.textMuted, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Modern Overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          
          <Animated.View style={[styles.scanWindow, { transform: [{ scale: pulse }] }]}>
            {/* Brackets */}
            {[
              { top: 0,    left: 0,    borderTopWidth: 4,    borderLeftWidth: 4,  borderTopLeftRadius: 16 },
              { top: 0,    right: 0,   borderTopWidth: 4,    borderRightWidth: 4, borderTopRightRadius: 16 },
              { bottom: 0, left: 0,    borderBottomWidth: 4, borderLeftWidth: 4,  borderBottomLeftRadius: 16 },
              { bottom: 0, right: 0,   borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
            ].map((corner, i) => (
              <View key={i} style={[styles.corner, corner, { borderColor: T.primary }]} />
            ))}
            
            {/* Animated Scan Line */}
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLinePos }] }]}>
               <LinearGradient
                  colors={['transparent', T.primary, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, opacity: 0.8 }}
                />
            </Animated.View>
          </Animated.View>

          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          <View style={styles.hintContainer}>
            <Text style={styles.scanHint}>
              {scanned ? 'QR DETECTED' : 'SCAN WALLET OR PAYMENT QR'}
            </Text>
          </View>

          {!!scanInfo && (
            <View style={styles.infoPill}>
              <MaterialIcons name="info-outline" size={14} color="#FFF" />
              <Text style={styles.infoPillText}>{scanInfo}</Text>
            </View>
          )}

          {scanned ? (
            <View style={styles.scannedBox}>
              <Text style={styles.scannedAddress} numberOfLines={1}>
                {lastScan.slice(0, 12)}...{lastScan.slice(-8)}
              </Text>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={() => { setScanned(false); setLastScan(''); setScanInfo(''); }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={14} color="#FFF" />
                <Text style={styles.rescanText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.galleryCard} onPress={handleGallery} activeOpacity={0.8}>
               <Feather name="image" size={18} color="#FFF" />
               <Text style={styles.galleryLabel}>Upload from gallery</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="x" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SCAN QR</Text>
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
          onPress={() => setTorchOn(p => !p)}
          activeOpacity={0.7}
        >
          <Ionicons name={torchOn ? "flash" : "flash-outline"} size={22} color={torchOn ? "#FFC107" : "#FFF"} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const WINDOW_SIZE = 280;
const CORNER_SIZE = 40;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Permissions
  permBox: { width: '100%', borderRadius: 32, padding: 32, backgroundColor: '#1C1D21', alignItems: 'center' },
  permIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  permTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  permSub: { color: '#A1A5AB', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtnPrimary: { width: '100%', paddingVertical: 18, borderRadius: 100, backgroundColor: '#FF3B3B', alignItems: 'center', marginTop: 24 },
  permBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  overlayMiddle: { flexDirection: 'row', height: WINDOW_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', paddingTop: 40 },

  // Scanner cutout
  scanWindow: { width: WINDOW_SIZE, height: WINDOW_SIZE, position: 'relative' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 3, 
  },

  // UI elements
  hintContainer: { 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 100, 
    marginBottom: 20 
  },
  scanHint: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  
  infoPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginBottom: 20 
  },
  infoPillText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  scannedBox: { alignItems: 'center', gap: 16 },
  scannedAddress: { color: '#FF3B3B', fontSize: 16, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  rescanText: { color: '#FFF', fontWeight: '700' },

  galleryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 12
  },
  galleryLabel: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20,
  },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  torchBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  torchBtnActive: { backgroundColor: 'rgba(255,193,7,0.2)', borderWidth: 1, borderColor: '#FFC107' },
  headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
});
