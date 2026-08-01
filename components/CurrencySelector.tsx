import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '../constants';
import { haptics } from '../utils/haptics';

import { useWallet } from '../store/WalletContext';

export type CurrencyCode = string;

interface CurrencySelectorProps {
  visible: boolean;
  onClose: () => void;
  currentCurrency: CurrencyCode;
  onSelect: (currency: CurrencyCode) => void;
  T: any;
}

export const CurrencySelector = memo(({ visible, onClose, currentCurrency, onSelect, T }: CurrencySelectorProps) => {
  const { fiatRates } = useWallet();
  const currenciesList = Object.values(fiatRates || {});

  const handleSelect = (currency: CurrencyCode) => {
    haptics.selection();
    onSelect(currency);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: T.surface }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: T.text }]}>Select Currency</Text>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {currenciesList.map(currency => {
              const active = currency.code === currentCurrency;
              return (
                <TouchableOpacity
                  key={currency.code}
                  style={[styles.row, { backgroundColor: active ? T.primary + '15' : 'transparent' }]}
                  onPress={() => handleSelect(currency.code as CurrencyCode)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.symbolBox, { backgroundColor: active ? T.primary : T.surfaceLow, borderColor: active ? T.primary : T.border }]}>
                    <Text style={[styles.symbol, { color: active ? '#FFF' : T.text }]}>{currency.flag || currency.symbol}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.code, { color: T.text }]}>{currency.code}</Text>
                    <Text style={[styles.name, { color: T.textMuted }]}>{currency.name}</Text>
                  </View>
                  {active
                    ? <Feather name="check-circle" size={18} color={T.primary} />
                    : <View style={[styles.radioOuter, { borderColor: T.border }]} />
                  }
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const OFFLINE_SEED: Record<string, any> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.0, locale: 'en-US', format: 'en-US', flag: '🇺🇸' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate: 7.23, locale: 'zh-CN', format: 'zh-CN', flag: '🇨🇳' },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate: 89.5, locale: 'ru-RU', format: 'ru-RU', flag: '🇷🇺' },
  UZS: { code: 'UZS', symbol: 'UZS', name: 'Uzbekistan Som', rate: 12600.0, locale: 'uz-UZ', format: 'uz-UZ', flag: '🇺🇿' },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rate: 278.5, locale: 'ur-PK', format: 'ur-PK', flag: '🇵🇰' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', rate: 25400.0, locale: 'vi-VN', format: 'vi-VN', flag: '🇻🇳' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rate: 16300.0, locale: 'id-ID', format: 'id-ID', flag: '🇮🇩' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', rate: 58.5, locale: 'fil-PH', format: 'fil-PH', flag: '🇵🇭' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', rate: 3.67, locale: 'en-US', format: 'en-US', flag: '🇦🇪' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', rate: 36.5, locale: 'th-TH', format: 'th-TH', flag: '🇹🇭' }
};

export const getCurrencyMeta = (code: CurrencyCode) =>
  OFFLINE_SEED[code] || OFFLINE_SEED['USD'];

export const formatCurrency = (amount: number, currency: CurrencyCode) => {
  const meta = getCurrencyMeta(currency);
  const converted = amount * meta.rate;
  if (currency === 'JPY' || currency === 'VND') return `${meta.symbol} ${Math.round(converted).toLocaleString()}`;
  return `${meta.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 64,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
  },
  symbolBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  symbol: { fontSize: 18, fontFamily: Fonts.extraBold },
  rowInfo: { flex: 1 },
  code: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  name: { fontSize: 12, fontFamily: Fonts.medium },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
