import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { SUPPORTED_TOKENS } from '../constants/currencyConfig';

const LOGOS: Record<string, string> = {
  ETH:  'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  DAI:  'https://assets.coingecko.com/coins/images/9956/large/4943.png',
  BTC:  'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  SOL:  'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  BNB:  'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  XRP:  'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  TON:  'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
  TRX:  'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
  SUI:  'https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg',
};

const COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(SUPPORTED_TOKENS).map(([k, v]) => [k, v.color])
);

interface Props {
  token: string;
  size?: number;
}

export default function TokenIcon({ token, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const uri   = LOGOS[token];
  const color = COLORS[token] ?? '#888';

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22',
      borderWidth: 1.5, borderColor: color + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        color,
        fontSize: size * 0.38,
        fontFamily: 'Inter_800ExtraBold',
        includeFontPadding: false,
      }} allowFontScaling={false}>
        {token.slice(0, 2)}
      </Text>
    </View>
  );
}
