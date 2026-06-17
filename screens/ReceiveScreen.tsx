import React, { useState, useEffect, memo } from 'react';
import { Theme, Fonts, COIN_META, COIN_COLORS } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Dimensions, Share, Image, StatusBar, Modal, Pressable, TextInput
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { storageService } from '../services/storageService';

const { width } = Dimensions.get('window');

// ── Fallback Network Configurations ──
const FALLBACK_NETWORKS = [
  { network_name: 'Ethereum (ERC20)', symbol: 'ETH', is_active: true, is_mainnet: true, min_deposit: '0.005 ETH', estimated_arrival: '3 minutes', warning_text: 'Only send ETH/USDT/USDC via ERC20.', supported_assets: ['ETH', 'USDT', 'USDC'] },
  { network_name: 'TRON (TRC20)', symbol: 'TRX', is_active: true, is_mainnet: true, min_deposit: '10 TRX', estimated_arrival: '1 minute', warning_text: 'Only send TRX/USDT/USDC via TRC20.', supported_assets: ['TRX', 'USDT', 'USDC'] },
  { network_name: 'Polygon Network', symbol: 'MATIC', is_active: true, is_mainnet: true, min_deposit: '5 MATIC', estimated_arrival: '2 minutes', warning_text: 'Only send MATIC/USDT/USDC via Polygon.', supported_assets: ['MATIC', 'USDT', 'USDC'] },
  { network_name: 'Arbitrum One', symbol: 'ETH', is_active: true, is_mainnet: true, min_deposit: '0.002 ETH', estimated_arrival: '30 seconds', warning_text: 'Only send ETH/USDT/USDC via Arbitrum.', supported_assets: ['ETH', 'USDT', 'USDC'] },
  { network_name: 'Sepolia Testnet', symbol: 'ETH', is_active: true, is_mainnet: false, min_deposit: '0.001 ETH', estimated_arrival: '15 seconds', warning_text: 'Only send Sepolia ETH/USDT/USDC.', supported_assets: ['ETH', 'USDT', 'USDC'] },
  { network_name: 'Bitcoin Network', symbol: 'BTC', is_active: true, is_mainnet: true, min_deposit: '0.0002 BTC', estimated_arrival: '10-60 minutes', warning_text: 'Only send Bitcoin (BTC) to this address.', supported_assets: ['BTC'] },
  { network_name: 'Solana Network', symbol: 'SOL', is_active: true, is_mainnet: true, min_deposit: '0.05 SOL', estimated_arrival: '10 seconds', warning_text: 'Only send SOL/USDT/USDC via Solana.', supported_assets: ['SOL', 'USDT', 'USDC'] },
  { network_name: 'TON Network', symbol: 'TON', is_active: true, is_mainnet: true, min_deposit: '0.5 TON', estimated_arrival: '1 minute', warning_text: 'Only send TON to this address.', supported_assets: ['TON'] },
  { network_name: 'Sui Network', symbol: 'SUI', is_active: true, is_mainnet: true, min_deposit: '0.1 SUI', estimated_arrival: '5 seconds', warning_text: 'Only send SUI to this address.', supported_assets: ['SUI'] },
  { network_name: 'Ripple Ledger', symbol: 'XRP', is_active: true, is_mainnet: true, min_deposit: '1 XRP', estimated_arrival: '10 seconds', warning_text: 'Only send XRP to this address.', supported_assets: ['XRP'] },
];

const ASSET_LIST = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'TRX', name: 'TRON' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'SUI', name: 'Sui' },
];

// ── Tab type ──
type ReceiveTab = 'wallet' | 'payment';

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

function getDepositAddress(evmAddress: string, assetSymbol: string, networkObj: any, nativeTronAddress?: string): string {
  if (!evmAddress) return '';
  const netName = (networkObj?.network_name || '').toUpperCase();
  const netSymbol = (networkObj?.symbol || '').toUpperCase();

  // TRON network or TRX native symbol
  if (netName.includes('TRON') || netSymbol === 'TRX') {
    return deriveChainAddress(evmAddress, 'TRX', nativeTronAddress);
  }
  // Solana network or SOL native symbol
  if (netName.includes('SOLANA') || netSymbol === 'SOL') {
    return deriveChainAddress(evmAddress, 'SOL');
  }
  // Standard derivation based on asset symbol
  return deriveChainAddress(evmAddress, assetSymbol, nativeTronAddress);
}

export type QRPayload = {
  address: string;
  network: string;
  chainId?: number;
  symbol:  string;
  version: number;
};

export type UIDQRPayload = {
  type: 'payment';
  uid: number;
  name?: string;
  accountType?: string;
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

export function parseUIDQRPayload(data: string): UIDQRPayload | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || parsed.type !== 'payment' || typeof parsed.uid !== 'number') return null;
    return {
      type: 'payment',
      uid: parsed.uid,
      name: parsed.name,
      accountType: parsed.accountType,
      version: parsed.version ?? 2,
    };
  } catch {
    return null;
  }
}

export default function ReceiveScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { walletAddress, tronAddress: ctxTronAddress, isDarkMode, walletName, userUid, accountType, adminNetworks } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [activeTab, setActiveTab] = useState<ReceiveTab>(route?.params?.symbol ? 'wallet' : 'payment');
  const [tronAddress, setTronAddress] = useState(ctxTronAddress || '');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Guided flow state variables
  const [receiveStep, setReceiveStep] = useState<'asset' | 'network' | 'address'>(route?.params?.symbol ? 'network' : 'asset');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(route?.params?.symbol || null);
  const [selectedNetworkObj, setSelectedNetworkObj] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const activeNets = adminNetworks && adminNetworks.length > 0 ? adminNetworks : FALLBACK_NETWORKS;
  const compatibleNets = selectedAsset
    ? activeNets.filter((n: any) => n.is_active && n.supported_assets && n.supported_assets.includes(selectedAsset))
    : [];

  const displayAddress = selectedAsset && selectedNetworkObj
    ? getDepositAddress(walletAddress, selectedAsset, selectedNetworkObj, tronAddress)
    : '';

  // Wallet QR payload
  const walletQrPayload = JSON.stringify({
    address: displayAddress,
    symbol: selectedAsset,
    network: selectedNetworkObj?.network_name || '',
    version: 1
  });

  // Payment UID QR payload
  const paymentQrPayload = userUid ? JSON.stringify({
    type: 'payment',
    uid: parseInt(userUid, 10),
    name: walletName || 'Account 1',
    accountType: accountType || 'personal',
    version: 2,
  }) : '';

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleCopy = async () => {
    if (activeTab === 'payment') {
      if (userUid) {
        await Clipboard.setStringAsync(userUid);
        showToast('UID copied to clipboard!', 'success');
      }
    } else {
      if (displayAddress) {
        await Clipboard.setStringAsync(displayAddress);
        showToast('Address copied to clipboard!', 'success');
      }
    }
  };

  const handleShare = async () => {
    try {
      if (activeTab === 'payment') {
        await Share.share({
          message: `Pay me on our wallet app!\n\nUID: ${userUid}\nName: ${walletName}\n\nScan my QR code to send funds instantly.`,
          title: 'My Payment QR',
        });
      } else if (selectedAsset && selectedNetworkObj) {
        const warning = selectedNetworkObj.warning_text || `Only send ${selectedAsset} through the selected network. Deposits from unsupported networks may be permanently lost.`;
        await Share.share({
          message: `My receiving address for ${selectedAsset} (${selectedNetworkObj.network_name}):\n\n${displayAddress}\n\nWarning: ${warning}`,
          title: `Receive ${selectedAsset}`,
        });
      }
    } catch {
      showToast('Unable to share', 'error');
    }
  };

  // Back navigation handler
  const handleBack = () => {
    if (activeTab === 'wallet') {
      if (receiveStep === 'address') {
        setReceiveStep('network');
        setSelectedNetworkObj(null);
      } else if (receiveStep === 'network') {
        // If route params pre-selected the asset, exit back
        if (route?.params?.symbol) {
          navigation.goBack();
        } else {
          setReceiveStep('asset');
          setSelectedAsset(null);
        }
      } else {
        navigation.goBack();
      }
    } else {
      navigation.goBack();
    }
  };

  const filteredAssets = ASSET_LIST.filter(
    a => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surfaceLow }]} onPress={handleBack} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          {activeTab === 'payment' ? 'RECEIVE VIA UID' : `RECEIVE ${selectedAsset || 'ASSET'}`}
        </Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
          <Ionicons name="qr-code-outline" size={20} color={T.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: T.surfaceLow }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'payment' && [styles.tabActive, { backgroundColor: T.primary }]]}
          onPress={() => { setActiveTab('payment'); }}
          activeOpacity={0.7}
        >
          <Feather name="zap" size={15} color={activeTab === 'payment' ? '#FFF' : T.textDim} />
          <Text style={[styles.tabText, { color: activeTab === 'payment' ? '#FFF' : T.textDim }]}>Payment QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'wallet' && [styles.tabActive, { backgroundColor: T.primary }]]}
          onPress={() => { setActiveTab('wallet'); }}
          activeOpacity={0.7}
        >
          <Feather name="link" size={15} color={activeTab === 'wallet' ? '#FFF' : T.textDim} />
          <Text style={[styles.tabText, { color: activeTab === 'wallet' ? '#FFF' : T.textDim }]}>Wallet QR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTab === 'payment' ? (
          <>
            <View style={styles.heroSection}>
              <Text style={[styles.heroTitle, { color: T.text }]}>Payment QR</Text>
              <Text style={[styles.heroSubTitle, { color: T.textDim }]}>
                Receive crypto from app users instantly. Share your QR code or UID.
              </Text>
            </View>

            {/* QR Card — Payment */}
            <View style={[styles.qrContainer, { borderColor: T.success + '30', backgroundColor: T.surface }]}>
              <LinearGradient
                colors={isDarkMode ? ['#1C1D21', '#0A0A0C'] : ['#FFFFFF', '#F2F4F6']}
                style={styles.qrCard}
              >
                <Text style={[styles.qrCardTitle, { color: T.textDim }]}>Scan with app to pay</Text>

                <View style={[styles.qrWrapper, { shadowColor: isDarkMode ? '#000' : '#999' }]}>
                  {paymentQrPayload ? (
                    <QRCode
                      value={paymentQrPayload}
                      size={width * 0.52}
                      color="#000"
                      backgroundColor="#FFF"
                      quietZone={12}
                    />
                  ) : (
                    <View style={{ width: width * 0.52, height: width * 0.52, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="alert-circle" size={32} color={T.textDim} />
                      <Text style={{ color: T.textDim, fontSize: 12, marginTop: 8, fontFamily: Fonts.medium }}>UID not available</Text>
                    </View>
                  )}
                </View>

                {/* User Info Badge */}
                <View style={[styles.userBadge, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <View style={[styles.userBadgeAvatar, { backgroundColor: T.primary }]}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                      {(walletName || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userBadgeName, { color: T.text }]}>{walletName || 'Account 1'}</Text>
                    <Text style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.medium }}>
                      {accountType === 'business' ? 'Merchant Account' : 'Personal Account'}
                    </Text>
                  </View>
                  {userUid && (
                    <View style={[styles.uidChip, { backgroundColor: '#F59E0B15' }]}>
                      <Feather name="hash" size={10} color="#F59E0B" />
                      <Text style={{ color: '#F59E0B', fontSize: 11, fontFamily: Fonts.bold }}>{userUid}</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* UID Copy Card */}
            {userUid && (
              <View style={styles.addressContainer}>
                <Text style={[styles.sectionLabel, { color: T.textDim }]}>YOUR UNIQUE ID (UID)</Text>
                <TouchableOpacity style={[styles.addressBox, { backgroundColor: T.surface, borderColor: T.border }]} onPress={handleCopy} activeOpacity={0.9}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.uidDisplayValue, { color: T.text }]}>{userUid}</Text>
                    <Text style={[styles.addressMeta, { color: T.textDim }]}>
                      Share this UID to receive payments
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.copyIconButton, { backgroundColor: T.surfaceLow }]} onPress={handleCopy}>
                    <Feather name="copy" size={18} color={T.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            )}

            {/* Info banner */}
            <View style={[styles.infoBanner, { backgroundColor: T.success + '10', borderColor: T.success + '30' }]}>
              <Feather name="zap" size={16} color={T.success} />
              <Text style={[styles.infoBannerText, { color: T.text }]}>
                Internal transfers are instant, free, and don't require blockchain gas fees.
              </Text>
            </View>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* WALLET QR REDESIGNED GUIDED FLOW                                  */
          /* ═══════════════════════════════════════════════════════════════════ */
          <View style={{ width: '100%' }}>
            {/* Step Indicators */}
            <View style={styles.stepIndicatorContainer}>
              <View style={[styles.stepDot, receiveStep === 'asset' && styles.stepDotActive, (receiveStep === 'network' || receiveStep === 'address') && styles.stepDotCompleted, { backgroundColor: T.border }]} />
              <View style={[styles.stepLine, (receiveStep === 'network' || receiveStep === 'address') && styles.stepLineCompleted, { backgroundColor: T.border }]} />
              <View style={[styles.stepDot, receiveStep === 'network' && styles.stepDotActive, receiveStep === 'address' && styles.stepDotCompleted, { backgroundColor: T.border }]} />
              <View style={[styles.stepLine, receiveStep === 'address' && styles.stepLineCompleted, { backgroundColor: T.border }]} />
              <View style={[styles.stepDot, receiveStep === 'address' && styles.stepDotActive, { backgroundColor: T.border }]} />
            </View>

            {/* STEP 1: SELECT ASSET */}
            {receiveStep === 'asset' && (
              <View>
                <View style={styles.heroSection}>
                  <Text style={[styles.heroTitle, { color: T.text }]}>Select Asset</Text>
                  <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Choose the token you wish to deposit to your wallet.</Text>
                </View>

                {/* Search Box */}
                <View style={[styles.searchBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <Feather name="search" size={18} color={T.textDim} />
                  <TextInput
                    style={[styles.searchInput, { color: T.text, fontFamily: Fonts.bold }]}
                    placeholder="Search tokens..."
                    placeholderTextColor={T.textDim}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x-circle" size={18} color={T.textDim} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Assets Grid */}
                <View style={styles.assetsListContainer}>
                  {filteredAssets.length === 0 ? (
                    <Text style={[styles.noResultsText, { color: T.textDim }]}>No matching assets found.</Text>
                  ) : (
                    filteredAssets.map(asset => (
                      <TouchableOpacity
                        key={asset.symbol}
                        style={[styles.assetCard, { backgroundColor: T.surface, borderColor: T.border }]}
                        onPress={() => {
                          setSelectedAsset(asset.symbol);
                          setReceiveStep('network');
                        }}
                        activeOpacity={0.7}
                      >
                        <CoinIcon symbol={asset.symbol} size={38} />
                        <View style={{ marginLeft: 16, flex: 1 }}>
                          <Text style={[styles.assetSymbol, { color: T.text }]}>{asset.symbol}</Text>
                          <Text style={[styles.assetName, { color: T.textDim }]}>{asset.name}</Text>
                        </View>
                        <View style={[styles.circleChevron, { backgroundColor: T.surfaceLow }]}>
                          <Feather name="chevron-right" size={16} color={T.textDim} />
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* STEP 2: SELECT NETWORK */}
            {receiveStep === 'network' && (
              <View>
                {/* Active Asset Banner */}
                <TouchableOpacity
                  style={[styles.assetSummaryBar, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => {
                    setReceiveStep('asset');
                    setSelectedAsset(null);
                  }}
                  activeOpacity={0.7}
                >
                  <CoinIcon symbol={selectedAsset!} size={24} />
                  <Text style={[styles.assetSummaryText, { color: T.text }]}>Selected: {selectedAsset}</Text>
                  <View style={[styles.changeChip, { backgroundColor: T.primary + '15' }]}>
                    <Text style={{ color: T.primary, fontSize: 11, fontFamily: Fonts.bold }}>Change</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.heroSection}>
                  <Text style={[styles.heroTitle, { color: T.text }]}>Select Network</Text>
                  <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Ensure you choose the correct network. Deposits from other networks will be permanently lost.</Text>
                </View>

                {/* Networks List */}
                <View style={styles.networksListContainer}>
                  {compatibleNets.length === 0 ? (
                    <View style={styles.emptyNetsContainer}>
                      <Feather name="alert-circle" size={24} color={T.primary} />
                      <Text style={[styles.emptyNetsText, { color: T.text, marginTop: 8 }]}>No networks active for {selectedAsset}</Text>
                      <Text style={[styles.emptyNetsSubText, { color: T.textDim }]}>Please select a different asset or contact admin.</Text>
                    </View>
                  ) : (
                    compatibleNets.map((net: any) => (
                      <TouchableOpacity
                        key={net.id || net.network_name}
                        style={[styles.networkCard, { backgroundColor: T.surface, borderColor: T.border }]}
                        onPress={() => {
                          setSelectedNetworkObj(net);
                          setReceiveStep('address');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.networkCardLeft}>
                          <View style={[styles.networkIconContainer, { backgroundColor: T.primary + '15' }]}>
                            <Feather name="layers" size={18} color={T.primary} />
                          </View>
                          <View style={{ marginLeft: 14 }}>
                            <Text style={[styles.networkCardName, { color: T.text }]}>{net.network_name}</Text>
                            <Text style={[styles.networkCardTime, { color: T.textDim }]}>
                              Arrival time: {net.estimated_arrival || '3 minutes'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.circleChevron, { backgroundColor: T.surfaceLow }]}>
                          <Feather name="chevron-right" size={16} color={T.textDim} />
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* STEP 3: GENERATE ADDRESS */}
            {receiveStep === 'address' && selectedNetworkObj && (
              <View>
                {/* Active Network Summary Banner */}
                <TouchableOpacity
                  style={[styles.assetSummaryBar, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => {
                    setReceiveStep('network');
                    setSelectedNetworkObj(null);
                  }}
                  activeOpacity={0.7}
                >
                  <CoinIcon symbol={selectedAsset!} size={24} />
                  <Text style={[styles.assetSummaryText, { color: T.text }]}>{selectedAsset} on {selectedNetworkObj.network_name}</Text>
                  <View style={[styles.changeChip, { backgroundColor: T.primary + '15' }]}>
                    <Text style={{ color: T.primary, fontSize: 11, fontFamily: Fonts.bold }}>Change</Text>
                  </View>
                </TouchableOpacity>

                {/* QR Card */}
                <View style={[styles.qrContainer, { borderColor: T.border, backgroundColor: T.surface, marginTop: 12 }]}>
                  <LinearGradient
                    colors={isDarkMode ? ['#1C1D21', '#0A0A0C'] : ['#FFFFFF', '#F2F4F6']}
                    style={styles.qrCard}
                  >
                    <View style={[styles.qrWrapper, { shadowColor: isDarkMode ? '#000' : '#999' }]}>
                      <QRCode
                        value={walletQrPayload || 'placeholder'}
                        size={width * 0.55}
                        color="#000"
                        backgroundColor="#FFF"
                        quietZone={12}
                      />
                    </View>

                    <View style={styles.qrFooter}>
                      <View style={[styles.networkBadge, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                        <View style={[styles.miniDot, { backgroundColor: T.success }]} />
                        <Text style={[styles.networkBadgeText, { color: T.text }]}>{selectedNetworkObj.network_name}</Text>
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
                        {selectedAsset} Receiver Address
                      </Text>
                    </View>
                    <TouchableOpacity style={[styles.copyIconButton, { backgroundColor: T.surfaceLow }]} onPress={handleCopy}>
                      <Feather name="copy" size={18} color={T.primary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>

                {/* Network parameters table */}
                <View style={[styles.paramsCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={styles.paramRow}>
                    <Text style={[styles.paramLabel, { color: T.textDim }]}>Minimum Deposit</Text>
                    <Text style={[styles.paramValue, { color: T.text }]}>{selectedNetworkObj.min_deposit || 'No Minimum'}</Text>
                  </View>
                  <View style={[styles.paramDivider, { backgroundColor: T.border }]} />
                  <View style={styles.paramRow}>
                    <Text style={[styles.paramLabel, { color: T.textDim }]}>Expected Arrival</Text>
                    <Text style={[styles.paramValue, { color: T.text }]}>{selectedNetworkObj.estimated_arrival || '3 minutes'}</Text>
                  </View>
                </View>

                {/* Warning instructions banner */}
                <View style={[styles.warningBanner, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}>
                  <MaterialCommunityIcons name="alert-decagram" size={18} color={T.primary} />
                  <Text style={[styles.warningText, { color: T.text }]}>
                    {selectedNetworkObj.warning_text || `Only send ${selectedAsset} through the selected network (${selectedNetworkObj.network_name}). Deposits from unsupported networks may be permanently lost.`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.footerContainer, { backgroundColor: isDarkMode ? 'rgba(10,10,12,0.95)' : 'rgba(247,249,251,0.97)', borderTopColor: T.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.footerRow}>
          {activeTab === 'payment' && (
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]} onPress={handleCopy} activeOpacity={0.8}>
              <Feather name="copy" size={16} color={T.text} />
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>Copy UID</Text>
            </TouchableOpacity>
          )}
          {((activeTab === 'wallet' && receiveStep === 'address') || activeTab === 'payment') && (
            <TouchableOpacity style={[styles.primaryShareBtn, activeTab === 'payment' && { flex: 1 }]} onPress={handleShare} activeOpacity={0.8}>
              <LinearGradient
                colors={[T.primary, '#D32F2F']}
                style={styles.shareGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Feather name="share-2" size={18} color="#FFF" />
                <Text style={styles.shareBtnText}>SHARE QR CODE</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {activeTab === 'wallet' && receiveStep !== 'address' && (
            <View style={{ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>
                Step {receiveStep === 'asset' ? '1 of 3' : '2 of 3'} · Complete to get address
              </Text>
            </View>
          )}
        </View>
      </View>
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
  headerTitle: { fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 2, textTransform: 'uppercase' },

  // Tab Switcher
  tabContainer: {
    flexDirection: 'row', marginHorizontal: 24, borderRadius: 16, padding: 4, marginBottom: 8,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  tabActive: {},
  tabText: { fontSize: 13, fontFamily: Fonts.bold },

  scroll: { paddingHorizontal: 24, paddingBottom: 150 },

  heroSection: { marginTop: 12, marginBottom: 20 },
  heroTitle: { fontSize: 28, fontFamily: Fonts.extraBold, letterSpacing: -1, marginBottom: 6 },
  heroSubTitle: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium },

  // Search Box
  searchBox: {
    flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 18,
    borderWidth: 1.5, paddingHorizontal: 16, gap: 10, marginBottom: 20
  },
  searchInput: { flex: 1, fontSize: 15 },

  // Asset / Network lists
  assetsListContainer: { gap: 10, marginBottom: 30 },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1
  },
  assetSymbol: { fontSize: 16, fontFamily: Fonts.extraBold },
  assetName: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 1 },
  circleChevron: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  assetSummaryBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
    borderWidth: 1, gap: 10, marginBottom: 12
  },
  assetSummaryText: { flex: 1, fontSize: 13, fontFamily: Fonts.bold },
  changeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },

  networksListContainer: { gap: 10, marginBottom: 30 },
  networkCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 18, borderWidth: 1
  },
  networkCardLeft: { flexDirection: 'row', alignItems: 'center' },
  networkIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  networkCardName: { fontSize: 15, fontFamily: Fonts.bold },
  networkCardTime: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },

  emptyNetsContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyNetsText: { fontSize: 16, fontFamily: Fonts.bold },
  emptyNetsSubText: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 4 },

  // Step Indicators
  stepIndicatorContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 14, paddingHorizontal: 40
  },
  stepDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#FFF' },
  stepDotActive: { backgroundColor: '#EC2629', borderColor: '#EC2629' },
  stepDotCompleted: { backgroundColor: '#00C853', borderColor: '#00C853' },
  stepLine: { flex: 1, height: 2 },
  stepLineCompleted: { backgroundColor: '#00C853' },

  // Parameters card
  paramsCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12 },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paramLabel: { fontSize: 13, fontFamily: Fonts.bold },
  paramValue: { fontSize: 13, fontFamily: Fonts.extraBold },
  paramDivider: { height: 1 },

  // QR
  qrContainer: { marginBottom: 20, borderRadius: 32, overflow: 'hidden', borderWidth: 1.5 },
  qrCard: { padding: 28, alignItems: 'center' },
  qrCardTitle: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 20 },
  qrWrapper: {
    backgroundColor: '#FFF', padding: 12, borderRadius: 24,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  qrFooter: { marginTop: 20 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, gap: 8, borderWidth: 1 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  networkBadgeText: { fontSize: 12, fontFamily: Fonts.bold },

  // User Badge (Payment QR)
  userBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
    width: '100%',
  },
  userBadgeAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  userBadgeName: { fontSize: 14, fontFamily: Fonts.bold },
  uidChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // Address
  addressContainer: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  addressBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 20, gap: 16, borderWidth: 1 },
  addressValue: { fontSize: 14, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  uidDisplayValue: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: 1, marginBottom: 4 },
  addressMeta: { fontSize: 12, fontFamily: Fonts.semiBold },
  copyIconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Warning Banner
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24,
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },

  // Info Banner (Payment tab)
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24,
  },
  infoBannerText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },

  noResultsText: { textAlign: 'center', paddingVertical: 40, fontSize: 14, fontFamily: Fonts.medium },

  // Footer
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 16, borderTopWidth: 1 },
  footerRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 24, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 13, fontFamily: Fonts.bold },
  primaryShareBtn: { flex: 1, height: 56, borderRadius: 28, overflow: 'hidden' },
  shareGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareBtnText: { color: '#FFF', fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
});
