import React, { useState, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Dimensions, Share, Image, StatusBar, Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const NETWORKS = [
  { id: 'Ethereum', label: 'Ethereum', symbol: 'ETH',  color: '#627EEA', chainId: 1,        iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { id: 'Polygon',  label: 'Polygon',  symbol: 'MATIC',color: '#8247E5', chainId: 137,      iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png' },
  { id: 'BNB Chain',label: 'BNB Chain',symbol: 'BNB',  color: '#F3BA2F', chainId: 56,       iconUrl: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  { id: 'Arbitrum', label: 'Arbitrum', symbol: 'ARB',  color: '#00A3FF', chainId: 42161,    iconUrl: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg' },
  { id: 'Sepolia',  label: 'Sepolia',  symbol: 'ETH',  color: '#F59E0B', chainId: 11155111, iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
];

export type QRPayload = {
  address: string;
  network: string;
  chainId: number;
  symbol:  string;
  version: number;
};

export function buildQRPayload(address: string, networkId: string): string {
  const net = NETWORKS.find(n => n.id === networkId) ?? NETWORKS[0];
  const payload: QRPayload = {
    address,
    network: net.id,
    chainId: net.chainId,
    symbol:  net.symbol,
    version: 1,
  };
  return JSON.stringify(payload);
}

export function parseQRPayload(data: string): QRPayload | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed.address !== 'string' || !parsed.address) return null;
    return {
      address: parsed.address,
      network: parsed.network ?? 'Ethereum',
      chainId: parsed.chainId ?? 1,
      symbol:  parsed.symbol  ?? 'ETH',
      version: parsed.version ?? 1,
    };
  } catch {
    return null;
  }
}

function NetworkIcon({ net, size = 32 }: { net: typeof NETWORKS[number]; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  if (!failed) {
    return (
      <Image
        source={{ uri: net.iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: net.color + '25',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: net.color, fontSize: size * 0.36, fontWeight: '800' }}>
        {net.symbol.slice(0, 2)}
      </Text>
    </View>
  );
}

export default function ReceiveScreen({ navigation }: any) {
  const { walletAddress, network: globalNetwork, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const defaultNet = NETWORKS.find(n => n.id === globalNetwork) ?? NETWORKS[0];
  const [selectedNet, setSelectedNet] = useState(defaultNet);
  const [netModalVisible, setNetModalVisible] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  useEffect(() => {
    const net = NETWORKS.find(n => n.id === globalNetwork) ?? NETWORKS[0];
    setSelectedNet(net);
  }, [globalNetwork]);

  const qrValue = walletAddress ? buildQRPayload(walletAddress, selectedNet.id) : '';

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleCopy = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      showToast('Address copied!', 'success');
    }
  };

  const handleShare = async () => {
    if (!walletAddress) return;
    try {
      await Share.share({
        message: `My ${selectedNet.label} address: ${walletAddress}`,
        title: 'Wallet Address',
      });
    } catch {
      showToast('Unable to share', 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Network Selector Modal */}
      <Modal visible={netModalVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setNetModalVisible(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[styles.modalIndicator, { backgroundColor: T.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Choose Network</Text>
              <TouchableOpacity onPress={() => setNetModalVisible(false)} style={[styles.modalCloseBtn, { backgroundColor: T.surfaceLow }]}>
                <Feather name="x" size={20} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {NETWORKS.map(net => {
                const isActive = selectedNet.id === net.id;
                return (
                  <TouchableOpacity
                    key={net.id}
                    style={[
                      styles.modalNetRow,
                      { backgroundColor: T.surfaceLow, borderColor: 'transparent' },
                      isActive && { backgroundColor: isDarkMode ? '#25262B' : net.color + '12', borderColor: net.color, borderWidth: 1 },
                    ]}
                    onPress={() => { setSelectedNet(net); setNetModalVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalNetIconBox, { backgroundColor: net.color + '15' }]}>
                      <NetworkIcon net={net} size={28} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalNetName, { color: T.text }, isActive && { color: net.color }]}>{net.label}</Text>
                      <Text style={[styles.modalNetSub, { color: T.textMuted }]}>{net.symbol} · Chain ID: {net.chainId}</Text>
                    </View>
                    {isActive && (
                      <View style={[styles.activeCheck, { backgroundColor: net.color }]}>
                        <Feather name="check" size={12} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.background }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surface }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>RECEIVE</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surface }]} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <Ionicons name="qr-code-outline" size={20} color={T.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: T.text }]}>Your QR Code</Text>
          <Text style={[styles.heroSubTitle, { color: T.textMuted }]}>Choose a network below to update the address format and QR info.</Text>
        </View>

        {/* Network Selector */}
        <View style={styles.selectorContainer}>
          <Text style={[styles.selectorLabel, { color: T.textDim }]}>ACTIVE RECEIVING NETWORK</Text>
          <TouchableOpacity
            style={[styles.networkMainBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => setNetModalVisible(true)}
            activeOpacity={0.8}
          >
            <NetworkIcon net={selectedNet} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.networkNameText, { color: T.text }]}>{selectedNet.label}</Text>
              <Text style={[styles.networkStatusText, { color: T.textMuted }]}>Tap to change protocol</Text>
            </View>
            <View style={[styles.chevronBox, { backgroundColor: T.surfaceLow }]}>
              <Feather name="chevron-down" size={18} color={T.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* QR Card */}
        <View style={[styles.qrContainer, { borderColor: T.border }]}>
          <LinearGradient
            colors={isDarkMode ? ['#1C1D21', '#0A0A0C'] : ['#FFFFFF', '#F2F4F6']}
            style={styles.qrCard}
          >
            <View style={[styles.qrWrapper, { shadowColor: isDarkMode ? '#000' : '#999' }]}>
              <QRCode
                value={qrValue || 'placeholder'}
                size={width * 0.55}
                color="#000"
                backgroundColor="#FFF"
                quietZone={12}
              />
            </View>

            <View style={styles.qrFooter}>
              <View style={[styles.networkBadge, { backgroundColor: selectedNet.color + '18', borderColor: selectedNet.color + '30' }]}>
                <View style={[styles.miniDot, { backgroundColor: selectedNet.color }]} />
                <Text style={[styles.networkBadgeText, { color: selectedNet.color }]}>{selectedNet.label} Network</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Address Card */}
        <View style={styles.addressContainer}>
          <Text style={[styles.sectionLabel, { color: T.textDim }]}>WALLET ADDRESS</Text>
          <TouchableOpacity style={[styles.addressBox, { backgroundColor: T.surface, borderColor: T.border }]} onPress={handleCopy} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addressValue, { color: T.text }]} numberOfLines={1}>
                {walletAddress || '0x...'}
              </Text>
              <Text style={[styles.addressMeta, { color: T.textMuted }]}>Standard {selectedNet.symbol} Address</Text>
            </View>
            <TouchableOpacity style={[styles.copyIconButton, { backgroundColor: T.surfaceLow }]} onPress={handleCopy}>
              <Feather name="copy" size={18} color={T.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Feather name="shield" size={16} color={T.primary} />
            <Text style={[styles.infoCardText, { color: T.text }]}>Secure Vault</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Feather name="clock" size={16} color={T.success} />
            <Text style={[styles.infoCardText, { color: T.text }]}>Instant Sync</Text>
          </View>
        </View>

      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.footerContainer, { backgroundColor: isDarkMode ? 'rgba(10,10,12,0.95)' : 'rgba(247,249,251,0.97)', borderTopColor: T.border }]}>
        <TouchableOpacity style={styles.primaryShareBtn} onPress={handleShare} activeOpacity={0.8}>
          <LinearGradient
            colors={[T.primary, '#D32F2F']}
            style={styles.shareGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Feather name="share-2" size={18} color="#FFF" />
            <Text style={styles.shareBtnText}>SHARE ASSET DETAILS</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },

  scroll: { paddingHorizontal: 24, paddingBottom: 150 },

  heroSection: { marginTop: 12, marginBottom: 24 },
  heroTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 6 },
  heroSubTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500' },

  selectorContainer: { marginBottom: 32 },
  selectorLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  networkMainBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 16, gap: 14, borderWidth: 1,
  },
  networkNameText: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  networkStatusText: { fontSize: 12, fontWeight: '600' },
  chevronBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalSheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24, maxHeight: '80%',
  },
  modalIndicator: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalNetRow: {
    flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20,
    marginBottom: 10, gap: 14, borderWidth: 1,
  },
  modalNetIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalNetName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  modalNetSub: { fontSize: 12, fontWeight: '600' },
  activeCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // QR
  qrContainer: { marginBottom: 32, borderRadius: 32, overflow: 'hidden', borderWidth: 1 },
  qrCard: { padding: 32, alignItems: 'center' },
  qrWrapper: {
    backgroundColor: '#FFF', padding: 12, borderRadius: 24,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  qrFooter: { marginTop: 20 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, gap: 8, borderWidth: 1 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  networkBadgeText: { fontSize: 12, fontWeight: '700' },

  // Address
  addressContainer: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  addressBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 20, gap: 16, borderWidth: 1 },
  addressValue: { fontSize: 15, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  addressMeta: { fontSize: 12, fontWeight: '600' },
  copyIconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Info
  infoGrid: { flexDirection: 'row', gap: 12 },
  infoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1 },
  infoCardText: { fontSize: 13, fontWeight: '700' },

  // Footer
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 },
  primaryShareBtn: { height: 60, borderRadius: 30, overflow: 'hidden' },
  shareGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  shareBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});

