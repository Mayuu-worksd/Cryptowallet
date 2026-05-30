import React, { useState, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { haptics } from '../utils/haptics';

import { COIN_META, COIN_COLORS } from '../constants';

const { width } = Dimensions.get('window');

const CoinIcon = React.memo(({ symbol, size = 40 }: { symbol: string; size?: number }) => {
  const meta = COIN_META[symbol as keyof typeof COIN_META];
  const color = COIN_COLORS[symbol as keyof typeof COIN_COLORS] || '#888';
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
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: color + '40'
    }}>
      <Text style={{ color, fontSize: size * 0.42, fontFamily: Fonts.extraBold }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

const EARN_ASSETS = [
  { symbol: 'USDT', name: 'Tether', apv: '11.5%', color: '#26A17B' },
  { symbol: 'ETH', name: 'Ethereum', apv: '4.2%', color: '#627EEA' },
  { symbol: 'BTC', name: 'Bitcoin', apv: '1.5%', color: '#F7931A' },
  { symbol: 'USDC', name: 'USD Coin', apv: '9.8%', color: '#2775CA' },
];

export default function EarnScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [hasNotified, setHasNotified] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleNotify = () => {
    haptics.success();
    setHasNotified(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => { haptics.selection(); navigation.goBack(); }}
          style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
        >
          <Feather name="chevron-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Earn</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Premium Hero Card */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
          <LinearGradient
            colors={isDarkMode ? ['#1e1e24', '#151518', '#0d0d12'] : ['#FFFFFF', '#F9FAFB', '#F3F4F6']}
            style={[styles.heroCard, { borderColor: T.border, borderWidth: 1 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.badgeWrap}>
              <View style={[styles.betaBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.betaBadgeText, { color: isDarkMode ? '#FFF' : T.text }]}>COMING SOON</Text>
              </View>
            </View>

            <Text style={[styles.heroSub, { color: T.textDim }]}>
              Up to
            </Text>
            <View style={styles.heroMainWrap}>
              <Text style={[styles.heroMain, { color: T.text }]}>11.5</Text>
              <Text style={[styles.heroPct, { color: T.text }]}>%</Text>
              <Text style={[styles.heroApy, { color: T.primary }]}>APY</Text>
            </View>

            <Text style={[styles.heroDesc, { color: T.textDim }]}>
              Grow your crypto safely with daily compounding rewards. No lock-up periods.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Assets List */}
        <Text style={[styles.sectionTitle, { color: T.text }]}>Supported Assets</Text>

        <View style={[styles.listContainer, { backgroundColor: T.surface, borderColor: T.border }]}>
          {EARN_ASSETS.map((asset, index) => (
            <View key={asset.symbol}>
              <View style={styles.assetRow}>
                <View style={styles.assetLeft}>
                  <CoinIcon symbol={asset.symbol} size={40} />
                  <View>
                    <Text style={[styles.assetSymbol, { color: T.text }]}>{asset.symbol}</Text>
                    <Text style={[styles.assetName, { color: T.textDim }]}>{asset.name}</Text>
                  </View>
                </View>
                <View style={styles.assetRight}>
                  <Text style={[styles.assetApy, { color: T.success }]}>{asset.apv}</Text>
                  <Text style={[styles.assetApyLabel, { color: T.textDim }]}>APY</Text>
                </View>
              </View>
              {index < EARN_ASSETS.length - 1 && (
                <View style={[styles.divider, { backgroundColor: T.border }]} />
              )}
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.bottomBar, { backgroundColor: T.background, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: hasNotified ? T.surface : T.text }
          ]}
          onPress={handleNotify}
          disabled={hasNotified}
          activeOpacity={0.8}
        >
          {hasNotified ? (
            <Text style={[styles.actionButtonText, { color: T.text }]}>We'll notify you</Text>
          ) : (
            <Text style={[styles.actionButtonText, { color: T.background }]}>Notify Me When Live</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  badgeWrap: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  betaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  betaBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Fonts.extraBold,
    letterSpacing: 1,
  },
  heroSub: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: -4,
  },
  heroMainWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  heroMain: {
    fontSize: 56,
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  heroPct: {
    fontSize: 32,
    fontFamily: Fonts.extraBold,
    marginLeft: 2,
  },
  heroApy: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    marginLeft: 8,
  },
  heroDesc: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    marginBottom: 16,
  },
  listContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetSymbol: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    marginBottom: 2,
  },
  assetName: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetApy: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    marginBottom: 2,
  },
  assetApyLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
  },
});
