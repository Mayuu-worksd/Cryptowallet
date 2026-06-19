import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Theme } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, StatusBar, Dimensions, RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import Toast from '../components/Toast';
import CreateCardFlow from '../components/card/CreateCardFlow';
import { adminSettingsService } from '../services/supabaseService';
import { CardCredentialsWidget } from '../components/card/CardNumberDisplay';
import EditCardSheet from '../components/card/EditCardSheet';
import SetCurrenciesSheet from '../components/card/SetCurrenciesSheet';
import TransactionDetailsSheet from '../components/card/TransactionDetailsSheet';
import { CurrencyText } from '../components/CurrencyText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CRIMSON = '#EC2629';
const COINS = ['ETH', 'USDT'] as const;
const ICONS = ['🛍️','🍔','☕','🎬','✈️','🏥','🎮','🏠','⚡','💊','📦','🎵'];

type CustomMerchant = { name: string; amount: string; icon: string; currency?: string };
type CardSkin = 'standard' | 'solana' | 'nature';
type PhysicalTier = 'Classic' | 'Gold' | 'Platinum' | 'Travel';

const PHYSICAL_GRADIENTS: Record<PhysicalTier, readonly [string, string, string]> = {
  Classic:  ['#2B2B30', '#18181A', '#0D0D0E'] as const,
  Gold:     ['#E5A93C', '#996515', '#4A3B18'] as const,
  Platinum: ['#E5E7EB', '#9CA3AF', '#374151'] as const,
  Travel:   ['#1E3A8A', '#0F172A', '#050515'] as const,
};

const PHYSICAL_LABELS: Record<PhysicalTier, string> = {
  Classic:  'CLASSIC EDITION',
  Gold:     'GOLD CENTURION',
  Platinum: 'PLATINUM STELLAR',
  Travel:   'TRAVEL EXPEDITION',
};

const PHYSICAL_DESCRIPTIONS: Record<PhysicalTier, string> = {
  Classic:  'Solid matte slate card. Perfect for effortless daily transactions and international ATM withdrawals.',
  Gold:     'Elite Emperor Gold finished metal card. Crafted for global business travelers and high-tier cashbacks.',
  Platinum: 'Solid space platinum steel card. Heavyweight physical profile featuring bespoke concierge privileges.',
  Travel:   'Deep Aero Indigo composite shell card. Zero foreign transaction fees and accelerated flight points.',
};

const DEFAULT_PHYSICAL_PRICES_USD: Record<PhysicalTier, number> = {
  Classic:  0,
  Gold:     49.99,
  Platinum: 99.99,
  Travel:   79.99,
};

export default function CardScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const {
    cardFrozen, toggleFreezeCard, reportLostCard,
    cardDetails, cardTransactions, cardCreated,
    balances, ethBalance, spendCard, cardBalance,
    isDarkMode, network,
    createCard, updateCardDetails, kycStatus,
    refreshCardData, refreshBalance, accountType,
    formatFiat, fiatSymbol, fiatCurrency, convertFiat,
    enabledCardCurrencies,
  } = useWallet() as any;
  const { prices } = useMarket();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [activeTab, setActiveTab] = useState<'virtual' | 'physical'>('virtual');
  const [selectedSkin, setSelectedSkin] = useState<CardSkin>('standard');
  const [physicalTier, setPhysicalTier] = useState<PhysicalTier>('Classic');

  // Swipe Scroll Refs for snap actions
  const virtualScrollRef = useRef<ScrollView>(null);
  const physicalScrollRef = useRef<ScrollView>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showSpend, setShowSpend] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const [merchant, setMerchant] = useState<CustomMerchant>({ name: '', amount: '', icon: '🛍️', currency: 'USD' });
  const [loading, setLoading] = useState(false);
  
  const [toast, setToast] = useState({
    visible: false, message: '', type: 'success' as 'success' | 'error' | 'info',
  });
  const [refreshing, setRefreshing] = useState(false);

  const [physicalPrices, setPhysicalPrices] = useState(DEFAULT_PHYSICAL_PRICES_USD);
  useEffect(() => {
    adminSettingsService.getSetting('physical_card_prices', DEFAULT_PHYSICAL_PRICES_USD)
      .then(setPhysicalPrices).catch(() => {});
  }, []);

  const STABLE_FALLBACK: Record<string, number> = {
    ETH: 3500, BTC: 65000, USDT: 1, USDC: 1, SOL: 150, BNB: 600, XRP: 0.5, TON: 7.5, TRX: 0.12, SUI: 1.8,
  };

  const realBalances = useMemo(() => {
    const isTron = network === "TRON" || network === "TRON Nile";
    return {
      ETH: isTron ? 0 : parseFloat(ethBalance || '0') || 0,
      TRX: isTron ? (balances.TRX ?? 0) : 0,
      USDC: isTron
        ? (balances.USDC_TRC20 ?? balances.USDC ?? 0)
        : (balances.USDC_ERC20 ?? balances.USDC ?? 0),
      USDT: isTron
        ? (balances.USDT_TRC20 ?? balances.USDT ?? 0)
        : (balances.USDT_ERC20 ?? balances.USDT ?? 0),
      BTC: balances.BTC ?? 0,
      SOL: balances.SOL ?? 0,
      BNB: balances.BNB ?? 0,
      XRP: balances.XRP ?? 0,
      TON: balances.TON ?? 0,
      SUI: balances.SUI ?? 0,
    };
  }, [ethBalance, balances, network]);

  const totalWalletUsd = useMemo(() => {
    let total = 0;
    for (const [sym, amount] of Object.entries(realBalances)) {
      const livePrice = prices[sym]?.usd;
      const price = livePrice !== undefined && livePrice > 0 ? livePrice : (STABLE_FALLBACK[sym] ?? 0);
      total += amount * price;
    }
    return total;
  }, [realBalances, prices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshCardData(), refreshBalance()]);
    setRefreshing(false);
  }, [refreshCardData, refreshBalance]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  // Handle scanned merchant routing
  useEffect(() => {
    if (!route?.params?.qrMerchant) return;
    setMerchant(route.params.qrMerchant);
    setShowSpend(true);
    navigation.setParams({ qrMerchant: undefined });
  }, [route?.params?.qrMerchant]);

  // Handle initial tab routing
  useEffect(() => {
    if (route?.params?.initialTab === 'physical') {
      setActiveTab('physical');
      navigation.setParams({ initialTab: undefined });
    }
  }, [route?.params?.initialTab]);

  const handleCardCreated = (holderName: string) => {
    createCard(holderName, selectedSkin === 'standard' ? 'dark' : selectedSkin === 'solana' ? 'neon' : 'emerald');
    setShowCreate(false);
    showToast('Vault Card successfully activated', 'success');
  };

  const handleSpend = async () => {
    const amtUSD = parseFloat(merchant.amount);
    if (!merchant.name.trim()) { showToast('Enter a merchant name', 'error'); return; }
    if (isNaN(amtUSD) || amtUSD <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amtUSD > 10000) { showToast(`Exceeds limit (10,000)`, 'error'); return; }
    if (cardFrozen) { showToast('Card is frozen. Unfreeze to spend.', 'error'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const ok = spendCard('ETH', amtUSD, `${merchant.icon} ${merchant.name.trim()}`, merchant.currency || 'USD');
    setLoading(false);
    if (ok) {
      showToast(`Paid ${amtUSD.toFixed(2)} ${merchant.currency || 'USD'} to ${merchant.name.trim()}`, 'success');
      setMerchant({ name: '', amount: '', icon: '🛍️' });
      setShowSpend(false);
    } else showToast('Insufficient combined wallet balance.', 'error');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showToast(`${label} copied to clipboard`, 'success');
  };

  const formattedCardNumber = useMemo(() => {
    if (!cardCreated) return '•••• •••• •••• ••••';
    const num = cardDetails.number.replace(/\s/g, '');
    return `•• ${num.slice(-4)}`;
  }, [cardDetails.number, cardCreated]);

  // Build the enabled fiat list for the payment panel dynamically
  const FIAT_ALL = ['USD','EUR','AED','GBP','INR','AUD','SGD','SAR','KWD','BHD','THB','VND','RUB','JPY','HKD'];
  const enabledFiatList = useMemo(
    () => FIAT_ALL.filter(c => enabledCardCurrencies[c] !== false).slice(0, 6),
    [enabledCardCurrencies]
  );
  const FIAT_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', AED: 'د.إ', GBP: '£', INR: '₹',
    AUD: 'A$', SGD: 'S$', SAR: '﷼', KWD: 'KD', BHD: 'BD',
    THB: '฿', VND: '₫', RUB: '₽', JPY: '¥', HKD: 'HK$',
  };

  // Skin configurations for virtual
  const skinStyles = useMemo(() => {
    switch (selectedSkin) {
      case 'solana':
        return {
          colors: ['#2E0854', '#1E1B4B', '#000000'] as const,
          brandText: 'SOLANA EDITION',
          accentColor: '#14F195',
          cardText: '#FFFFFF',
        };
      case 'nature':
        return {
          colors: ['#064E3B', '#022C22', '#000000'] as const,
          brandText: 'ORGANIC LEAF',
          accentColor: '#10B981',
          cardText: '#FFFFFF',
        };
      case 'standard':
      default:
        return {
          colors: ['#1C1B1B', '#161515', '#0E0D0D'] as const,
          brandText: 'CRYPTOWALLET',
          accentColor: '#EC2629',
          cardText: '#FFFFFF',
        };
    }
  }, [selectedSkin]);

  // Dynamic user name for display on card face
  const cardFaceHolderName = useMemo(() => {
    if (cardCreated && cardDetails?.holderName) {
      return cardDetails.holderName.toUpperCase();
    }
    return 'CARD HOLDER';
  }, [cardCreated, cardDetails]);

  // Dynamic selector on swiping virtual cards
  const onVirtualScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (index === 0 && selectedSkin !== 'standard') setSelectedSkin('standard');
    else if (index === 1 && selectedSkin !== 'solana') setSelectedSkin('solana');
    else if (index === 2 && selectedSkin !== 'nature') setSelectedSkin('nature');
  };

  // Dynamic selector on swiping physical cards (Classic, Gold, Platinum, Travel)
  const onPhysicalScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (index === 0 && physicalTier !== 'Classic') setPhysicalTier('Classic');
    else if (index === 1 && physicalTier !== 'Gold') setPhysicalTier('Gold');
    else if (index === 2 && physicalTier !== 'Platinum') setPhysicalTier('Platinum');
    else if (index === 3 && physicalTier !== 'Travel') setPhysicalTier('Travel');
  };

  const handleIndicatorPress = (skin: CardSkin, index: number) => {
    setSelectedSkin(skin);
    virtualScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handlePhysicalIndicatorPress = (tier: PhysicalTier, index: number) => {
    setPhysicalTier(tier);
    physicalScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  if (showCreate) {
    return <CreateCardFlow onComplete={handleCardCreated} onCancel={() => setShowCreate(false)} />;
  }

  if (kycStatus !== 'verified') {
    return (
      <View style={[styles.root, { backgroundColor: T.background, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Feather name="shield" size={64} color={T.primary} style={{ marginBottom: 24 }} />
        <Text style={{ color: T.text, fontSize: 24, fontFamily: 'Inter_900Black', marginBottom: 12, letterSpacing: -0.5 }}>Identity Verification</Text>
        <Text style={{ color: T.textMuted, fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center', marginHorizontal: 40, marginBottom: 40, lineHeight: 22 }}>
          Complete your KYC verification to unlock premium Virtual and Physical cards.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(accountType === 'business' ? 'BusinessKYCResult' : 'KYCIntro')}
          style={[styles.applyButton, { backgroundColor: T.text, width: '80%', height: 60 }]}
          activeOpacity={0.9}
        >
          <Text style={[styles.applyButtonText, { color: T.background }]}>Complete KYC Verification</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* Dynamic Header with Premium Back Arrow */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={20} color={T.text} />
            </TouchableOpacity>
          )}
          <Text style={[styles.pageTitle, { color: T.text }]}>Cards</Text>
        </View>
        
        {cardCreated && (
          <TouchableOpacity
            style={[styles.refreshCircle, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={T.primary} />
              : <Feather name="refresh-cw" size={15} color={T.text} />}
          </TouchableOpacity>
        )}
      </View>

      {/* Pill Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: T.surfaceLow }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('virtual')}
          style={[styles.tabButton, activeTab === 'virtual' && [styles.tabButtonActive, { backgroundColor: T.surface }]]}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabButtonText, { color: T.textDim }, activeTab === 'virtual' && { color: T.text }]}>
            Virtual card
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('physical')}
          style={[styles.tabButton, activeTab === 'physical' && [styles.tabButtonActive, { backgroundColor: T.surface }]]}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabButtonText, { color: T.textDim }, activeTab === 'physical' && { color: T.text }]}>
            Physical card
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          cardCreated ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.primary}
              colors={[T.primary]}
            />
          ) : undefined
        }
      >
        {/* ────────────────── LANDING / CAROUSEL STATE ────────────────── */}
        {(!cardCreated || activeTab === 'physical') ? (
          <View style={styles.landingWrapper}>
            
            {/* Horizontal Swipeable Card Pager */}
            {activeTab === 'virtual' ? (
              <View style={styles.carouselWrapper}>
                <ScrollView
                  ref={virtualScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onVirtualScroll}
                  scrollEventThrottle={16}
                  style={styles.carouselScroll}
                  contentContainerStyle={styles.carouselContent}
                >
                  {/* Skin 1: Standard Card */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={['#1C1B1B', '#161515', '#0E0D0D']} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={styles.cardChip}>
                        <View style={styles.chipLineHorizontal} />
                        <View style={styles.chipLineVertical} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: '#EC2629' }]} />
                        <Text style={styles.brandRotatedText}>CRYPTOWALLET</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Skin 2: Solana Edition */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={['#2E0854', '#1E1B4B', '#000000']} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={[styles.cardChip, { backgroundColor: '#14F195', borderColor: '#19FB9B' }]}>
                        <View style={[styles.chipLineHorizontal, { backgroundColor: '#0B8A54' }]} />
                        <View style={[styles.chipLineVertical, { backgroundColor: '#0B8A54' }]} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: '#14F195' }]} />
                        <Text style={styles.brandRotatedText}>SOLANA EDITION</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Skin 3: Organic Leaf */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={['#064E3B', '#022C22', '#000000']} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={styles.cardChip}>
                        <View style={styles.chipLineHorizontal} />
                        <View style={styles.chipLineVertical} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.brandRotatedText}>ORGANIC LEAF</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>
                </ScrollView>
              </View>
            ) : (
              /* Physical swiping card selector (Classic, Gold, Platinum, Travel) */
              <View style={styles.carouselWrapper}>
                <ScrollView
                  ref={physicalScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onPhysicalScroll}
                  scrollEventThrottle={16}
                  style={styles.carouselScroll}
                  contentContainerStyle={styles.carouselContent}
                >
                  {/* Tier 1: Classic Slate */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={PHYSICAL_GRADIENTS.Classic} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={styles.cardChip}>
                        <View style={styles.chipLineHorizontal} />
                        <View style={styles.chipLineVertical} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: CRIMSON }]} />
                        <Text style={styles.brandRotatedText}>{PHYSICAL_LABELS.Classic}</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Tier 2: Gold Centurion */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={PHYSICAL_GRADIENTS.Gold} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={[styles.cardChip, { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' }]}>
                        <View style={[styles.chipLineHorizontal, { backgroundColor: '#6B7280' }]} />
                        <View style={[styles.chipLineVertical, { backgroundColor: '#6B7280' }]} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: '#FFFFFF' }]} />
                        <Text style={styles.brandRotatedText}>{PHYSICAL_LABELS.Gold}</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Tier 3: Platinum Stellar */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={PHYSICAL_GRADIENTS.Platinum} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={styles.cardChip}>
                        <View style={styles.chipLineHorizontal} />
                        <View style={styles.chipLineVertical} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(0,0,0,0.3)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: CRIMSON }]} />
                        <Text style={[styles.brandRotatedText, { color: '#131313' }]}>{PHYSICAL_LABELS.Platinum}</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={[styles.cardFaceHolderLabel, { color: 'rgba(0,0,0,0.4)' }]}>CARD HOLDER</Text>
                        <Text style={[styles.cardFaceHolderName, { color: '#131313' }]}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={[styles.visaRotatedText, { color: '#131313' }]}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Tier 4: Travel Expedition */}
                  <View style={styles.carouselItem}>
                    <LinearGradient colors={PHYSICAL_GRADIENTS.Travel} style={[styles.portraitCard, styles.shadowWrapper]}>
                      <View style={styles.glow} />
                      <View style={styles.cardChip}>
                        <View style={styles.chipLineHorizontal} />
                        <View style={styles.chipLineVertical} />
                      </View>
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: '#14F195' }]} />
                        <Text style={styles.brandRotatedText}>{PHYSICAL_LABELS.Travel}</Text>
                      </View>
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={styles.cardFaceHolderLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardFaceHolderName}>{cardFaceHolderName}</Text>
                      </View>
                      <View style={styles.visaRotatedContainer}>
                        <Text style={styles.visaRotatedText}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Description card details below swiper */}
            <Text style={[styles.standardCardTitle, { color: T.text }]}>
              {activeTab === 'virtual' 
                ? (selectedSkin === 'standard' ? 'Standard card' : selectedSkin === 'solana' ? 'Solana edition' : 'Organic Leaf')
                : `${physicalTier} Metal Smartcard`}
            </Text>
            
            <Text style={[styles.standardCardSubtitle, { color: T.textMuted }]}>
              {activeTab === 'virtual' ? (
                selectedSkin === 'standard' 
                  ? 'Works with Apple & Google Pay. Accepted by 130M+ merchants worldwide.'
                  : selectedSkin === 'solana'
                    ? 'Unlock exclusive Web3 features and direct Solana native balance payments.'
                    : 'Eco-friendly smartcard made of biodegradable organic elements.'
              ) : (
                PHYSICAL_DESCRIPTIONS[physicalTier]
              )}
            </Text>

            {/* Selection indicators */}
            {activeTab === 'virtual' ? (
              <View style={styles.indicatorContainer}>
                {[
                  { key: 'standard', color: '#1C1B1B' },
                  { key: 'solana', color: '#9945FF' },
                  { key: 'nature', color: '#10B981' }
                ].map((s, idx) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => handleIndicatorPress(s.key as CardSkin, idx)}
                    style={[styles.indicatorDot, selectedSkin === s.key && styles.indicatorDotActive, { backgroundColor: s.color }]}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.indicatorContainer}>
                {(['Classic', 'Gold', 'Platinum', 'Travel'] as PhysicalTier[]).map((tier, idx) => {
                  const isActive = physicalTier === tier;
                  const indicatorColor = tier === 'Gold' ? '#E5A93C' : tier === 'Platinum' ? '#9CA3AF' : tier === 'Travel' ? '#3B82F6' : '#1C1B1B';
                  return (
                    <TouchableOpacity
                      key={tier}
                      onPress={() => handlePhysicalIndicatorPress(tier, idx)}
                      style={[styles.indicatorDot, isActive && styles.indicatorDotActive, { backgroundColor: indicatorColor }]}
                    />
                  );
                })}
              </View>
            )}

            {/* Action Bottom Pill */}
            {activeTab === 'virtual' ? (
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={[styles.applyButton, { backgroundColor: T.text }]}
                activeOpacity={0.9}
              >
                <Text style={[styles.applyButtonText, { color: T.background }]}>Create a Virtual Card</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate(kycStatus === 'verified' ? 'ApplyPhysicalCard' : 'KYCIntro', { preselectedVariant: physicalTier })}
                style={[styles.applyButton, { backgroundColor: T.text }]}
                activeOpacity={0.9}
              >
                <Text style={[styles.applyButtonText, { color: T.background }]}>
                  {kycStatus === 'verified' 
                    ? <>Order {physicalTier} Card · {physicalPrices[physicalTier] === 0 ? 'Free' : <CurrencyText amount={physicalPrices[physicalTier]} code={fiatCurrency} />}</>
                    : 'Verify KYC to order'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* ────────────────── ACTIVE WALLET LEDGER STATE ────────────────── */
          <View style={styles.activeWrapper}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: T.textMuted, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>Card Balance</Text>
              <Text style={{ fontSize: 32, color: T.text, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1 }}>
                {balanceHidden ? '****' : <CurrencyText amount={totalWalletUsd} code={fiatCurrency} />}
              </Text>
            </View>
            
            {/* Swipable active card preview */}
            <View style={[styles.carouselWrapper, { marginLeft: -24 }]}>
              <ScrollView
                ref={virtualScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onVirtualScroll}
                scrollEventThrottle={16}
                style={styles.carouselScroll}
                contentContainerStyle={styles.carouselContent}
              >
                {/* Skin 1: Standard Card */}
                <View style={styles.carouselItem}>
                  <LinearGradient colors={['#1C1B1B', '#161515', '#0E0D0D']} style={[styles.portraitCard, styles.shadowWrapper, cardFrozen && { opacity: 0.65 }]}>
                    <View style={styles.glow} />
                    <View style={styles.cardChip}>
                      <View style={styles.chipLineHorizontal} />
                      <View style={styles.chipLineVertical} />
                    </View>
                    <View style={styles.cardWifi}>
                      <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                    </View>
                    <View style={styles.brandRotatedContainer}>
                      <View style={[styles.brandDot, { backgroundColor: '#EC2629' }]} />
                      <Text style={styles.brandRotatedText}>CRYPTOWALLET</Text>
                    </View>
                    <View style={[styles.cardFaceHolderWrap, { bottom: 20, left: 24 }]}>
                      <Text style={[styles.cardFaceHolderName, { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 }]}>{cardFrozen ? '**** **** **** ****' : formattedCardNumber}</Text>
                    </View>
                    <View style={[styles.visaRotatedContainer, { right: 24, bottom: 20, transform: [{ rotate: '0deg' }] }]}>
                      <Text style={[styles.visaRotatedText, { fontSize: 24, fontStyle: 'italic', fontFamily: 'Inter_900Black' }]}>VISA</Text>
                    </View>
                    {cardFrozen && (
                      <View style={[styles.frozenOverlay, { backgroundColor: 'rgba(236,38,41,0.4)', borderRadius: 24 }]}>
                        <MaterialCommunityIcons name="snowflake" size={36} color="#FFFFFF" />
                        <Text style={[styles.frozenText, { fontSize: 16, marginTop: 8 }]}>Frozen</Text>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                {/* Skin 2: Solana Edition */}
                <View style={styles.carouselItem}>
                  <LinearGradient colors={['#2E0854', '#1E1B4B', '#000000']} style={[styles.portraitCard, styles.shadowWrapper, cardFrozen && { opacity: 0.65 }]}>
                    <View style={styles.glow} />
                    <View style={[styles.cardChip, { backgroundColor: '#14F195', borderColor: '#19FB9B' }]}>
                      <View style={[styles.chipLineHorizontal, { backgroundColor: '#0B8A54' }]} />
                      <View style={[styles.chipLineVertical, { backgroundColor: '#0B8A54' }]} />
                    </View>
                    <View style={styles.cardWifi}>
                      <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                    </View>
                    <View style={styles.brandRotatedContainer}>
                      <View style={[styles.brandDot, { backgroundColor: '#14F195' }]} />
                      <Text style={styles.brandRotatedText}>SOLANA EDITION</Text>
                    </View>
                    <View style={[styles.cardFaceHolderWrap, { bottom: 20, left: 24 }]}>
                      <Text style={[styles.cardFaceHolderName, { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 }]}>{cardFrozen ? '**** **** **** ****' : formattedCardNumber}</Text>
                    </View>
                    <View style={[styles.visaRotatedContainer, { right: 24, bottom: 20, transform: [{ rotate: '0deg' }] }]}>
                      <Text style={[styles.visaRotatedText, { fontSize: 24, fontStyle: 'italic', fontFamily: 'Inter_900Black' }]}>VISA</Text>
                    </View>
                    {cardFrozen && (
                      <View style={[styles.frozenOverlay, { backgroundColor: 'rgba(236,38,41,0.4)', borderRadius: 24 }]}>
                        <MaterialCommunityIcons name="snowflake" size={36} color="#FFFFFF" />
                        <Text style={[styles.frozenText, { fontSize: 16, marginTop: 8 }]}>Frozen</Text>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                {/* Skin 3: Organic Leaf */}
                <View style={styles.carouselItem}>
                  <LinearGradient colors={['#064E3B', '#022C22', '#000000']} style={[styles.portraitCard, styles.shadowWrapper, cardFrozen && { opacity: 0.65 }]}>
                    <View style={styles.glow} />
                    <View style={styles.cardChip}>
                      <View style={styles.chipLineHorizontal} />
                      <View style={styles.chipLineVertical} />
                    </View>
                    <View style={styles.cardWifi}>
                      <Feather name="wifi" size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                    </View>
                    <View style={styles.brandRotatedContainer}>
                      <View style={[styles.brandDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.brandRotatedText}>ORGANIC LEAF</Text>
                    </View>
                    <View style={[styles.cardFaceHolderWrap, { bottom: 20, left: 24 }]}>
                      <Text style={[styles.cardFaceHolderName, { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 }]}>{cardFrozen ? '**** **** **** ****' : formattedCardNumber}</Text>
                    </View>
                    <View style={[styles.visaRotatedContainer, { right: 24, bottom: 20, transform: [{ rotate: '0deg' }] }]}>
                      <Text style={[styles.visaRotatedText, { fontSize: 24, fontStyle: 'italic', fontFamily: 'Inter_900Black' }]}>VISA</Text>
                    </View>
                    {cardFrozen && (
                      <View style={[styles.frozenOverlay, { backgroundColor: 'rgba(236,38,41,0.4)', borderRadius: 24 }]}>
                        <MaterialCommunityIcons name="snowflake" size={36} color="#FFFFFF" />
                        <Text style={[styles.frozenText, { fontSize: 16, marginTop: 8 }]}>Frozen</Text>
                      </View>
                    )}
                  </LinearGradient>
                </View>
              </ScrollView>
            </View>

            {/* Active Pager Indicators */}
            <View style={[styles.indicatorContainer, { marginTop: -12, marginBottom: 20 }]}>
              {[
                { key: 'standard', color: '#1C1B1B' },
                { key: 'solana', color: '#9945FF' },
                { key: 'nature', color: '#10B981' }
              ].map((s, idx) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => handleIndicatorPress(s.key as CardSkin, idx)}
                  style={[styles.indicatorDot, selectedSkin === s.key && styles.indicatorDotActive, { backgroundColor: s.color }]}
                />
              ))}
            </View>

            {/* Action buttons (RedotPay style) */}
            <View style={[styles.circularActionsContainer, { marginBottom: 20 }]}>
              {cardFrozen ? (
                <>
                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
                      onPress={async () => {
                        try {
                          await reportLostCard();
                          showToast('Report sent to admin. Support will contact you shortly.', 'info');
                        } catch (e) {
                          showToast('Failed to send report. Please try again.', 'error');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="credit-card" size={22} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Report lost</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.text, borderColor: T.text }]} 
                      onPress={() => { toggleFreezeCard(); }} 
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="snowflake" size={24} color={T.background} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Unfreeze</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} activeOpacity={0.7}>
                      <Feather name="trash-2" size={22} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Delete card</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: showCreds ? T.primary + '20' : T.surface, borderColor: showCreds ? T.primary : T.border }]} 
                      onPress={() => setShowCreds(v => !v)} 
                      activeOpacity={0.7}
                    >
                      <Feather name={showCreds ? "eye-off" : "eye"} size={22} color={showCreds ? T.primary : T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>View</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
                      onPress={() => { setShowCreds(false); setShowSpend(false); toggleFreezeCard(); }} 
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="snowflake" size={24} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Freeze</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
                      onPress={() => setShowSpend(v => !v)} 
                      activeOpacity={0.7}
                    >
                      <Feather name="sliders" size={22} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Limit</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
                      onPress={() => setShowEdit(true)}
                      activeOpacity={0.7}
                    >
                      <Feather name="settings" size={22} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Settings</Text>
                  </View>

                  <View style={styles.circularActionWrap}>
                    <TouchableOpacity 
                      style={[styles.circularBtn, { backgroundColor: T.surface, borderColor: T.border }]} 
                      onPress={() => setShowCurrencies(true)}
                      activeOpacity={0.7}
                    >
                      <Feather name="dollar-sign" size={22} color={T.text} />
                    </TouchableOpacity>
                    <Text style={[styles.circularActionLabel, { color: T.text }]}>Currency</Text>
                  </View>
                </>
              )}
            </View>

            {/* Credentials Panel */}
            {!cardFrozen && showCreds && (
              <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                <CardCredentialsWidget
                  cardNumber={cardDetails?.number || ''}
                  expiry={cardDetails?.expiry || ''}
                  cvv={cardDetails?.cvv || ''}
                  holderName={cardDetails?.holderName || ''}
                  textColor={T.text}
                  accentColor={T.primary}
                  mutedColor={T.textMuted}
                  widgetBg={T.surfaceLow}
                  widgetBorder={T.border}
                />
              </View>
            )}

            {/* Pay Collapsible Panel */}
            {showSpend && (
              <View style={[styles.interactivePanel, { backgroundColor: T.surface, borderColor: T.border }, styles.shadowWrapper]}>
                <View style={styles.panelHeader}>
                  <Text style={[styles.panelTitle, { color: T.text }]}>Card Payment</Text>
                  <TouchableOpacity onPress={() => { setShowSpend(false); setMerchant({ name: '', amount: '', icon: '🛍️' }); }}>
                    <Feather name="x" size={16} color={T.textDim} />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ICONS.map(ic => (
                      <TouchableOpacity
                        key={ic}
                        onPress={() => setMerchant(p => ({ ...p, icon: ic }))}
                        style={[
                          styles.emojiBox,
                          { backgroundColor: T.surfaceLow, borderColor: T.border },
                          merchant.icon === ic && [styles.emojiBoxActive, { borderColor: T.primary }],
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{ic}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={[styles.inputLabel, { color: T.textDim }]}>MERCHANT NAME</Text>
                <View style={[styles.inputPill, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <TextInput
                    style={[styles.textInput, { color: T.text }]}
                    placeholder="e.g. Netflix, Amazon Prime..."
                    placeholderTextColor={T.textDim}
                    value={merchant.name}
                    onChangeText={v => setMerchant(p => ({ ...p, name: v }))}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.inputLabel, { color: T.textDim, marginBottom: 0 }]}>AMOUNT</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: 8 }}>
                    {enabledFiatList.map(cur => (
                      <TouchableOpacity
                        key={cur}
                        onPress={() => setMerchant(p => ({ ...p, currency: cur }))}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: merchant.currency === cur ? T.primary + '30' : T.surfaceLow, borderWidth: 1, borderColor: merchant.currency === cur ? T.primary : T.border }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: merchant.currency === cur ? T.primary : T.textDim }}>{cur}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={[styles.inputPill, { backgroundColor: T.surfaceLow, borderColor: T.border, marginTop: 0 }]}>
                  <Text style={{ color: T.text, fontSize: 15, marginRight: 6 }}>
                    {FIAT_SYMBOLS[merchant.currency ?? 'USD'] ?? '$'}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { color: T.text }]}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    value={merchant.amount}
                    onChangeText={v => setMerchant(p => ({ ...p, amount: v.replace(/[^0-9.]/g, '') }))}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.panelConfirmBtn, { backgroundColor: T.text },
                    (!merchant.name.trim() || !merchant.amount || loading) && { opacity: 0.5 }]}
                  onPress={handleSpend}
                  disabled={!merchant.name.trim() || !merchant.amount || loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={T.background} />
                  ) : (
                    <Text style={[styles.panelConfirmBtnText, { color: T.background }]}>
                      {merchant.name.trim() && merchant.amount
                        ? `Pay ${formatFiat(parseFloat(merchant.amount))}`
                        : 'Confirm Swipe'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Transactions Header */}
            <View style={styles.transactionsHeader}>
              <Text style={[styles.transactionsTitle, { color: T.text }]}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History', { filter: 'Card' })}>
                <Text style={[styles.viewAllText, { color: T.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>

            {/* Ledger Transactions */}
            <View style={[styles.premiumWidget, { backgroundColor: T.surface, borderColor: T.border, padding: 6 }, styles.shadowWrapper]}>
              {cardTransactions.filter((tx: any) => tx.type !== 'topup').length === 0 ? (
                <View style={styles.emptyActivity}>
                  <Feather name="activity" size={24} color={T.textDim} />
                  <Text style={[styles.emptyTextTitle, { color: T.textDim }]}>No transactions recorded</Text>
                </View>
              ) : (
                cardTransactions.filter((tx: any) => tx.type !== 'topup').slice(0, 5).map((tx: any, i: number, arr: any[]) => (
                  <TouchableOpacity
                    key={tx.id}
                    style={[
                      styles.txRow,
                      { borderBottomColor: T.border },
                      i < arr.length - 1 && styles.txBorder,
                    ]}
                    onPress={() => setSelectedTransaction(tx)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.txIconWrap,
                      { backgroundColor: tx.type === 'topup' ? 'rgba(0,200,83,0.08)' : 'rgba(236,38,41,0.08)' }
                    ]}>
                      <Feather
                        name={tx.type === 'topup' ? 'download' : 'shopping-bag'}
                        size={13}
                        color={tx.type === 'topup' ? '#00C853' : T.primary}
                      />
                    </View>
                    
                    <View style={styles.txDetailWrap}>
                      <Text style={[styles.txLabel, { color: T.text }]} numberOfLines={1}>{tx.label}</Text>
                      <Text style={[styles.txDate, { color: T.textDim }]}>
                        {new Date(tx.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </View>

                    <Text style={[styles.txAmount, { color: tx.type === 'topup' ? '#00C853' : T.text }]}>
                      {tx.type === 'topup' ? '+' : '−'}
                      <CurrencyText amount={tx.amount} code={fiatCurrency} />
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <SetCurrenciesSheet 
        visible={showCurrencies}
        onClose={() => setShowCurrencies(false)}
        cardNumber={cardDetails?.number || ''}
      />
      
      <TransactionDetailsSheet 
        visible={!!selectedTransaction}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      {cardCreated && (
        <EditCardSheet
          visible={showEdit}
          currentName={cardDetails?.holderName || ''}
          currentDesign={cardDetails?.design || 'dark'}
          cardNumber={cardDetails?.number || ''}
          expiry={cardDetails?.expiry || ''}
          onSave={(patch) => {
            updateCardDetails(patch);
            showToast('Card updated successfully', 'success');
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pageTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  refreshCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 99,
    padding: 4,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: { paddingBottom: 120 },
  
  landingWrapper: {
    alignItems: 'stretch',
    paddingHorizontal: 0,
  },
  carouselWrapper: {
    width: SCREEN_WIDTH,
    height: 390,
    marginBottom: 16,
  },
  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitCard: {
    width: 230,
    height: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  shadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E5A93C', 
    position: 'absolute',
    top: 100,
    left: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#D4942A',
    padding: 3,
  },
  chipLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
    height: 1,
    backgroundColor: '#B57C1E',
  },
  chipLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    width: 1,
    backgroundColor: '#B57C1E',
  },
  cardWifi: {
    position: 'absolute',
    top: 105,
    right: 24,
  },
  brandRotatedContainer: {
    position: 'absolute',
    top: 75,
    right: -35,
    transform: [{ rotate: '90deg' }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandRotatedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 4,
    opacity: 0.85,
  },
  cardFaceHolderWrap: {
    position: 'absolute',
    bottom: 50,
    right: 24,
    alignItems: 'flex-end',
  },
  cardFaceHolderLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardFaceHolderName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  visaRotatedContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    transform: [{ rotate: '270deg' }],
  },
  visaRotatedText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  standardCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
    marginTop: 10,
  },
  standardCardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 28,
    marginBottom: 20,
    fontWeight: '500',
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
    alignItems: 'center',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.35,
  },
  indicatorDotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
    opacity: 1,
  },
  circlesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    justifyContent: 'center',
  },
  variantCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  variantCircleActive: {
    borderColor: '#EC2629',
  },
  circleInner: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  applyButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  activeWrapper: {
    paddingHorizontal: 24,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  frozenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 12,
  },

  /* Premium Widget panels */
  premiumWidget: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  premiumWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  premiumTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumWidgetTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  revealBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailRow: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailValueMono: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    flex: 1,
  },
  detailDigit: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    includeFontPadding: false,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  gridColumn: {
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  
  /* Balance ledger styling */
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  activeCurrencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 4,
    opacity: 0.7,
  },
  activeBalanceText: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  activeUsdtTag: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  activeNetworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  networkStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeNetworkText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  circularActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  circularActionWrap: {
    alignItems: 'center',
    gap: 10,
  },
  circularBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  circularActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  appleWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  appleWalletIconWrap: {
    width: 32,
    height: 22,
    backgroundColor: 'rgba(120,120,120,0.1)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleWalletText: {
    fontSize: 15,
    fontWeight: '800',
  },

  interactivePanel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  tokenPill: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tokenPillActive: {
    backgroundColor: 'rgba(236,38,41,0.1)',
  },
  tokenPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputPill: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  maxText: {
    fontWeight: '900',
    fontSize: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  successText: {
    fontSize: 11,
    fontWeight: '800',
  },
  panelConfirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emojiBoxActive: {
    backgroundColor: 'rgba(236,38,41,0.15)',
  },

  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 12,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyActivity: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTextTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  txBorder: {
    borderBottomWidth: 1,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetailWrap: {
    flex: 1,
    marginLeft: 12,
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  txDate: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
});
