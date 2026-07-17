import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '../utils/haptics';
import Toast from './Toast';
import { Theme, Fonts } from '../constants';
import { useWallet } from '../store/WalletContext';

export interface CopyableAddressProps {
  address: string;
  type?: 'evm' | 'tron' | 'uid' | 'text';
  variant?: 'inline' | 'compact-pill' | 'box';
  showAddress?: boolean;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pillStyle?: StyleProp<ViewStyle>;
  pillColor?: string;
  label?: string; // Optional label for box layout
}

export default function CopyableAddress({
  address,
  type = 'text',
  variant = 'inline',
  showAddress = true,
  iconSize = 14,
  style,
  textStyle,
  pillStyle,
  pillColor,
  label,
}: CopyableAddressProps) {
  const { isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    haptics.success();

    let message = 'Wallet address copied.';
    if (type === 'evm') {
      message = 'EVM address copied.';
    } else if (type === 'tron') {
      message = 'TRON address copied.';
    } else if (type === 'uid') {
      message = 'User ID copied.';
    } else if (type === 'text') {
      message = 'Copied to clipboard.';
    }
    setToastMessage(message);
    setToastVisible(true);
  }, [address, type]);

  const hideToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  if (variant === 'compact-pill') {
    const isUid = type === 'uid';
    const displayIcon = isUid ? 'hash' : 'link';
    const displayText = isUid 
      ? `UID: ${address}` 
      : (address ? `${address.slice(0, 5)}...${address.slice(-4)}` : 'No wallet');

    return (
      <View>
        <TouchableOpacity
          onPress={handleCopy}
          style={[
            styles.compactPill,
            { backgroundColor: pillColor ? pillColor + '15' : T.primary + '15' },
            pillStyle,
          ]}
          activeOpacity={0.7}
        >
          <Feather name={displayIcon as any} size={10} color={pillColor || T.primary} />
          <Text style={[styles.compactPillText, { color: pillColor || T.primary }, textStyle]}>
            {displayText}
          </Text>
        </TouchableOpacity>
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type="success"
          onHide={hideToast}
          isDarkMode={isDarkMode}
        />
      </View>
    );
  }

  if (variant === 'box') {
    return (
      <View style={{ width: '100%' }}>
        <TouchableOpacity
          style={[styles.addressBox, { backgroundColor: T.surface, borderColor: T.border }, style]}
          onPress={handleCopy}
          activeOpacity={0.9}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            {type === 'uid' ? (
              <Text style={[styles.uidDisplayValue, { color: T.text }, textStyle]}>{address}</Text>
            ) : (
              <Text style={[styles.addressValue, { color: T.text }, textStyle]} numberOfLines={1}>
                {address}
              </Text>
            )}
            <Text style={[styles.addressMeta, { color: T.textDim || T.textMuted }]}>
              {label || (type === 'uid' ? 'Share this UID to receive payments' : `${type === 'tron' ? 'TRON' : 'EVM'} Receiver Address`)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.copyIconButton, { backgroundColor: T.surfaceLow }]}
            onPress={handleCopy}
          >
            <Feather name="copy" size={18} color={T.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type="success"
          onHide={hideToast}
          isDarkMode={isDarkMode}
        />
      </View>
    );
  }

  // variant === 'inline' (default)
  return (
    <View style={styles.inlineWrapper}>
      <TouchableOpacity
        onPress={handleCopy}
        style={[styles.inlineContainer, style]}
        activeOpacity={0.6}
      >
        {showAddress && (
          <Text style={[styles.inlineText, { color: T.text }, textStyle]}>
            {address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}
          </Text>
        )}
        <Feather name="copy" size={iconSize} color={T.primary} style={{ marginLeft: showAddress ? 4 : 0 }} />
      </TouchableOpacity>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={hideToast}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compactPillText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
  },
  uidDisplayValue: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  addressMeta: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  copyIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
