import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, ActivityIndicator, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { merchantQRService } from '../services/merchantService';
import TokenIcon from '../components/TokenIcon';

const TOKENS = ['ETH', 'USDC', 'USDT', 'BTC', 'SOL', 'BNB', 'XRP', 'TON', 'TRX', 'SUI'];

export default function MerchantQRScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [token, setToken]       = useState('ETH');
  const [amount, setAmount]     = useState('');
  const [reference, setRef]     = useState('');
  const [qrString, setQrString] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const generate = () => {
    const qr = amount || reference
      ? merchantQRService.generateQRString(walletAddress, token, amount, reference)
      : walletAddress; // All-in-One: just the address, any token can pay
    setQrString(qr);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!qrString) return;
    setSaving(true);
    try {
      await merchantQRService.save(walletAddress, { token, amount, reference, qr_string: qrString });
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!qrString) return;
    await Share.share({ message: `Pay me crypto:\n${qrString}`, title: 'Payment QR' });
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>QR Generator</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SavedQRCodes')} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="list" size={18} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* All-in-One Banner */}
        <TouchableOpacity
          style={[s.allInOneBtn, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}
          onPress={() => { setToken('ETH'); setAmount(''); setRef(''); setTimeout(generate, 50); }}
          activeOpacity={0.85}
        >
          <View style={[s.allInOneIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Feather name="zap" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.allInOneTitle, { color: T.text }]}>All-in-One QR</Text>
            <Text style={[s.allInOneSub, { color: T.textMuted }]}>Accept any token — no amount lock</Text>
          </View>
          <Feather name="arrow-right" size={16} color="#10B981" />
        </TouchableOpacity>

        {/* Token Selector */}
        <Text style={[s.label, { color: T.textDim }]}>SELECT ASSET</Text>
        <View style={{ marginHorizontal: -20, marginBottom: 24 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {TOKENS.map(t => {
              const active = token === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.tokenCard, { 
                    backgroundColor: active ? T.primary + '15' : T.surface, 
                    borderColor: active ? T.primary : T.border 
                  }]}
                  onPress={() => setToken(t)}
                  activeOpacity={0.8}
                >
                  <TokenIcon token={t} size={32} />
                  <Text style={[s.tokenCardText, { color: active ? T.text : T.textMuted }]}>{t}</Text>
                  {active && (
                    <View style={[s.tokenCheck, { backgroundColor: T.primary }]}>
                      <Feather name="check" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Amount */}
        <Text style={[s.label, { color: T.textDim }]}>AMOUNT (OPTIONAL)</Text>
        <View style={[s.input, { backgroundColor: T.surface, borderColor: T.border }]}>
          <TextInput
            style={[s.inputText, { color: T.text }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={T.textDim}
            keyboardType="decimal-pad"
          />
          <Text style={[s.inputSuffix, { color: T.textDim }]}>{token}</Text>
        </View>

        {/* Reference */}
        <Text style={[s.label, { color: T.textDim }]}>REFERENCE NOTE (OPTIONAL)</Text>
        <View style={[s.input, { backgroundColor: T.surface, borderColor: T.border }]}>
          <TextInput
            style={[s.inputText, { color: T.text }]}
            value={reference}
            onChangeText={setRef}
            placeholder="e.g. Order #1234"
            placeholderTextColor={T.textDim}
          />
        </View>

        {/* Generate Button */}
        <TouchableOpacity style={[s.generateBtn, { backgroundColor: T.primary, shadowColor: T.primary }]} onPress={generate} activeOpacity={0.85}>
          <Feather name="grid" size={18} color="#FFF" />
          <Text style={s.generateBtnText}>Generate QR Code</Text>
        </TouchableOpacity>

        {/* QR Display */}
        {qrString ? (
          <View style={[s.qrCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <LinearGradient colors={[T.primary + '20', 'transparent']} style={s.qrGradientTop} />
            <View style={s.qrWrap}>
              <View style={[s.qrCodeWrapper, { borderColor: T.border, backgroundColor: isDarkMode ? '#FFF' : '#FFF' }]}>
                <QRCode value={qrString} size={220} color="#000" backgroundColor="transparent" />
              </View>
            </View>

            <View style={[s.qrInfo, { borderTopColor: T.border }]}>
              <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Payment Asset</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TokenIcon token={token} size={18} />
                <Text style={[s.qrInfoValue, { color: T.text }]}>{token}</Text>
              </View>
            </View>
            {amount ? (
              <View style={[s.qrInfo, { borderTopColor: T.border }]}>
                <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Amount Requested</Text>
                <Text style={[s.qrInfoValue, { color: T.text }]}>{amount} {token}</Text>
              </View>
            ) : null}
            {reference ? (
              <View style={[s.qrInfo, { borderTopColor: T.border }]}>
                <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Reference Note</Text>
                <Text style={[s.qrInfoValue, { color: T.text }]}>{reference}</Text>
              </View>
            ) : null}

            <View style={s.qrActions}>
              <TouchableOpacity style={[s.qrActionBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]} onPress={handleShare} activeOpacity={0.8}>
                <Feather name="share-2" size={16} color={T.text} />
                <Text style={[s.qrActionText, { color: T.text }]}>Share QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.qrActionBtn, { backgroundColor: saved ? '#10B981' + '15' : T.primary + '15', borderColor: saved ? '#10B981' : T.primary }]}
                onPress={handleSave}
                disabled={saving || saved}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator size="small" color={T.primary} /> : <Feather name={saved ? 'check' : 'bookmark'} size={16} color={saved ? '#10B981' : T.primary} />}
                <Text style={[s.qrActionText, { color: saved ? '#10B981' : T.primary }]}>{saved ? 'Saved' : 'Save to Gallery'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 24 },
  allInOneBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 20 },
  allInOneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  allInOneTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  allInOneSub: { fontSize: 12 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  tokenCard: { width: 85, height: 90, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1.5, padding: 8 },
  tokenCardText: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  tokenCheck: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#101114' },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, height: 58, marginBottom: 24 },
  inputText: { flex: 1, fontSize: 16, fontWeight: '600' },
  inputSuffix: { fontSize: 14, fontWeight: '700' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 60, borderRadius: 20, marginBottom: 32, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  qrCard: { borderRadius: 28, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  qrGradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140, opacity: 0.8 },
  qrWrap: { alignItems: 'center', padding: 40, paddingTop: 48 },
  qrCodeWrapper: { padding: 16, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  qrInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18, borderTopWidth: 1 },
  qrInfoLabel: { fontSize: 13, fontWeight: '600' },
  qrInfoValue: { fontSize: 15, fontWeight: '800' },
  qrActions: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 10 },
  qrActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16, borderWidth: 1 },
  qrActionText: { fontSize: 14, fontWeight: '800' },
});
