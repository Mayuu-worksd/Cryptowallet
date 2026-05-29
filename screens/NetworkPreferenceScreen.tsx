import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { NETWORK_INFO } from '../constants';

const { width } = Dimensions.get('window');

const NETWORKS = [
  { id: 'TRON', name: 'TRON', icon: 'TRX', desc: 'High-speed layer-1 for TRC20 tokens', type: 'Mainnet', color: '#EF0027' },
  { id: 'TRON Nile', name: 'TRON Nile', icon: 'TRX', desc: 'TRON testnet network', type: 'Testnet', color: '#FF6B6B' },
  { id: 'Ethereum', name: 'Ethereum', icon: '⟠', desc: 'Secure mainnet with high fees', type: 'Mainnet', color: '#627EEA' },
  { id: 'Polygon', name: 'Polygon', icon: '⬟', desc: 'Fast & cheap Layer 2 solution', type: 'Mainnet', color: '#8247E5' },
  { id: 'Arbitrum', name: 'Arbitrum', icon: '◆', desc: 'Optimistic rollup scaling', type: 'Mainnet', color: '#28A0F0' },
  { id: 'Solana', name: 'Solana', icon: 'SOL', desc: 'High-speed Solana network', type: 'Mainnet', color: '#9945FF' },
  { id: 'Sepolia', name: 'Sepolia', icon: '⟠', desc: 'Ethereum testnet for development', type: 'Testnet', color: '#FFC107' },
  { id: 'Solana Devnet', name: 'Solana Devnet', icon: 'SOL', desc: 'Solana developer testnet network', type: 'Testnet', color: '#14F195' },
];

export default function NetworkPreferenceScreen({ onSelect }: { onSelect: (network: string) => void }) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  
  const [selectedNetwork, setSelectedNetwork] = useState('TRON');
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    // Check if this is first time setup
    AsyncStorage.getItem('cw_network_preference_set').then(val => {
      setIsFirstTime(!val);
    });
  }, []);

  const handleContinue = async () => {
    // Save network preference and mark as set
    await AsyncStorage.setItem('cw_network', selectedNetwork);
    await AsyncStorage.setItem('cw_network_preference_set', 'true');
    onSelect(selectedNetwork);
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Custom Header */}
      <View style={[styles.customHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.headerIcon, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerBrand, { color: T.text }]}>CRYPTOWALLET</Text>
        <TouchableOpacity style={[styles.headerIcon, { backgroundColor: T.surfaceLow }]}>
          <View style={styles.userDot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* STEP 03 */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>STEP 03</Text>
          <Text style={[styles.sectionTitle, { color: T.text }]}>Network Preference</Text>
          <Text style={[styles.sectionDesc, { color: T.textDim }]}>
            Choose your preferred blockchain network. You can change this later in Settings.
          </Text>
          
          {NETWORKS.map((network) => (
            <TouchableOpacity 
              key={network.id}
              style={[
                styles.networkCard, 
                { 
                  backgroundColor: T.surface, 
                  borderColor: selectedNetwork === network.id ? '#FF1E1E' : T.border 
                }
              ]}
              onPress={() => setSelectedNetwork(network.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.networkIcon, { backgroundColor: T.surfaceLow }]}>
                  <Text style={[styles.networkEmoji, { color: network.color }]}>{network.icon}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: network.type === 'Testnet' ? '#FFC107' : '#4CAF50' }]}>
                  <Text style={[styles.badgeText, { color: '#FFF' }]}>{network.type.toUpperCase()}</Text>
                </View>
              </View>
              
              <Text style={[styles.networkName, { color: T.text }]}>{network.name}</Text>
              <Text style={[styles.networkDesc, { color: T.textDim }]}>{network.desc}</Text>
              
              <View style={[styles.divider, { backgroundColor: T.border }]} />
              
              <View style={styles.featureRow}>
                <Feather 
                  name={selectedNetwork === network.id ? "check-circle" : "circle"} 
                  size={14} 
                  color={selectedNetwork === network.id ? "#FF1E1E" : T.textDim} 
                />
                <Text style={[styles.featureText, { color: T.text }]}>
                  {network.type === 'Testnet' ? 'Free transactions' : 'Real transactions'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>START WALLET</Text>
        </TouchableOpacity>

        <Text style={[styles.securityNotice, { color: T.textDim }]}>
          {NETWORK_INFO[selectedNetwork]?.type === 'Testnet' 
            ? 'TESTNET MODE — NO REAL FUNDS AT RISK' 
            : 'MAINNET MODE — REAL CRYPTOCURRENCY TRANSACTIONS'
          }
        </Text>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF1E1E',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  stepLabel: {
    color: '#FF1E1E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  networkCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  networkIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkEmoji: {
    fontSize: 24,
    fontWeight: '900',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  networkName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  networkDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '700',
  },
  continueBtn: {
    backgroundColor: '#FF1E1E',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  continueBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  securityNotice: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 24,
  },
});