import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Switch, TextInput, Modal, Image, ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { storageService } from '../services/storageService';
import { Theme, COIN_META, COIN_COLORS } from '../constants';
import Toast from '../components/Toast';
import { haptics } from '../utils/haptics';
import PinScreen from './PinScreen';
import { clearPin as removePin } from '../services/pinService';

const NETWORKS = [
  { name: 'Sepolia',  type: 'Testnet', color: '#F59E0B', iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { name: 'Ethereum', type: 'Mainnet', color: '#627EEA', iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { name: 'Polygon',  type: 'Mainnet', color: '#8247E5', iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png' },
  { name: 'Arbitrum', type: 'Mainnet', color: '#2D374B', iconUrl: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg' },
];

const CoinIcon = ({ symbol, size = 36 }: { symbol: string; size?: number }) => {
  const meta = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = useState(false);
  if (meta && !failed) {
    return <Image source={{ uri: meta.iconUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setFailed(true)} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
};

export default function SettingsScreen({ navigation }: any) {
  const {
    network, switchNetwork, walletAddress, walletName, setWalletName,
    deleteWallet, isDarkMode, toggleTheme, balances, ethBalance,
    pinEnabled, refreshPinEnabled,
  } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  // Refresh pin badge whenever screen comes into focus
  React.useEffect(() => {
    refreshPinEnabled();
  }, []);

  const [renameModal, setRenameModal]   = useState(false);
  const [nameInput, setNameInput]       = useState(walletName);
  const [phraseModal, setPhraseModal]   = useState(false);
  const [phrase, setPhrase]             = useState('');
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [pinVerifyMode, setPinVerifyMode] = useState<'phrase' | 'toggle_off' | null>(null);
  const [showPinSetup, setShowPinSetup]   = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const copyAddress = async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    haptics.success();
    showToast('Wallet address copied!', 'success');
  };

  const handleRename = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await setWalletName(trimmed);
    setRenameModal(false);
    showToast('Wallet renamed successfully', 'success');
  };

  const executeViewPhrase = async () => {
    setPhraseLoading(true);
    setPhraseModal(true);
    try {
      const m = await storageService.getMnemonic();
      setPhrase(m ?? 'Unable to retrieve seed phrase.');
    } catch (_e) {
      setPhrase('Unable to retrieve seed phrase.');
    } finally {
      setPhraseLoading(false);
    }
  };

  const handleViewPhrase = () => {
    if (pinEnabled) {
      setPinVerifyMode('phrase');
      return;
    }
    Alert.alert(
      'View Seed Phrase',
      'Your seed phrase gives full access to your wallet. Never share it with anyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Show Phrase', style: 'destructive', onPress: executeViewPhrase },
      ]
    );
  };

  const handleTogglePin = async () => {
    if (pinEnabled) {
      setPinVerifyMode('toggle_off');
    } else {
      setShowPinSetup(true);
    }
  };

  const handleCopyPhrase = async () => {
    await Clipboard.setStringAsync(phrase);
    showToast('Seed phrase copied. Keep it safe!', 'info');
  };

  const handleDelete = () => {
    haptics.heavy();
    Alert.alert(
      'Logout & Delete Wallet',
      'This will remove your wallet from this device. Make sure your seed phrase is backed up first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWallet(); } },
      ]
    );
  };

  const styles = makeStyles(T);

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      <Modal visible={pinVerifyMode !== null} animationType="slide">
        {pinVerifyMode && (
          <PinScreen 
            mode="verify" 
            onSuccess={async () => {
              const mode = pinVerifyMode;
              setPinVerifyMode(null);
              if (mode === 'phrase') {
                 setTimeout(() => executeViewPhrase(), 300);
              } else if (mode === 'toggle_off') {
                 await removePin();
                 refreshPinEnabled();
                 showToast('PIN removed successfully', 'success');
              }
            }} 
            onCancel={() => setPinVerifyMode(null)} 
          />
        )}
      </Modal>

      <Modal visible={showPinSetup} animationType="slide">
         <PinScreen
            mode="setup"
            onSuccess={() => {
               setShowPinSetup(false);
               refreshPinEnabled();
               showToast('PIN enabled successfully!', 'success');
            }}
            onCancel={() => setShowPinSetup(false)}
         />
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: T.surface }]}>
            <Text style={[styles.modalTitle, { color: T.text }]}>Rename Wallet</Text>
            <TextInput
              style={[styles.modalInput, { color: T.text, borderColor: T.border, backgroundColor: T.background }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Main Wallet"
              placeholderTextColor={T.textMuted}
              maxLength={24}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.surfaceLow }]} onPress={() => setRenameModal(false)}>
                <Text style={[styles.modalBtnText, { color: T.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} onPress={handleRename}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Seed Phrase Modal */}
      <Modal visible={phraseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: T.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: T.text, marginBottom: 0 }]}>Seed Phrase</Text>
              <TouchableOpacity onPress={() => { setPhraseModal(false); setPhrase(''); }}>
                <Feather name="x" size={22} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            {phraseLoading ? (
              <ActivityIndicator color={T.primary} style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={[styles.phraseGrid, { backgroundColor: T.surfaceLow }]}>
                  {phrase.split(' ').map((word, i) => (
                    <View key={i} style={[styles.wordBox, { borderColor: T.border }]}>
                      <Text style={[styles.wordNum, { color: T.textMuted }]}>{i + 1}</Text>
                      <Text style={[styles.wordText, { color: T.text }]}>{word}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.copyPhraseBtn, { borderColor: T.border }]} onPress={handleCopyPhrase}>
                  <Feather name="copy" size={16} color={T.primary} />
                  <Text style={[styles.copyPhraseBtnText, { color: T.primary }]}>Copy Phrase</Text>
                </TouchableOpacity>
                <View style={[styles.phraseWarning, { backgroundColor: T.error + '15' }]}>
                  <Feather name="alert-triangle" size={14} color={T.error} />
                  <Text style={[styles.phraseWarningText, { color: T.error }]}>
                    Never share this with anyone. CryptoWallet will never ask for it.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: isDarkMode ? '#191C1E' : T.surfaceLow }]}>
          <View style={[styles.profileAvatar, { backgroundColor: T.primary }]}>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800' }}>
              {walletName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.profileName, { color: T.text }]}>{walletName}</Text>
              <TouchableOpacity onPress={() => { setNameInput(walletName); setRenameModal(true); }} activeOpacity={0.7}>
                <Feather name="edit-2" size={14} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.walletAddrRow}>
              <Text style={[styles.profileAddr, { color: T.textMuted }]} numberOfLines={1}>
                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'No wallet'}
              </Text>
              <TouchableOpacity onPress={copyAddress} style={[styles.copyIcon, { backgroundColor: T.primary + '20' }]}>
                <Feather name="copy" size={14} color={T.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Holdings with real coin logos */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>My Holdings</Text>
        <View style={[styles.cardBlock, { backgroundColor: T.surface }]}>
          {(['ETH', 'USDC', 'USDT'] as const).map((sym, i, arr) => {
            const amt = sym === 'ETH' ? parseFloat(ethBalance) || 0 : (balances[sym] ?? 0);
            const usd = amt * (prices[sym]?.usd ?? 0);
            return (
              <TouchableOpacity
                key={sym}
                onPress={() => { haptics.selection(); navigation.navigate('CoinChart', { symbol: sym }); }}
                activeOpacity={0.7}
                style={[styles.holdingRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <CoinIcon symbol={sym} size={40} />
                  <View>
                    <Text style={[styles.menuLabel, { color: T.text }]}>{COIN_META[sym]?.name ?? sym}</Text>
                    <Text style={[styles.menuSub, { color: T.textMuted }]}>{amt.toFixed(4)} {sym}</Text>
                  </View>
                </View>
                <Text style={[styles.menuLabel, { color: T.text }]}>${usd.toFixed(2)}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Coming Soon rows */}
          {(['BTC', 'SOL'] as const).map((sym, i) => (
            <TouchableOpacity
              key={sym}
              onPress={() => { haptics.selection(); showToast('BTC & SOL support coming soon!', 'info'); }}
              activeOpacity={0.7}
              style={[styles.holdingRow, { borderTopWidth: i === 0 ? 1 : 0, borderTopColor: T.border }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <CoinIcon symbol={sym} size={40} />
                <View>
                  <Text style={[styles.menuLabel, { color: T.text }]}>{COIN_META[sym]?.name ?? sym}</Text>
                  <Text style={[styles.menuSub, { color: T.textMuted }]}>{sym}</Text>
                </View>
              </View>
              <View style={[styles.comingSoonChip, { backgroundColor: T.primary + '20', borderColor: T.primary + '40' }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: T.primary }}>Soon</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Network Selection */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>Network Selection</Text>
        <View style={[styles.cardBlock, { backgroundColor: T.surface }]}>
          {NETWORKS.map((n, i) => {
            const isActive = network === n.name;
            return (
              <TouchableOpacity
                key={n.name}
                activeOpacity={0.7}
                style={[styles.networkRow, i < NETWORKS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
                onPress={() => {
                  if (n.type === 'Mainnet' && !isActive) {
                    Alert.alert(
                      'Switch to Mainnet',
                      `You are switching to ${n.name} Mainnet. This uses real funds.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Switch', onPress: () => { haptics.warning(); switchNetwork(n.name); showToast(`Switched to ${n.name}`, 'success'); } },
                      ]
                    );
                  } else {
                    haptics.selection();
                    switchNetwork(n.name);
                    showToast(`Switched to ${n.name}`, 'success');
                  }
                }}
              >
                <View style={styles.networkLeft}>
                  <View style={[styles.networkIconCore, { backgroundColor: n.color + '20' }]}>
                    <Image source={{ uri: n.iconUrl }} style={{ width: 26, height: 26, borderRadius: 13 }} />
                  </View>
                  <View>
                    <Text style={[styles.networkName, { color: T.text }]}>{n.name}</Text>
                    <Text style={[styles.networkType, { color: T.textMuted }]}>{n.type}</Text>
                  </View>
                </View>
                {isActive
                  ? <Feather name="check-circle" size={20} color={T.primary} />
                  : <View style={[styles.radioEmpty, { borderColor: T.border }]} />
                }
              </TouchableOpacity>
            );
          })}
        </View>

        {/* General Settings */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>General</Text>
        <View style={[styles.cardBlock, { backgroundColor: T.surface }]}>

          {/* Virtual Card */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Card')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="credit-card" size={18} color={T.primary} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Virtual Card</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>Manage your premium debit card</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>

          {/* PIN Lock */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={handleTogglePin}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="lock" size={18} color={T.primary} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>PIN Lock</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>
                  {pinEnabled ? 'PIN is active — tap to change' : 'Set a PIN to secure your wallet'}
                </Text>
              </View>
            </View>
            <View style={[styles.pinBadge, { backgroundColor: pinEnabled ? T.success + '20' : T.border }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: pinEnabled ? T.success : T.textMuted }}>
                {pinEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Dark Mode Toggle */}
          <View style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name={isDarkMode ? 'moon' : 'sun'} size={18} color={T.text} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Dark Theme</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>Toggle light/dark mode</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: T.border, true: T.primaryLight }}
              thumbColor={isDarkMode ? T.primary : T.surfaceLow}
            />
          </View>

          {/* View Seed Phrase */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={handleViewPhrase}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="shield" size={18} color={T.text} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>View Seed Phrase</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>Backup your recovery phrase</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>

          {/* Transaction History */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('History')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="list" size={18} color={T.text} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Transaction History</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>View all transactions</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Support')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="help-circle" size={18} color={T.text} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Help & Support</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>Get help with your wallet</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: T.surface, borderColor: T.error }]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={18} color={T.error} />
          <Text style={[styles.logoutBtnText, { color: T.error }]}>Logout & Delete Wallet</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    padding: 20, marginBottom: 32, marginTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  walletAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileAddr: { fontSize: 13, fontFamily: 'monospace' },
  copyIcon: { padding: 4, borderRadius: 6 },

  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 },
  cardBlock: { borderRadius: 20, marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },

  networkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  networkLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  networkIconCore: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  networkName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  networkType: { fontSize: 13, fontWeight: '500' },
  pinBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  radioEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },

  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  menuSub: { fontSize: 13 },

  comingSoonChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, gap: 10, borderWidth: 1 },
  logoutBtnText: { fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },

  phraseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, borderRadius: 16, marginBottom: 16 },
  wordBox: { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: T.border },
  wordNum: { fontSize: 10, fontWeight: '700', minWidth: 14 },
  wordText: { fontSize: 13, fontWeight: '700', flex: 1 },
  copyPhraseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  copyPhraseBtnText: { fontSize: 14, fontWeight: '700' },
  phraseWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
  phraseWarningText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
});
