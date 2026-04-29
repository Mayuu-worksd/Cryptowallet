import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert, Image, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { p2pService, P2POrder } from '../services/merchantService';

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
  const { walletAddress, isDarkMode, balances, ethBalance, lockBalance } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<P2POrder>(order);

  const isSeller = currentOrder.seller_wallet.toLowerCase() === walletAddress.toLowerCase();
  const isBuyer  = currentOrder.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase();
  const isOpen   = currentOrder.status === 'open';

  // Check if buyer has enough balance
  const buyerBalance = currentOrder.token === 'ETH'
    ? parseFloat(ethBalance) || 0
    : (balances[currentOrder.token] ?? 0);
  const hasEnoughBalance = buyerBalance >= currentOrder.amount;

  const refresh = async () => {
    try {
      const orders = await p2pService.getMyOrders(walletAddress);
      const updated = orders.find(o => o.id === currentOrder.id);
      if (updated) setCurrentOrder(updated);
    } catch {}
  };

  const handleBuyOrder = async () => {
    // Confirm wallet balance before locking escrow
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
          setLoading(true);
          try {
            await p2pService.buyOrder(currentOrder.id!, walletAddress);
            lockBalance(currentOrder.token, currentOrder.amount);
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
        setLoading(true);
        try {
          await p2pService.markFiatSent(currentOrder.id!);
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
        setLoading(true);
        try {
          await p2pService.cancelOrder(currentOrder.id!, walletAddress);
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
          <Text style={[s.heroFiat, { color: T.textMuted }]}>≈ ${currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
          <View style={s.timerRow}>
            <Feather name="clock" size={14} color={T.textDim} />
            <Text style={[s.timerText, { color: T.textDim }]}>P2P Transaction Protection Active</Text>
          </View>
        </View>

        {/* Instruction Banner */}
        <View style={[s.banner, { backgroundColor: T.surface, borderColor: T.primary + '20' }]}>
          <View style={[s.bannerIconBox, { backgroundColor: T.primary + '15' }]}>
             <Feather name="info" size={20} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: T.text }]}>Transaction Instruction</Text>
            <Text style={[s.bannerSub, { color: T.textMuted }]}>
              {isOpen ? "Select 'Buy' to lock the merchant's assets in escrow. " : "Please complete the bank transfer. After transferring, click 'I HAVE PAID' to notify the seller."}
            </Text>
          </View>
        </View>

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
             <Text style={[s.rowValue, { color: T.primary }]}>${currentOrder.fiat_total.toFixed(2)} {currentOrder.fiat_currency}</Text>
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

        {/* Merchant Card */}
        <View style={[s.merchantCard, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
          <View style={[s.avatarBox, { backgroundColor: T.surfaceHigh }]}>
             <Feather name="user" size={24} color={T.textMuted} />
             <View style={[s.onlineDot, { borderColor: T.surface }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.merchantName, { color: T.text }]}>Merchant Profile</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
               <Feather name="star" size={10} color="#F5AC37" />
               <Text style={[s.merchantSub, { color: T.textMuted }]}>Verified • 99% Completion</Text>
            </View>
          </View>
          <TouchableOpacity style={[s.chatBtn, { backgroundColor: T.surfaceHigh }]}>
            <Feather name="message-square" size={18} color={T.primary} />
          </TouchableOpacity>
        </View>

        {/* Escrow Badge */}
        <View style={[s.merchantCard, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
          <View style={[s.avatarBox, { backgroundColor: T.success + '15', borderRadius: 12 }]}>
             <Feather name="shield" size={24} color={T.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.merchantName, { color: T.text }]}>Vault Escrow Active</Text>
            <Text style={[s.merchantSub, { color: T.textMuted }]}>Your funds are protected by our multi-sig smart contract.</Text>
          </View>
        </View>

      </ScrollView>

      {/* Sticky Actions */}
      <View style={[s.actions, { backgroundColor: T.background, borderTopColor: T.border }]}>
        {/* Open order — not mine — buyer can accept */}
        {isOpen && !isSeller && (
          <>
            {!hasEnoughBalance && (
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
        {/* Buyer — in escrow — mark fiat sent */}
        {isBuyer && currentOrder.status === 'in_escrow' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: T.primary }]} onPress={handleFiatSent} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>I HAVE PAID</Text>}
          </TouchableOpacity>
        )}
        {/* Seller — can cancel open order */}
        {isSeller && isOpen && (
          <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={handleCancel} disabled={loading}>
            <Text style={[s.secondaryBtnText, { color: T.text }]}>CANCEL LISTING</Text>
          </TouchableOpacity>
        )}
        {/* Anyone can go back */}
        {!isOpen && !isBuyer && (
          <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: T.surfaceHigh }]} onPress={() => navigation.goBack()}>
            <Text style={[s.secondaryBtnText, { color: T.text }]}>BACK TO MARKET</Text>
          </TouchableOpacity>
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

  banner: { flexDirection: 'row', padding: 20, borderRadius: 28, gap: 16, marginBottom: 20, borderWidth: 1.5 },
  bannerIconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  bannerSub: { fontSize: 13, lineHeight: 21, fontWeight: '500' },

  detailsCard: { borderRadius: 28, padding: 4, marginBottom: 20 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 16, fontWeight: '800' },

  merchantCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 28, padding: 20, gap: 16, marginBottom: 16 },
  avatarBox: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 3 },
  merchantName: { fontSize: 17, fontWeight: '800' },
  merchantSub: { fontSize: 13, fontWeight: '500' },
  chatBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24, borderTopWidth: 1, gap: 14 },
  primaryBtn: { height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  secondaryBtn: { height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '800' },
});


