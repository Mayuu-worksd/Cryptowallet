import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Animated, Dimensions,
  SafeAreaView, Share, Modal, ScrollView, Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../constants';
import { useWallet } from '../store/WalletContext';
import { ethers } from 'ethers';
import { storageService } from '../services/storageService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DAPPS = [
  { name: 'Uniswap',   url: 'https://app.uniswap.org',    icon: '🦄' },
  { name: 'Aave',      url: 'https://app.aave.com',        icon: '👻' },
  { name: 'OpenSea',   url: 'https://opensea.io',          icon: '🌊' },
  { name: 'Etherscan', url: 'https://etherscan.io',        icon: '🔍' },
  { name: 'CoinGecko', url: 'https://coingecko.com',       icon: '🦎' },
  { name: 'dYdX',      url: 'https://dydx.exchange',       icon: '📈' },
  { name: 'Zerion',    url: 'https://app.zerion.io',       icon: '💎' },
  { name: 'Compound',  url: 'https://compound.finance',    icon: '🏦' },
  { name: 'Lido',      url: 'https://lido.fi',             icon: '🌊' },
  { name: 'Blur',      url: 'https://blur.io',             icon: '💨' },
];

const DEFAULT_BOOKMARKS = [
  { name: 'Etherscan', url: 'https://etherscan.io', icon: '🔍' },
  { name: 'CoinGecko', url: 'https://coingecko.com', icon: '🦎' },
  { name: 'Uniswap', url: 'https://app.uniswap.org', icon: '🦄' },
];

const getInjectedJS = (walletAddress: string, chainId: number) => `
  (function() {
    window.ethereum = {
      isMetaMask: true,
      isCryptoWallet: true,
      chainId: '0x${chainId.toString(16)}',
      networkVersion: '${chainId}',
      selectedAddress: '${walletAddress}',
      isConnected: () => true,
      
      request: ({ method, params }) => {
        return new Promise((resolve, reject) => {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ 
              type: 'ETH_REQUEST', 
              method, 
              params: params || [] 
            })
          );
          window.__resolveEth = resolve;
          window.__rejectEth = reject;
        });
      },
      
      on: (event, callback) => {
        window.__ethCallbacks = window.__ethCallbacks || {};
        window.__ethCallbacks[event] = callback;
      },
    };
    
    window.web3 = { currentProvider: window.ethereum };
    true;
  })();
`;

export default function BrowserScreen({ route, navigation }: any) {
  const initialUrl = route.params?.url;
  const { isDarkMode, walletAddress, network } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const chainId = network === 'Sepolia' ? 11155111 : 1;
  const rpcUrl = network === 'Sepolia' 
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}`
    : `https://eth-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}`;

  const [url, setUrl] = useState(initialUrl || '');
  const [inputUrl, setInputUrl] = useState(initialUrl || '');
  const [title, setTitle] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSecure, setIsSecure] = useState(true);
  const [showHome, setShowHome] = useState(!initialUrl);
  const [bookmarks, setBookmarks] = useState(DEFAULT_BOOKMARKS);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  // Web3 Modals State
  const [connectModal, setConnectModal] = useState<{ visible: boolean; dappName: string; onApprove: () => void; onReject: () => void } | null>(null);
  const [txModal, setTxModal] = useState<{ visible: boolean; to: string; value: string; data: string; dappName: string; onApprove: () => void; onReject: () => void } | null>(null);
  const [signModal, setSignModal] = useState<{ visible: boolean; message: string; onSign: () => void; onReject: () => void } | null>(null);

  const webViewRef = useRef<WebView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const saved = await AsyncStorage.getItem('browser_bookmarks');
      if (saved) setBookmarks(JSON.parse(saved));
    } catch (e) {}
  };

  const saveBookmarks = async (newBookmarks: any[]) => {
    try {
      await AsyncStorage.setItem('browser_bookmarks', JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks);
    } catch (e) {}
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const handleNavigate = (newUrl: string) => {
    let finalUrl = newUrl.trim();
    if (!finalUrl.includes('.') && !finalUrl.includes('://')) {
      finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(finalUrl)}`;
    } else if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    setShowHome(false);
    setIsEditingUrl(false);
  };

  const toggleBookmark = () => {
    const exists = bookmarks.find(b => b.url === url);
    if (exists) {
      const filtered = bookmarks.filter(b => b.url !== url);
      saveBookmarks(filtered);
    } else {
      const newBookmark = { name: title || 'New Bookmark', url, icon: '⭐' };
      saveBookmarks([...bookmarks, newBookmark]);
    }
  };

  const handleDAppMessage = async (event: any) => {
    try {
      const { type, method, params } = JSON.parse(event.nativeEvent.data);
      if (type !== 'ETH_REQUEST') return;

      console.log('DApp Request:', method, params);

      switch (method) {
        case 'eth_requestAccounts':
          setConnectModal({
            visible: true,
            dappName: title || 'This DApp',
            onApprove: () => {
              setConnectModal(null);
              webViewRef.current?.injectJavaScript(`window.__resolveEth(['${walletAddress}']);`);
            },
            onReject: () => {
              setConnectModal(null);
              webViewRef.current?.injectJavaScript(`window.__rejectEth(new Error('User rejected'));`);
            }
          });
          break;

        case 'eth_accounts':
          webViewRef.current?.injectJavaScript(`window.__resolveEth(['${walletAddress}']);`);
          break;

        case 'eth_chainId':
          webViewRef.current?.injectJavaScript(`window.__resolveEth('0x${chainId.toString(16)}');`);
          break;

        case 'personal_sign':
          setSignModal({
            visible: true,
            message: params[0],
            onSign: async () => {
              setSignModal(null);
              const pk = await storageService.getPrivateKey();
              if (pk) {
                const wallet = new ethers.Wallet(pk);
                const sig = await wallet.signMessage(ethers.utils.arrayify(params[0]));
                webViewRef.current?.injectJavaScript(`window.__resolveEth('${sig}');`);
              }
            },
            onReject: () => {
              setSignModal(null);
              webViewRef.current?.injectJavaScript(`window.__rejectEth(new Error('User rejected'));`);
            }
          });
          break;

        case 'eth_sendTransaction':
          const tx = params[0];
          setTxModal({
            visible: true,
            to: tx.to,
            value: tx.value ? ethers.utils.formatEther(tx.value) : '0',
            data: tx.data || '0x',
            dappName: title || 'This DApp',
            onApprove: async () => {
              setTxModal(null);
              const pk = await storageService.getPrivateKey();
              if (pk) {
                const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
                const wallet = new ethers.Wallet(pk, provider);
                const receipt = await wallet.sendTransaction(tx);
                webViewRef.current?.injectJavaScript(`window.__resolveEth('${receipt.hash}');`);
              }
            },
            onReject: () => {
              setTxModal(null);
              webViewRef.current?.injectJavaScript(`window.__rejectEth(new Error('User rejected'));`);
            }
          });
          break;

        default:
          webViewRef.current?.injectJavaScript(`window.__resolveEth(null);`);
      }
    } catch (e) {}
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: T.surface, borderBottomColor: T.border }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => webViewRef.current?.goBack()} disabled={!canGoBack} style={styles.navBtn}>
          <Feather name="chevron-left" size={24} color={canGoBack ? T.text : T.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => webViewRef.current?.goForward()} disabled={!canGoForward} style={styles.navBtn}>
          <Feather name="chevron-right" size={24} color={canGoForward ? T.text : T.textMuted} />
        </TouchableOpacity>

        <View style={[styles.addressBar, { backgroundColor: isDarkMode ? '#1A1B1F' : '#F0F2F5', borderColor: T.border }]}>
          <Feather name={isSecure ? "lock" : "alert-triangle"} size={12} color={isSecure ? T.success : T.error} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.addressInput, { color: T.text }]}
            value={isEditingUrl ? inputUrl : url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            onChangeText={setInputUrl}
            onFocus={() => setIsEditingUrl(true)}
            onBlur={() => setIsEditingUrl(false)}
            onSubmitEditing={() => handleNavigate(inputUrl)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectTextOnFocus
          />
        </View>

        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.navBtn}>
          <Feather name="refresh-cw" size={18} color={T.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.navBtn}>
          <Feather name="more-vertical" size={20} color={T.text} />
        </TouchableOpacity>
      </View>
      {isLoading && (
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: T.primary }]} />
        </View>
      )}
    </View>
  );

  const renderHome = () => (
    <ScrollView style={[styles.homeContainer, { backgroundColor: T.background }]} contentContainerStyle={{ padding: 20 }}>
      <View style={[styles.homeSearch, { backgroundColor: T.surface, borderColor: T.border }]}>
        <Feather name="search" size={20} color={T.textMuted} />
        <TextInput
          placeholder="Search or enter URL"
          placeholderTextColor={T.textMuted}
          style={[styles.homeSearchInput, { color: T.text }]}
          onSubmitEditing={(e) => handleNavigate(e.nativeEvent.text)}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: T.text }]}>POPULAR DAPPS</Text>
      <View style={styles.dappGrid}>
        {DAPPS.map(dapp => (
          <TouchableOpacity key={dapp.name} style={[styles.dappCard, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => handleNavigate(dapp.url)}>
            <Text style={styles.dappIcon}>{dapp.icon}</Text>
            <Text style={[styles.dappName, { color: T.text }]}>{dapp.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: T.text, marginTop: 30 }]}>BOOKMARKS</Text>
      <View style={styles.dappGrid}>
        {bookmarks.map(b => (
          <TouchableOpacity
            key={b.url}
            style={[styles.dappCard, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => handleNavigate(b.url)}
            onLongPress={() => {
              const filtered = bookmarks.filter(item => item.url !== b.url);
              saveBookmarks(filtered);
            }}
          >
            <Text style={styles.dappIcon}>{b.icon}</Text>
            <Text style={[styles.dappName, { color: T.text }]} numberOfLines={1}>{b.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.background }}>
      {renderHeader()}
      <View style={{ flex: 1 }}>
        {showHome ? renderHome() : (
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            injectedJavaScriptBeforeContentLoaded={getInjectedJS(walletAddress, chainId)}
            onMessage={handleDAppMessage}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
            onNavigationStateChange={(navState) => {
              setUrl(navState.url);
              setTitle(navState.title);
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
              setIsSecure(navState.url.startsWith('https'));
            }}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: T.surface, borderTopColor: T.border }]}>
        <TouchableOpacity onPress={() => webViewRef.current?.goBack()} disabled={!canGoBack}>
          <Feather name="arrow-left" size={24} color={canGoBack ? T.text : T.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => webViewRef.current?.goForward()} disabled={!canGoForward}>
          <Feather name="arrow-right" size={24} color={canGoForward ? T.text : T.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowHome(true)}>
          <Feather name="home" size={24} color={showHome ? T.primary : T.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleBookmark}>
          <Feather name="star" size={24} color={bookmarks.find(b => b.url === url) ? T.primary : T.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Feather name="more-horizontal" size={24} color={T.text} />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal visible={showMenu} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContainer, { backgroundColor: T.surface }]}>
            <View style={styles.menuHandle} />
            <Text style={[styles.menuTitle, { color: T.text }]} numberOfLines={1}>{url}</Text>
            <View style={[styles.menuDivider, { backgroundColor: T.border }]} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); toggleBookmark(); }}>
              <Feather name="star" size={20} color={T.text} />
              <Text style={[styles.menuItemText, { color: T.text }]}>Add Bookmark</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); Share.share({ url }); }}>
              <Feather name="share" size={20} color={T.text} />
              <Text style={[styles.menuItemText, { color: T.text }]}>Share this page</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); Linking.openURL(url); }}>
              <Feather name="external-link" size={20} color={T.text} />
              <Text style={[styles.menuItemText, { color: T.text }]}>Open in External Browser</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); webViewRef.current?.reload(); }}>
              <Feather name="refresh-cw" size={20} color={T.text} />
              <Text style={[styles.menuItemText, { color: T.text }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Web3 Interaction Modals */}
      {connectModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalCentered}>
            <View style={[styles.web3Modal, { backgroundColor: T.surface }]}>
              <Text style={styles.dappIconBig}>🦄</Text>
              <Text style={[styles.web3Title, { color: T.text }]}>{connectModal.dappName}</Text>
              <Text style={[styles.web3Subtitle, { color: T.textMuted }]}>wants to connect to your wallet</Text>
              <View style={[styles.addressBadge, { backgroundColor: T.background }]}>
                <Text style={[styles.addressBadgeText, { color: T.text }]}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.border }]} onPress={connectModal.onReject}>
                  <Text style={[styles.modalBtnText, { color: T.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} onPress={connectModal.onApprove}>
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Connect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {txModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalCentered}>
            <View style={[styles.web3Modal, { backgroundColor: T.surface }]}>
              <Text style={[styles.web3Title, { color: T.text }]}>Transaction Request</Text>
              <Text style={[styles.web3Subtitle, { color: T.textMuted }]}>From: {txModal.dappName}</Text>
              <View style={[styles.txInfo, { backgroundColor: T.background, borderColor: T.border }]}>
                <Text style={[styles.txLabel, { color: T.textMuted }]}>To:</Text>
                <Text style={[styles.txValue, { color: T.text }]}>{txModal.to}</Text>
                <Text style={[styles.txLabel, { color: T.textMuted, marginTop: 8 }]}>Value:</Text>
                <Text style={[styles.txValue, { color: T.text, fontSize: 18, fontWeight: '800' }]}>{txModal.value} ETH</Text>
              </View>
              <Text style={[styles.warningText, { color: T.error }]}>⚠️ Only approve transactions from sites you trust.</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.border }]} onPress={txModal.onReject}>
                  <Text style={[styles.modalBtnText, { color: T.text }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} onPress={txModal.onApprove}>
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {signModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalCentered}>
            <View style={[styles.web3Modal, { backgroundColor: T.surface }]}>
              <Text style={[styles.web3Title, { color: T.text }]}>Sign Message</Text>
              <ScrollView style={[styles.msgScroll, { backgroundColor: T.background }]}>
                <Text style={[styles.msgText, { color: T.text }]}>{signModal.message}</Text>
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.border }]} onPress={signModal.onReject}>
                  <Text style={[styles.modalBtnText, { color: T.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: T.primary }]} onPress={signModal.onSign}>
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Sign</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addressBar: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  addressInput: { flex: 1, fontSize: 13, fontWeight: '500' },
  progressContainer: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2 },
  progressBar: { height: '100%' },

  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 60, borderTopWidth: 1 },

  homeContainer: { flex: 1 },
  homeSearch: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, marginBottom: 24 },
  homeSearchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '500' },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  dappGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dappCard: { width: (SCREEN_W - 52) / 2, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  dappIcon: { fontSize: 24 },
  dappName: { fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  menuTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 20, opacity: 0.7 },
  menuDivider: { height: 1, marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 16, fontWeight: '600' },

  modalCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  web3Modal: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
  dappIconBig: { fontSize: 48, marginBottom: 16 },
  web3Title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  web3Subtitle: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
  addressBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginBottom: 24 },
  addressBadgeText: { fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },

  txInfo: { width: '100%', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  txLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  txValue: { fontSize: 14, fontWeight: '500' },
  warningText: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 24 },

  msgScroll: { width: '100%', maxHeight: 200, padding: 16, borderRadius: 16, marginBottom: 24 },
  msgText: { fontSize: 14, lineHeight: 20 },
});
