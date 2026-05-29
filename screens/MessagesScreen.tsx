import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { supabase } from '../services/supabaseClient';

const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B',
  TRX: '#EF0027', BTC: '#F7931A', SOL: '#14F195',
};

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

      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: T.border }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>Messages</Text>
        {totalUnread > 0 && (
          <View style={[styles.totalBadge, { backgroundColor: T.primary }]}>
            <Text style={styles.totalBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={[styles.emptyIcon, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
            <Feather name="message-square" size={28} color={T.primary} />
          </View>
          <Text style={{ color: T.text, fontSize: 16, fontFamily: Fonts.bold, textAlign: 'center' }}>No P2P Orders Yet</Text>
          <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20 }}>
            When you start a P2P trade, your conversations will appear here.
          </Text>
          <TouchableOpacity
            style={[styles.goP2PBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.navigate('P2P')}
          >
            <Text style={{ color: '#FFF', fontFamily: Fonts.bold, fontSize: 14 }}>Go to P2P Market</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {orders.map(order => {
            const last = lastMessages[order.id];
            const unread = unreadCounts[order.id] ?? 0;
            const isSeller = myAddresses.includes(order.seller_wallet?.toLowerCase());
            const color = TOKEN_COLORS[order.token] ?? '#888';
            const sColor = statusColor(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.row, { borderBottomColor: T.border }]}
                onPress={() => openChat(order)}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
                  <Text style={{ color, fontSize: 16, fontFamily: Fonts.extraBold }}>{order.token.charAt(0)}</Text>
                  {unread > 0 && (
                    <View style={[styles.unreadDot, { backgroundColor: T.primary }]}>
                      <Text style={styles.unreadDotText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ color: T.text, fontFamily: Fonts.bold, fontSize: 14 }}>
                      {isSeller ? 'Selling' : 'Buying'} {order.amount} {order.token}
                    </Text>
                    <Text style={{ color: T.textMuted, fontFamily: Fonts.medium, fontSize: 11 }}>
                      {last ? timeAgo(last.created_at) : timeAgo(order.created_at)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: T.textMuted, fontFamily: Fonts.medium, fontSize: 12, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {last
                        ? (myAddresses.includes(last.sender_wallet?.toLowerCase()) ? 'You: ' : '') + last.message
                        : `${order.fiat_total?.toFixed(2)} ${order.fiat_currency} · ${order.payment_method}`}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: sColor + '15' }]}>
                      <Text style={{ color: sColor, fontSize: 9, fontFamily: Fonts.extraBold }}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color={T.border} style={{ marginLeft: 8 }} />
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
    borderBottomWidth: 1, gap: 10,
  },
  headerTitle: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
  totalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  totalBadgeText: { color: '#FFF', fontSize: 11, fontFamily: Fonts.extraBold },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  unreadDotText: { color: '#FFF', fontSize: 9, fontFamily: Fonts.extraBold },
  statusPill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  goP2PBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 16 },
});
