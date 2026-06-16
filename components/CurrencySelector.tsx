import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '../constants';
import { haptics } from '../utils/haptics';

import { SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';

const CURRENCIES = Object.values(SUPPORTED_FIAT_CURRENCIES);

export type CurrencyCode = string;

interface CurrencySelectorProps {
  visible: boolean;
  onClose: () => void;
  currentCurrency: CurrencyCode;
  onSelect: (currency: CurrencyCode) => void;
  T: any;
}

export const CurrencySelector = memo(({ visible, onClose, currentCurrency, onSelect, T }: CurrencySelectorProps) => {
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
            {CURRENCIES.map(currency => {
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

export const getCurrencyMeta = (code: CurrencyCode) =>
  CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];

export const formatCurrency = (amount: number, currency: CurrencyCode) => {
  const meta = getCurrencyMeta(currency);
  const converted = amount * meta.rate;
  if (currency === 'JPY' || currency === 'VND') return `\u200E${meta.symbol} ${Math.round(converted).toLocaleString()}`;
  return `\u200E${meta.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
