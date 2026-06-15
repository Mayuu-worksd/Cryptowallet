import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, Platform, Pressable, Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../../store/WalletContext';
import { SUPPORTED_FIAT_CURRENCIES } from '../../constants/currencyConfig';

type Props = {
  visible: boolean;
  onClose: () => void;
  cardNumber: string;
};

// Use all supported fiat currencies from config
const DISPLAY_CURRENCIES = Object.keys(SUPPORTED_FIAT_CURRENCIES);

// Add HKD and JPY if not in config
const getCurrencyDetails = (code: string) => {
  const c = SUPPORTED_FIAT_CURRENCIES[code];
  if (c) return c;
  
  if (code === 'HKD') return { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' };
  if (code === 'JPY') return { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' };
  
  return { code, name: code, flag: '🌐' };
};

export default function SetCurrenciesSheet({ visible, onClose, cardNumber }: Props) {
  const { enabledCardCurrencies, setEnabledCardCurrencies } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');

  const last4 = cardNumber.replace(/\D/g, '').slice(-4) || '****';

  const toggleCurrency = (code: string) => {
    const newVal = !enabledCardCurrencies[code];
    // If turning off the last currency, maybe show a warning, but for now just allow it
    const newSettings = { ...enabledCardCurrencies, [code]: newVal };
    setEnabledCardCurrencies(newSettings);
  };

  const filteredCurrencies = DISPLAY_CURRENCIES.filter(code => 
    code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    getCurrencyDetails(code).name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 34 }} /> {/* Spacer */}
            <Text style={styles.headerTitle}>Set Transaction Currencies</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Manage transaction currencies for card ending •••• {last4}
            </Text>

            <View style={styles.searchWrap}>
              <Feather name="search" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
              {filteredCurrencies.map((code) => {
                const details = getCurrencyDetails(code);
                const isEnabled = enabledCardCurrencies[code] !== false; // Default true if undefined

                return (
                  <View key={code} style={styles.currencyRow}>
                    <View style={styles.currencyLeft}>
                      <View style={styles.flagWrap}>
                        <Text style={styles.flag}>{details.flag}</Text>
                      </View>
                      <View>
                        <Text style={styles.currencyCode}>{details.code}</Text>
                        <Text style={styles.currencyName}>{details.name}</Text>
                      </View>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={() => toggleCurrency(code)}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#FF3B3B' }}
                      thumbColor="#FFF"
                      ios_backgroundColor="rgba(255,255,255,0.1)"
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1C1B1E', // Darker background based on the image
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%', // Taller sheet
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 550 : undefined,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  closeBtn: { 
    width: 34, height: 34, 
    alignItems: 'center', justifyContent: 'center' 
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  content: { 
    flex: 1,
    paddingHorizontal: 20, 
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    fontWeight: '500',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2B2E', // Slightly lighter than background
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  flag: {
    fontSize: 24,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  currencyName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
});
