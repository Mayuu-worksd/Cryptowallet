import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Image,
  Modal,
  Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Theme, Fonts, COIN_META, COIN_COLORS } from '../constants';
import { useWallet } from '../store/WalletContext';
import { haptics } from '../utils/haptics';
import Toast from '../components/Toast';

// ── Real Network & Token Meta for Bridge ──
export interface BridgeChain {
  id: number;
  name: string;
  shortName: string;
  symbol: string;
  badge: string;
  iconUrl: string;
  color: string;
  tokenSymbol: string;
}

const BRIDGE_CHAINS: BridgeChain[] = [
  {
    id: 11155111,
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    symbol: 'Sepolia ETH',
    badge: 'ERC-20',
    iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
    color: '#627EEA',
    tokenSymbol: 'INRX',
  },
  {
    id: 80002,
    name: 'Polygon Amoy',
    shortName: 'Polygon',
    symbol: 'Polygon MATIC',
    badge: 'ERC-20',
    iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/matic.png',
    color: '#8247E5',
    tokenSymbol: 'INRX',
  },
  {
    id: 2494104990,
    name: 'TRON Nile Testnet',
    shortName: 'TRON Nile',
    symbol: 'TRON TRX',
    badge: 'TRC-20',
    iconUrl: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/trx.png',
    color: '#FF0013',
    tokenSymbol: 'INRX',
  },
];

const INRX_ICON_URL = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png';

// ── Coin / Network Icon Component with Fallback ──
function NetworkCoinIcon({ url, symbol, color, size = 28 }: { url: string; symbol: string; color: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '20',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color }}>
        {symbol.slice(0, 2)}
      </Text>
    </View>
  );
}

export default function BridgeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, balances, bridgeINRX, walletAddress, tronAddress, refreshBalance } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = useMemo(() => makeStyles(T), [T]);

  const [sourceChain, setSourceChain] = useState<BridgeChain>(BRIDGE_CHAINS[0]);
  const [destChain, setDestChain] = useState<BridgeChain>(BRIDGE_CHAINS[1]);
  const [amount, setAmount] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [loading, setLoading] = useState(false);

  // Network Selection Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<'source' | 'dest'>('source');

  // Auto-set default dest address based on target chain
  React.useEffect(() => {
    if (destChain.id === 2494104990) {
      setDestAddress(tronAddress || '');
    } else {
      setDestAddress(walletAddress || '');
    }
  }, [destChain, walletAddress, tronAddress]);

  const getChainBalance = useCallback((chain: BridgeChain) => {
    if (!balances) return '0.00';
    if (chain.id === 11155111) return balances.Sepolia?.inrxBalance || '0.00';
    if (chain.id === 80002) return balances.Amoy?.inrxBalance || '0.00';
    if (chain.id === 2494104990) return balances.Nile?.inrxBalance || '0.00';
    return '0.00';
  }, [balances]);

  const sourceBalance = useMemo(() => getChainBalance(sourceChain), [getChainBalance, sourceChain]);
  const destBalance = useMemo(() => getChainBalance(destChain), [getChainBalance, destChain]);

  const handleFlipChains = () => {
    haptics.selection();
    const temp = sourceChain;
    setSourceChain(destChain);
    setDestChain(temp);
  };

  const handleOpenModal = (target: 'source' | 'dest') => {
    haptics.selection();
    setModalTarget(target);
    setModalVisible(true);
  };

  const handleSelectChain = (chain: BridgeChain) => {
    haptics.selection();
    if (modalTarget === 'source') {
      if (chain.id === destChain.id) {
        setDestChain(sourceChain);
      }
      setSourceChain(chain);
    } else {
      if (chain.id === sourceChain.id) {
        setSourceChain(destChain);
      }
      setDestChain(chain);
    }
    setModalVisible(false);
  };

  const handleUseMax = () => {
    haptics.selection();
    setAmount(sourceBalance);
  };

  const handlePasteAddress = async () => {
    haptics.selection();
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setDestAddress(text.trim());
        Toast.show({ type: 'success', text1: 'Pasted Address', text2: 'Copied from clipboard.' });
      }
    } catch (e) {
      // ignore
    }
  };

  const handleUseMyWallet = () => {
    haptics.selection();
    const targetAddr = destChain.id === 2494104990 ? tronAddress : walletAddress;
    if (targetAddr) {
      setDestAddress(targetAddr);
    }
  };

  const handleBridge = async () => {
    haptics.impact('medium');
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid INRX amount.' });
      return;
    }
    if (amtNum > parseFloat(sourceBalance)) {
      Toast.show({ type: 'error', text1: 'Insufficient Balance', text2: `You have ${sourceBalance} INRX on ${sourceChain.shortName}.` });
      return;
    }
    if (!destAddress) {
      Toast.show({ type: 'error', text1: 'Destination Address Required', text2: 'Please enter the receiving address.' });
      return;
    }

    setLoading(true);
    try {
      const netKey = sourceChain.id === 11155111 ? 'Sepolia' : sourceChain.id === 80002 ? 'Amoy' : 'Nile';
      const res = await bridgeINRX(netKey, destChain.id, amount, destAddress);
      if (res.success) {
        haptics.notification('success');
        Alert.alert(
          'Bridge Initiated 🎉',
          `Successfully initiated transfer of ${amount} INRX from ${sourceChain.shortName} to ${destChain.shortName}.\n\nTx Hash: ${res.txHash.slice(0, 16)}...`,
          [{ text: 'Done', onPress: () => { refreshBalance(); navigation.goBack(); } }]
        );
      } else {
        haptics.notification('error');
        Toast.show({ type: 'error', text1: 'Bridge Failed', text2: res.error || 'Transaction reverted.' });
      }
    } catch (err: any) {
      haptics.notification('error');
      Toast.show({ type: 'error', text1: 'Bridge Error', text2: err.message || 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: T.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header (Clean & Professional like Swap/Send) */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Bridge INRX</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Source Chain Card */}
        <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: T.textDim }]}>FROM NETWORK</Text>
            <View style={styles.balanceContainer}>
              <Text style={[styles.balanceText, { color: T.textDim }]}>
                Bal: <Text style={{ color: T.text, fontFamily: Fonts.bold }}>{sourceBalance}</Text> INRX
              </Text>
              <TouchableOpacity onPress={handleUseMax}>
                <Text style={styles.maxBadge}>MAX</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount & Network Pill Row */}
          <View style={styles.cardMainRow}>
            <TextInput
              style={[styles.amountInput, { color: T.text }]}
              placeholder="0.00"
              placeholderTextColor={T.textDim + '60'}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <TouchableOpacity
              style={[styles.networkPill, { backgroundColor: T.background, borderColor: T.border }]}
              onPress={() => handleOpenModal('source')}
              activeOpacity={0.7}
            >
              <NetworkCoinIcon url={sourceChain.iconUrl} symbol={sourceChain.symbol} color={sourceChain.color} size={26} />
              <View style={{ marginLeft: 6 }}>
                <Text style={[styles.networkPillTitle, { color: T.text }]}>{sourceChain.shortName}</Text>
                <Text style={[styles.networkPillBadge, { color: sourceChain.color }]}>{sourceChain.badge}</Text>
              </View>
              <Feather name="chevron-down" size={16} color={T.textDim} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardFooterRow}>
            <View style={styles.tokenTag}>
              <NetworkCoinIcon url={INRX_ICON_URL} symbol="INRX" color="#008080" size={16} />
              <Text style={styles.tokenTagText}>INRX (e-Rupee Stablecoin)</Text>
            </View>
          </View>
        </View>

        {/* Floating Direction Swap Button */}
        <View style={styles.floatingButtonContainer}>
          <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
          <TouchableOpacity
            style={[styles.floatingSwapBtn, { backgroundColor: T.surface, borderColor: T.primary }]}
            onPress={handleFlipChains}
            activeOpacity={0.8}
          >
            <Feather name="repeat" size={20} color={T.primary} />
          </TouchableOpacity>
          <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
        </View>

        {/* Destination Chain Card */}
        <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: T.textDim }]}>TO NETWORK</Text>
            <Text style={[styles.balanceText, { color: T.textDim }]}>
              Bal: <Text style={{ color: T.text, fontFamily: Fonts.bold }}>{destBalance}</Text> INRX
            </Text>
          </View>

          <View style={[styles.cardMainRow, { paddingVertical: 6 }]}>
            <Text style={[styles.amountInput, { color: amount ? T.text : T.textDim + '60' }]}>
              {amount || '0.00'}
            </Text>

            <TouchableOpacity
              style={[styles.networkPill, { backgroundColor: T.background, borderColor: T.border }]}
              onPress={() => handleOpenModal('dest')}
              activeOpacity={0.7}
            >
              <NetworkCoinIcon url={destChain.iconUrl} symbol={destChain.symbol} color={destChain.color} size={26} />
              <View style={{ marginLeft: 6 }}>
                <Text style={[styles.networkPillTitle, { color: T.text }]}>{destChain.shortName}</Text>
                <Text style={[styles.networkPillBadge, { color: destChain.color }]}>{destChain.badge}</Text>
              </View>
              <Feather name="chevron-down" size={16} color={T.textDim} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Destination Address Card */}
        <View style={[styles.addressCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: T.textDim }]}>RECEIVING WALLET ADDRESS</Text>
            <TouchableOpacity onPress={handleUseMyWallet} style={styles.myWalletBadge}>
              <Text style={[styles.myWalletText, { color: T.primary }]}>Use My Address</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.addressInputContainer, { backgroundColor: T.background, borderColor: T.border }]}>
            <TextInput
              style={[styles.addressTextInput, { color: T.text }]}
              placeholder={`Enter ${destChain.shortName} (${destChain.badge}) destination address...`}
              placeholderTextColor={T.textDim + '70'}
              value={destAddress}
              onChangeText={setDestAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.pasteButton} onPress={handlePasteAddress}>
              <Feather name="clipboard" size={16} color={T.primary} />
              <Text style={[styles.pasteText, { color: T.primary }]}>Paste</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction Details Box (Like SwapScreen) */}
        <View style={[styles.detailsBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textDim }]}>Estimated Arrival</Text>
            <Text style={[styles.detailValue, { color: T.text }]}>~1 - 3 mins</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textDim }]}>Bridge Gas Fee</Text>
            <Text style={[styles.detailValue, { color: '#008080' }]}>0.00 INRX (Free)</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: T.textDim }]}>Cross-Chain Mechanism</Text>
            <Text style={[styles.detailValue, { color: T.text }]}>Lock / Burn → Mint</Text>
          </View>
        </View>

        {/* Main Action Button */}
        <TouchableOpacity
          style={[styles.mainAction, { backgroundColor: T.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleBridge}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.actionText}>Review & Bridge INRX</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Network Selection Modal (Exact match to SwapScreen selector) */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>
                Select {modalTarget === 'source' ? 'Source' : 'Destination'} Network
              </Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                <Feather name="x" size={20} color={T.text} />
              </TouchableOpacity>
            </View>

            {BRIDGE_CHAINS.map((chain) => {
              const active = modalTarget === 'source' ? sourceChain.id === chain.id : destChain.id === chain.id;
              const bal = getChainBalance(chain);
              return (
                <TouchableOpacity
                  key={chain.id}
                  style={[
                    styles.chainItem,
                    {
                      backgroundColor: active ? T.primary + '15' : T.background,
                      borderColor: active ? T.primary : T.border,
                    },
                  ]}
                  onPress={() => handleSelectChain(chain)}
                  activeOpacity={0.7}
                >
                  <NetworkCoinIcon url={chain.iconUrl} symbol={chain.symbol} color={chain.color} size={36} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.chainItemName, { color: T.text }]}>{chain.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={[styles.badgeTag, { backgroundColor: chain.color + '20' }]}>
                        <Text style={[styles.badgeTagText, { color: chain.color }]}>{chain.badge}</Text>
                      </View>
                      <Text style={{ color: T.textDim, fontSize: 12 }}>INRX</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.chainItemBalance, { color: T.text }]}>{bal}</Text>
                    <Text style={{ color: T.textDim, fontSize: 11 }}>Available</Text>
                  </View>

                  {active && (
                    <View style={[styles.activeCheck, { backgroundColor: T.primary }]}>
                      <Feather name="check" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 80,
    },
    card: {
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardLabel: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      letterSpacing: 0.8,
    },
    balanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    balanceText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    maxBadge: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: T.primary,
      backgroundColor: T.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    cardMainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    amountInput: {
      fontSize: 32,
      fontFamily: Fonts.extraBold,
      padding: 0,
      height: 46,
      flex: 1,
      marginRight: 12,
    },
    networkPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      paddingLeft: 8,
      paddingRight: 12,
      paddingVertical: 8,
      borderWidth: 1,
    },
    networkPillTitle: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    networkPillBadge: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      marginTop: 1,
    },
    cardFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
    },
    tokenTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#00808015',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    tokenTagText: {
      color: '#008080',
      fontSize: 12,
      fontFamily: Fonts.bold,
    },
    floatingButtonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: -14,
      zIndex: 10,
      paddingHorizontal: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    floatingSwapBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    addressCard: {
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      marginTop: 16,
    },
    myWalletBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: T.primary + '15',
    },
    myWalletText: {
      fontSize: 11,
      fontFamily: Fonts.bold,
    },
    addressInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 12,
      height: 48,
    },
    addressTextInput: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.medium,
      height: '100%',
    },
    pasteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: T.primary + '15',
    },
    pasteText: {
      fontSize: 12,
      fontFamily: Fonts.bold,
    },
    detailsBox: {
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 20,
      marginBottom: 24,
      padding: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    detailDivider: {
      height: 1,
      backgroundColor: T.border + '50',
      marginVertical: 10,
    },
    detailLabel: {
      fontSize: 13,
      fontFamily: Fonts.medium,
    },
    detailValue: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    mainAction: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: T.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    actionText: {
      color: '#FFF',
      fontSize: 16,
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chainItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 10,
    },
    chainItemName: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
    badgeTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeTagText: {
      fontSize: 10,
      fontFamily: Fonts.bold,
    },
    chainItemBalance: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    activeCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
  });
