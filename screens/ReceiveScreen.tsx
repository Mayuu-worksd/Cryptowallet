import React, { useState, useEffect, memo } from 'react';
import { Theme, Fonts, COIN_META, COIN_COLORS } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Dimensions, Share, Image, StatusBar, Modal, Pressable
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { storageService } from '../services/storageService';

const { width } = Dimensions.get('window');

const RECEIVE_TOKENS = [
  { symbol: 'USDT', name: 'Tether', network: 'Ethereum / TRON', warning: 'Send only USDT (ERC20/TRC20) to this address. Verify active network.' },
  { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC20)', warning: 'Send only USDC (ERC20) to this address.' },
  { symbol: 'ETH',  name: 'Ethereum', network: 'Ethereum Network', warning: 'Send only Ethereum (ETH) to this address. Do not send to any other networks.' },
  { symbol: 'BTC',  name: 'Bitcoin', network: 'Bitcoin Network', warning: 'Send only Bitcoin (BTC) to this SegWit address.' },
  { symbol: 'SOL',  name: 'Solana', network: 'Solana Network', warning: 'Send only Solana (SOL) or SPL tokens to this address.' },
  { symbol: 'BNB',  name: 'BNB', network: 'BNB Smart Chain', warning: 'Send only BNB (BEP20) to this BSC address.' },
  { symbol: 'XRP',  name: 'Ripple', network: 'Ripple Ledger', warning: 'Send only Ripple (XRP) to this address. No Destination Tag required for this wallet.' },
  { symbol: 'TON',  name: 'Toncoin', network: 'TON Network', warning: 'Send only Toncoin (TON) to this address. Memo/Comment is NOT required.' },
  { symbol: 'TRX',  name: 'TRON', network: 'TRON Network', warning: 'Send only TRON (TRX) or TRC20 tokens to this address.' },
  { symbol: 'SUI',  name: 'Sui', network: 'Sui Network', warning: 'Send only Sui (SUI) to this address.' },
];

export type QRPayload = {
  address: string;
  network: string;
  chainId?: number;
  symbol:  string;
  version: number;
};

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

const CoinIcon = memo(({ symbol, size = 24 }: { symbol: string; size?: number }) => {
  const meta  = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = useState(false);
  if (meta && !failed) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

// Deterministic multi-chain address generation derived from EVM walletAddress
function deriveChainAddress(evmAddress: string, symbol: string, nativeTronAddress?: string): string {
  if (!evmAddress) return '';
  const cleanHex = evmAddress.toLowerCase().replace('0x', '');
  
  if (symbol === 'ETH' || symbol === 'USDT' || symbol === 'USDC' || symbol === 'BNB') {
    return evmAddress;
  }
  if (symbol === 'TRX') {
    return nativeTronAddress || 'T' + cleanHex.slice(0, 33);
  }
  if (symbol === 'BTC') {
    return 'bc1q' + cleanHex.padEnd(38, 'a').slice(0, 38);
  }
  if (symbol === 'SOL') {
    const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let res = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.slice(i, i + 2), 16) || 0;
      res += b58[byte % 58];
    }
    return (res + res).padEnd(44, 'x').slice(0, 44);
  }
  if (symbol === 'TON') {
    const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let res = 'EQ';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.slice(i, i + 2), 16) || 0;
      res += b64[byte % 64];
    }
    return res.padEnd(48, 'A').slice(0, 48);
  }
  if (symbol === 'SUI') {
    return '0x' + (cleanHex + cleanHex).padEnd(64, 'f').slice(0, 64);
  }
  if (symbol === 'XRP') {
    const b58 = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
    let res = 'r';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.slice(i, i + 2), 16) || 0;
      res += b58[byte % 58];
    }
    return res.padEnd(34, 'X').slice(0, 34);
  }
  return evmAddress;
}

export default function ReceiveScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { walletAddress, tronAddress: ctxTronAddress, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [tronAddress, setTronAddress] = useState(ctxTronAddress || '');
  const [selectedToken, setSelectedToken] = useState(RECEIVE_TOKENS[0]);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Get Tron Address deterministically
  useEffect(() => {
    if (ctxTronAddress) { setTronAddress(ctxTronAddress); return; }
    (async () => {
      const stored = await storageService.getTronAddress();
      if (stored) { setTronAddress(stored); return; }
      const mnemonic = await storageService.getMnemonic();
      if (!mnemonic) return;
      try {
        const { deriveTronAddress } = await import('../services/tronService');
        const tron = await deriveTronAddress(mnemonic);
        setTronAddress(tron.address);
        storageService.saveTronAddress(tron.address).catch(() => {});
      } catch {}
    })();
  }, [ctxTronAddress]);

  const displayAddress = deriveChainAddress(walletAddress, selectedToken.symbol, tronAddress);

  // Payload for scanning
  const qrPayload = JSON.stringify({
    address: displayAddress,
    symbol: selectedToken.symbol,
    network: selectedToken.network,
    version: 1
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleCopy = async () => {
    if (displayAddress) {
      await Clipboard.setStringAsync(displayAddress);
      showToast('Address copied to clipboard!', 'success');
    }
  };

  const handleShare = async () => {
    if (!displayAddress) return;
    try {
      await Share.share({
        message: `My receiving address for ${selectedToken.symbol} (${selectedToken.network}):\n\n${displayAddress}\n\nWarning: ${selectedToken.warning}`,
        title: `Receive ${selectedToken.symbol}`,
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
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.background, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surface }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>RECEIVE CRYPTO</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surface }]} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <Ionicons name="qr-code-outline" size={20} color={T.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: T.text }]}>Your QR Code</Text>
          <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Choose an asset below to automatically generate its multi-chain wallet address and QR code.</Text>
        </View>

        {/* Asset Selector */}
        <View style={styles.selectorContainer}>
          <Text style={[styles.selectorLabel, { color: T.textDim }]}>ACTIVE DEPOSIT ASSET</Text>
          <TouchableOpacity
            style={[styles.networkMainBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => setTokenModalVisible(true)}
            activeOpacity={0.8}
          >
            <CoinIcon symbol={selectedToken.symbol} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.networkNameText, { color: T.text }]}>{selectedToken.symbol} ({selectedToken.name})</Text>
              <Text style={[styles.networkStatusText, { color: T.textDim }]}>{selectedToken.network} · Tap to change</Text>
            </View>
            <View style={[styles.chevronBox, { backgroundColor: T.surfaceLow }]}>
              <Feather name="chevron-down" size={18} color={T.textDim} />
            </View>
          </TouchableOpacity>
        </View>

        {/* QR Card */}
        <View style={[styles.qrContainer, { borderColor: T.border, backgroundColor: T.surface }]}>
          <LinearGradient
            colors={isDarkMode ? ['#1C1D21', '#0A0A0C'] : ['#FFFFFF', '#F2F4F6']}
            style={styles.qrCard}
          >
            <View style={[styles.qrWrapper, { shadowColor: isDarkMode ? '#000' : '#999' }]}>
              <QRCode
                value={qrPayload || 'placeholder'}
                size={width * 0.55}
                color="#000"
                backgroundColor="#FFF"
                quietZone={12}
              />
            </View>

            <View style={styles.qrFooter}>
              <View style={[styles.networkBadge, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                <View style={[styles.miniDot, { backgroundColor: T.success }]} />
                <Text style={[styles.networkBadgeText, { color: T.text }]}>{selectedToken.network}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Address Card */}
        <View style={styles.addressContainer}>
          <Text style={[styles.sectionLabel, { color: T.textDim }]}>DEPOSIT WALLET ADDRESS</Text>
          <TouchableOpacity style={[styles.addressBox, { backgroundColor: T.surface, borderColor: T.border }]} onPress={handleCopy} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addressValue, { color: T.text }]} numberOfLines={1}>
                {displayAddress || '0x...'}
              </Text>
              <Text style={[styles.addressMeta, { color: T.textDim }]}>
                {selectedToken.symbol} Receiver Address
              </Text>
            </View>
            <TouchableOpacity style={[styles.copyIconButton, { backgroundColor: T.surfaceLow }]} onPress={handleCopy}>
              <Feather name="copy" size={18} color={T.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Warning instructions banner */}
        <View style={[styles.warningBanner, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}>
          <MaterialCommunityIcons name="alert-decagram" size={18} color={T.primary} />
          <Text style={[styles.warningText, { color: T.text }]}>{selectedToken.warning}</Text>
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
      <View style={[styles.footerContainer, { backgroundColor: isDarkMode ? 'rgba(10,10,12,0.95)' : 'rgba(247,249,251,0.97)', borderTopColor: T.border, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryShareBtn} onPress={handleShare} activeOpacity={0.8}>
          <LinearGradient
            colors={[T.primary, '#D32F2F']}
            style={styles.shareGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Feather name="share-2" size={18} color="#FFF" />
            <Text style={styles.shareBtnText}>SHARE ADDRESS DETAILS</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Token Picker Modal ── */}
      <Modal visible={tokenModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setTokenModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[styles.modalIndicator, { backgroundColor: T.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Select Asset to Receive</Text>
              <TouchableOpacity onPress={() => setTokenModalVisible(false)} style={[styles.modalCloseBtn, { backgroundColor: T.surfaceLow }]}>
                <Feather name="x" size={20} color={T.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {RECEIVE_TOKENS.map(token => {
                const isSelected = selectedToken.symbol === token.symbol;
                return (
                  <TouchableOpacity
                    key={token.symbol}
                    style={[
                      styles.modalNetRow,
                      { backgroundColor: T.surfaceLow, borderColor: 'transparent' },
                      isSelected && { backgroundColor: T.border + '35', borderColor: T.primary, borderWidth: 1 },
                    ]}
                    onPress={() => { setSelectedToken(token); setTokenModalVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <CoinIcon symbol={token.symbol} size={32} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.modalNetName, { color: T.text, fontFamily: Fonts.bold }]}>{token.symbol}</Text>
                      <Text style={[styles.modalNetSub, { color: T.textDim }]}>{token.name} · {token.network}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.activeCheck, { backgroundColor: T.primary }]}>
                        <Feather name="check" size={12} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 2 },

  scroll: { paddingHorizontal: 24, paddingBottom: 150 },

  heroSection: { marginTop: 12, marginBottom: 24 },
  heroTitle: { fontSize: 32, fontFamily: Fonts.extraBold, letterSpacing: -1, marginBottom: 6 },
  heroSubTitle: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium },

  selectorContainer: { marginBottom: 32 },
  selectorLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  networkMainBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 16, gap: 14, borderWidth: 1,
  },
  networkNameText: { fontSize: 16, fontFamily: Fonts.extraBold, marginBottom: 2 },
  networkStatusText: { fontSize: 12, fontFamily: Fonts.semiBold },
  chevronBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalSheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 44, maxHeight: '80%',
  },
  modalIndicator: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: Fonts.extraBold },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalNetRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20,
    marginBottom: 10, gap: 14, borderWidth: 1,
  },
  modalNetName: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 },
  modalNetSub: { fontSize: 12, fontFamily: Fonts.semiBold },
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
  networkBadgeText: { fontSize: 12, fontFamily: Fonts.bold },

  // Address
  addressContainer: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  addressBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 20, gap: 16, borderWidth: 1 },
  addressValue: { fontSize: 14, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  addressMeta: { fontSize: 12, fontFamily: Fonts.semiBold },
  copyIconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },

  // Info
  infoGrid: { flexDirection: 'row', gap: 12 },
  infoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1 },
  infoCardText: { fontSize: 13, fontFamily: Fonts.bold },

  // Footer
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 16, borderTopWidth: 1 },
  primaryShareBtn: { height: 60, borderRadius: 30, overflow: 'hidden' },
  shareGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  shareBtnText: { color: '#FFF', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 1 },
});
