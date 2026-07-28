import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { ethereumService } from '../services/ethereumService';
import { storageService } from '../services/storageService';
import Toast from '../components/Toast';

export default function ImportTokenScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, network, addCustomToken } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [contractAddress, setContractAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleFetchMetadata = async () => {
    if (!contractAddress.trim()) {
      showToast('Please enter a contract address', 'error');
      return;
    }
    
    // TRON network check
    if (network === 'TRON' || network === 'TRON Nile') {
      showToast('Custom tokens on TRON are not yet supported', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const meta = await ethereumService.getCustomTokenMetadata(contractAddress, network);
      if (meta) {
        setTokenSymbol(meta.symbol);
        setTokenDecimals(String(meta.decimals));
        showToast('Token details found!', 'success');
      } else {
        showToast('Could not fetch token details on this network', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error fetching token metadata', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!contractAddress || !tokenSymbol || !tokenDecimals) {
      showToast('Please fill all fields or auto-fetch details', 'error');
      return;
    }

    const token = {
      contractAddress: contractAddress.trim(),
      symbol: tokenSymbol.toUpperCase(),
      decimals: parseInt(tokenDecimals, 10),
      network, // bind token to the current network
      isCustom: true
    };

    try {
      await addCustomToken(token);
      showToast(`${token.symbol} imported successfully!`, 'success');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e) {
      showToast('Failed to save token', 'error');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: T.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: T.text }]}>Import Token</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.infoText, { color: T.textMuted }]}>
          Anyone can create a token, including fake versions of existing tokens. Learn about scams and security risks.
        </Text>

        <View style={[styles.networkBadge, { backgroundColor: T.surface }]}>
          <Text style={[styles.networkBadgeText, { color: T.text }]}>Current Network: <Text style={{ fontFamily: Fonts.bold }}>{network}</Text></Text>
        </View>

        <Text style={[styles.label, { color: T.text }]}>Token Contract Address</Text>
        <View style={[styles.inputWrapper, { backgroundColor: T.surface }]}>
          <TextInput
            style={[styles.input, { color: T.text, marginBottom: 0, backgroundColor: 'transparent' }]}
            placeholder="0x..."
            placeholderTextColor={T.textMuted}
            value={contractAddress}
            onChangeText={setContractAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={handleFetchMetadata} style={styles.fetchBtn}>
            {isLoading ? <ActivityIndicator size="small" color={T.primary} /> : <Text style={[styles.fetchBtnText, { color: T.primary }]}>Fetch</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: T.text }]}>Token Symbol</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.surface, color: T.text }]}
          placeholder="e.g. LINK"
          placeholderTextColor={T.textMuted}
          value={tokenSymbol}
          onChangeText={setTokenSymbol}
          autoCapitalize="characters"
        />

        <Text style={[styles.label, { color: T.text }]}>Token Decimal</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.surface, color: T.text }]}
          placeholder="18"
          placeholderTextColor={T.textMuted}
          value={tokenDecimals}
          onChangeText={setTokenDecimals}
          keyboardType="numeric"
        />

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: T.primary }]}
          onPress={handleImport}
        >
          <Text style={styles.submitText}>Import</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  content: {
    padding: 20,
  },
  infoText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    lineHeight: 20,
    marginBottom: 24,
  },
  networkBadge: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  networkBadgeText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingRight: 12,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    fontFamily: Fonts.medium,
    fontSize: 16,
    marginBottom: 20,
  },
  fetchBtn: {
    padding: 8,
  },
  fetchBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  submitBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
