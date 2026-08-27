import React, { useState, useMemo, memo, useEffect, useCallback, useRef } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Image, Animated, RefreshControl, StatusBar, Modal, Pressable, ActivityIndicator
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import Toast from '../components/Toast';
import { CurrencySelector } from '../components/CurrencySelector';
import { CurrencyText } from '../components/CurrencyText';
import { haptics } from '../utils/haptics';
import { supabase } from '../services/supabaseClient';
import { P2POrder } from '../services/merchantService';
const FLAG_MAP: Record<string, string> = {
  THB: '🇹🇭', PKR: '🇵🇰', AED: '🇦🇪', CNY: '🇨🇳', RUB: '🇷🇺',
  UZS: '🇺🇿', VND: '🇻🇳', IDR: '🇮🇩', PHP: '🇵🇭', INRX: '🇮🇳'
};

const CoinIcon = memo(({ symbol, size = 40 }: { symbol: string; size?: number }) => {
  const meta = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const flag = FLAG_MAP[symbol];
  const [failed, setFailed] = useState(false);

  if (meta?.iconUrl && !failed) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }

  if (flag) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: (color || '#007AFF') + '20',
        borderWidth: 1.5, borderColor: (color || '#007AFF') + '40',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.52 }}>{flag}</Text>
      </View>
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


const FIAT_META: Record<string, { color: string }> = {
  USD: { color: '#2E7D32' },
  EUR: { color: '#1A237E' },
  INR: { color: '#E65100' },
  GBP: { color: '#1565C0' },
  AED: { color: '#006064' },
  SGD: { color: '#C62828' },
  JPY: { color: '#B71C1C' },
  CAD: { color: '#BF360C' },
  AUD: { color: '#0D47A1' },
  BRL: { color: '#1B5E20' },
  THB: { color: '#0288D1' },
  BHD: { color: '#D32F2F' },
  VND: { color: '#C62828' },
  SAR: { color: '#2E7D32' },
  KWD: { color: '#00897B' },
  RUB: { color: '#1976D2' },
};

const FiatIcon = memo(({ code, size = 40 }: { code: string; size?: number }) => {
  const { fiatRates } = useWallet();
  const flag = fiatRates[code]?.flag || '💵';
  const meta = FIAT_META[code] ?? { color: '#37474F' };
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: meta.color + '20',
      borderWidth: 1.5, borderColor: meta.color + '40',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.52 }}>{flag}</Text>
    </View>
  );
});

const STABLE_FALLBACK: Record<string, number> = { 
  ETH: 3500, 
  BTC: 65000, 
  USDT: 1, 
  USDC: 1, 
  INRX: 0.012,
  SOL: 150, 
  BNB: 600, 
  XRP: 0.50, 
  TON: 7.5, 
  TRX: 0.12, 
  SUI: 1.80,
  // Custom stablecoins — pegged to fiat, price = 1/fiat_rate_vs_USD
  THB: 0.028,   // 1 THB ≈ $0.028
  PKR: 0.0036,  // 1 PKR ≈ $0.0036
  AED: 0.272,   // 1 AED ≈ $0.272
  CNY: 0.138,   // 1 CNY ≈ $0.138
  RUB: 0.011,   // 1 RUB ≈ $0.011
  UZS: 0.000078,// 1 UZS ≈ $0.000078
  VND: 0.000039,// 1 VND ≈ $0.000039
  IDR: 0.000062,// 1 IDR ≈ $0.000062
  PHP: 0.017,   // 1 PHP ≈ $0.017
};

// Sleek redotpay styled crypto row
const CryptoAssetRow = memo(({ a, T, isUp, prices, formatFiat, balanceVisible, onPress, fiatCurrency, fiatRates, isFavorite, onToggleFavorite }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  
  let price = prices[a.symbol]?.usd ?? STABLE_FALLBACK[a.symbol] ?? 0;
  if (price === 0 && fiatRates && fiatRates[a.symbol]) {
    const rate = Number(fiatRates[a.symbol].rate || 1);
    if (rate > 0) {
      price = 1 / rate;
    }
  }
  const usdValue = a.available * price;
  const changePercent = prices[a.symbol]?.change24h ?? a.change24h ?? 0;

  return (
    <TouchableOpacity
      style={[styles.assetRow, { borderColor: T.border + '30' }]}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, tension: 350, friction: 18, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start()}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }, { transform: [{ scale }] }]}>
        <View style={styles.assetLeft}>
          <TouchableOpacity
            style={{ paddingRight: 10, paddingLeft: 4, justifyContent: 'center', alignItems: 'center' }}
            onPress={(e) => {
              e.stopPropagation();
              haptics.selection();
              onToggleFavorite(a.symbol);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={20}
              color={isFavorite ? "#FFD700" : T.textDim}
            />
          </TouchableOpacity>
          <CoinIcon symbol={a.symbol} size={42} />
          <View style={styles.assetInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.assetSymbol, { color: T.text }]}>{COIN_META[a.symbol]?.symbol ?? a.symbol.replace('_TRC20', '').replace('_ERC20', '')}</Text>
              {a.locked > 0 && (
                <View style={[styles.lockedBadgeMini, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Feather name="lock" size={9} color="#FFA500" />
                  <Text style={styles.lockedTextMini}>{a.locked.toFixed(2)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.assetName, { color: T.textDim }]}>{COIN_META[a.symbol]?.name ?? a.symbol}</Text>
          </View>
        </View>

        <View style={styles.assetRight}>
          <Text style={[styles.assetAmountNum, { color: T.text }]}>
            {balanceVisible ? a.available.toFixed(4) : '••••'}
          </Text>
          {balanceVisible ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <CurrencyText amount={usdValue} code={fiatCurrency} style={[styles.assetUsd, { color: T.textDim }]} />
            </View>
          ) : (
            <Text style={[styles.assetUsd, { color: T.textDim }]}>≈ ••••</Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// Sleek redotpay styled fiat row
const FiatAssetRow = memo(({ item, T, balanceVisible, onPress }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={[styles.assetRow, { borderColor: T.border + '30' }]}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, tension: 350, friction: 18, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start()}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }, { transform: [{ scale }] }]}>
        <View style={styles.assetLeft}>
          <FiatIcon code={item.code} size={42} />
          <View style={styles.assetInfo}>
            <Text style={[styles.assetSymbol, { color: T.text }]}>{item.code} Wallet</Text>
            <Text style={[styles.assetName, { color: T.textDim }]}>{item.name}</Text>
          </View>
        </View>

        <View style={styles.assetRight}>
          <Text style={[styles.assetAmountNum, { color: T.text }]}>
            {balanceVisible ? item.formattedBalance : '••••'}
          </Text>
          <Text style={[styles.assetUsd, { color: T.textDim }]}>
            Local Account
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function PortfolioScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    ethBalance, balances, isDarkMode, walletAddress, lockedBalance,
    formatFiat, convertFiat, fiatSymbol, fiatCurrency, setFiatCurrency, formatOrderFiat,
    balanceVisible, toggleBalanceVisible, fiatRates, network, favoriteTokens, toggleFavorite
  } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const [activeOrders, setActiveOrders] = useState<P2POrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'crypto' | 'fiat'>('crypto');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [fiatDepositModal, setFiatDepositModal] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [hideZeroBalances, setHideZeroBalances] = useState(true);

  const { refreshBalance } = useWallet();

  // Fetch active Bank Accounts for Fiat Deposit
  useEffect(() => {
    if (!fiatDepositModal) {
      setBankDetails([]);
      return;
    }
    
    const fetchBanks = async () => {
      setLoadingBanks(true);
      try {
        const { data } = await supabase
          .from('admin_bank_accounts')
          .select('*')
          .eq('is_active', true)
          .eq('currency', fiatDepositModal.code);
          
        if (data) setBankDetails(data);
      } catch (e) {
        console.log('Error fetching banks', e);
      } finally {
        setLoadingBanks(false);
      }
    };
    
    fetchBanks();
  }, [fiatDepositModal]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.selection();
    await refreshBalance();
    setRefreshing(false);
  }, [refreshBalance]);

  // Fetch active P2P orders
  useEffect(() => {
    if (!walletAddress) return;
    const fetchOrders = async () => {
      try {
        const { data } = await supabase
          .from('p2p_orders')
          .select('*')
          .or(`buyer_wallet.eq.${walletAddress.toLowerCase()},seller_wallet.eq.${walletAddress.toLowerCase()}`)
          .in('status', ['open', 'escrow_locked', 'payment_pending', 'payment_verification', 'crypto_released', 'disputed'])
          .order('created_at', { ascending: false });
        if (data) setActiveOrders(data);
      } catch {}
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const realBalances: Record<string, number> = useMemo(() => ({
    ETH: parseFloat(ethBalance) || 0,
    ...Object.fromEntries(
      Object.entries(balances).filter(([k]) => k !== 'ETH').map(([k, v]) => [k, v ?? 0])
    ),
  }), [ethBalance, balances]);

  const assetsList = useMemo(() => {
    const priority = ['INRX', 'USDT', 'USDC', 'ETH', 'BTC', 'SOL', 'BNB', 'XRP', 'TON', 'TRX', 'SUI'];
    
    // Append any dynamic custom/contract tokens from realBalances that are not in the priority list
    const allSymbols = [...priority];
    Object.keys(realBalances).forEach(k => {
      if (!allSymbols.includes(k)) {
        allSymbols.push(k);
      }
    });

    return allSymbols.map(symbol => {
      const balanceVal = realBalances[symbol] ?? 0;
      
      let price = prices[symbol]?.usd ?? STABLE_FALLBACK[symbol] ?? 0;
      if (price === 0 && fiatRates && fiatRates[symbol]) {
        const rate = Number(fiatRates[symbol].rate || 1);
        if (rate > 0) {
          price = 1 / rate;
        }
      }

      const change24h = prices[symbol]?.change24h ?? 0;
      const available = balanceVal - (lockedBalance[symbol] ?? 0);
      return {
        symbol,
        amount: balanceVal,
        available: Math.max(0, available),
        locked: lockedBalance[symbol] ?? 0,
        usd: balanceVal * price,
        change24h
      };
    });
  }, [realBalances, prices, lockedBalance, fiatRates]);

  const totalUsd = useMemo(() => {
    const total = assetsList.reduce((acc, a) => acc + (a.usd || 0), 0);
    console.log('[PortfolioScreen] Debug Info:', {
      realBalances,
      totalUsd: total,
      assetsList: assetsList.map(a => ({ symbol: a.symbol, amount: a.amount, usd: a.usd }))
    });
    return total;
  }, [assetsList, realBalances]);

  const fiatWalletsList = useMemo(() => {
    return Object.values(fiatRates || {}).map((f: any) => ({
      code: f.code,
      name: `${f.name} Wallet`,
      formattedBalance: balanceVisible ? formatOrderFiat(0, f.code) : '••••'
    }));
  }, [balanceVisible, fiatRates]);

  const filteredAssets = useMemo(() => {
    if (!hideZeroBalances) return assetsList;
    const nativeCoin = network.toLowerCase().includes('tron') ? 'TRX' : (network.toLowerCase().includes('solana') ? 'SOL' : (network.toLowerCase().includes('bitcoin') ? 'BTC' : 'ETH'));
    return assetsList.filter(a => {
      return a.amount > 0 || a.symbol === nativeCoin;
    });
  }, [assetsList, hideZeroBalances, network]);

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      <CurrencySelector
        visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        currentCurrency={fiatCurrency}
        onSelect={(cur) => {
          haptics.success();
          setFiatCurrency(cur);
        }}
        T={T}
      />

      {/* Fiat Deposit Detail Sheet Modal */}
      <Modal transparent visible={!!fiatDepositModal} animationType="slide" onRequestClose={() => setFiatDepositModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setFiatDepositModal(null)}>
          <Pressable style={[styles.depositSheet, { backgroundColor: T.surface }]} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.depositTitle, { color: T.text }]}>{fiatDepositModal?.code} Fiat Gateway</Text>
            
            <View style={[styles.depositInfoCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="info" size={18} color={T.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.depositInfoText, { color: T.text }]}>
                  To deposit {fiatDepositModal?.code} directly into your digital fiat wallet, please execute a standard domestic bank wire transfer using the virtual account routing coordinates below.
                </Text>
              </View>
            </View>

            {loadingBanks ? (
              <View style={[styles.coordsBox, { alignItems: 'center', paddingVertical: 40 }]}>
                <ActivityIndicator size="small" color={T.primary} />
                <Text style={{ color: T.textDim, marginTop: 12, fontFamily: Fonts.medium }}>Locating secure clearing nodes...</Text>
              </View>
            ) : bankDetails.length > 0 ? (
              <View style={styles.coordsBox}>
                {[
                  { label: 'Beneficiary Name', value: bankDetails[0].beneficiary_name },
                  { label: 'Bank Name', value: bankDetails[0].bank_name },
                  { label: 'Routing / SWIFT Number', value: bankDetails[0].routing_number },
                  { label: 'Account Number', value: bankDetails[0].account_number },
                  { label: 'Account Type', value: bankDetails[0].account_type },
                ].map((item, index) => (
                  <View key={index} style={styles.coordRow}>
                    <Text style={[styles.coordLabel, { color: T.textDim }]}>{item.label}</Text>
                    <Text style={[styles.coordValue, { color: T.text }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.coordsBox, { alignItems: 'center', paddingVertical: 40 }]}>
                <Feather name="alert-circle" size={32} color={T.textDim} style={{ marginBottom: 12, opacity: 0.5 }} />
                <Text style={{ color: T.textDim, fontFamily: Fonts.medium, textAlign: 'center' }}>
                  No active fiat gateways found for {fiatDepositModal?.code}.{'\n'}Please check back later or contact support.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.depositButton, { backgroundColor: T.primary }]}
              onPress={() => {
                haptics.selection();
                showToast('Virtual account details copied to clipboard!', 'success');
                setFiatDepositModal(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.depositButtonText}>Copy Banking Details</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} activeOpacity={0.7}>
          <Feather name="chevron-left" size={26} color={T.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row' }}><Text style={[styles.headerTitle, { color: Theme.colors.primary }]}>My </Text><Text style={[styles.headerTitle, { color: T.text }]}>Assets</Text></View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
        }
      >
        {/* Sleek Est Total Value and Selector */}
        <View style={styles.balanceArea}>
          <TouchableOpacity
            style={styles.estLabelRow}
            onPress={() => {
              haptics.selection();
              toggleBalanceVisible();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.estTitleText, { color: T.textDim }]}>Est. total value</Text>
            <Feather name="chevron-down" size={14} color={T.textDim} style={{ marginLeft: 2, marginRight: 6 }} />
            <Feather name={balanceVisible ? "eye" : "eye-off"} size={16} color={T.textDim} />
          </TouchableOpacity>

          <View style={styles.mainBalanceRow}>
            {balanceVisible ? (
              <CurrencyText amount={totalUsd} code={fiatCurrency} style={[styles.mainBalanceNum, { color: T.text }]} />
            ) : (
              <CurrencyText amount={0} code={fiatCurrency} hideBalance={true} style={[styles.mainBalanceNum, { color: T.text }]} />
            )}
            
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setShowCurrencyPicker(true);
              }}
              activeOpacity={0.75}
              style={[styles.currencyChip, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            >
              <Text style={[styles.currencyChipText, { color: T.text }]}>{fiatCurrency}</Text>
              <Feather name="chevron-down" size={12} color={T.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Quick Action Capsule Buttons */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.actionCapsule, { backgroundColor: '#FFFFFF' }]}
            onPress={() => { haptics.selection(); navigation.navigate('Receive'); }}
            activeOpacity={0.9}
          >
            <Text style={[styles.actionCapsuleText, { color: '#131313' }]}>Add funds</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCapsule, { backgroundColor: T.surfaceLow }]}
            onPress={() => { haptics.selection(); navigation.navigate('Earn'); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionCapsuleText, { color: T.text }]}>Earn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCapsule, { backgroundColor: T.surfaceLow }]}
            onPress={() => { haptics.selection(); navigation.navigate('Credit'); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionCapsuleText, { color: T.text }]}>Credit</Text>
          </TouchableOpacity>
        </View>

        {/* Active P2P Orders Panel */}
        {activeOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.orderHeaderDot, { backgroundColor: T.primary }]} />
              <Text style={[styles.sectionTitle, { color: T.text }]}>ACTIVE ESCROWS</Text>
              <View style={[styles.orderCountBadge, { backgroundColor: T.primary + '18' }]}>
                <Text style={[styles.orderCountText, { color: T.primary }]}>{activeOrders.length}</Text>
              </View>
            </View>
            
            {activeOrders.map(order => {
              const isBuyer = order.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase();
              const statusColor = order.status === 'disputed' ? T.error : (order.status === 'payment_pending' || order.status === 'payment_verification') ? '#F59E0B' : T.success;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => { haptics.selection(); navigation.navigate('P2POrderDetail', { order }); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderLeft}>
                    <View style={[styles.orderIconWrap, { backgroundColor: statusColor + '12' }]}>
                      <Feather name={isBuyer ? 'download' : 'upload'} size={15} color={statusColor} />
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={[styles.orderAmount, { color: T.text }]}>
                        {order.amount} {order.token}
                      </Text>
                      <Text style={[styles.orderStatusText, { color: T.textDim }]}>
                        {isBuyer ? 'BUYING' : 'SELLING'} • {order.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderFiatText, { color: T.text }]}>
                      {formatOrderFiat(order.fiat_total || 0, order.fiat_currency)}
                    </Text>
                    <Feather name="chevron-right" size={14} color={T.textDim} style={{ marginLeft: 6 }} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Tab Headers: Crypto & Fiat */}
        <View style={styles.tabsContainer}>
          <View style={[styles.tabsRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => { haptics.selection(); setActiveTab('crypto'); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabButtonText,
                  { color: activeTab === 'crypto' ? T.text : T.textDim, fontFamily: activeTab === 'crypto' ? Fonts.bold : Fonts.medium }
                ]}>
                  Crypto
                </Text>
                {activeTab === 'crypto' && <View style={[styles.activeTabLine, { backgroundColor: T.text }]} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => { haptics.selection(); setActiveTab('fiat'); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabButtonText,
                  { color: activeTab === 'fiat' ? T.text : T.textDim, fontFamily: activeTab === 'fiat' ? Fonts.bold : Fonts.medium }
                ]}>
                  Fiat
                </Text>
                {activeTab === 'fiat' && <View style={[styles.activeTabLine, { backgroundColor: T.text }]} />}
              </TouchableOpacity>
            </View>

            {activeTab === 'crypto' && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                onPress={() => {
                  haptics.selection();
                  setHideZeroBalances(p => !p);
                }}
                activeOpacity={0.7}
              >
                <Feather name={hideZeroBalances ? "check-square" : "square"} size={14} color={T.textDim} />
                <Text style={{ fontSize: 12, color: T.textDim, fontFamily: Fonts.medium }}>Hide 0 balances</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.tabUnderlineBorder, { backgroundColor: T.border + '25' }]} />
        </View>

        {/* Tab Content List */}
        <View style={styles.assetsListWrapper}>
          {activeTab === 'crypto' ? (
            filteredAssets.map(a => {
              const isUp = a.change24h >= 0;
              return (
                <CryptoAssetRow
                  key={a.symbol}
                  a={a}
                  T={T}
                  isUp={isUp}
                  prices={prices}
                  formatFiat={formatFiat}
                  fiatCurrency={fiatCurrency}
                  balanceVisible={balanceVisible}
                  fiatRates={fiatRates}
                  isFavorite={favoriteTokens?.includes(a.symbol)}
                  onToggleFavorite={toggleFavorite}
                  onPress={() => { haptics.selection(); navigation.navigate('CoinChart', { symbol: a.symbol }); }}
                />
              );
            })
          ) : (
            fiatWalletsList.map(item => (
              <FiatAssetRow
                key={item.code}
                item={item}
                T={T}
                balanceVisible={balanceVisible}
                onPress={() => { haptics.selection(); setFiatDepositModal(item); }}
              />
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  balanceArea: {
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  estLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estTitleText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  mainBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  mainBalanceNum: {
    fontSize: 42,
    fontFamily: Fonts.extraBold,
    letterSpacing: -1.5,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  currencyChipText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  actionCapsule: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCapsuleText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  ordersSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  orderHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.extraBold,
    letterSpacing: 1.5,
  },
  orderCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  orderCountText: {
    fontSize: 10,
    fontFamily: Fonts.extraBold,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  orderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  orderAmount: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  orderStatusText: {
    fontSize: 10,
    fontFamily: Fonts.extraBold,
    letterSpacing: 0.5,
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderFiatText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },

  tabsContainer: {
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  tabButton: {
    paddingBottom: 10,
    position: 'relative',
  },
  tabButtonText: {
    fontSize: 18,
  },
  activeTabLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
  },
  tabUnderlineBorder: {
    height: 1,
    marginTop: -1,
  },

  assetsListWrapper: {
    marginTop: 8,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  assetInfo: {
    justifyContent: 'center',
  },
  assetSymbol: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  assetName: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  lockedBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  lockedTextMini: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#FFA500',
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetAmountNum: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  assetUsd: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  depositSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: 20,
  },
  depositTitle: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    marginBottom: 16,
  },
  depositInfoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  depositInfoText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    lineHeight: 18,
  },
  coordsBox: {
    gap: 14,
    marginBottom: 24,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  coordValue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  depositButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.extraBold,
  },
});
