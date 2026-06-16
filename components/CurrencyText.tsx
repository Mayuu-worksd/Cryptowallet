import React from 'react';
import { Text, TextStyle, StyleSheet, View } from 'react-native';
import getSymbolFromCurrency from 'currency-symbol-map';
import { SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';
import AedSymbol from './AedSymbol';

interface CurrencyTextProps {
  amount: number | string;
  code: string;
  style?: TextStyle | TextStyle[];
  hideBalance?: boolean;
  skipConversion?: boolean;
  decimals?: number;
}

export const CurrencyText = ({ amount, code, style, hideBalance = false, skipConversion = false, decimals }: CurrencyTextProps) => {
  const flattened = StyleSheet.flatten(style || {});
  const fontSize = flattened.fontSize || 16;
  const color = flattened.color || '#FFFFFF';
  
  const fiatConfig = SUPPORTED_FIAT_CURRENCIES[code] || SUPPORTED_FIAT_CURRENCIES['USD'];
  const rate = fiatConfig?.rate ?? 1.0;
  const locale = fiatConfig?.locale ?? 'en-US';

  const convertedAmt = typeof amount === 'number' ? (skipConversion ? amount : amount * rate) : amount;
  
  let amountStr: string | number = convertedAmt;
  if (typeof convertedAmt === 'number') {
    let minDecimals = 2;
    let maxDecimals = 2;
    
    if (decimals !== undefined) {
      minDecimals = decimals;
      maxDecimals = decimals;
    } else {
      if (fiatConfig?.code === 'JPY' || fiatConfig?.code === 'VND') {
        minDecimals = 0;
        maxDecimals = 0;
      }
    }

    amountStr = convertedAmt.toLocaleString(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals
    });
  }
    
  const cleanAmt = typeof convertedAmt === 'number' && typeof amountStr === 'string' 
    ? amountStr.replace(/(\.[0-9]{2}[0-9]*?)0+$/, '$1').replace(/\.$/, '') 
    : amountStr;
  
  const displayAmt = hideBalance ? '••••' : cleanAmt;

  if (code === 'AED') {
    return (
      <Text style={style}>
        <AedSymbol size={fontSize * 0.85} color={color as string} style={{ transform: [{ translateY: fontSize * 0.15 }] }} />
        <Text style={style}> {displayAmt}</Text>
      </Text>
    );
  }

  const symbol = getSymbolFromCurrency(code) || code;
  return (
    <Text style={style}>
      {symbol}{displayAmt}
    </Text>
  );
};
