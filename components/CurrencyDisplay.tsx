import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useWallet } from '../store/WalletContext';
import AedSymbol from './AedSymbol';
import { SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';

interface CurrencyDisplayProps {
  amountUSD: number;
  style?: any;
  hideBalance?: boolean;
}

export default function CurrencyDisplay({ amountUSD, style, hideBalance = false }: CurrencyDisplayProps) {
  const { fiatCurrency, formatFiat } = useWallet() as any;
  
  if (hideBalance) {
     return <Text style={style}>••••</Text>;
  }

  const fiat = SUPPORTED_FIAT_CURRENCIES[fiatCurrency] || SUPPORTED_FIAT_CURRENCIES['USD'];

  // Special handling for the new AED symbol
  if (fiatCurrency === 'AED') {
    const converted = amountUSD * fiat.rate;
    const formattedNum = converted.toLocaleString(fiat.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const flattenedStyle = StyleSheet.flatten(style) || {};
    const color = flattenedStyle.color || '#fff';
    const fontSize = flattenedStyle.fontSize || 16;
    const iconSize = fontSize * 0.85; // slightly smaller than text so it looks proportional

    return (
      <View style={[styles.inlineRow, { padding: 0, margin: 0, backgroundColor: 'transparent' }]}>
        <AedSymbol color={color} width={iconSize} height={iconSize} style={{ marginRight: 4, marginTop: 1 }} />
        <Text style={style}>{formattedNum}</Text>
      </View>
    );
  }

  return <Text style={style}>{formatFiat(amountUSD)}</Text>;
}

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
