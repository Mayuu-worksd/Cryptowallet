import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Share, Alert, Dimensions, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { merchantQRService } from '../services/merchantService';
import TokenIcon from '../components/TokenIcon';

const { width } = Dimensions.get('window');

const TOKENS = [
  { symbol: 'ETH',  color: '#627EEA' },
  { symbol: 'USDC', color: '#2775CA' },
  { symbol: 'USDT', color: '#26A17B' },
  { symbol: 'BTC',  color: '#F7931A' },
  { symbol: 'SOL',  color: '#14F195' },
  { symbol: 'BNB',  color: '#F3BA2F' },
  { symbol: 'XRP',  color: '#23292F' },
  { symbol: 'TON',  color: '#0098EA' },
  { symbol: 'TRX',  color: '#FF0013' },
  { symbol: 'SUI',  color: '#4CA2FF' },
];

export default function MerchantQRScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [activeToken, setActiveToken] = useState(TOKENS[0]);
  const [amount, setAmount]     = useState('');
  const [reference, setRef]     = useState('');
  const [qrString, setQrString] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Live QR update
  useEffect(() => {
    const qr = amount || reference
      ? merchantQRService.generateQRString(walletAddress, activeToken.symbol, amount, reference)
      : walletAddress;
    setQrString(qr);
    setSaved(false);
  }, [amount, reference, activeToken, walletAddress]);

  const handleSave = async () => {
    if (!qrString) return;
    setSaving(true);
    try {
      await merchantQRService.save(walletAddress, { token: activeToken.symbol, amount, reference, qr_string: qrString });
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
    <KeyboardAvoidingView style={[s.root, { backgroundColor: T.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Receive Payment</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SavedQRCodes')} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="bookmark" size={18} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Dynamic POS Terminal */}
        <View style={s.terminalWrap}>
          <LinearGradient
            colors={[activeToken.color + '40', activeToken.color + '05', 'transparent']}
            style={s.terminalGlow}
          />
          <View style={[s.terminal, { backgroundColor: T.surface, borderColor: activeToken.color + '50' }]}>
            
            {/* Amount Input (Huge) */}
            <View style={s.amountInputWrap}>
              <Text style={[s.currencySymbol, { color: T.textDim }]}>$</Text>
              <TextInput
                style={[s.amountInput, { color: T.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={T.textDim + '80'}
                keyboardType="decimal-pad"
                autoFocus={true}
              />
              <Text style={[s.tokenBadge, { color: activeToken.color }]}>{activeToken.symbol}</Text>
            </View>

            {/* Reference Input */}
            <View style={[s.refInputWrap, { backgroundColor: isDarkMode ? '#101114' : '#F8FAFC' }]}>
              <Feather name="edit-3" size={14} color={T.textDim} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.refInput, { color: T.text }]}
                value={reference}
                onChangeText={setRef}
                placeholder="Add order reference (Optional)"
                placeholderTextColor={T.textDim}
              />
            </View>

            {/* The Live QR Code */}
            <View style={s.qrWrapper}>
              <View style={[s.qrBorder, { borderColor: activeToken.color }]}>
                {qrString ? (
                  <QRCode value={qrString} size={width * 0.5} color={isDarkMode ? '#FFF' : '#000'} backgroundColor="transparent" />
                ) : null}
              </View>
              <View style={[s.scanOverlay, { backgroundColor: activeToken.color + '10' }]} />
            </View>
            <Text style={[s.scanText, { color: T.textDim }]}>Scan to pay via {activeToken.symbol} Network</Text>
          </View>
        </View>

        {/* Asset Selector */}
        <Text style={[s.sectionLabel, { color: T.textDim }]}>SELECT ASSET</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.assetScroll}>
          {TOKENS.map(t => {
            const active = activeToken.symbol === t.symbol;
            return (
              <TouchableOpacity
                key={t.symbol}
                style={[s.assetCard, { 
                  backgroundColor: active ? t.color + '15' : T.surface, 
                  borderColor: active ? t.color : T.border 
                }]}
                onPress={() => setActiveToken(t)}
                activeOpacity={0.8}
              >
                <TokenIcon token={t.symbol} size={36} />
                <Text style={[s.assetCardText, { color: active ? T.text : T.textMuted }]}>{t.symbol}</Text>
                {active && (
                  <View style={[s.assetCheck, { backgroundColor: t.color }]}>
                    <Feather name="check" size={10} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      </ScrollView>

      {/* Floating Action Bar */}
      <View style={[s.actionBar, { backgroundColor: T.background, borderTopColor: T.border }]}>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: T.surfaceLow }]} onPress={handleShare}>
          <Feather name="share-2" size={20} color={T.text} />
          <Text style={[s.actionBtnText, { color: T.text }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: saved ? '#10B981' : activeToken.color }]}
          onPress={handleSave}
          disabled={saving || saved}
        >
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name={saved ? 'check' : 'download'} size={20} color="#FFF" />}
          <Text style={[s.actionBtnText, { color: '#FFF' }]}>{saved ? 'Saved' : 'Save QR'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 120, paddingTop: 12 },
  
  terminalWrap: { position: 'relative', marginBottom: 32 },
  terminalGlow: { position: 'absolute', top: -30, left: -20, right: -20, bottom: -30, borderRadius: 40 },
  terminal: { padding: 24, borderRadius: 32, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 12, alignItems: 'center' },
  
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  currencySymbol: { fontSize: 32, fontWeight: '900', marginRight: 4, marginTop: -4 },
  amountInput: { fontSize: 48, fontWeight: '900', minWidth: 100, textAlign: 'center' },
  tokenBadge: { fontSize: 14, fontWeight: '900', marginLeft: 8, letterSpacing: 0.5 },
  
  refInputWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 48, borderRadius: 16, paddingHorizontal: 16, marginBottom: 32 },
  refInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  
  qrWrapper: { position: 'relative', marginBottom: 16 },
  qrBorder: { padding: 16, borderRadius: 24, borderWidth: 2, backgroundColor: '#FFF' },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, opacity: 0.5, pointerEvents: 'none' },
  scanText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  
  sectionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  assetScroll: { gap: 12, paddingBottom: 20, marginHorizontal: -24, paddingHorizontal: 24 },
  assetCard: { width: 85, height: 95, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1.5, padding: 8 },
  assetCardText: { fontSize: 13, fontWeight: '800', marginTop: 10 },
  assetCheck: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#101114' },
  
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 40, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 60, borderRadius: 20 },
  actionBtnText: { fontSize: 16, fontWeight: '800' },
});
