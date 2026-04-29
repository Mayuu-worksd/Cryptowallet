import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NETWORK_INFO } from '../constants';
import { useWallet } from '../store/WalletContext';

const D = {
  background:       '#101114',
  surface:          '#1C1D21',
  surfaceLow:       '#2A2B31',
  surfaceLowest:    '#0A0A0C',
  primary:          '#FF3B3B',
  primaryContainer: '#C00018',
  onSurface:        '#FFFFFF',
  onSurfaceVariant: '#A1A5AB',
  textDim:          '#5C6068',
  success:          '#00C853',
  border:           '#2E3036',
};

const NAV_ITEMS = [
  { name: 'Home',    screen: 'Home'        },
  { name: 'Card',    screen: 'Card'        },
  { name: 'Send',    screen: 'Send'        },
  { name: 'Receive', screen: 'Receive'     },
  { name: 'Swap',    screen: 'Swap'        },
  { name: 'Assets',  screen: 'Assets'      },
  { name: 'History', screen: 'History'     },
  { name: 'Profile', screen: 'Profile'     },
  { name: 'Admin',   screen: 'Admin'       },
];

function NavItem({ item, isActive, onPress }: { item: typeof NAV_ITEMS[0]; isActive: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.navItem,
        isActive && styles.navItemActive,
        hovered && !isActive && styles.navItemHovered,
        { transform: [{ translateX: hovered && !isActive ? 4 : 0 }] }
      ]}
      onPress={onPress}
    >
      {({ hovered }: any) => (
        <>
          {isActive && (
            <LinearGradient
              colors={['#FF3B3B', '#800010']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={[styles.navDot, isActive && styles.navDotActive, hovered && !isActive && styles.navDotHovered]} />
          <Text style={[
            styles.navLabel,
            isActive && styles.navLabelActive,
            hovered && !isActive && styles.navLabelHovered,
          ]}>
            {item.name}
          </Text>
          {isActive && <View style={styles.navPill} />}
        </>
      )}
    </Pressable>
  );
}

type Props = {
  children: React.ReactNode;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  walletAddress: string;
  network: string;
};

export default function WebLayout({ children, currentScreen, onNavigate, walletAddress, network }: Props) {
  if (Platform.OS !== 'web') return <>{children}</>;
  const { walletName } = useWallet();

  const networkInfo = NETWORK_INFO[network] || { name: network, type: 'Testnet' };

  return (
    <View style={styles.root}>

      {/* Sidebar */}
      <View style={styles.sidebar}>

        {/* Gradient accent top */}
        <LinearGradient
          colors={['#2563EB10', '#004AC605']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sidebarAccent}
        />

        {/* Logo */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={['#FF3B3B', '#800010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoMarkText}>CW</Text>
          </LinearGradient>
          <View>
            <Text style={styles.logoTitle}>CryptoWallet</Text>
            <Text style={styles.logoSub}>Digital Vault</Text>
          </View>
        </View>

        {/* Network */}
        <View style={styles.networkCard}>
          <View style={styles.networkLeft}>
            <View style={styles.networkPulse}>
              <View style={styles.networkDot} />
            </View>
            <View>
              <Text style={styles.networkLabel}>Network</Text>
              <Text style={styles.networkValue}>{networkInfo.name} · {networkInfo.type}</Text>
            </View>
          </View>
          <View style={[styles.liveBadge, networkInfo.type === 'Mainnet' && { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.liveBadgeText, networkInfo.type === 'Mainnet' && { color: '#DC2626' }]}>{networkInfo.type === 'Mainnet' ? 'Mainnet' : 'Testnet'}</Text>
          </View>
        </View>

        {/* Nav label */}
        <Text style={styles.navSectionLabel}>NAVIGATION</Text>

        {/* Nav items */}
        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.name}
              item={item}
              isActive={currentScreen === item.screen}
              onPress={() => onNavigate(item.screen)}
            />
          ))}
        </ScrollView>

        <View style={styles.divider} />

        {/* Sidebar Widget: Market Pulse */}
        <View style={styles.pulseCard}>
          <View style={styles.pulseHeader}>
             <Feather name="activity" size={14} color={D.primary} />
             <Text style={styles.pulseTitle}>Market Pulse</Text>
          </View>
          <Text style={styles.pulseStatus}>BTC Market Cap +3.2%</Text>
          <Text style={styles.pulseDesc}>Volatile market conditions detected. Consider hedging options.</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Footer User Card */}
        <Pressable 
          onPress={() => onNavigate('Settings')}
          style={({ hovered }: any) => [
            styles.userCard,
            hovered && styles.userCardHovered,
          ]}
        >
          <LinearGradient
            colors={['#FF3B3B', '#800010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userAvatar}
          >
            <Text style={styles.userAvatarText}>{walletName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{walletName}</Text>
            <Text style={styles.userAddr} numberOfLines={1}>
              {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-4)}` : 'Disconnected'}
            </Text>
          </View>
          <Feather name="settings" size={16} color={D.textDim} />
        </Pressable>

      </View>

      {/* Main */}
      <View style={styles.main}>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarTitle}>{currentScreen}</Text>
            <Text style={styles.topBarSub}>CryptoWallet · Precision Transparency</Text>
          </View>
          <View style={styles.topBarRight}>
            <View style={[styles.topBarBadge, networkInfo.type === 'Mainnet' && { backgroundColor: '#FEE2E2' }]}>
              <View style={[styles.topBarDot, networkInfo.type === 'Mainnet' && { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.topBarBadgeText, networkInfo.type === 'Mainnet' && { color: '#DC2626' }]}>{networkInfo.name} {networkInfo.type}</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('Settings')}>
              <LinearGradient
                colors={['#FF3B3B', '#800010']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.topBarAvatar}
              >
                <Text style={styles.topBarAvatarText}>{walletName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.pageWrap}>
            {children}
          </View>
        </ScrollView>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: D.background,
    minHeight: '100vh' as any,
  },
  sidebar: {
    width: 280,
    backgroundColor: D.surfaceLowest,
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'column',
    position: 'relative' as any,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: D.border + '40',
  },
  sidebarAccent: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    opacity: 0.15,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 40,
    zIndex: 1,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  logoMarkText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  logoTitle: { color: D.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  logoSub: { color: D.onSurfaceVariant, fontSize: 11, marginTop: 1, textTransform: 'uppercase', letterSpacing: 1 },
  networkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: D.surfaceLow + '80',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    zIndex: 1,
    borderWidth: 1,
    borderColor: D.border + '20',
  },
  networkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  networkPulse: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: D.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.success },
  networkLabel: { color: D.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  networkValue: { color: D.onSurface, fontSize: 13, fontWeight: '700', marginTop: 2 },
  liveBadge: {
    backgroundColor: D.success + '20',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeText: { color: D.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  navSectionLabel: {
    color: D.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  navList: { flex: 1, zIndex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 6,
    gap: 14,
    position: 'relative' as any,
    overflow: 'hidden',
    cursor: 'pointer' as any,
  },
  navItemActive: { 
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  navItemHovered: { backgroundColor: D.surface + '80' },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: D.textDim,
  },
  navDotActive: { backgroundColor: '#FFF' },
  navDotHovered: { backgroundColor: D.primary },
  navLabel: {
    flex: 1,
    color: D.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '600',
  },
  navLabelActive: { color: '#FFF', fontWeight: '700' },
  navLabelHovered: { color: D.onSurface },
  navPill: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  userTierWrap: { marginBottom: 32, paddingHorizontal: 6 },
  userTierName: { color: D.onSurface, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.primary },
  tierText: { color: D.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  pulseCard: {
    backgroundColor: D.surfaceLow + '40',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: D.border + '20',
    marginTop: 20,
  },
  pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pulseTitle: { color: D.onSurfaceVariant, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  pulseStatus: { color: D.onSurface, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  pulseDesc: { color: D.textDim, fontSize: 12, lineHeight: 18 },
  divider: {
    height: 1,
    backgroundColor: D.border + '40',
    marginVertical: 24,
    zIndex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: D.surfaceLow + '60',
    borderRadius: 20,
    padding: 16,
    zIndex: 1,
    borderWidth: 1,
    borderColor: D.border + '20',
  },
  userCardHovered: {
    backgroundColor: D.surfaceLow,
    borderColor: D.primary + '40',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  userName: { color: D.onSurface, fontSize: 14, fontWeight: '700' },
  userAddr: { color: D.onSurfaceVariant, fontSize: 11, marginTop: 3, fontFamily: 'monospace', opacity: 0.7 },
  main: {
    flex: 1,
    backgroundColor: D.background,
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 24,
    backgroundColor: D.background + 'B3',
    // @ts-ignore
    backdropFilter: 'blur(12px)',
    borderBottomWidth: 1,
    borderBottomColor: D.border + '20',
    zIndex: 10,
  },
  topBarTitle: { color: D.onSurface, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  topBarSub: { color: D.onSurfaceVariant, fontSize: 13, marginTop: 4, letterSpacing: 0.5 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topBarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: D.surfaceLow + '80',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: D.border + '20',
  },
  topBarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.success },
  topBarBadgeText: { color: D.onSurface, fontSize: 13, fontWeight: '700' },
  topBarAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  topBarAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  pageScroll: { flexGrow: 1 },
  pageWrap: {
    flex: 1,
    maxWidth: 1280, // Expanded for exact stitch dashboard layout
    width: '100%',
    alignSelf: 'center' as any,
    paddingHorizontal: 48,
    paddingVertical: 48,
  },
});

