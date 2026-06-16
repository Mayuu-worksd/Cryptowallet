import React from 'react';
import { Text, TextStyle, StyleSheet, View } from 'react-native';
import getSymbolFromCurrency from 'currency-symbol-map';
import Svg, { Path } from 'react-native-svg';

const AedSymbol = ({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) => (
  // We use negative translateY to vertically align the SVG with the text baseline natively
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: [{ translateY: size * 0.15 }] }}>
    {/* D shape */}
    <Path d="M5 4V20H12C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4H5Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Two horizontal strokes */}
    <Path d="M2 10H22M2 14H22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

interface CurrencyTextProps {
  amount: number | string;
  code: string;
  style?: TextStyle | TextStyle[];
  hideBalance?: boolean;
}

export const CurrencyText = ({ amount, code, style, hideBalance = false }: CurrencyTextProps) => {
  const flattened = StyleSheet.flatten(style || {});
  const fontSize = flattened.fontSize || 16;
  const color = flattened.color || '#FFFFFF';
  
  const amountStr = typeof amount === 'number' 
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(amount) 
    : amount;
    
  // Strip trailing zeros if it's over 2 decimals
  const cleanAmt = typeof amount === 'number' ? amountStr.replace(/(\.[0-9]{2}[0-9]*?)0+$/, '$1').replace(/\.$/, '') : amountStr;
  
  const displayAmt = hideBalance ? '••••' : cleanAmt;

  if (code === 'AED') {
    return (
      <Text style={style}>
        <AedSymbol size={fontSize * 0.9} color={color as string} />
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
