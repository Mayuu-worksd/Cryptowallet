import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { supabase } from '../services/supabaseClient';

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

function TokenSymbolIcon({ token, size = 42 }: { token: string; size?: number }) {
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MessagesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { walletAddress, tronAddress, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [orders, setOrders] = useState<any[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, any>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const seenRef = useRef<Record<string, number>>({});

  const myAddresses = [
    (walletAddress || '').toLowerCase(),
    (tronAddress || '').toLowerCase(),
  ].filter(Boolean);

  const fetchOrders = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const filters = [`seller_wallet.eq.${walletAddress.toLowerCase()}`, `buyer_wallet.eq.${walletAddress.toLowerCase()}`];
      if (tronAddress) {
        filters.push(`seller_wallet.eq.${tronAddress.toLowerCase()}`);
        filters.push(`buyer_wallet.eq.${tronAddress.toLowerCase()}`);
      }
      const { data } = await supabase
        .from('p2p_orders')
        .select('*')
        .or(filters.join(','))
        .not('status', 'in', '("cancelled")')
        .order('created_at', { ascending: false });
      if (data) setOrders(data);
    } catch {}
  }, [walletAddress, tronAddress]);

  const fetchLastMessages = useCallback(async (orderList: any[]) => {
    if (!orderList.length) return;
    const ids = orderList.map(o => o.id);
    try {
      const { data } = await supabase
        .from('p2p_chat')
        .select('*')
        .in('order_id', ids)
        .order('created_at', { ascending: false });

      if (!data) return;

      const lastMsgs: Record<string, any> = {};
      const counts: Record<string, number> = {};

      for (const msg of data) {
        if (!lastMsgs[msg.order_id]) lastMsgs[msg.order_id] = msg;
        const isFromMe = myAddresses.includes(msg.sender_wallet?.toLowerCase());
        if (!isFromMe) {
          const seen = seenRef.current[msg.order_id] ?? 0;
          const msgTime = new Date(msg.created_at).getTime();
          if (msgTime > seen) {
            counts[msg.order_id] = (counts[msg.order_id] ?? 0) + 1;
          }
        }
      }

      setLastMessages(lastMsgs);
      setUnreadCounts(counts);
    } catch {}
  }, [myAddresses]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchOrders();
    setLoading(false);
  }, [fetchOrders]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (orders.length) fetchLastMessages(orders);
  }, [orders, fetchLastMessages]);

  const openChat = (order: any) => {
    seenRef.current[order.id] = Date.now();
    setUnreadCounts(prev => ({ ...prev, [order.id]: 0 }));
    navigation.navigate('P2POrderDetail', { order, openChat: true });
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const statusColor = (status: string) => {
    if (status === 'completed') return '#10B981';
    if (status === 'cancelled' || status === 'disputed') return T.primary;
    if (status === 'escrow_locked') return '#627EEA';
    return '#F59E0B';
  };

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Modern Fintech Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[styles.headerTitle, { color: T.text }]}>Messages</Text>
          {totalUnread > 0 && (
            <View style={[styles.totalBadge, { backgroundColor: T.primary }]}>
              <Text style={styles.totalBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.primary} size="small" />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 }}>
          <View style={[styles.emptyIcon, { backgroundColor: T.primary + '12', borderColor: T.primary + '30' }]}>
            <Feather name="message-square" size={32} color={T.primary} />
          </View>
          <Text style={{ color: T.text, fontSize: 18, fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -0.3 }}>No messages yet</Text>
          <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20 }}>
            Active conversations and P2P order chats will appear here.
          </Text>
          <TouchableOpacity
            style={[styles.goP2PBtn, { backgroundColor: T.text }]}
            onPress={() => navigation.navigate('P2P')}
            activeOpacity={0.8}
          >
            <Text style={{ color: T.background, fontFamily: Fonts.bold, fontSize: 14 }}>Explore P2P Market</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        >
          {orders.map(order => {
            const last = lastMessages[order.id];
            const unread = unreadCounts[order.id] ?? 0;
            const isSeller = myAddresses.includes(order.seller_wallet?.toLowerCase());
            const sColor = statusColor(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.row, { backgroundColor: T.surface, borderColor: T.border + '40' }]}
                onPress={() => openChat(order)}
                activeOpacity={0.8}
              >
                {/* Custom Token Avatar with Trade Role Indicator */}
                <View style={styles.avatarContainer}>
                  <TokenSymbolIcon token={order.token} size={46} />
                  <View style={[styles.roleBadge, { backgroundColor: isSeller ? T.error : T.success }]}>
                    <Text style={styles.roleBadgeText}>{isSeller ? 'SELL' : 'BUY'}</Text>
                  </View>
                  {unread > 0 && (
                    <View style={[styles.unreadDot, { backgroundColor: T.primary }]}>
                      <Text style={styles.unreadDotText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>

                {/* Info and Message Body */}
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: T.text, fontFamily: Fonts.bold, fontSize: 15, letterSpacing: -0.2 }}>
                        {order.amount} {order.token}
                      </Text>
                      <View style={[styles.paymentMethodChip, { backgroundColor: T.surfaceHigh }]}>
                        <Text style={{ color: T.textDim, fontSize: 9, fontFamily: Fonts.bold }}>
                          {order.payment_method}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: T.textMuted, fontFamily: Fonts.medium, fontSize: 11 }}>
                      {last ? timeAgo(last.created_at) : timeAgo(order.created_at)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: T.textMuted, fontFamily: Fonts.medium, fontSize: 12, flex: 1, marginRight: 12 }} numberOfLines={1}>
                      {last
                        ? (myAddresses.includes(last.sender_wallet?.toLowerCase()) ? 'You: ' : '') + last.message
                        : `${order.fiat_total?.toFixed(2)} ${order.fiat_currency}`}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: sColor + '12', borderColor: sColor + '20' }]}>
                      <Text style={{ color: sColor, fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.3 }}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={T.textDim} style={{ marginLeft: 8, opacity: 0.5 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontFamily: Fonts.extraBold, letterSpacing: -0.6 },
  totalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  totalBadgeText: { color: '#FFF', fontSize: 11, fontFamily: Fonts.extraBold },
  
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 20, borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  
  avatarContainer: { position: 'relative' },
  roleBadge: {
    position: 'absolute', bottom: -4, right: -4,
    paddingHorizontal: 5, paddingVertical: 1.5,
    borderRadius: 6, borderWidth: 1.5, borderColor: '#FFF',
  },
  roleBadgeText: { color: '#FFF', fontSize: 7, fontFamily: Fonts.extraBold },
  
  unreadDot: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#FFF',
  },
  unreadDotText: { color: '#FFF', fontSize: 9, fontFamily: Fonts.extraBold },
  
  paymentMethodChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  statusPill: { 
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5,
  },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  goP2PBtn: { marginTop: 12, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
});
