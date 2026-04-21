import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Dimensions, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';

const NETWORKS = [
  { id: 'Ethereum', label: 'Ethereum', symbol: 'ETH',   color: '#627EEA', chainId: 1       },
  { id: 'Polygon',  label: 'Polygon',  symbol: 'MATIC', color: '#8247E5', chainId: 137     },
  { id: 'Arbitrum', label: 'Arbitrum', symbol: 'ARB',   color: '#2D374B', chainId: 42161   },
  { id: 'Sepolia',  label: 'Sepolia',  symbol: 'ETH',   color: '#F59E0B', chainId: 11155111},
];

// QR payload structure — Paytm-style universal crypto QR
export type QRPayload = {
  address: string;
  network: string;
  chainId: number;
  symbol:  string;
  version: number;   // for future compatibility
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

export function parseQRPayload(data: string): { address: string; network: string } | null {
  // Try new JSON payload first
  try {
    const parsed = JSON.parse(data) as QRPayload;
    if (parsed.address && parsed.network && /^0x[0-9a-fA-F]{40}$/.test(parsed.address)) {
      return { address: parsed.address, network: parsed.network };
    }
  } catch {}

  // Fallback: plain ethereum: URI or raw address
  let raw = data.trim();
  if (raw.startsWith('ethereum:')) {
    raw = raw.replace('ethereum:', '').split('?')[0].split('@')[0];
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return { address: raw, network: 'Ethereum' };
  }
  return null;
}

export default function ReceiveScreen({ navigation }: any) {
  const { walletAddress, network: globalNetwork, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const defaultNet = NETWORKS.find(n => n.id === globalNetwork) ?? NETWORKS[0];
  const [selectedNet, setSelectedNet] = useState(defaultNet);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const qrValue = walletAddress ? buildQRPayload(walletAddress, selectedNet.id) : '';

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleCopy = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      showToast('Address copied to clipboard!', 'success');
    }
  };

  const handleShare = async () => {
    if (!walletAddress) return;
    try {
      await Share.share({
        message: `My ${selectedNet.label} wallet address: ${walletAddress}`,
        title: 'My Wallet Address',
      });
    } catch {
      showToast('Unable to share address', 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Receive Crypto</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Network Selector Pills */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: T.textMuted }]}>Select Network</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.networkSelector}>
            {NETWORKS.map((net) => {
              const isActive = selectedNet.id === net.id;
              return (
                <TouchableOpacity
                  key={net.id}
                  style={[
                    styles.netTab,
                    { backgroundColor: T.surfaceLow, borderColor: isActive ? net.color : T.border },
                    isActive && { backgroundColor: net.color + '15', borderWidth: 2 }
                  ]}
                  onPress={() => setSelectedNet(net)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.netDot, { backgroundColor: net.color }]} />
                  <Text style={[styles.netTabText, { color: isActive ? T.text : T.textDim }]}>{net.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Network Info */}
        <View style={styles.sectionBlock}>
          <View style={[styles.networkBadge, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.networkIcon, { backgroundColor: selectedNet.color + '20' }]}>
                <MaterialIcons name="lan" size={16} color={selectedNet.color} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.networkName, { color: T.text }]}>{selectedNet.label} Network</Text>
                  {selectedNet.id === globalNetwork && (
                    <View style={styles.activeLabel}>
                      <Text style={styles.activeLabelText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.networkArrival, { color: T.textMuted }]}>Chain ID: {selectedNet.chainId} • Symbol: {selectedNet.symbol}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* QR Code */}
        <View style={styles.qrWrapper}>
          <View style={[styles.qrBox, { backgroundColor: '#FFF', borderColor: T.surfaceLow }]}>
            {walletAddress ? (
              <QRCode
                value={qrValue}
                size={Dimensions.get('window').width * 0.55}
                color="#101114"
                backgroundColor="#FFF"
              />
            ) : (
              <View style={{ width: 220, height: 220, backgroundColor: T.surfaceLow, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
                <Text style={{ color: '#888' }}>No Address</Text>
              </View>
            )}
            <View style={styles.qrLogo}>
              <View style={[styles.qrLogoInner, { backgroundColor: T.background }]}>
                <Text style={[styles.qrLogoText, { color: T.primary }]}>CW</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressBlock}>
          <Text style={[styles.addressTitle, { color: T.textMuted }]}>Your Wallet Address</Text>
          <View style={[styles.addressBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Text style={[styles.addressText, { color: T.text }]} selectable>
              {walletAddress || 'Waiting for address...'}
            </Text>
            <View style={[styles.addressActions, { borderTopColor: T.border }]}>
              <TouchableOpacity
                onPress={handleCopy}
                style={[styles.actionBtn, { backgroundColor: T.surface }]}
                activeOpacity={0.7}
              >
                <MaterialIcons name="content-copy" size={18} color={T.text} />
                <Text style={[styles.actionBtnText, { color: T.text }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.actionBtn, { backgroundColor: T.surface }]}
                activeOpacity={0.7}
              >
                <MaterialIcons name="share" size={18} color={T.text} />
                <Text style={[styles.actionBtnText, { color: T.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={[styles.instructionCard, { backgroundColor: T.surfaceLow }]}>
            <View style={[styles.instructionIconBox, { backgroundColor: T.error + '20' }]}>
              <MaterialIcons name="security" size={20} color={T.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.instructionTitle, { color: T.text }]}>Send only compatible assets</Text>
              <Text style={[styles.instructionBody, { color: T.textMuted }]}>
                Sending unsupported tokens to this address may result in permanent loss.
              </Text>
            </View>
          </View>

          <View style={[styles.instructionCard, { backgroundColor: T.surfaceLow }]}>
            <View style={[styles.instructionIconBox, { backgroundColor: T.primary + '20' }]}>
              <MaterialIcons name="bolt" size={20} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.instructionTitle, { color: T.text }]}>Min. Deposit: 0.0001 ETH</Text>
              <Text style={[styles.instructionBody, { color: T.textMuted }]}>
                Amounts smaller than this will not be credited correctly to your account.
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  scroll: { paddingTop: 100, paddingHorizontal: 24, paddingBottom: 60, alignItems: 'center' },

  sectionBlock: { width: '100%', marginBottom: 32 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  networkBadge: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  networkIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  networkName: { fontSize: 14, fontWeight: '600' },
  networkArrival: { fontSize: 10, marginTop: 2 },

  networkSelector: { flexDirection: 'row', gap: 10, paddingRight: 20 },
  netTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, minWidth: 110 },
  netDot: { width: 8, height: 8, borderRadius: 4 },
  netTabText: { fontSize: 13, fontWeight: '700' },
  activeLabel: { backgroundColor: '#FF3B3B15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  activeLabelText: { fontSize: 8, fontWeight: '900', color: '#FF3B3B' },

  qrWrapper: { width: '100%', maxWidth: 320, aspectRatio: 1, marginBottom: 40 },
  qrBox: { flex: 1, borderRadius: 40, padding: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 12, shadowColor: '#FF544E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 40 },
  qrLogo: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -24 }, { translateY: -24 }], width: 48, height: 48, backgroundColor: '#FFF', borderRadius: 12, padding: 4 },
  qrLogoInner: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qrLogoText: { fontSize: 10, fontWeight: '900', letterSpacing: -0.5 },

  addressBlock: { width: '100%', marginBottom: 32 },
  addressTitle: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  addressBox: { width: '100%', padding: 20, borderRadius: 24, borderWidth: 1 },
  addressText: { fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  addressActions: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 16, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },

  instructionsContainer: { width: '100%', gap: 16 },
  instructionCard: { flexDirection: 'row', padding: 20, borderRadius: 24, gap: 16, alignItems: 'flex-start' },
  instructionIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  instructionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  instructionBody: { fontSize: 12, lineHeight: 18 },
});
