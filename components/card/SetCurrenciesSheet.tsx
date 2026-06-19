import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Platform, Pressable, Switch, Image, FlatList, ListRenderItemInfo,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../../store/WalletContext';
import { SUPPORTED_FIAT_CURRENCIES, SUPPORTED_TOKENS } from '../../constants/currencyConfig';

type Props = {
  visible: boolean;
  onClose: () => void;
  cardNumber: string;
};

// Real token icons pulled directly from SUPPORTED_TOKENS config
const SETTLEMENT_TOKENS = ['USDT', 'USDC', 'ETH', 'BTC', 'BNB', 'TRX'].map(code => ({
  code,
  name: SUPPORTED_TOKENS[code]?.name ?? code,
  iconUrl: SUPPORTED_TOKENS[code]?.iconUrl ?? '',
  color: SUPPORTED_TOKENS[code]?.color ?? '#888',
  isCrypto: true,
}));

// Flag CDN — renders the country flag as a real PNG (no emoji rendering differences)
const flagUrl = (iso2: string) =>
  `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;

const FIAT_FLAG_ISO: Record<string, string> = {
  USD: 'us', INR: 'in', EUR: 'eu', GBP: 'gb', AED: 'ae',
  AUD: 'au', SGD: 'sg', RUB: 'ru', BHD: 'bh', VND: 'vn',
  SAR: 'sa', KWD: 'kw', THB: 'th', HKD: 'hk', JPY: 'jp',
};

type RowItem = {
  code: string;
  name: string;
  iconUrl: string;
  color: string;
  isCrypto: boolean;
  isHeader?: false;
} | {
  isHeader: true;
  code: string;
  label: string;
};

export default function SetCurrenciesSheet({ visible, onClose, cardNumber }: Props) {
  const { enabledCardCurrencies, setEnabledCardCurrencies } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');

  const last4 = cardNumber.replace(/\D/g, '').slice(-4) || '****';

  const toggleCurrency = useCallback((code: string) => {
    setEnabledCardCurrencies({ ...enabledCardCurrencies, [code]: !(enabledCardCurrencies[code] !== false) });
  }, [enabledCardCurrencies, setEnabledCardCurrencies]);

  const q = searchQuery.toLowerCase();

  const fiatRows = useMemo(() =>
    Object.values(SUPPORTED_FIAT_CURRENCIES)
      .filter(c => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .map(c => ({
        code: c.code,
        name: c.name,
        iconUrl: flagUrl(FIAT_FLAG_ISO[c.code] ?? c.code.slice(0, 2).toLowerCase()),
        color: '#888',
        isCrypto: false as const,
      })),
  [q]);

  const tokenRows = useMemo(() =>
    SETTLEMENT_TOKENS.filter(t => !q || t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)),
  [q]);

  // Build a flat list with header separators so there is only ONE scrollable list — no nesting
  const listData: RowItem[] = useMemo(() => {
    const items: RowItem[] = [];
    if (tokenRows.length > 0) {
      items.push({ isHeader: true, code: '__h1', label: 'SETTLEMENT TOKENS' });
      tokenRows.forEach(t => items.push({ ...t, isHeader: false as const }));
    }
    if (fiatRows.length > 0) {
      items.push({ isHeader: true, code: '__h2', label: 'FIAT CURRENCIES' });
      fiatRows.forEach(t => items.push({ ...t, isHeader: false as const }));
    }
    return items;
  }, [tokenRows, fiatRows]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<RowItem>) => {
    if (item.isHeader) {
      return <Text style={styles.sectionLabel}>{item.label}</Text>;
    }
    const isEnabled = enabledCardCurrencies[item.code] !== false;
    return (
      <View style={styles.currencyRow}>
        <View style={styles.currencyLeft}>
          <CurrencyIcon uri={item.iconUrl} color={item.color} code={item.code} isCrypto={item.isCrypto} />
          <View style={styles.labelWrap}>
            <Text style={styles.currencyCode}>{item.code}</Text>
            <Text style={styles.currencyName}>{item.name}</Text>
          </View>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={() => toggleCurrency(item.code)}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#FF3B3B' }}
          thumbColor="#FFF"
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </View>
    );
  }, [enabledCardCurrencies, toggleCurrency]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        {/* stopPropagation so taps inside the sheet don't close it */}
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 34 }} />
            <Text style={styles.headerTitle}>Set Transaction Currencies</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Manage currencies for card ending •••• {last4}
          </Text>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Single FlatList — no nested ScrollView, no scroll-blocking */}
          <FlatList
            data={listData}
            keyExtractor={item => item.code}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Icon component with real image + color fallback ──
function CurrencyIcon({ uri, color, code, isCrypto }: { uri: string; color: string; code: string; isCrypto: boolean }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.icon, isCrypto && styles.iconCrypto]}
        onError={() => setFailed(true)}
        resizeMode="cover"
      />
    );
  }
  // Fallback: colored circle with ticker initials
  return (
    <View style={[styles.icon, { backgroundColor: color + '22', borderWidth: 1.5, borderColor: color + '55' }]}>
      <Text style={[styles.iconFallbackText, { color }]}>{code.slice(0, 2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1C1B1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 550 : undefined,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2B2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 6,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconCrypto: {
    backgroundColor: '#111',
  },
  iconFallbackText: {
    fontSize: 14,
    fontWeight: '800',
  },
  labelWrap: { flex: 1 },
  currencyCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  currencyName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
