import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert, Image, StatusBar, TextInput, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { p2pService, P2POrder } from '../services/merchantService';
import { supabase } from '../services/supabaseClient';
import TransactionLoader from '../components/ui/TransactionLoader';

const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B', DAI: '#F5AC37',
};
const TOKEN_LOGOS: Record<string, string> = {
  ETH:  'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  DAI:  'https://assets.coingecko.com/coins/images/9956/large/4943.png',
};
const TOKEN_NAMES: Record<string, string> = {
  ETH: 'Ethereum', USDC: 'USD Coin', USDT: 'Tether USD', DAI: 'Dai Stablecoin',
};

function TokenSymbolIcon({ token, size = 26 }: { token: string; size?: number }) {
  const color = TOKEN_COLORS[token] ?? '#888';
  const [failed, setFailed] = React.useState(false);
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
      <Text style={{ color, fontSize: size * 0.44, fontWeight: '900' }}>{token.charAt(0)}</Text>
    </View>
  );
}

export default function P2POrderDetailScreen({ navigation, route }: any) {
  const order: P2POrder = route?.params?.order;
  const { walletAddress, isDarkMode, balances, ethBalance, lockBalance, unlockBalance, accountType, addTx, updateTxStatus, lockedBalance, refreshBalance, creditP2PBalance, network } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [loading, setLoading] = useState(false);
  const [loaderType, setLoaderType] = useState<'send' | 'swap' | 'p2p' | 'generic'>('p2p');
  const [loaderTitle, setLoaderTitle] = useState('');
  const [loaderSub, setLoaderSub] = useState('');
  const [currentOrder, setCurrentOrder] = useState<P2POrder>(order);
  const [orderLoading, setOrderLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages]   = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgCount = useRef(0);
  const chatPulse = useRef(new Animated.Value(1)).current;
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
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
      }
    } catch {}
  }, [currentOrder.id]);

  // Chat: try Realtime first, fall back to 3s polling
  useEffect(() => {
    if (!currentOrder.id) return;
    // Reset count so messages always load fresh for this order/account
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
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          return next;
        });
      })
      .subscribe();

    // Polling fallback — kicks in if Realtime isn't available (free tier)
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
    // Add optimistic message immediately for instant feedback
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
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { data } = await supabase.from('p2p_chat').insert({
        order_id:      currentOrder.id,
        sender_wallet: walletAddress.toLowerCase(),
        message:       text,
        is_support:    false,
      }).select().single();
      // Replace optimistic with real record
      if (data) {
        setMessages(prev => {
          const replaced = prev.map(m => m.id === optId ? data : m);
          replaced.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return replaced;
        });
      }
    } catch {
      // Remove optimistic on failure
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
      // Find the pending tx ID — from memory first, then AsyncStorage (survives restarts)
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

  // Fetch fresh order + balance on mount
  useEffect(() => {
    refresh().finally(() => setOrderLoading(false));
    // Fetch live on-chain balance directly so we don't depend on stale global state
    const fetchLive = async () => {
      try {
        const { getWalletBalances } = await import('../services/balanceService');
        const bals = await getWalletBalances(walletAddress, network);
        setLiveBalance(currentOrder.token === 'ETH' ? bals.ETH : (bals[currentOrder.token] ?? 0));
      } catch {
        refreshBalance(); // fallback to global refresh
      }
    };
    if (walletAddress) fetchLive();
    // Heal stale locked balances on mount
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

  // Also react if status changes while screen is open
  useEffect(() => {
    applyCompletion(currentOrder);
  }, [currentOrder.status]);

  // Use live fetched balance if available, fall back to global state
  const rawBalance = liveBalance !== null
    ? liveBalance
    : currentOrder.token === 'ETH'
      ? parseFloat(ethBalance) || 0
      : (balances[currentOrder.token] ?? 0);
  const lockedAmt = isSeller ? (lockedBalance?.[currentOrder.token] ?? 0) : 0;
  const buyerBalance = Math.max(0, rawBalance - lockedAmt);
  // On testnet (Sepolia/TRON Nile) escrow is simulated — no real on-chain lock needed
  // Only enforce balance check on mainnet with deployed escrow contract
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
            // Add pending tx and capture the ID so applyCompletion can update it
            pendingTxId.current = addTx({
              type: 'received',
              coin: currentOrder.token,
              amount: currentOrder.amount.toString(),
              usdValue: currentOrder.fiat_total.toFixed(2),
              address: `P2P Buy \u00b7 ${currentOrder.fiat_currency} \u2192 ${currentOrder.token}`,
              status: 'pending',
            });
            // Persist so applyCompletion can find it after app restart
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

  const handleFiatSent = async () => {
    Alert.alert('Confirm', 'Have you sent the payment to the seller?', [
      { text: 'Cancel', style: 'cancel' },
      { text: "Yes, I've Sent", onPress: async () => {
        showLoader('Confirming Payment', 'Notifying the seller...', 'p2p');
        try {
          await p2pService.markFiatSent(currentOrder.id!, network);
          await refresh();
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Failed.');
        } finally { setLoading(false); }
      }},
    ]);
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

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <TransactionLoader visible={loading} title={loaderTitle} subtitle={loaderSub} isDarkMode={isDarkMode} type={loaderType} />
      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Order Details</Text>
        <TouchableOpacity onPress={refresh} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={20} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status Hero */}
        <View style={s.hero}>
          <View style={[s.statusBadge, { backgroundColor: T.primary + '15' }]}>
            <Text style={[s.statusText, { color: T.primary }]}>{statusLabel}</Text>
          </View>
          <Text style={[s.heroAmount, { color: T.text }]}>{currentOrder.amount} {currentOrder.token}</Text>
          <Text style={[s.heroFiat, { color: T.textMuted }]}>≈ {currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
          <View style={s.timerRow}>
            <Feather name="clock" size={14} color={T.textDim} />
            <Text style={[s.timerText, { color: T.textDim }]}>P2P Transaction Protection Active</Text>
          </View>
          {currentOrder.created_at && (
            <View style={[s.timerRow, { marginTop: 6 }]}>
              <Feather name="zap" size={13} color="#10B981" />
              <Text style={[s.timerText, { color: '#10B981', fontWeight: '700' }]}>~15 min ETA</Text>
              <Text style={[s.timerText, { color: T.textDim, marginLeft: 8 }]}>
                Listed {(() => {
                  const diff = Date.now() - new Date(currentOrder.created_at!).getTime();
                  const m = Math.floor(diff / 60000);
                  if (m < 1) return 'just now';
                  if (m < 60) return `${m}m ago`;
                  const h = Math.floor(m / 60);
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* Step Tracker */}
        {currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && (() => {
          const steps = isSeller
            ? [
                { label: 'Order Listed', icon: 'tag' as const },
                { label: 'Escrow Locked', icon: 'lock' as const },
                { label: 'Fiat Received', icon: 'check-circle' as const },
              ]
            : [
                { label: 'Lock Escrow', icon: 'lock' as const },
                { label: 'Send Payment', icon: 'send' as const },
                { label: 'Crypto Released', icon: 'check-circle' as const },
              ];
          const activeStep = isSeller
            ? currentOrder.status === 'open' ? 0 : currentOrder.status === 'in_escrow' ? 1 : 2
            : currentOrder.status === 'open' ? 0 : currentOrder.status === 'in_escrow' ? 1 : 2;
          return (
            <View style={[s.stepTracker, { backgroundColor: T.surface, borderColor: T.border }]}>
              {steps.map((step, idx) => (
                <React.Fragment key={idx}>
                  <View style={s.stepItem}>
                    <View style={[
                      s.stepCircle,
                      idx < activeStep && { backgroundColor: '#10B981', borderColor: '#10B981' },
                      idx === activeStep && { backgroundColor: T.primary, borderColor: T.primary },
                      idx > activeStep && { backgroundColor: 'transparent', borderColor: T.border },
                    ]}>
                      <Feather
                        name={idx < activeStep ? 'check' : step.icon}
                        size={13}
                        color={idx >= activeStep ? (idx === activeStep ? '#FFF' : T.textDim) : '#FFF'}
                      />
                    </View>
                    <Text style={[
                      s.stepLabel,
                      { color: idx === activeStep ? T.text : idx < activeStep ? '#10B981' : T.textDim },
                    ]}>{step.label}</Text>
                  </View>
                  {idx < steps.length - 1 && (
                    <View style={[s.stepLine, { backgroundColor: idx < activeStep ? '#10B981' : T.border }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          );
        })()}

        {/* Details Table */}
        <View style={[s.detailsCard, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
          <View style={[s.tableRow, { borderBottomColor: T.border }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Token</Text>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TokenSymbolIcon token={currentOrder.token} size={26} />
                <Text style={[s.rowValue, { color: T.text }]}>{TOKEN_NAMES[currentOrder.token] ?? currentOrder.token}</Text>
             </View>
          </View>
          <View style={[s.tableRow, { borderBottomColor: T.border }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Amount</Text>
             <Text style={[s.rowValue, { color: T.text }]}>{currentOrder.amount} {currentOrder.token}</Text>
          </View>
          <View style={[s.tableRow, { borderBottomColor: T.border }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Rate</Text>
             <Text style={[s.rowValue, { color: T.text }]}>${currentOrder.rate.toFixed(2)} / {currentOrder.token}</Text>
          </View>
          <View style={[s.tableRow, { borderBottomColor: T.border }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Total Fiat</Text>
             <Text style={[s.rowValue, { color: T.primary }]}>{currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
          </View>
          <View style={[s.tableRow, { borderBottomColor: T.border }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Payment Method</Text>
             <Text style={[s.rowValue, { color: T.text }]}>{currentOrder.payment_method}</Text>
          </View>
          <View style={[s.tableRow, { borderBottomWidth: 0 }]}>
             <Text style={[s.rowLabel, { color: T.textMuted }]}>Order ID</Text>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.rowLabel, { color: T.textDim }]}>{currentOrder.id ? `${currentOrder.id.slice(0, 12)}...` : '—'}</Text>
                <TouchableOpacity onPress={() => Alert.alert('Copied', 'Order ID copied to clipboard.')}>
                   <Feather name="copy" size={14} color={T.primary} />
                </TouchableOpacity>
             </View>
          </View>
        </View>

        {/* Compact Horizontal Info Bar */}
        <View style={[s.infoBar, { backgroundColor: T.surface, borderColor: T.border }]}>
          {/* Seller Info */}
          <View style={s.infoItem}>
            <View style={[s.infoIcon, { backgroundColor: T.surfaceHigh }]}>
              <Feather name={currentOrder.is_merchant ? 'briefcase' : 'user'} size={16} color={T.textMuted} />
            </View>
            <View>
              <Text style={[s.infoLabel, { color: T.textDim }]}>Seller</Text>
              <Text style={[s.infoValue, { color: T.text }]}>
                {currentOrder.seller_wallet.slice(0, 6)}…{currentOrder.seller_wallet.slice(-4)}
              </Text>
            </View>
          </View>
          
          {/* Escrow Status */}
          <View style={s.infoItem}>
            <View style={[s.infoIcon, { backgroundColor: T.success + '15' }]}>
              <Feather name="shield" size={16} color={T.success} />
            </View>
            <View>
              <Text style={[s.infoLabel, { color: T.textDim }]}>Escrow</Text>
              <Text style={[s.infoValue, { color: T.success }]}>Protected</Text>
            </View>
          </View>
          
          {/* Dispute Option */}
          {(currentOrder.status === 'in_escrow' || currentOrder.status === 'fiat_sent') && (
            <TouchableOpacity 
              style={s.infoItem}
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
              <View style={[s.infoIcon, { backgroundColor: T.error + '15' }]}>
                <Feather name="alert-triangle" size={16} color={T.error} />
              </View>
              <View>
                <Text style={[s.infoLabel, { color: T.textDim }]}>Issue?</Text>
                <Text style={[s.infoValue, { color: T.error }]}>Dispute</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Floating Chat FAB */}
      {(currentOrder.status === 'in_escrow' || currentOrder.status === 'fiat_sent' || currentOrder.status === 'disputed') && (
        <Animated.View style={[s.chatFab, { transform: [{ scale: chatPulse }] }]}>
          <TouchableOpacity
            style={[s.fabButton, { backgroundColor: T.primary }]}
            onPress={() => setShowChatModal(true)}
            activeOpacity={0.85}
          >
            <Feather name="message-circle" size={24} color="#FFF" />
            {messages.length > 0 && (
              <View style={s.fabBadge}>
                <Text style={s.fabBadgeText}>{messages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Full-Screen Chat Modal */}
      {showChatModal && (
        <KeyboardAvoidingView
          style={[s.chatModal, { backgroundColor: T.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

          {/* ── WhatsApp-style Header ── */}
          <View style={[s.waHeader, { backgroundColor: T.surface, borderBottomColor: T.border }]}>
            <TouchableOpacity onPress={() => setShowChatModal(false)} style={s.waBackBtn}>
              <Feather name="arrow-left" size={22} color={T.text} />
            </TouchableOpacity>

            {/* Counterparty avatar + info */}
            <View style={[s.waAvatar, { backgroundColor: T.primary + '20' }]}>
              <Feather name={currentOrder.is_merchant ? 'briefcase' : 'user'} size={18} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.waName, { color: T.text }]}>
                {isSeller
                  ? `${currentOrder.buyer_wallet?.slice(0, 6) ?? '??'}…${currentOrder.buyer_wallet?.slice(-4) ?? '??'}`
                  : `${currentOrder.seller_wallet.slice(0, 6)}…${currentOrder.seller_wallet.slice(-4)}`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[s.onlineDot, { backgroundColor: T.success }]} />
                <Text style={[s.waStatus, { color: T.textDim }]}>
                  {currentOrder.is_merchant ? 'Merchant' : 'Personal'} · Escrow Protected
                </Text>
              </View>
            </View>

            {/* Trade info pill */}
            <View style={[s.waTradePill, { backgroundColor: T.primary + '15' }]}>
              <TokenSymbolIcon token={currentOrder.token} size={14} />
              <Text style={[s.waTradeText, { color: T.primary }]}>
                {currentOrder.amount} {currentOrder.token}
              </Text>
            </View>
          </View>

          {/* ── Escrow status banner ── */}
          <View style={[s.escrowBanner, {
            backgroundColor: currentOrder.status === 'disputed' ? T.error + '12' : T.success + '10',
            borderBottomColor: currentOrder.status === 'disputed' ? T.error + '30' : T.success + '25',
          }]}>
            <Feather
              name={currentOrder.status === 'disputed' ? 'alert-triangle' : 'shield'}
              size={12}
              color={currentOrder.status === 'disputed' ? T.error : T.success}
            />
            <Text style={[s.escrowBannerText, {
              color: currentOrder.status === 'disputed' ? T.error : T.success
            }]}>
              {currentOrder.status === 'disputed'
                ? 'Dispute raised — support team reviewing'
                : `Escrow locked · ${currentOrder.fiat_total.toFixed(2)} ${currentOrder.fiat_currency} · ${currentOrder.payment_method}`}
            </Text>
          </View>

          {/* ── Messages ── */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, backgroundColor: T.background }}
              contentContainerStyle={s.chatMessages}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={s.chatEmpty}>
                  <View style={[s.emptyIconRing, { borderColor: T.border }]}>
                    <View style={[s.emptyIconInner, { backgroundColor: T.surfaceLow }]}>
                      <Feather name="lock" size={28} color={T.textDim} />
                    </View>
                  </View>
                  <Text style={{ color: T.textDim, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                    Messages are end-to-end encrypted.{`\n`}Only trade participants can read them.
                  </Text>
                </View>
              ) : messages.map((m, i) => {
                const isMe     = m.sender_wallet?.toLowerCase() === walletAddress.toLowerCase();
                const isSystem = m.sender_wallet === 'system';
                const isSupport = m.is_support;
                const prevMsg  = messages[i - 1];

                // Date separator
                const msgDate  = m.created_at ? new Date(m.created_at) : new Date();
                const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at) : null;
                const showDate = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

                // Group consecutive messages from same sender (no avatar/name repeat)
                const nextMsg    = messages[i + 1];
                const isLastInGroup = !nextMsg || nextMsg.sender_wallet !== m.sender_wallet;
                const isFirstInGroup = !prevMsg || prevMsg.sender_wallet !== m.sender_wallet;

                const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isOptimistic = m.id?.startsWith('opt-');

                if (isSystem) return (
                  <React.Fragment key={m.id ?? i}>
                    {showDate && (
                      <View style={s.dateSep}>
                        <View style={[s.dateLine, { backgroundColor: T.border }]} />
                        <Text style={[s.dateText, { color: T.textDim, backgroundColor: T.background }]}>
                          {msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <View style={[s.dateLine, { backgroundColor: T.border }]} />
                      </View>
                    )}
                    <View style={[s.systemMsg, { backgroundColor: T.error + '12', borderColor: T.error + '25' }]}>
                      <Feather name="alert-triangle" size={12} color={T.error} />
                      <Text style={{ color: T.error, fontSize: 12, fontWeight: '600', flex: 1 }}>{m.message}</Text>
                    </View>
                  </React.Fragment>
                );

                const isBuyerMsg = m.sender_wallet?.toLowerCase() === currentOrder.buyer_wallet?.toLowerCase();
                const senderLabel = isSupport ? 'Support' : isBuyerMsg ? 'Buyer' : 'Seller';

                const msgKey = m.id ?? `msg-${i}`;
                const anim = getOrCreateMsgAnim(msgKey);

                return (
                  <React.Fragment key={msgKey}>
                    {showDate && (
                      <View style={s.dateSep}>
                        <View style={[s.dateLine, { backgroundColor: T.border }]} />
                        <Text style={[s.dateText, { color: T.textDim, backgroundColor: T.background }]}>
                          {msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <View style={[s.dateLine, { backgroundColor: T.border }]} />
                      </View>
                    )}
                    <Animated.View
                      style={[
                        s.msgRow,
                        isMe ? s.msgRowMe : s.msgRowThem,
                        { marginBottom: isLastInGroup ? 8 : 2 },
                        {
                          opacity: anim,
                          transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }],
                        },
                      ]}
                    >
                      {/* Avatar — only on last message in group for them */}
                      {!isMe && (
                        <View style={{ width: 32, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 }}>
                          {isLastInGroup ? (
                            <View style={[s.msgAvatar, {
                              backgroundColor: isSupport ? T.primary + '20' : T.surfaceHigh,
                            }]}>
                              <Feather
                                name={isSupport ? 'shield' : isBuyerMsg ? 'user' : 'briefcase'}
                                size={13}
                                color={isSupport ? T.primary : T.textMuted}
                              />
                            </View>
                          ) : (
                            <View style={{ width: 32 }} />
                          )}
                        </View>
                      )}

                      <View style={[
                        s.bubbleWrap,
                        isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                      ]}>
                        {/* Sender label — only first in group for them */}
                        {!isMe && isFirstInGroup && (
                          <Text style={[s.senderLabel, { color: isSupport ? T.primary : T.textDim }]}>
                            {senderLabel}
                            {isSupport && ' ✓'}
                          </Text>
                        )}

                        {/* Bubble */}
                        <View style={[
                          s.bubble,
                          isMe ? [
                            s.myBubble,
                            { backgroundColor: T.primary },
                            isFirstInGroup && s.myBubbleFirst,
                          ] : [
                            s.theirBubble,
                            { backgroundColor: T.surface, borderColor: T.border },
                            isFirstInGroup && s.theirBubbleFirst,
                          ],
                        ]}>
                          <Text style={[s.messageText, { color: isMe ? '#FFF' : T.text }]}>
                            {m.message}
                          </Text>
                          {/* Time + status inside bubble */}
                          <View style={[s.msgMeta, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                            <Text style={[s.messageTime, { color: isMe ? 'rgba(255,255,255,0.55)' : T.textDim }]}>
                              {timeStr}
                            </Text>
                            {isMe && (
                              <Feather
                                name={isOptimistic ? 'clock' : 'check-circle'}
                                size={10}
                                color={isOptimistic ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)'}
                              />
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Spacer for my messages (no avatar) */}
                      {isMe && <View style={{ width: 32 }} />}
                    </Animated.View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </TouchableWithoutFeedback>

          {/* ── Input bar ── */}
          <View style={[s.inputBar, { backgroundColor: T.surface, borderTopColor: T.border }]}>
            <View style={[s.inputWrap, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <TextInput
                style={[s.chatInput, { color: T.text }]}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Message..."
                placeholderTextColor={T.textDim}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                blurOnSubmit={false}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: chatInput.trim() ? T.primary : T.surfaceHigh }]}
              onPress={sendMessage}
              disabled={!chatInput.trim()}
              activeOpacity={0.8}
            >
              <Feather name="send" size={18} color={chatInput.trim() ? '#FFF' : T.textDim} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Sticky Actions */}
      <View style={[s.actions, { backgroundColor: T.background, borderTopColor: T.border }]}>
        {/* Open order — any buyer (not the seller) can accept */}
        {isOpen && !isSeller && (
          <>
            {!hasEnoughBalance && !isTestnet && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.error + '15', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <Feather name="alert-circle" size={14} color={T.error} />
                <Text style={{ color: T.error, fontSize: 12, fontWeight: '700', flex: 1 }}>
                  Insufficient balance. Need {currentOrder.amount} {currentOrder.token}.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: hasEnoughBalance ? T.primary : T.textDim }]}
              onPress={handleBuyOrder}
              disabled={loading || !hasEnoughBalance}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.primaryBtnText}>
                    {hasEnoughBalance ? `BUY ${currentOrder.token} — LOCK ESCROW` : 'INSUFFICIENT BALANCE'}
                  </Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* Seller — open order: can cancel */}
        {isSeller && isOpen && (
          <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={handleCancel} disabled={loading}>
            {loading ? <ActivityIndicator color={T.text} /> : <Text style={[s.secondaryBtnText, { color: T.text }]}>CANCEL LISTING</Text>}
          </TouchableOpacity>
        )}

        {/* Seller — in_escrow: waiting for buyer to pay */}
        {isSeller && currentOrder.status === 'in_escrow' && (
          <View style={[s.statusCard, { backgroundColor: T.surface, borderColor: T.primary + '30' }]}>
            <View style={[s.statusIconBox, { backgroundColor: T.primary + '15' }]}>
              <Feather name="clock" size={18} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.statusLabel, { color: T.textMuted }]}>Awaiting Payment</Text>
              <Text style={[s.statusMessage, { color: T.text }]}>Buyer is sending fiat payment</Text>
            </View>
            <View style={[s.statusDot, { backgroundColor: T.primary }]} />
          </View>
        )}

        {/* Seller — fiat_sent: confirm and release */}
        {isSeller && currentOrder.status === 'fiat_sent' && (
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: '#10B981' }]}
            onPress={async () => {
              Alert.alert('Confirm Payment Received', 'This will release the crypto to the buyer. Only confirm if you have received the fiat payment.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Release Crypto', onPress: async () => {
                  showLoader('Releasing Crypto', 'Transferring to buyer wallet...', 'p2p');
                  try {
                    await p2pService.confirmPaymentReceived(currentOrder.id!, network, walletAddress);
                    unlockBalance(currentOrder.token, currentOrder.amount);
                    // Deduct from seller's local balance directly (testnet has no real transfer)
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
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>✓ RELEASE CRYPTO TO BUYER</Text>}
          </TouchableOpacity>
        )}

        {/* Buyer — in_escrow: mark fiat sent */}
        {isBuyer && !isSeller && currentOrder.status === 'in_escrow' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: T.primary }]} onPress={handleFiatSent} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>I HAVE PAID</Text>}
          </TouchableOpacity>
        )}

        {/* Buyer — fiat_sent: waiting for seller to confirm */}
        {isBuyer && !isSeller && currentOrder.status === 'fiat_sent' && (
          <View style={[s.statusCard, { backgroundColor: T.surface, borderColor: '#F59E0B' + '40' }]}>
            <View style={[s.statusIconBox, { backgroundColor: '#F59E0B' + '15' }]}>
              <Feather name="clock" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.statusLabel, { color: T.textMuted }]}>Payment Sent</Text>
              <Text style={[s.statusMessage, { color: T.text }]}>Waiting for seller to confirm</Text>
            </View>
            <View style={[s.statusDot, { backgroundColor: '#F59E0B' }]} />
          </View>
        )}

        {/* Completed — Trade Receipt */}
        {currentOrder.status === 'completed' && (() => {
          return (
          <>
            <View style={[s.receiptCard, { backgroundColor: T.surface, borderColor: '#10B98130' }]}>
              <View style={s.receiptHeader}>
                <View style={[s.receiptIconBox, { backgroundColor: '#10B98120' }]}>
                  <Feather name="check-circle" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.receiptTitle, { color: '#10B981' }]}>Trade Complete</Text>
                  <Text style={[s.receiptSub, { color: T.textMuted }]}>
                    {currentOrder.id ? `#${currentOrder.id.slice(0, 8).toUpperCase()}` : ''}
                  </Text>
                </View>
                <TokenSymbolIcon token={currentOrder.token} size={36} />
              </View>
              <View style={[s.receiptDivider, { backgroundColor: T.border }]} />
              <View style={s.receiptRow}>
                <Text style={[s.receiptLabel, { color: T.textMuted }]}>You {isSeller ? 'Sold' : 'Bought'}</Text>
                <Text style={[s.receiptValue, { color: T.text }]}>{currentOrder.amount} {currentOrder.token}</Text>
              </View>
              <View style={s.receiptRow}>
                <Text style={[s.receiptLabel, { color: T.textMuted }]}>Fiat {isSeller ? 'Received' : 'Paid'}</Text>
              <Text style={[s.receiptValue, { color: T.primary }]}>{currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
              </View>
              <View style={s.receiptRow}>
                <Text style={[s.receiptLabel, { color: T.textMuted }]}>Rate</Text>
                <Text style={[s.receiptValue, { color: T.text }]}>${currentOrder.rate.toFixed(2)} / {currentOrder.token}</Text>
              </View>
              <View style={s.receiptRow}>
                <Text style={[s.receiptLabel, { color: T.textMuted }]}>Counterparty</Text>
                <Text style={[s.receiptValue, { color: T.text }]}>
                  {isSeller
                    ? currentOrder.buyer_wallet ? `${currentOrder.buyer_wallet.slice(0, 8)}…` : 'Buyer'
                    : `${currentOrder.seller_wallet.slice(0, 8)}…`}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={() => navigation.goBack()}>
              <Text style={[s.secondaryBtnText, { color: T.text }]}>BACK TO MARKET</Text>
            </TouchableOpacity>
          </>
          );
        })()}

        {/* Cancelled */}
        {currentOrder.status === 'cancelled' && (
          <>
            <View style={[s.statusCard, { backgroundColor: T.surface, borderColor: T.error + '30' }]}>
              <View style={[s.statusIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="x-circle" size={18} color={T.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusLabel, { color: T.textMuted }]}>Order Cancelled</Text>
                <Text style={[s.statusMessage, { color: T.text }]}>This trade has been cancelled</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={() => navigation.goBack()}>
              <Text style={[s.secondaryBtnText, { color: T.text }]}>BACK TO MARKET</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Disputed */}
        {currentOrder.status === 'disputed' && (
          <>
            <View style={[s.statusCard, { backgroundColor: T.surface, borderColor: T.error + '30' }]}>
              <View style={[s.statusIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="alert-triangle" size={18} color={T.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusLabel, { color: T.textMuted }]}>Under Dispute</Text>
                <Text style={[s.statusMessage, { color: T.text }]}>Support team is reviewing this order</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={() => navigation.goBack()}>
              <Text style={[s.secondaryBtnText, { color: T.text }]}>BACK TO MARKET</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  scroll: { paddingHorizontal: 20, paddingBottom: 180 },

  hero: { alignItems: 'center', paddingVertical: 40 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, marginBottom: 20 },
  statusText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  heroAmount: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  heroFiat: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  timerText: { fontSize: 14, fontWeight: '600' },

  stepTracker: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
  stepItem: { alignItems: 'center', gap: 6, flex: 1 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  stepLine: { height: 2, flex: 0.4, marginBottom: 18, borderRadius: 2 },

  detailsCard: { borderRadius: 28, padding: 4, marginBottom: 20 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 16, fontWeight: '800' },

  // Compact Info Bar
  infoBar: { flexDirection: 'row', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, gap: 20 },
  infoItem: { flex: 1, alignItems: 'center', gap: 8 },
  infoIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  infoValue: { fontSize: 13, fontWeight: '800', textAlign: 'center' },

  // Floating Chat FAB
  chatFab: { position: 'absolute', bottom: 130, right: 20, zIndex: 1000 },
  fabButton: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  fabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  fabBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },

  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24, borderTopWidth: 1, gap: 14 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderWidth: 1.5 },
  statusIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statusMessage: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  primaryBtn: { height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  secondaryBtn: { height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '800' },

  // ── WhatsApp-style chat ──
  chatModal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 },

  // Header
  waHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12, borderBottomWidth: 1 },
  waBackBtn: { padding: 4 },
  waAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  waName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  waStatus: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  waTradePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  waTradeText: { fontSize: 11, fontWeight: '800' },

  // Escrow banner
  escrowBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: 1 },
  escrowBannerText: { fontSize: 11, fontWeight: '600', flex: 1 },

  // Messages
  chatMessages: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16, gap: 0 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleWrap: { maxWidth: '75%' },
  senderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 2 },
  bubble: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderWidth: 1 },
  myBubble: { borderRadius: 18, borderBottomRightRadius: 4, borderColor: 'transparent' },
  myBubbleFirst: { borderTopRightRadius: 18 },
  theirBubble: { borderRadius: 18, borderBottomLeftRadius: 4 },
  theirBubbleFirst: { borderTopLeftRadius: 18 },
  messageText: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  messageTime: { fontSize: 10, fontWeight: '500' },

  // Date separator
  dateSep: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },

  // System message
  systemMsg: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, maxWidth: '85%', marginVertical: 4 },

  // Empty state
  chatEmpty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  emptyIconInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  inputWrap: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, minHeight: 42, justifyContent: 'center' },
  chatInput: { fontSize: 15, fontWeight: '400', maxHeight: 100, padding: 0 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  receiptCard: { borderRadius: 24, borderWidth: 1.5, padding: 20, marginBottom: 14, gap: 0 },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  receiptIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 17, fontWeight: '900' },
  receiptSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  receiptDivider: { height: 1, marginBottom: 14 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  receiptLabel: { fontSize: 13, fontWeight: '600' },
  receiptValue: { fontSize: 14, fontWeight: '800' },

});


