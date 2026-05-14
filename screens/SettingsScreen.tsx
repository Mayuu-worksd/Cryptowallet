import React, { useState, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Switch, TextInput, Modal, Image, ActivityIndicator,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmall = SCREEN_WIDTH < 375;
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { storageService } from '../services/storageService';
import { COIN_META, COIN_COLORS } from '../constants';
import Toast from '../components/Toast';
import { haptics } from '../utils/haptics';
import PinScreen from './PinScreen';
import { clearPin as removePin } from '../services/pinService';

const NETWORKS = [
  { name: 'Sepolia',    type: 'Testnet', color: '#F59E0B', iconUrl: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png' },
  { name: 'Ethereum',  type: 'Mainnet', color: '#627EEA', iconUrl: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png' },
  { name: 'Polygon',   type: 'Mainnet', color: '#8247E5', iconUrl: 'https://coin-images.coingecko.com/coins/images/4713/large/matic-token-icon.png' },
  { name: 'Arbitrum',  type: 'Mainnet', color: '#2D374B', iconUrl: 'https://coin-images.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg' },
  { name: 'TRON',      type: 'Mainnet', color: '#EF0027', iconUrl: 'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png' },
  { name: 'TRON Nile', type: 'Testnet', color: '#FF6B6B', iconUrl: 'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png' },
];

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳', currency: 'INR' },
  { name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { name: 'UAE', flag: '🇦🇪', currency: 'AED' },
  { name: 'Singapore', flag: '🇸🇬', currency: 'SGD' },
  { name: 'European Union', flag: '🇪🇺', currency: 'EUR' },
  { name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { name: 'Japan', flag: '🇯🇵', currency: 'JPY' },
  { name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { name: 'Switzerland', flag: '🇨🇭', currency: 'CHF' },
];

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
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
    network, switchNetwork, walletAddress, tronAddress,
    walletName, setWalletName,
    deleteWallet, enterReadOnlyMode, isDarkMode, toggleTheme, balances, ethBalance,
    pinEnabled, refreshPinEnabled, isReadOnly, kycStatus, accountType, setAccountType,
    p2pCountry, p2pCurrency, setP2PPreferences,
  } = useWallet() as any;
  const isTronNetwork = network === 'TRON' || network === 'TRON Nile';
  // Show EVM address on EVM networks, TRON address on TRON networks
  const primaryAddress = isTronNetwork ? (tronAddress || '') : (walletAddress || '');
  const secondaryAddress = isTronNetwork ? (walletAddress || '') : (tronAddress || '');
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const adminTapCount = React.useRef(0);
  const adminTapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHeaderTap = () => {
    adminTapCount.current += 1;
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
    if (adminTapCount.current >= 5) {
      adminTapCount.current = 0;
      navigation.navigate('Admin');
      return;
    }
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
  };

  // Refresh pin badge whenever screen comes into focus
  React.useEffect(() => {
    refreshPinEnabled();
  }, []);

  const [renameModal, setRenameModal]   = useState(false);
  const [nameInput, setNameInput]       = useState(walletName);
  const [accountTypeModal, setAccountTypeModal] = useState(false);
  const [phraseModal, setPhraseModal]   = useState(false);
  const [phrase, setPhrase]             = useState('');
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [pinVerifyMode, setPinVerifyMode] = useState<'phrase' | 'toggle_off' | null>(null);
  const [showPinSetup, setShowPinSetup]   = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const copyAddress = async () => {
    if (!primaryAddress) return;
    await Clipboard.setStringAsync(primaryAddress);
    haptics.success();
    showToast(isTronNetwork ? 'TRON address copied!' : 'EVM address copied!', 'success');
  };

  const copyTronAddress = async () => {
    if (!secondaryAddress) return;
    await Clipboard.setStringAsync(secondaryAddress);
    haptics.success();
    showToast(isTronNetwork ? 'EVM address copied!' : 'TRON address copied!', 'success');
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

  const handleLogout = () => {
    haptics.heavy();
    Alert.alert(
      'Logout',
      'This will remove your wallet from this device. Your transaction history and balance data will be preserved — re-import your seed phrase anytime to restore full access.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => { await deleteWallet(); } },
      ]
    );
  };

  const handleDeleteAccount = () => {
    haptics.heavy();
    Alert.alert(
      'Delete Account',
      'This will permanently remove your private keys from this device. Your wallet address will remain visible in read-only mode — you can see your balance but cannot send, swap, or receive.\n\nTo restore full access, re-import your seed phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => { await enterReadOnlyMode(); },
        },
      ]
    );
  };

  const styles = makeStyles(T);

  const SelectionModal = ({ visible, onClose, title, items, selected, onSelect, type }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={[styles.modalTitle, { color: T.text, marginBottom: 0 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={T.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {items.map((item: any) => {
              const isSelected = type === 'country' ? selected === item.name : selected === item.code;
              return (
                <TouchableOpacity
                  key={type === 'country' ? item.name : item.code}
                  style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <View style={styles.menuLeft}>
                    {type === 'country' ? <Text style={styles.flagIcon}>{item.flag}</Text> : <Feather name="dollar-sign" size={16} color={T.textMuted} />}
                    <Text style={[styles.menuLabel, { color: T.text }]}>{type === 'country' ? item.name : `${item.code} - ${item.name}`}</Text>
                  </View>
                  {isSelected && <Feather name="check" size={20} color={T.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />
      <SelectionModal 
        visible={showRegionModal} 
        onClose={() => setShowRegionModal(false)}
        title="Select Region"
        items={COUNTRIES}
        selected={p2pCountry}
        onSelect={(c: any) => { setP2PPreferences(c.name, c.currency); showToast(`Region updated to ${c.name}`, 'success'); }}
        type="country"
      />
      <SelectionModal 
        visible={showCurrencyModal} 
        onClose={() => setShowCurrencyModal(false)}
        title="Base Currency"
        items={CURRENCIES}
        selected={p2pCurrency}
        onSelect={(c: any) => { setP2PPreferences(p2pCountry, c.code); showToast(`Currency updated to ${c.code}`, 'success'); }}
        type="currency"
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

      {/* Account Type Modal */}
      <Modal visible={accountTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: T.surface }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.modalTitle, { color: T.text, marginBottom: 0 }]}>Account Type</Text>
              <TouchableOpacity onPress={() => setAccountTypeModal(false)}>
                <Feather name="x" size={22} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[{ color: T.textMuted, fontSize: 13, marginBottom: 24, lineHeight: 20 }]}>
              Choose how you use CryptoWallet. Switch anytime.
            </Text>

            {/* Personal Option */}
            <TouchableOpacity
              onPress={async () => { await setAccountType('personal'); setAccountTypeModal(false); showToast('Switched to Personal account', 'success'); }}
              activeOpacity={0.85}
              style={[styles.accountTypeOption, {
                backgroundColor: accountType === 'personal' ? T.success + '12' : T.surfaceLow,
                borderColor: accountType === 'personal' ? T.success : T.border,
                borderWidth: accountType === 'personal' ? 2 : 1,
              }]}
            >
              <View style={[styles.accountTypeIconWrap, { backgroundColor: T.success + '20' }]}>
                <Feather name="user" size={22} color={T.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountTypeOptionTitle, { color: T.text }]}>Personal</Text>
                <Text style={[styles.accountTypeOptionDesc, { color: T.textMuted }]}>Send, receive, swap & P2P trading</Text>
              </View>
              {accountType === 'personal' && (
                <View style={[styles.activeCheck, { backgroundColor: T.success }]}>
                  <Feather name="check" size={14} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Business Option */}
            <TouchableOpacity
              onPress={async () => { await setAccountType('business'); setAccountTypeModal(false); showToast('Switched to Business Merchant account', 'success'); }}
              activeOpacity={0.85}
              style={[styles.accountTypeOption, {
                backgroundColor: accountType === 'business' ? T.primary + '12' : T.surfaceLow,
                borderColor: accountType === 'business' ? T.primary : T.border,
                borderWidth: accountType === 'business' ? 2 : 1,
                marginBottom: 0,
              }]}
            >
              <View style={[styles.accountTypeIconWrap, { backgroundColor: T.primary + '20' }]}>
                <Feather name="briefcase" size={22} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountTypeOptionTitle, { color: T.text }]}>Business Merchant</Text>
                <Text style={[styles.accountTypeOptionDesc, { color: T.textMuted }]}>Merchant QR, business KYC & multi-currency P2P</Text>
              </View>
              {accountType === 'business' && (
                <View style={[styles.activeCheck, { backgroundColor: T.primary }]}>
                  <Feather name="check" size={14} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHeaderTap} activeOpacity={1}>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
        </TouchableOpacity>
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
            {/* Address row — compact single line */}
            <TouchableOpacity onPress={copyAddress} activeOpacity={0.7} style={styles.addrRow}>
              <View style={[styles.addrNetPill, { backgroundColor: isTronNetwork ? '#EF002718' : '#627EEA18' }]}>
                <View style={[styles.addrNetDot, { backgroundColor: isTronNetwork ? '#EF0027' : '#627EEA' }]} />
                <Text style={[styles.addrNetLabel, { color: isTronNetwork ? '#EF0027' : '#627EEA' }]}>
                  {isTronNetwork ? 'TRX' : 'EVM'}
                </Text>
              </View>
              <Text style={[styles.addrText, { color: T.textMuted }]} numberOfLines={1}>
                {primaryAddress ? `${primaryAddress.slice(0, 6)}...${primaryAddress.slice(-4)}` : 'No wallet'}
              </Text>
              <Feather name="copy" size={12} color={T.textMuted} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
            {/* Account Type Badge */}
            <TouchableOpacity
              onPress={() => setAccountTypeModal(true)}
              style={[styles.accountTypeBadge, { backgroundColor: accountType === 'business' ? T.primary + '20' : T.success + '20' }]}
            >
              <Feather name={accountType === 'business' ? 'briefcase' : 'user'} size={12} color={accountType === 'business' ? T.primary : T.success} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: accountType === 'business' ? T.primary : T.success, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {accountType === 'business' ? 'Business Merchant' : 'Personal'}
              </Text>
              <Feather name="chevron-down" size={11} color={accountType === 'business' ? T.primary : T.success} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Holdings with real coin logos */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>My Holdings</Text>
        <View style={[styles.cardBlock, { backgroundColor: T.surface }]}>
          {(['ETH', 'USDC', 'USDT', 'TRX'] as const).map((sym, i, arr) => {
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

          {/* Merchant Dashboard — Business only */}
          {accountType === 'business' && (
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MerchantDashboard')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="briefcase" size={18} color={'#10B981'} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Merchant Dashboard</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>QR payments & P2P marketplace</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>
          )}

          {/* KYC Verification — Personal shows personal KYC, Business shows Business KYC */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={async () => {
              if (accountType === 'business') {
                navigation.navigate('BusinessKYCForm');
                return;
              }
              // Always fetch fresh status — never trust stale context value
              try {
                const { kycService } = await import('../services/supabaseService');
                const record = await kycService.getStatus(walletAddress);
                if (!record) {
                  navigation.navigate('KYCIntro');
                } else if (
                  record.status === 'verified' ||
                  record.status === 'under_review' ||
                  (record.status === 'pending' && !!record.document_url)
                ) {
                  navigation.navigate('KYCResult');
                } else {
                  // pending with no doc or rejected — go to form
                  navigation.navigate('KYCForm');
                }
              } catch {
                navigation.navigate('KYCIntro');
              }
            }}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="shield" size={18} color={
                  accountType === 'business' ? T.text :
                  kycStatus === 'verified'     ? T.success :
                  kycStatus === 'under_review' ? T.primary :
                  kycStatus === 'pending'      ? '#F59E0B' :
                  kycStatus === 'rejected'     ? T.error : T.text
                } />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>
                  {accountType === 'business' ? 'Business KYC' : 'Identity Verification'}
                </Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>
                  {accountType === 'business' ? 'Verify your business to unlock merchant features' : 'KYC required for physical card'}
                </Text>
              </View>
            </View>
            {accountType === 'personal' && (
              <View style={[styles.pinBadge, { backgroundColor:
                kycStatus === 'verified'     ? T.success + '20' :
                kycStatus === 'under_review' ? T.primary + '20' :
                kycStatus === 'pending'      ? '#F59E0B20' :
                kycStatus === 'rejected'     ? T.error + '20' : T.border
              }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color:
                  kycStatus === 'verified'     ? T.success :
                  kycStatus === 'under_review' ? T.primary :
                  kycStatus === 'pending'      ? '#F59E0B' :
                  kycStatus === 'rejected'     ? T.error : T.textMuted
                }}>
                  {kycStatus === 'verified'     ? 'VERIFIED' :
                   kycStatus === 'under_review' ? 'REVIEW' :
                   kycStatus === 'pending'      ? 'PENDING' :
                   kycStatus === 'rejected'     ? 'REJECTED' : 'START'}
                </Text>
              </View>
            )}
            {accountType === 'business' && (
              <Feather name="chevron-right" size={20} color={T.textMuted} />
            )}
          </TouchableOpacity>

          {/* Virtual Card — Personal only */}
          {accountType !== 'business' && (
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
          )}

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

          {/* Regional Preferences */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => setShowRegionModal(true)}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: T.background }]}>
                <Feather name="globe" size={18} color={T.primary} />
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: T.text }]}>Region</Text>
                <Text style={[styles.menuSub, { color: T.textMuted }]}>{p2pCountry} · {p2pCurrency}</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={T.textMuted} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
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

        {/* Testnet Faucets */}
        {(network === 'Sepolia' || network === 'TRON Nile') && (
          <>
            <Text style={[styles.sectionTitle, { color: T.textMuted }]}>Testnet Faucets</Text>
            <View style={[styles.cardBlock, { backgroundColor: T.surface }]}>
              {network === 'Sepolia' && [
                { label: 'ETH Sepolia Faucet', url: 'https://sepoliafaucet.com', icon: 'droplet', color: '#627EEA' },
                { label: 'USDT Sepolia Faucet', url: 'https://faucet.circle.com', icon: 'droplet', color: '#26A17B' },
                { label: 'Alchemy Faucet', url: 'https://www.alchemy.com/faucets/ethereum-sepolia', icon: 'zap', color: '#F59E0B' },
              ].map((f, i, arr) => (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.menuRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
                  activeOpacity={0.7}
                  onPress={() => Alert.alert(f.label, `Open ${f.url} in your browser to get test tokens.`)}
                >
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIconBox, { backgroundColor: f.color + '20' }]}>
                      <Feather name={f.icon as any} size={18} color={f.color} />
                    </View>
                    <View>
                      <Text style={[styles.menuLabel, { color: T.text }]}>{f.label}</Text>
                      <Text style={[styles.menuSub, { color: T.textMuted }]}>{f.url}</Text>
                    </View>
                  </View>
                  <Feather name="external-link" size={16} color={T.textMuted} />
                </TouchableOpacity>
              ))}
              {network === 'TRON Nile' && [
                { label: 'TRX Nile Faucet', url: 'https://nileex.io/join/getJoinPage', icon: 'droplet', color: '#EF0027' },
                { label: 'USDT TRC20 Faucet', url: 'https://nileex.io/join/getJoinPage', icon: 'droplet', color: '#26A17B' },
                { label: 'Nile Testnet Explorer', url: 'https://nile.tronscan.org', icon: 'external-link', color: '#FF6B6B' },
              ].map((f, i, arr) => (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.menuRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
                  activeOpacity={0.7}
                  onPress={() => Alert.alert(f.label, `Open ${f.url} in your browser to get test TRX.`)}
                >
                  <View style={styles.menuLeft}>
                    <View style={[styles.menuIconBox, { backgroundColor: f.color + '20' }]}>
                      <Feather name={f.icon as any} size={18} color={f.color} />
                    </View>
                    <View>
                      <Text style={[styles.menuLabel, { color: T.text }]}>{f.label}</Text>
                      <Text style={[styles.menuSub, { color: T.textMuted }]}>{f.url}</Text>
                    </View>
                  </View>
                  <Feather name="external-link" size={16} color={T.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Read-Only Mode Banner */}
        {isReadOnly && (
          <View style={[styles.readOnlyBanner, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B50' }]}>
            <Feather name="eye" size={18} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: '800', marginBottom: 2 }}>Read-Only Mode</Text>
              <Text style={{ color: '#F59E0B99', fontSize: 12, lineHeight: 18 }}>
                Your private keys have been removed. Balance is visible but you cannot transact. Import your seed phrase to restore full access.
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {isReadOnly ? (
          // In read-only mode: offer to re-import wallet
          <TouchableOpacity
            style={[styles.importRestoreBtn, { backgroundColor: T.primaryDark }]}
            onPress={() => {
              // Navigate back to Landing → ImportWallet
              // Since hasWallet is still true we can't go to Landing stack.
              // Instead show an info toast — user can factory reset from here.
              haptics.selection();
              Alert.alert(
                'Restore Full Access',
                'To restore your wallet, logout first and then re-import your seed phrase on the next screen.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Logout & Restore',
                    onPress: async () => { await deleteWallet(); },
                  },
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Feather name="download" size={18} color="#FFF" />
            <Text style={[styles.logoutBtnText, { color: '#FFF' }]}>Import Wallet to Restore Access</Text>
          </TouchableOpacity>
        ) : (
          // Normal mode: show Logout + Delete Account
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: T.surface, borderColor: T.error }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Feather name="log-out" size={18} color={T.error} />
              <Text style={[styles.logoutBtnText, { color: T.error }]}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: T.error + '15', borderColor: T.error + '60' }]}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={18} color={T.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.logoutBtnText, { color: T.error, textAlign: 'left' }]}>Delete Account</Text>
                <Text style={{ color: T.error + '99', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  Removes keys · Balance still visible
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={T.error + '80'} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: isSmall ? 16 : 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    backgroundColor: T.background,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: T.surfaceLow },
  headerTitle: { fontSize: isSmall ? 16 : 18, fontFamily: Fonts.extraBold, color: T.text, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: isSmall ? 16 : 24, paddingBottom: 120, paddingTop: 12 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    padding: isSmall ? 16 : 20, marginBottom: 28,
    borderWidth: 1, borderColor: T.surfaceHigh,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  profileAvatar: { width: isSmall ? 48 : 56, height: isSmall ? 48 : 56, borderRadius: isSmall ? 24 : 28, alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: isSmall ? 16 : 18, fontFamily: Fonts.extraBold, marginBottom: 4, letterSpacing: -0.5 },
  profileAddr: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', opacity: 0.7 },
  copyIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  addrNetPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  addrNetDot: { width: 5, height: 5, borderRadius: 3 },
  addrNetLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  addrText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', flex: 1 },
  accountTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start' },
  accountTypeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 12 },
  accountTypeIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountTypeOptionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  accountTypeOptionDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  activeCheck: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  sectionTitle: { fontSize: 11, fontFamily: Fonts.extraBold, textTransform: 'uppercase', marginBottom: 14, marginLeft: 4, letterSpacing: 1.2, opacity: 0.6 },
  cardBlock: { borderRadius: 20, marginBottom: 28, borderWidth: 1, borderColor: T.surfaceHigh, overflow: 'hidden' },

  networkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  networkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  networkIconCore: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  networkName: { fontSize: isSmall ? 14 : 15, fontFamily: Fonts.bold, marginBottom: 2 },
  networkType: { fontSize: 12, fontFamily: Fonts.semiBold, opacity: 0.6 },
  pinBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  radioEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, flexShrink: 0 },

  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  menuIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel: { fontSize: isSmall ? 14 : 15, fontFamily: Fonts.bold, marginBottom: 2 },
  menuSub: { fontSize: 12, opacity: 0.6 },

  comingSoonChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 18, gap: 10, borderWidth: 1, marginBottom: 12 },
  logoutBtnText: { fontSize: 16, fontFamily: Fonts.extraBold },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingVertical: 16, paddingHorizontal: 20,
    gap: 14, borderWidth: 1,
  },
  importRestoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, paddingVertical: 18, gap: 10,
  },
  readOnlyBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20,
    marginTop: 10,
  },
  flagIcon: { fontSize: 20, marginRight: 12 },
  menuLabelSmall: { fontSize: 15, fontWeight: '700' },
  menuSubSmall: { fontSize: 11, opacity: 0.6, marginTop: 1 },
  menuIconBoxSmall: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { width: '100%', maxWidth: 420, borderRadius: 32, padding: 28, borderWidth: 1, borderColor: T.surfaceHigh },
  modalTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: T.text, marginBottom: 20, letterSpacing: -0.5 },
  modalInput: { borderWidth: 1, borderRadius: 18, padding: 18, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
  modalBtnText: { fontSize: 16, fontFamily: Fonts.extraBold },

  phraseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, borderRadius: 20, marginBottom: 20 },
  wordBox: { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  wordNum: { fontSize: 11, fontFamily: Fonts.extraBold, minWidth: 16, opacity: 0.5 },
  wordText: { fontSize: 14, fontFamily: Fonts.extraBold, flex: 1 },
  copyPhraseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  copyPhraseBtnText: { fontSize: 15, fontFamily: Fonts.extraBold },
  phraseWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 16 },
  phraseWarningText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: Fonts.bold },
});

