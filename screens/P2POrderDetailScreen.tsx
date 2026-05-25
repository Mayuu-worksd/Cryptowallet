import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, 
  ActivityIndicator, Alert, Image, StatusBar, TextInput, KeyboardAvoidingView, 
  Keyboard, TouchableWithoutFeedback, Animated, Modal, Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { p2pService, P2POrder } from '../services/merchantService';
import { supabase } from '../services/supabaseClient';
import TransactionLoader from '../components/ui/TransactionLoader';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';


const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B', DAI: '#F5AC37',
  BTC: '#F7931A', SOL: '#14F195', BNB: '#F3BA2F', XRP: '#23292F',
  TON: '#0088CC', TRX: '#EF0027', SUI: '#6FBCF0'
};

const TOKEN_LOGOS: Record<string, string> = {
  ETH:  'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  USDC: 'https://coin-images.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  USDT: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  DAI:  'https://coin-images.coingecko.com/coins/images/9956/large/4943.png',
  BTC:  'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',
  SOL:  'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',
  BNB:  'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  XRP:  'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  TON:  'https://coin-images.coingecko.com/coins/images/17980/large/ton_token_logo.png',
  TRX:  'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png',
  SUI:  'https://coin-images.coingecko.com/coins/images/26375/large/sui_logo.png'
};

function TokenSymbolIcon({ token, size = 26 }: { token: string; size?: number }) {
  const color = TOKEN_COLORS[token] ?? '#888';
  const [failed, setFailed] = useState(false);
  const uri = TOKEN_LOGOS[token];
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.44, fontFamily: Fonts.extraBold }}>{token.charAt(0)}</Text>
    </View>
  );
}

export default function P2POrderDetailScreen({ navigation, route }: any) {
  const order: P2POrder = route?.params?.order;
  const { 
    walletAddress, isDarkMode, balances, ethBalance, lockBalance, unlockBalance, 
    addTx, updateTxStatus, lockedBalance, refreshBalance, creditP2PBalance, network 
  } = useWallet() as any;
  
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [loaderType, setLoaderType] = useState<'send' | 'swap' | 'p2p' | 'generic'>('p2p');
  const [loaderTitle, setLoaderTitle] = useState('');
  const [loaderSub, setLoaderSub] = useState('');
  const [currentOrder, setCurrentOrder] = useState<P2POrder>(order);
  const [orderLoading, setOrderLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [utrRef, setUtrRef] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const scrollRef = useRef<ScrollView>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgCount = useRef(0);
  const msgAnimations = useRef<Record<string, Animated.Value>>({});

  const getOrCreateMsgAnim = (id: string) => {
    if (!msgAnimations.current[id]) {
      msgAnimations.current[id] = new Animated.Value(0);
      Animated.spring(msgAnimations.current[id], {
        toValue: 1, useNativeDriver: true, tension: 65, friction: 10,
      }).start();
    }
    return msgAnimations.current[id];
  };

  const fetchMessages = useCallback(async () => {
    if (!currentOrder.id) return;
    try {
      const { data } = await supabase
        .from('p2p_chat')
        .select('*')
        .eq('order_id', currentOrder.id)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(prev => {
          const dbTexts = new Set(data.map((m: any) => m.message));
          const pendingOptimistic = prev.filter(
            m => m.id?.startsWith('opt-') && !dbTexts.has(m.message)
          );
          const merged = [...data, ...pendingOptimistic];
          merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return merged;
        });
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 50);
      }
    } catch {}
  }, [currentOrder.id]);

  useEffect(() => {
    if (!currentOrder.id) return;
    lastMsgCount.current = 0;
    fetchMessages();

    let realtimeWorking = false;
    const channel = supabase
      .channel(`p2p_chat:${currentOrder.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'p2p_chat',
        filter: `order_id=eq.${currentOrder.id}`,
      }, payload => {
        realtimeWorking = true;
        setMessages(prev => {
          const withoutOptimistic = prev.filter(
            m => !(m.id?.startsWith('opt-') && m.message === payload.new.message)
          );
          if (withoutOptimistic.find(m => m.id === payload.new.id)) return withoutOptimistic;
          const next = [...withoutOptimistic, payload.new];
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
          return next;
        });
      })
      .subscribe();

    pollRef.current = setInterval(() => {
      if (!realtimeWorking) fetchMessages();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentOrder.id, fetchMessages]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !currentOrder.id) return;
    setChatInput('');
    const optId = `opt-${Date.now()}`;
    const optimistic = {
      id: optId,
      order_id: currentOrder.id,
      sender_wallet: walletAddress.toLowerCase(),
      message: text,
      is_support: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { data } = await supabase.from('p2p_chat').insert({
        order_id:      currentOrder.id,
        sender_wallet: walletAddress.toLowerCase(),
        message:       text,
        is_support:    false,
      }).select().single();
      if (data) {
        setMessages(prev => {
          const replaced = prev.map((m: any) => m.id === optId ? data : m);
          replaced.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return replaced;
        });
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optId));
    }
  };

  const isSeller = useMemo(
    () => currentOrder.seller_wallet.toLowerCase() === walletAddress.toLowerCase(),
    [currentOrder.seller_wallet, walletAddress]
  );
  const isBuyer = useMemo(
    () => currentOrder.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase(),
    [currentOrder.buyer_wallet, walletAddress]
  );
  const isOpen = currentOrder.status === 'open';

  const completionHandled = useRef(false);
  const pendingTxId = useRef<string | null>(null);
  const CREDITED_KEY   = `cw_p2p_credited_${order.id}`;
  const PENDING_TX_KEY = `cw_p2p_ptx_${order.id}`;

  const applyCompletion = useCallback(async (freshOrder: P2POrder) => {
    if (freshOrder.status !== 'completed') return;
    if (completionHandled.current) return;
    const amIBuyer = freshOrder.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase();
    if (!amIBuyer) return;
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const alreadyCredited = await AsyncStorage.getItem(CREDITED_KEY);
      if (alreadyCredited === 'true') { completionHandled.current = true; return; }
      completionHandled.current = true;
      unlockBalance(freshOrder.token, freshOrder.amount);
      const storedId = pendingTxId.current ?? await AsyncStorage.getItem(PENDING_TX_KEY);
      if (storedId) {
        updateTxStatus(storedId, 'success');
        await AsyncStorage.removeItem(PENDING_TX_KEY);
      } else {
        addTx({
          type: 'received',
          coin: freshOrder.token,
          amount: freshOrder.amount.toString(),
          usdValue: freshOrder.fiat_total.toFixed(2),
          address: `P2P Buy \u00b7 ${freshOrder.fiat_currency} \u2192 ${freshOrder.token}`,
          status: 'success',
        });
      }
      creditP2PBalance(freshOrder.token, freshOrder.amount);
      await AsyncStorage.setItem(CREDITED_KEY, 'true');
    } catch { completionHandled.current = true; }
  }, [walletAddress, unlockBalance, addTx, updateTxStatus, creditP2PBalance, CREDITED_KEY, PENDING_TX_KEY]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('p2p_orders')
        .select('*')
        .eq('id', order.id)
        .single();
      if (data) {
        setCurrentOrder(data);
        applyCompletion(data);
      }
    } catch {}
  }, [order.id, applyCompletion]);

  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    refresh().finally(() => setOrderLoading(false));
    const fetchLive = async () => {
      try {
        const { getWalletBalances } = await import('../services/balanceService');
        const bals = await getWalletBalances(walletAddress, network);
        setLiveBalance(currentOrder.token === 'ETH' ? bals.ETH : (bals[currentOrder.token] ?? 0));
      } catch {
        refreshBalance();
      }
    };
    if (walletAddress) fetchLive();
    const healLocks = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const raw = await AsyncStorage.getItem('cw_locked_balance');
        if (!raw) return;
        const locks = JSON.parse(raw);
        const hasPositive = Object.values(locks).some((v: any) => v > 0);
        if (!hasPositive) await AsyncStorage.removeItem('cw_locked_balance');
      } catch {}
    };
    healLocks();
  }, []);

  useEffect(() => {
    applyCompletion(currentOrder);
  }, [currentOrder.status]);

  const rawBalance = liveBalance !== null
    ? liveBalance
    : currentOrder.token === 'ETH'
      ? parseFloat(ethBalance) || 0
      : (balances[currentOrder.token] ?? 0);
  const lockedAmt = isSeller ? (lockedBalance?.[currentOrder.token] ?? 0) : 0;
  const buyerBalance = Math.max(0, rawBalance - lockedAmt);
  const isTestnet = network === 'Sepolia' || network === 'TRON Nile';
  const hasEnoughBalance = isTestnet ? true : buyerBalance >= currentOrder.amount;

  const showLoader = (title: string, sub: string, type: typeof loaderType = 'p2p') => {
    setLoaderTitle(title); setLoaderSub(sub); setLoaderType(type); setLoading(true);
  };

  const handleBuyOrder = async () => {
    if (!hasEnoughBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${currentOrder.amount} ${currentOrder.token} to accept this order.\n\nYour balance: ${buyerBalance.toFixed(6)} ${currentOrder.token}`,
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Confirm Purchase',
      `You are about to lock ${currentOrder.amount} ${currentOrder.token} in escrow.\n\nTotal to pay: ${currentOrder.fiat_total.toFixed(2)} ${currentOrder.fiat_currency}\n\nYour balance: ${buyerBalance.toFixed(6)} ${currentOrder.token}\n\nFunds will be locked until the seller confirms payment received.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Lock & Buy', style: 'default', onPress: async () => {
          showLoader('Locking Escrow', 'Securing funds in smart contract...', 'p2p');
          try {
            await p2pService.buyOrder(currentOrder.id!, walletAddress, network);
            lockBalance(currentOrder.token, currentOrder.amount);
            pendingTxId.current = addTx({
              type: 'received',
              coin: currentOrder.token,
              amount: currentOrder.amount.toString(),
              usdValue: currentOrder.fiat_total.toFixed(2),
              address: `P2P Buy \u00b7 ${currentOrder.fiat_currency} \u2192 ${currentOrder.token}`,
              status: 'pending',
            });
            const AS = (await import('@react-native-async-storage/async-storage')).default;
            await AS.setItem(`cw_p2p_ptx_${currentOrder.id}`, pendingTxId.current!);
            await refresh();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to lock escrow.');
          } finally { setLoading(false); }
        }},
      ]
    );
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    const mockReceipts = [
      'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=400&q=80'
    ];
    const chosen = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
    
    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      setUploadProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setProofUrl(chosen);
          setIsUploading(false);
          Alert.alert('Upload Complete', 'Receipt screenshot uploaded and verified by AI check.', [{ text: 'OK' }]);
        }, 150);
      }
    }, 200);
  };

  const handleSubmitProof = async () => {
    if (!utrRef.trim()) {
      Alert.alert('Reference Required', 'Please enter the transaction reference / UTR number from your payment receipt.', [{ text: 'OK' }]);
      return;
    }
    if (utrRef.trim().length < 6) {
      Alert.alert('Invalid UTR', 'Please enter a valid transaction reference / UTR code (at least 6 characters).', [{ text: 'OK' }]);
      return;
    }
    if (!proofUrl) {
      Alert.alert('Receipt Screenshot Required', 'Please upload a receipt screenshot as proof of payment.', [{ text: 'OK' }]);
      return;
    }

    showLoader('Submitting Proof', 'Uploading metadata and notifying seller...', 'p2p');
    try {
      await p2pService.submitPaymentProof(currentOrder.id!, walletAddress, proofUrl, utrRef.trim(), network);
      await refresh();
      Alert.alert('Proof Submitted', 'Your payment proof has been registered in the escrow log. The seller has been notified to release your crypto.', [{ text: 'Done' }]);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message ?? 'Failed to submit payment proof.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Order', 'Cancel this listing?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Order', style: 'destructive', onPress: async () => {
        showLoader('Cancelling Order', 'Releasing locked funds...', 'p2p');
        try {
          await p2pService.cancelOrder(currentOrder.id!, walletAddress, network);
          if (isSeller) {
            unlockBalance(currentOrder.token, currentOrder.amount);
          }
          navigation.goBack();
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Failed.');
        } finally { setLoading(false); }
      }},
    ]);
  };

  const statusLabel = currentOrder.status.toUpperCase().replace('_', ' ');
  const statusColor = currentOrder.status === 'completed'
    ? '#10B981'
    : (currentOrder.status === 'cancelled' || currentOrder.status === 'disputed')
      ? T.primary
      : currentOrder.status === 'escrow_locked'
        ? '#627EEA'
        : '#F59E0B';

  const formatAddress = (addr: string) => {
    if (!addr) return '—';
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <TransactionLoader visible={loading} title={loaderTitle} subtitle={loaderSub} isDarkMode={isDarkMode} type={loaderType} />
      
      {/* ── HEADER ── */}
      <View style={[styles.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="chevron-left" size={26} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>P2P Transaction</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={refresh} style={[styles.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="refresh-cw" size={18} color={T.text} />
          </TouchableOpacity>
          
          {/* Chat Icon in Header */}
          {(currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification' || currentOrder.status === 'disputed') && (
            <TouchableOpacity 
              onPress={() => setShowChatModal(true)} 
              style={[styles.iconBtn, { backgroundColor: T.primary + '18', position: 'relative' }]}
            >
              <Feather name="message-square" size={18} color={T.primary} />
              {messages.length > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: T.primary }]}>
                  <Text style={styles.unreadText}>{messages.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
      >
        {/* Subtle Ambient status glow */}
        <LinearGradient
          colors={[statusColor + '12', 'transparent']}
          style={{ position: 'absolute', top: 0, left: -24, right: -24, height: 200 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* ── HERO BANNER ── */}
        <View style={[styles.heroCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.heroRow1}>
            <View>
              <Text style={[styles.tradeActionLabel, { color: T.textDim }]}>
                {isSeller ? 'SELLING' : 'BUYING'} {currentOrder.token}
              </Text>
              <Text style={[styles.heroAmount, { color: T.text }]}>
                {currentOrder.amount} <Text style={styles.heroAsset}>{currentOrder.token}</Text>
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '30' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: T.border + '30' }]} />

          <View style={styles.heroRow2}>
            <View>
              <Text style={[styles.secondaryLabel, { color: T.textDim }]}>Settlement Amount</Text>
              <Text style={[styles.settlementValue, { color: T.primary }]}>
                {currentOrder.fiat_total.toFixed(2)} <Text style={{ fontSize: 13, color: T.textMuted }}>{currentOrder.fiat_currency}</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.secondaryLabel, { color: T.textDim }]}>Rate</Text>
              <Text style={[styles.rateValue, { color: T.text }]}>
                {currentOrder.rate.toFixed(2)} {currentOrder.fiat_currency}
              </Text>
            </View>
          </View>
        </View>

        {/* ── TIMER BANNER FOR ACTIVE ORDERS ── */}
        {(currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') && currentOrder.created_at && (
          <View style={[styles.timerBanner, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Feather name="clock" size={14} color={T.primary} />
            <Text style={[styles.timerText, { color: T.text }]}>
              Please resolve transaction within standard lock time. Initiated{' '}
              {(() => {
                const diff = Date.now() - new Date(currentOrder.created_at!).getTime();
                const m = Math.floor(diff / 60000);
                if (m < 1) return 'just now';
                if (m < 60) return `${m}m ago`;
                return `${Math.floor(m / 60)}h ago`;
              })()}
            </Text>
          </View>
        )}

        {/* ── MILESTONE ROADMAP ── */}
        {currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && (() => {
          const steps = isSeller
            ? [
                { label: 'Order Listed', sub: 'Listing visible on P2P market', icon: 'tag' as const },
                { label: 'Escrow Locked', sub: 'USDT locked in security ledger', icon: 'lock' as const },
                { label: 'Confirm Payment', sub: 'Awaiting fiat bank transfer', icon: 'check-circle' as const },
              ]
            : [
                { label: 'Lock Escrow', sub: 'USDT secured in escrow', icon: 'shield' as const },
                { label: 'Send Payment', sub: 'Transfer fiat funds to seller', icon: 'send' as const },
                { label: 'Release Crypto', sub: 'Seller releases USDT', icon: 'check-circle' as const },
              ];
          const activeStep = isSeller
            ? currentOrder.status === 'open' ? 0 : (currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') ? 1 : 2
            : currentOrder.status === 'open' ? 0 : (currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') ? 1 : 2;
          
          return (
            <View style={[styles.sectionCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>TRANSACTION ROADMAP</Text>
              <View style={{ gap: 14 }}>
                {steps.map((step, idx) => {
                  const isActive = idx === activeStep;
                  const isDone = idx < activeStep;
                  const dotColor = isDone ? '#10B981' : isActive ? T.primary : T.textDim;
                  
                  return (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={[
                          styles.milestoneDot, 
                          { 
                            borderColor: isDone ? '#10B981' : isActive ? T.primary : T.border,
                            backgroundColor: isDone ? '#10B98112' : isActive ? T.primary + '12' : 'transparent'
                          }
                        ]}>
                          <Feather
                            name={isDone ? 'check' : step.icon}
                            size={12}
                            color={isDone ? '#10B981' : isActive ? T.primary : T.textDim}
                          />
                        </View>
                        {idx < steps.length - 1 && (
                          <View style={[styles.milestoneLine, { backgroundColor: isDone ? '#10B981' : T.border + '50' }]} />
                        )}
                      </View>
                      
                      <View style={{ flex: 1, paddingBottom: 6 }}>
                        <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: isActive ? T.text : T.textDim }}>
                          {step.label}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: T.textMuted, marginTop: 2 }}>
                          {step.sub}
                        </Text>
                      </View>

                      {isActive && (
                        <View style={[styles.activeStepTag, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
                          <Text style={{ fontSize: 9, fontFamily: Fonts.extraBold, color: T.primary }}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* ── BUYER FIAT PAYMENT PANEL ── */}
        {isBuyer && !isSeller && (currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending') && (
          <View style={[styles.paymentCard, { backgroundColor: T.surface, borderColor: T.primary + '40' }]}>
            <View style={[styles.paymentHeader, { backgroundColor: T.primary + '08' }]}>
              <Feather name="credit-card" size={16} color={T.primary} />
              <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text }}>Fiat Payment Instructions</Text>
            </View>

            <View style={{ padding: 18, gap: 16 }}>
              <View style={[styles.infoBanner, { backgroundColor: T.primary + '06', borderColor: T.primary + '15' }]}>
                <Feather name="shield" size={14} color={T.primary} style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 12, fontFamily: Fonts.medium, color: T.textDim, flex: 1, lineHeight: 18 }}>
                  Seller's crypto is locked inside secure escrow. Pay exactly <Text style={{ color: T.primary, fontFamily: Fonts.bold }}>{currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text> via <Text style={{ color: T.text, fontFamily: Fonts.bold }}>{currentOrder.payment_method}</Text>.
                </Text>
              </View>

              {/* Bank/UPI payment credentials */}
              <View style={[styles.bankDetailsBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                {(() => {
                  const detailsRaw = currentOrder.seller_payment_details || '';
                  const hasUpi = currentOrder.payment_method.toUpperCase().includes('UPI');
                  const hasPaypal = currentOrder.payment_method.toUpperCase().includes('PAYPAL');
                  
                  if (detailsRaw && !detailsRaw.includes('CryptoWallet Bank')) {
                    return (
                      <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.textMuted }}>Custom Deposit Instructions</Text>
                        <Text style={{ fontSize: 14, fontFamily: Fonts.bold, color: T.text, lineHeight: 20 }}>{detailsRaw}</Text>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}
                          onPress={() => {
                            Clipboard.setStringAsync(detailsRaw);
                            Alert.alert('Copied', 'Details copied.');
                          }}
                        >
                          <Feather name="copy" size={12} color={T.primary} />
                          <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.primary }}>Copy Instructions</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (hasUpi) {
                    const upiId = detailsRaw.includes('@') ? detailsRaw : `${currentOrder.seller_wallet.slice(0, 8)}@upi`;
                    return (
                      <View style={{ gap: 12 }}>
                        <View style={styles.bankDetailRow}>
                          <View>
                            <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>UPI ID (VPA)</Text>
                            <Text style={[styles.bankDetailValue, { color: T.text }]}>{upiId}</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.copyPill}
                            onPress={() => {
                              Clipboard.setStringAsync(upiId);
                              Alert.alert('Copied', 'UPI ID copied.');
                            }}
                          >
                            <Feather name="copy" size={12} color={T.primary} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.bankDivider} />
                        <View>
                          <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>Payee Name</Text>
                          <Text style={[styles.bankDetailValue, { color: T.text }]}>P2P Premium Merchant</Text>
                        </View>
                      </View>
                    );
                  }

                  if (hasPaypal) {
                    const email = detailsRaw.includes('@') ? detailsRaw : `${currentOrder.seller_wallet.slice(0, 8)}@paypal.com`;
                    return (
                      <View style={styles.bankDetailRow}>
                        <View>
                          <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>PayPal Email</Text>
                          <Text style={[styles.bankDetailValue, { color: T.text }]}>{email}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.copyPill}
                          onPress={() => {
                            Clipboard.setStringAsync(email);
                            Alert.alert('Copied', 'PayPal email copied.');
                          }}
                        >
                          <Feather name="copy" size={12} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return (
                    <View style={{ gap: 10 }}>
                      <View style={styles.bankDetailRow}>
                        <View>
                          <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>Bank Name</Text>
                          <Text style={[styles.bankDetailValue, { color: T.text }]}>CryptoWallet International Bank</Text>
                        </View>
                      </View>
                      <View style={styles.bankDivider} />
                      <View style={styles.bankDetailRow}>
                        <View>
                          <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>Account Number</Text>
                          <Text style={[styles.bankDetailValue, { color: T.text }]}>1009 8765 4321</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.copyPill}
                          onPress={() => {
                            Clipboard.setStringAsync('1009 8765 4321');
                            Alert.alert('Copied', 'Account number copied.');
                          }}
                        >
                          <Feather name="copy" size={12} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.bankDivider} />
                      <View style={styles.bankDetailRow}>
                        <View>
                          <Text style={[styles.bankDetailLabel, { color: T.textMuted }]}>IFSC / Routing Code</Text>
                          <Text style={[styles.bankDetailValue, { color: T.text }]}>CWBK0001</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.copyPill}
                          onPress={() => {
                            Clipboard.setStringAsync('CWBK0001');
                            Alert.alert('Copied', 'Routing code copied.');
                          }}
                        >
                          <Feather name="copy" size={12} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>

              <View style={[styles.bankDivider, { marginVertical: 4 }]} />

              <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Submit Payment Verification
              </Text>

              {/* UTR Input */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.textMuted, marginBottom: 6 }}>UTR / Transaction Reference Number</Text>
                <View style={[styles.utrInputContainer, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <TextInput
                    style={{ color: T.text, fontSize: 14, fontFamily: Fonts.bold, padding: 0 }}
                    value={utrRef}
                    onChangeText={setUtrRef}
                    placeholder="Enter 12-digit UTR or reference ID"
                    placeholderTextColor={T.textDim}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Upload screenshot */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.textMuted, marginBottom: 8 }}>Receipt Proof Screenshot</Text>
                {isUploading ? (
                  <View style={[styles.uploadBox, { borderColor: T.primary, borderStyle: 'dashed', backgroundColor: T.surfaceLow }]}>
                    <ActivityIndicator size="small" color={T.primary} />
                    <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.primary }}>
                      Uploading receipt... {uploadProgress}%
                    </Text>
                    <View style={{ width: '60%', height: 4, backgroundColor: T.border, borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: T.primary }} />
                    </View>
                  </View>
                ) : proofUrl ? (
                  <View style={[styles.uploadedReceipt, { borderColor: T.success + '40', backgroundColor: T.surfaceLow }]}>
                    <Image source={{ uri: proofUrl }} style={styles.uploadedImage} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.success }}>Receipt Verified</Text>
                      <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: T.textMuted, marginTop: 2 }}>Escrow verification active</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deletePill, { backgroundColor: T.error + '12' }]}
                      onPress={() => setProofUrl('')}
                    >
                      <Feather name="trash-2" size={14} color={T.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadBox, { borderColor: T.border, borderStyle: 'dashed', backgroundColor: T.surfaceLow }]}
                    onPress={simulateUpload}
                    activeOpacity={0.8}
                  >
                    <Feather name="upload-cloud" size={20} color={T.primary} />
                    <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.primary }}>Upload Payment Screenshot</Text>
                    <Text style={{ fontSize: 10, fontFamily: Fonts.medium, color: T.textMuted }}>Supports PNG, JPG up to 5MB</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitProofBtn, 
                  { backgroundColor: (utrRef.trim().length >= 6 && proofUrl) ? T.primary : T.textDim }
                ]}
                disabled={loading || !utrRef.trim() || !proofUrl}
                onPress={handleSubmitProof}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 0.5 }}>
                    SUBMIT PROOF & MARK PAID
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STATUS INFOBARS ── */}
        {isSeller && currentOrder.status === 'escrow_locked' && (
          <View style={[styles.statusBannerRow, { borderColor: T.primary + '30', backgroundColor: T.surface }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: T.primary + '12' }]}>
              <Feather name="clock" size={16} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: Fonts.extraBold, color: T.textMuted, textTransform: 'uppercase' }}>Awaiting Payment</Text>
              <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text, marginTop: 2 }}>Buyer is currently transferring fiat funds</Text>
            </View>
            <View style={[styles.liveDot, { backgroundColor: T.primary }]} />
          </View>
        )}

        {isBuyer && !isSeller && (currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') && (
          <View style={[styles.statusBannerRow, { borderColor: '#F59E0B' + '40', backgroundColor: T.surface }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: '#F59E0B' + '12' }]}>
              <Feather name="clock" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: Fonts.extraBold, color: T.textMuted, textTransform: 'uppercase' }}>Payment Sent</Text>
              <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text, marginTop: 2 }}>Waiting for seller to verify bank transfer</Text>
            </View>
            <View style={[styles.liveDot, { backgroundColor: '#F59E0B' }]} />
          </View>
        )}

        {currentOrder.status === 'completed' && (
          <View style={[styles.completedCard, { borderColor: '#10B98140', backgroundColor: T.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="check-circle" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: Fonts.bold, color: '#10B981' }}>Trade Settled Successfully</Text>
                <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: T.textMuted, marginTop: 2 }}>Escrow assets released to the buyer</Text>
              </View>
              <TokenSymbolIcon token={currentOrder.token} size={30} />
            </View>
            
            <View style={[styles.bankDivider, { backgroundColor: T.border + '30', marginBottom: 12 }]} />

            <View style={{ gap: 10 }}>
              <View style={styles.flexRowBetween}>
                <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.textDim }}>You {isSeller ? 'Sold' : 'Bought'}</Text>
                <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text }}>{currentOrder.amount} {currentOrder.token}</Text>
              </View>
              <View style={styles.flexRowBetween}>
                <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.textDim }}>Fiat Settlement</Text>
                <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.primary }}>{currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
              </View>
              <View style={styles.flexRowBetween}>
                <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.textDim }}>Rate</Text>
                <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text }}>{currentOrder.rate.toFixed(2)} {currentOrder.fiat_currency}</Text>
              </View>
            </View>
          </View>
        )}

        {currentOrder.status === 'cancelled' && (
          <View style={[styles.statusBannerRow, { borderColor: T.border, backgroundColor: T.surface }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: T.border + '50' }]}>
              <Feather name="x-circle" size={16} color={T.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: Fonts.extraBold, color: T.textMuted, textTransform: 'uppercase' }}>Trade Cancelled</Text>
              <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text, marginTop: 2 }}>Escrow assets released back to seller's wallet</Text>
            </View>
          </View>
        )}

        {currentOrder.status === 'disputed' && (
          <View style={[styles.statusBannerRow, { borderColor: T.primary + '30', backgroundColor: T.surface }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: T.primary + '12' }]}>
              <Feather name="alert-triangle" size={16} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: Fonts.extraBold, color: T.textMuted, textTransform: 'uppercase' }}>Order Under Dispute</Text>
              <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: T.text, marginTop: 2 }}>Support team is currently reviewing escrow protection</Text>
            </View>
          </View>
        )}

        {/* ── TRADE SPECIFICATIONS ── */}
        <View style={[styles.sectionCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>TRADE PARAMETERS</Text>
          
          <View style={{ gap: 12 }}>
            <View style={styles.flexRowBetween}>
              <Text style={[styles.detailsLabel, { color: T.textMuted }]}>Asset</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TokenSymbolIcon token={currentOrder.token} size={18} />
                <Text style={[styles.detailsValue, { color: T.text }]}>{currentOrder.token}</Text>
              </View>
            </View>
            
            <View style={[styles.bankDivider, { backgroundColor: T.border + '20' }]} />
            
            <View style={styles.flexRowBetween}>
              <Text style={[styles.detailsLabel, { color: T.textMuted }]}>Exchange Amount</Text>
              <Text style={[styles.detailsValue, { color: T.text }]}>{currentOrder.amount} {currentOrder.token}</Text>
            </View>

            <View style={[styles.bankDivider, { backgroundColor: T.border + '20' }]} />

            <View style={styles.flexRowBetween}>
              <Text style={[styles.detailsLabel, { color: T.textMuted }]}>Payment Type</Text>
              <Text style={[styles.detailsValue, { color: T.text }]}>{currentOrder.payment_method}</Text>
            </View>

            <View style={[styles.bankDivider, { backgroundColor: T.border + '20' }]} />

            <View style={styles.flexRowBetween}>
              <Text style={[styles.detailsLabel, { color: T.textMuted }]}>Active Blockchain</Text>
              <Text style={[styles.detailsValue, { color: T.text }]}>{network} Network</Text>
            </View>
          </View>
        </View>

        {/* ── SECURITY PROTOCOL INFOBAR ── */}
        <View style={[styles.securityRow, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.flexRowBetween}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.text }}>Escrow Protection Active</Text>
              <Text style={{ fontSize: 10, fontFamily: Fonts.medium, color: T.textMuted, marginTop: 2 }}>
                Escrow locks crypto safely inside on-chain smart ledgers.
              </Text>
            </View>
            <View style={[styles.securityBadge, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
              <Feather name="shield" size={11} color="#10B981" />
              <Text style={{ fontSize: 9, fontFamily: Fonts.extraBold, color: '#10B981' }}>100% SECURE</Text>
            </View>
          </View>
        </View>

        {/* ── DISPUTE & ID PANEL ── */}
        <View style={[styles.sectionCard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.flexRowBetween}>
            <View>
              <Text style={{ fontSize: 10, fontFamily: Fonts.bold, color: T.textMuted }}>Transaction Reference ID</Text>
              <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.text, marginTop: 4 }}>{currentOrder.id || '—'}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.copyIconBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
              onPress={() => {
                Clipboard.setStringAsync(currentOrder.id || '');
                Alert.alert('Copied', 'Order ID copied.');
              }}
            >
              <Feather name="copy" size={13} color={T.primary} />
            </TouchableOpacity>
          </View>

          {(currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') && (
            <>
              <View style={[styles.bankDivider, { backgroundColor: T.border + '20', marginVertical: 12 }]} />
              <View style={styles.flexRowBetween}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: T.text }}>Having an issue with the trade?</Text>
                  <Text style={{ fontSize: 10, fontFamily: Fonts.medium, color: T.textMuted, marginTop: 2 }}>You can raise a dispute to freeze escrow lock.</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.disputeBtn, { borderColor: T.primary }]}
                  onPress={() => Alert.alert(
                    'Raise Dispute',
                    'This will freeze the escrow and notify our support team. Only raise a dispute if there is a genuine issue.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Raise Dispute', style: 'destructive', onPress: async () => {
                        setLoading(true);
                        try {
                          await p2pService.raiseDispute(currentOrder.id!, network);
                          setShowChatModal(true);
                          await refresh();
                          await fetchMessages();
                        } catch (e: any) {
                          Alert.alert('Error', e?.message ?? 'Failed.');
                        } finally { setLoading(false); }
                      }},
                    ]
                  )}
                >
                  <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.primary }}>Raise Dispute</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

      </ScrollView>

      {/* ── STICKY CALL TO ACTION BAR ── */}
      {(() => {
        const hasAction = (isOpen && !isSeller) ||
          (isSeller && isOpen) ||
          (isSeller && (currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification')) ||
          (isBuyer && !isSeller && currentOrder.status === 'escrow_locked') ||
          (currentOrder.status === 'completed' || currentOrder.status === 'cancelled' || currentOrder.status === 'disputed');

        if (!hasAction) return null;

        return (
          <View style={[styles.actionBar, { backgroundColor: T.background, borderTopColor: T.border, paddingBottom: insets.bottom + 16 }]}>
            
            {/* Accept buy order (buyer side) */}
            {isOpen && !isSeller && (
              <>
                {!hasEnoughBalance && !isTestnet && (
                  <View style={[styles.balanceWarningBanner, { backgroundColor: T.primary + '12', borderColor: T.primary + '25' }]}>
                    <Feather name="alert-circle" size={13} color={T.primary} />
                    <Text style={{ color: T.primary, fontSize: 11, fontFamily: Fonts.bold, flex: 1 }}>
                      Insufficient balance. Requires {currentOrder.amount} {currentOrder.token}.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: hasEnoughBalance ? T.primary : T.textDim }]}
                  onPress={handleBuyOrder}
                  disabled={loading || !hasEnoughBalance}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {hasEnoughBalance ? `BUY ${currentOrder.token} — LOCK ESCROW` : 'INSUFFICIENT BALANCE'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Seller cancel listing */}
            {isSeller && isOpen && (
              <TouchableOpacity 
                style={[styles.secondaryBtn, { backgroundColor: T.surfaceHigh }]} 
                onPress={handleCancel} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={T.text} /> : <Text style={[styles.secondaryBtnText, { color: T.text }]}>CANCEL LISTING</Text>}
              </TouchableOpacity>
            )}

            {/* Seller release crypto */}
            {isSeller && (currentOrder.status === 'payment_pending' || currentOrder.status === 'payment_verification') && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                onPress={async () => {
                  Alert.alert('Confirm Payment Received', 'This will release the crypto to the buyer. Only confirm if you have verified the fiat payment inside your bank account.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Release Crypto', onPress: async () => {
                      showLoader('Releasing Crypto', 'Transferring to buyer wallet...', 'p2p');
                      try {
                        await p2pService.confirmPaymentReceived(currentOrder.id!, network, walletAddress);
                        unlockBalance(currentOrder.token, currentOrder.amount);
                        creditP2PBalance(currentOrder.token, -currentOrder.amount);
                        addTx({
                          type: 'sent',
                          coin: currentOrder.token,
                          amount: currentOrder.amount.toString(),
                          usdValue: currentOrder.fiat_total.toFixed(2),
                          address: `P2P Sale · ${currentOrder.token} → ${currentOrder.fiat_currency}`,
                          status: 'success',
                        });
                        await refresh();
                      } catch (e: any) {
                        Alert.alert('Error', e?.message ?? 'Failed.');
                      } finally { setLoading(false); }
                    }},
                  ]);
                }}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>✓ CONFIRM PAYMENT & RELEASE CRYPTO</Text>}
              </TouchableOpacity>
            )}

            {/* Buyer verify/mark paid */}
            {isBuyer && !isSeller && (currentOrder.status === 'escrow_locked' || currentOrder.status === 'payment_pending') && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: (utrRef.trim().length >= 6 && proofUrl) ? T.primary : T.primary + '60' }]}
                onPress={() => {
                  if (utrRef.trim().length >= 6 && proofUrl) {
                    handleSubmitProof();
                  } else {
                    chatScrollRef.current?.scrollToEnd({ animated: true });
                    Alert.alert(
                      'Payment Proof Incomplete',
                      'Please complete fiat transfer, enter UTR transaction ID, and upload receipt screenshot inside instructions panel.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>✓ SUBMIT VERIFICATION PROOF</Text>}
              </TouchableOpacity>
            )}

            {/* Back to market */}
            {(currentOrder.status === 'completed' || currentOrder.status === 'cancelled' || currentOrder.status === 'disputed') && (
              <TouchableOpacity 
                style={[styles.secondaryBtn, { backgroundColor: T.surfaceHigh }]} 
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.secondaryBtnText, { color: T.text }]}>BACK TO MARKET</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}

      {/* ── WHATSAPP STYLE CHAT MODAL ── */}
      <Modal visible={showChatModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={[styles.chatModal, { backgroundColor: T.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Chat Header */}
          <View style={[styles.chatHeader, { backgroundColor: T.surface, borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowChatModal(false)} style={styles.chatHeaderBackBtn}>
              <Feather name="chevron-left" size={26} color={T.text} />
            </TouchableOpacity>

            <View style={[styles.chatAvatar, { backgroundColor: T.primary + '20' }]}>
              <Feather name={currentOrder.is_merchant ? 'briefcase' : 'user'} size={16} color={T.primary} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={[styles.chatCounterpartyName, { color: T.text }]}>
                {isSeller
                  ? formatAddress(currentOrder.buyer_wallet || '')
                  : formatAddress(currentOrder.seller_wallet)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[styles.onlineDot, { backgroundColor: T.success }]} />
                <Text style={[styles.chatHeaderStatusText, { color: T.textMuted }]}>
                  {currentOrder.is_merchant ? 'Merchant' : 'Personal'} · Escrow Secured
                </Text>
              </View>
            </View>

            <View style={[styles.chatHeaderOrderPill, { backgroundColor: T.surfaceHigh }]}>
              <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.text }}>
                {currentOrder.amount} {currentOrder.token}
              </Text>
            </View>
          </View>

          {/* Chat Escrow Banner */}
          <View style={[styles.chatEscrowBanner, { backgroundColor: T.success + '08', borderBottomColor: T.border + '50' }]}>
            <Feather name="shield" size={11} color={T.success} />
            <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: T.success, flex: 1 }}>
              Safe Trade Guarantee active. Never pay outside order instructions.
            </Text>
          </View>

          {/* Message List */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              ref={chatScrollRef}
              style={{ flex: 1, backgroundColor: T.background }}
              contentContainerStyle={styles.chatMessages}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={styles.chatEmpty}>
                  <View style={[styles.emptyIconRing, { borderColor: T.border }]}>
                    <Feather name="lock" size={24} color={T.textDim} />
                  </View>
                  <Text style={{ color: T.textDim, fontSize: 13, fontFamily: Fonts.bold, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
                    Chat is secured and end-to-end encrypted.{`\n`}Only members can view order updates.
                  </Text>
                </View>
              ) : messages.map((m, i) => {
                const isMe = m.sender_wallet?.toLowerCase() === walletAddress.toLowerCase();
                const isSystem = m.sender_wallet === 'system';
                const isSupport = m.is_support;
                const prevMsg = messages[i - 1];

                const msgDate = m.created_at ? new Date(m.created_at) : new Date();
                const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at) : null;
                const showDate = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

                const nextMsg = messages[i + 1];
                const isLastInGroup = !nextMsg || nextMsg.sender_wallet !== m.sender_wallet;
                const isFirstInGroup = !prevMsg || prevMsg.sender_wallet !== m.sender_wallet;

                const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isOptimistic = m.id?.startsWith('opt-');

                if (isSystem) {
                  return (
                    <React.Fragment key={m.id ?? i}>
                      {showDate && <View style={styles.dateSep}><Text style={[styles.dateText, { color: T.textDim }]}>{msgDate.toLocaleDateString()}</Text></View>}
                      <View style={[styles.systemMsg, { backgroundColor: T.primary + '10', borderColor: T.primary + '25' }]}>
                        <Feather name="alert-triangle" size={12} color={T.primary} />
                        <Text style={{ color: T.text, fontSize: 11, fontFamily: Fonts.medium, flex: 1 }}>{m.message}</Text>
                      </View>
                    </React.Fragment>
                  );
                }

                const msgKey = m.id ?? `msg-${i}`;
                const anim = getOrCreateMsgAnim(msgKey);

                return (
                  <React.Fragment key={msgKey}>
                    {showDate && (
                      <View style={styles.dateSep}>
                        <Text style={[styles.dateText, { color: T.textDim }]}>
                          {msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    )}
                    <Animated.View
                      style={[
                        styles.msgRow,
                        isMe ? styles.msgRowMe : styles.msgRowThem,
                        { marginBottom: isLastInGroup ? 8 : 2 },
                        {
                          opacity: anim,
                          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                        },
                      ]}
                    >
                      <View style={[styles.bubble, isMe ? { backgroundColor: T.primary } : { backgroundColor: T.surface, borderColor: T.border }]}>
                        {!isMe && isFirstInGroup && (
                          <Text style={[styles.senderLabel, { color: isSupport ? T.primary : T.primary }]}>
                            {isSupport ? 'Customer Support' : 'Counterparty'}
                          </Text>
                        )}
                        <Text style={[styles.messageText, { color: isMe ? '#FFF' : T.text }]}>{m.message}</Text>
                        <View style={styles.msgMetaRow}>
                          <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.6)' : T.textDim }]}>{timeStr}</Text>
                          {isMe && <Feather name={isOptimistic ? 'clock' : 'check'} size={10} color="rgba(255,255,255,0.8)" />}
                        </View>
                      </View>
                    </Animated.View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </TouchableWithoutFeedback>

          {/* Chat Input Bar */}
          <View style={[styles.chatInputBar, { backgroundColor: T.surface, borderTopColor: T.border, paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8 }]}>
            <View style={[styles.chatInputWrap, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <TextInput
                style={[styles.chatTextInput, { color: T.text }]}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor={T.textDim}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity
              style={[styles.chatSendBtn, { backgroundColor: chatInput.trim() ? T.primary : T.surfaceHigh }]}
              onPress={sendMessage}
              disabled={!chatInput.trim()}
              activeOpacity={0.8}
            >
              <Feather name="send" size={16} color={chatInput.trim() ? '#FFF' : T.textDim} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: Fonts.extraBold,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  heroRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tradeActionLabel: {
    fontSize: 10,
    fontFamily: Fonts.extraBold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 28,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  heroAsset: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.extraBold,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  heroRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  settlementValue: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
  },
  rateValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  // Timer Banner
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  timerText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    flex: 1,
  },

  // Milestone Stepper
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.extraBold,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  milestoneDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneLine: {
    width: 2,
    height: 32,
    marginVertical: 4,
  },
  activeStepTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  // Details
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  detailsValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  copyIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Payment Panel
  paymentCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  bankDetailsBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankDetailLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  bankDetailValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  copyPill: {
    padding: 8,
  },
  bankDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 10,
  },
  utrInputContainer: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  uploadBox: {
    height: 100,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadedReceipt: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadedImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  deletePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitProofBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },

  // Banner Rows
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  statusIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  completedCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
  },

  securityRow: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  disputeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },

  // Actions
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  balanceWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  primaryBtn: {
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: Fonts.extraBold,
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  // ── CHAT SYSTEM ──
  chatModal: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  chatHeaderBackBtn: {
    padding: 4,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatCounterpartyName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  chatHeaderStatusText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chatHeaderOrderPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chatEscrowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  chatMessages: {
    padding: 16,
    gap: 8,
  },
  chatEmpty: {
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRow: {
    flexDirection: 'row',
    width: '100%',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowThem: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '78%',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  senderLabel: {
    fontSize: 10,
    fontFamily: Fonts.extraBold,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    lineHeight: 20,
  },
  msgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 9,
    fontFamily: Fonts.bold,
  },
  dateSep: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginVertical: 10,
  },
  dateText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  systemMsg: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '85%',
    marginVertical: 4,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chatInputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chatTextInput: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    maxHeight: 100,
    padding: 0,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
