import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService } from '../services/merchantService';

export default function BusinessKYCDocumentScreen({ navigation, route }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [docUri, setDocUri]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled && result.assets[0]) setDocUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) setDocUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!docUri) return;
    setLoading(true);
    try {
      const url = await businessKYCService.uploadDocument(walletAddress, docUri);
      await businessKYCService.finalizeSubmission(walletAddress, url);
      navigation.replace('BusinessKYCResult');
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Business Document</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        <View style={[s.iconRing, { backgroundColor: T.primary + '12', borderColor: T.primary + '25' }]}>
          <Feather name="file-text" size={36} color={T.primary} />
        </View>
        <Text style={[s.title, { color: T.text }]}>Upload Business Document</Text>
        <Text style={[s.sub, { color: T.textMuted }]}>Upload your business registration certificate, license, or any official business document.</Text>

        {docUri ? (
          <View style={s.previewWrap}>
            <Image source={{ uri: docUri }} style={s.preview} resizeMode="cover" />
            <TouchableOpacity style={[s.retakeBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]} onPress={() => setDocUri(null)}>
              <Feather name="refresh-cw" size={14} color={T.textMuted} />
              <Text style={[s.retakeBtnText, { color: T.textMuted }]}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.uploadOptions}>
            <TouchableOpacity style={[s.uploadBtn, { backgroundColor: T.surface, borderColor: T.border }]} onPress={takePhoto} activeOpacity={0.8}>
              <Feather name="camera" size={24} color={T.primary} />
              <Text style={[s.uploadBtnText, { color: T.text }]}>Take Photo</Text>
              <Text style={[s.uploadBtnSub, { color: T.textDim }]}>Use camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.uploadBtn, { backgroundColor: T.surface, borderColor: T.border }]} onPress={pickDocument} activeOpacity={0.8}>
              <Feather name="upload" size={24} color={T.primary} />
              <Text style={[s.uploadBtnText, { color: T.text }]}>Upload File</Text>
              <Text style={[s.uploadBtnSub, { color: T.textDim }]}>From gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[s.btn, { backgroundColor: docUri ? T.primary : T.surfaceHigh, shadowColor: T.primary }, (!docUri || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!docUri || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <><Text style={[s.btnText, { color: docUri ? '#FFF' : T.textDim }]}>Submit for Review</Text><Feather name="send" size={17} color={docUri ? '#FFF' : T.textDim} /></>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, alignItems: 'center' },
  iconRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12, letterSpacing: -0.4 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  uploadOptions: { flexDirection: 'row', gap: 16, width: '100%' },
  uploadBtn: { flex: 1, alignItems: 'center', gap: 8, padding: 24, borderRadius: 20, borderWidth: 1 },
  uploadBtnText: { fontSize: 15, fontWeight: '800' },
  uploadBtnSub: { fontSize: 12 },
  previewWrap: { width: '100%', gap: 12 },
  preview: { width: '100%', height: 200, borderRadius: 16 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1 },
  retakeBtnText: { fontSize: 14, fontWeight: '700' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 60, borderRadius: 18, width: '100%', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnText: { fontSize: 16, fontWeight: '900' },
});
