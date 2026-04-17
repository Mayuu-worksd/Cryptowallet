import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme, COIN_META, COIN_COLORS } from '../constants';

const CoinIcon = ({ symbol, size = 44 }: { symbol: string; size?: number }) => {
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
};

export default function PortfolioScreen({ navigation }: any) {
  const { ethBalance, balances, prices, isDarkMode, walletName } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const realBalances: Record<string, number> = { ...balances, ETH: parseFloat(ethBalance) || 0 };

  const assetsList = Object.keys(realBalances)
    .map(symbol => {
      const price     = prices[symbol]?.usd ?? 0;
      const change24h = prices[symbol]?.change24h ?? 0;
      return { symbol, amount: realBalances[symbol], usd: realBalances[symbol] * price, change24h };
    })
    .sort((a, b) => b.usd - a.usd);

  const totalUsd = assetsList.reduce((acc, a) => acc + a.usd, 0);

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)' }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>ASSETS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Feather name="search" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={[styles.avatar, { borderColor: T.border, backgroundColor: T.surfaceLow }]}>
            <Text style={{ color: T.primary, fontWeight: '800', fontSize: 14 }}>
              {walletName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Balance gradient card */}
        <View style={styles.balanceContainer}>
          <LinearGradient
            colors={['#ff544e', '#8b201f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editorialGradient}
          >
            <Text style={styles.totalSubtitle}>Total Balance Equivalent</Text>
            <Text style={styles.totalValue}>
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {(() => {
              const avgChange = assetsList.reduce((s, a) => s + a.change24h, 0) / (assetsList.length || 1);
              const isUp = avgChange >= 0;
              return (
                <View style={styles.changeRow}>
                  <View style={[styles.changeBadge, { backgroundColor: isUp ? '#85f3fe' : '#fecaca' }]}>
                    <Text style={[styles.changeBadgeText, { color: isUp ? '#002022' : '#7f1d1d' }]}>
                      {isUp ? '+' : ''}{avgChange.toFixed(2)}%
                    </Text>
                  </View>
                  <Text style={styles.changeMuted}>24h change</Text>
                </View>
              );
            })()}
            <View style={styles.decorativeGlow} />
          </LinearGradient>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { borderBottomColor: T.border }]}>
          <TouchableOpacity style={[styles.activeTab, { borderBottomColor: T.primary }]} activeOpacity={0.9}>
            <Text style={[styles.activeTabText, { color: T.text }]}>Crypto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inactiveTab} activeOpacity={0.7}>
            <Text style={[styles.inactiveTabText, { color: T.textMuted }]}>Fiat</Text>
          </TouchableOpacity>
        </View>

        {/* Assets list */}
        <View style={styles.assetList}>
          {assetsList.map(a => {
            if (a.amount <= 0) return null;
            const isUp = a.change24h >= 0;
            return (
              <TouchableOpacity
                key={a.symbol}
                style={[styles.assetCard, { backgroundColor: T.surfaceLow }]}
                activeOpacity={0.8}
              >
                <View style={styles.assetLeft}>
                  <View style={[styles.coinWrapper, { backgroundColor: T.surface, borderColor: T.border }]}>
                    <CoinIcon symbol={a.symbol} size={40} />
                  </View>
                  <View style={styles.assetInfo}>
                    <Text style={[styles.assetName, { color: T.text }]}>{COIN_META[a.symbol]?.name ?? a.symbol}</Text>
                    <Text style={[styles.assetSymbol, { color: T.textMuted }]}>{a.symbol}</Text>
                  </View>
                </View>
                <View style={styles.assetValBox}>
                  <Text style={[styles.assetAmountNum, { color: T.text }]}>
                    {a.amount.toFixed(4)} {a.symbol}
                  </Text>
                  <Text style={[styles.assetUsd, { color: T.textMuted }]}>
                    ${a.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.assetChange, { color: isUp ? T.success : T.error }]}>
                    {isUp ? '▲' : '▼'} {Math.abs(a.change24h).toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {assetsList.every(a => a.amount <= 0) && (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={32} color={T.border} style={{ marginBottom: 16 }} />
              <Text style={{ color: T.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Empty Portfolio</Text>
              <Text style={{ color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
                Your assets will appear here once you have a balance.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  iconBtn: { padding: 8, borderRadius: 20 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 110 },

  balanceContainer: { marginBottom: 28, marginTop: 8 },
  editorialGradient: {
    padding: 24, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#ff544e', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  totalSubtitle: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  totalValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1, color: '#FFFFFF' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  changeBadge: { backgroundColor: '#85f3fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  changeBadgeText: { color: '#002022', fontSize: 12, fontWeight: '700' },
  changeMuted: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  decorativeGlow: {
    position: 'absolute', right: -40, bottom: -40, width: 160, height: 160,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 80,
  },

  tabsContainer: { flexDirection: 'row', gap: 32, marginBottom: 28, borderBottomWidth: 1 },
  activeTab: { paddingBottom: 12, borderBottomWidth: 2 },
  activeTabText: { fontSize: 14, fontWeight: '700' },
  inactiveTab: { paddingBottom: 12 },
  inactiveTabText: { fontSize: 14, fontWeight: '500' },

  assetList: { gap: 12 },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 20,
  },
  assetLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinWrapper: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  assetInfo: { justifyContent: 'center' },
  assetName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  assetSymbol: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

  assetValBox: { alignItems: 'flex-end' },
  assetAmountNum: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  assetUsd: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  assetChange: { fontSize: 11, fontWeight: '700' },

  emptyBox: { padding: 40, alignItems: 'center' },
});
