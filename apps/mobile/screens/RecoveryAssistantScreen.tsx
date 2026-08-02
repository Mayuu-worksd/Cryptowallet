import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { recoveryAssistantService, DiagnosticResult } from '../services/recoveryAssistantService';
import Toast from '../components/Toast';

export default function RecoveryAssistantScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, network, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleDiagnose = async () => {
    if (!inputVal.trim()) {
      showToast('Please enter a hash, contract, or address', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await recoveryAssistantService.diagnoseInput(inputVal.trim(), network, walletAddress);
      setResult(res);
    } catch (e: any) {
      showToast(e.message || 'Diagnostic failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: T.text }]}>Recovery Assistant</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.desc, { color: T.textMuted }]}>
          Paste a Transaction Hash, Contract Address, or Wallet Address to diagnose asset transfers and get recovery instructions.
        </Text>

        {/* Input Wrapper */}
        <View style={[styles.inputWrapper, { backgroundColor: T.surface, borderColor: T.border }]}>
          <TextInput
            style={[styles.input, { color: T.text }]}
            placeholder="0x... transaction hash or address"
            placeholderTextColor={T.textMuted}
            value={inputVal}
            onChangeText={setInputVal}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <TouchableOpacity style={[styles.btn, { backgroundColor: T.primary }]} onPress={handleDiagnose}>
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnText}>Analyze</Text>}
          </TouchableOpacity>
        </View>

        {/* Results Card */}
        {result && (
          <View style={[styles.resultCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.badge, { backgroundColor: result.isRecoverable ? T.success + '20' : T.error + '20' }]}>
                <Text style={{ color: result.isRecoverable ? T.success : T.error, fontFamily: Fonts.bold, fontSize: 12 }}>
                  {result.isRecoverable ? 'Recoverable' : 'Not Recoverable'}
                </Text>
              </View>
              <Text style={[styles.typeText, { color: T.textMuted }]}>Type: {result.type.toUpperCase()}</Text>
            </View>

            <Text style={[styles.explanation, { color: T.text }]}>{result.explanation}</Text>

            {/* Steps */}
            {result.steps.length > 0 && (
              <View style={styles.stepsSection}>
                <Text style={[styles.stepsTitle, { color: T.text }]}>Recovery Steps:</Text>
                {result.steps.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <Text style={[styles.stepNum, { color: T.primary }]}>{idx + 1}</Text>
                    <Text style={[styles.stepText, { color: T.text }]}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Metadata / Estimates */}
            <View style={[styles.metaGrid, { borderTopColor: T.border }]}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: T.textMuted }]}>Est. Gas Cost</Text>
                <Text style={[styles.metaValue, { color: T.text }]}>{result.estimatedGas}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: T.textMuted }]}>Est. Duration</Text>
                <Text style={[styles.metaValue, { color: T.text }]}>{result.estimatedTime}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontFamily: Fonts.bold },
  scroll: { padding: 20 },
  desc: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputWrapper: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  input: {
    minHeight: 80,
    fontFamily: Fonts.medium,
    fontSize: 15,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  btn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#FFF', fontSize: 15, fontFamily: Fonts.bold },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeText: { fontSize: 12, fontFamily: Fonts.bold },
  explanation: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    lineHeight: 22,
    marginBottom: 20,
  },
  stepsSection: {
    marginBottom: 20,
  },
  stepsTitle: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 12 },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNum: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    width: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 4 },
  metaValue: { fontSize: 14, fontFamily: Fonts.bold },
});
