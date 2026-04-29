import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, ActivityIndicator, Share, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { merchantQRService } from '../services/merchantService';

const TOKENS = ['ETH', 'USDC', 'USDT', 'DAI'];

export default function MerchantQRScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

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
      <View style={[s.header, { borderBottomColor: T.border }]}>
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
        <Text style={[s.label, { color: T.textDim }]}>SELECT TOKEN</Text>
        <View style={s.tokenRow}>
          {TOKENS.map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tokenBtn, { backgroundColor: token === t ? T.primary : T.surface, borderColor: token === t ? T.primary : T.border }]}
              onPress={() => setToken(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.tokenBtnText, { color: token === t ? '#FFF' : T.textMuted }]}>{t}</Text>
            </TouchableOpacity>
          ))}
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
            <View style={s.qrWrap}>
              <QRCode value={qrString} size={200} color={isDarkMode ? '#FFF' : '#000'} backgroundColor="transparent" />
            </View>

            <View style={[s.qrInfo, { borderTopColor: T.border }]}>
              <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Token</Text>
              <Text style={[s.qrInfoValue, { color: T.text }]}>{token}</Text>
            </View>
            {amount ? (
              <View style={[s.qrInfo, { borderTopColor: T.border }]}>
                <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Amount</Text>
                <Text style={[s.qrInfoValue, { color: T.text }]}>{amount} {token}</Text>
              </View>
            ) : null}
            {reference ? (
              <View style={[s.qrInfo, { borderTopColor: T.border }]}>
                <Text style={[s.qrInfoLabel, { color: T.textDim }]}>Reference</Text>
                <Text style={[s.qrInfoValue, { color: T.text }]}>{reference}</Text>
              </View>
            ) : null}

            <View style={s.qrActions}>
              <TouchableOpacity style={[s.qrActionBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]} onPress={handleShare} activeOpacity={0.8}>
                <Feather name="share-2" size={16} color={T.text} />
                <Text style={[s.qrActionText, { color: T.text }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.qrActionBtn, { backgroundColor: saved ? '#10B981' + '20' : T.primary + '15', borderColor: saved ? '#10B981' : T.primary }]}
                onPress={handleSave}
                disabled={saving || saved}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator size="small" color={T.primary} /> : <Feather name={saved ? 'check' : 'bookmark'} size={16} color={saved ? '#10B981' : T.primary} />}
                <Text style={[s.qrActionText, { color: saved ? '#10B981' : T.primary }]}>{saved ? 'Saved!' : 'Save'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 24 },
  allInOneBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 20 },
  allInOneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  allInOneTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  allInOneSub: { fontSize: 12 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  tokenRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tokenBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1.5 },
  tokenBtnText: { fontSize: 13, fontWeight: '800' },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, height: 54, marginBottom: 20 },
  inputText: { flex: 1, fontSize: 15, fontWeight: '600' },
  inputSuffix: { fontSize: 13, fontWeight: '700' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58, borderRadius: 18, marginBottom: 28, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  qrCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  qrWrap: { alignItems: 'center', padding: 32 },
  qrInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  qrInfoLabel: { fontSize: 13, fontWeight: '600' },
  qrInfoValue: { fontSize: 14, fontWeight: '700' },
  qrActions: { flexDirection: 'row', gap: 12, padding: 16 },
  qrActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1 },
  qrActionText: { fontSize: 14, fontWeight: '800' },
});
