import React, { memo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  StyleSheet, ScrollView, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NETWORK_INFO } from '../constants';
import { Fonts } from '../constants';
import { haptics } from '../utils/haptics';

// Keys must match NETWORK_INFO exactly
const TESTNETS = ['Sepolia', 'Polygon Amoy', 'Arbitrum Sepolia', 'Base Sepolia', 'Optimism Sepolia', 'TRON Nile'];
const MAINNETS = ['Ethereum', 'Polygon', 'Arbitrum', 'TRON'];

// Real chain logos from public CDNs — no hardcoded icons
const CHAIN_LOGOS: Record<string, string> = {
  Sepolia:            'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  Ethereum:           'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  Polygon:            'https://coin-images.coingecko.com/coins/images/4713/large/matic-token-icon.png',
  'Polygon Amoy':     'https://coin-images.coingecko.com/coins/images/4713/large/matic-token-icon.png',
  Arbitrum:           'https://coin-images.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
  'Arbitrum Sepolia': 'https://coin-images.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
  'Base Sepolia':     'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  'Optimism Sepolia': 'https://coin-images.coingecko.com/coins/images/25244/large/Optimism.png',
  TRON:               'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png',
  'TRON Nile':        'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  currentNetwork: string;
  onSelect: (network: string) => void;
  T: any;
}

const NetworkRow = memo(({ network, active, onPress, T }: {
  network: string; active: boolean; onPress: () => void; T: any;
}) => {
  const info = NETWORK_INFO[network];
  if (!info) return null;
  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: active ? T.primary + '18' : T.surfaceLow }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: CHAIN_LOGOS[network] }}
        style={[styles.logo, { borderColor: info.color + '40' }]}
      />
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: T.text }]}>{info.name}</Text>
        <View style={styles.itemMeta}>
          <View style={[styles.typeBadge, {
            backgroundColor: info.type === 'Testnet' ? '#F59E0B18' : '#00C85318',
          }]}>
            <Text style={[styles.typeText, {
              color: info.type === 'Testnet' ? '#F59E0B' : '#00C853',
            }]}>{info.type}</Text>
          </View>
          <Text style={[styles.itemSymbol, { color: T.textMuted }]}>{info.symbol}</Text>
        </View>
      </View>
      {active
        ? <Feather name="check-circle" size={18} color={T.primary} />
        : <View style={[styles.radioOuter, { borderColor: T.border }]} />
      }
    </TouchableOpacity>
  );
});

export const NetworkSelector = memo(({ visible, onClose, currentNetwork, onSelect, T }: Props) => {
  const handleSelect = (network: string) => {
    haptics.selection();
    onSelect(network);
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
          <Text style={[styles.title, { color: T.text }]}>Select Network</Text>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={[styles.sectionLabel, { color: T.textMuted }]}>TESTNETS</Text>
            {TESTNETS.map(n => (
              <NetworkRow
                key={n}
                network={n}
                active={n === currentNetwork}
                onPress={() => handleSelect(n)}
                T={T}
              />
            ))}

            <Text style={[styles.sectionLabel, { color: T.textMuted, marginTop: 20 }]}>MAINNETS</Text>
            {MAINNETS.map(n => (
              <NetworkRow
                key={n}
                network={n}
                active={n === currentNetwork}
                onPress={() => handleSelect(n)}
                T={T}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

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
    maxHeight: '82%',
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: { fontSize: 10, fontFamily: Fonts.bold },
  itemSymbol: { fontSize: 11, fontFamily: Fonts.medium },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
  },
});
