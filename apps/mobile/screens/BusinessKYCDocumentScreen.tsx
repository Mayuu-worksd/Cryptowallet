import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Image, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService } from '../services/merchantService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabaseClient';

type DocStep = 0 | 1 | 2; // 0=business doc, 1=director ID, 2=review

export default function BusinessKYCDocumentScreen({ navigation, route }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [step, setStep]           = useState<DocStep>(0);
  const [bizDocUri, setBizDocUri] = useState<string | null>(null);
  const [dirDocUri, setDirDocUri] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setter(result.assets[0].uri);
  };

  const takePhoto = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) setter(result.assets[0].uri);
  };

  const uploadToStorage = async (fileUri: string, folder: string): Promise<string> => {
    const addr = walletAddress.toLowerCase().replace('0x', '');
    const storagePath = `business_kyc/${addr}/${folder}_${Date.now()}.jpg`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/kyc-docs/${storagePath}`;
    const fileResponse = await fetch(fileUri);
    if (!fileResponse.ok) throw new Error('Could not read file.');
    const blob = await fileResponse.blob();
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const { supabase } = await import('../services/supabaseClient');
    const { data } = supabase.storage.from('kyc-docs').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!bizDocUri || !dirDocUri) return;
    setLoading(true);
    try {
      const [bizUrl, dirUrl] = await Promise.all([
        uploadToStorage(bizDocUri, 'business_doc'),
        uploadToStorage(dirDocUri, 'director_id'),
      ]);
      // Save director_id_url first, then finalize with business doc
      const { supabase } = await import('../services/supabaseClient');
      await supabase.from('business_kyc').update({ director_id_url: dirUrl })
        .eq('wallet_address', walletAddress.toLowerCase());
      await businessKYCService.finalizeSubmission(walletAddress, bizUrl);
      navigation.replace('BusinessKYCResult');
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { label: 'Business Doc', icon: 'file-text' as const },
    { label: 'Director ID',  icon: 'credit-card' as const },
    { label: 'Review',       icon: 'check-circle' as const },
  ];

  const UploadBox = ({
    uri, onCamera, onGallery, onClear, title, subtitle, acceptedDocs,
  }: {
    uri: string | null;
    onCamera: () => void;
    onGallery: () => void;
    onClear: () => void;
    title: string;
    subtitle: string;
    acceptedDocs: string[];
  }) => (
    <View style={{ flex: 1 }}>
      <Text style={[s.boxTitle, { color: T.text }]}>{title}</Text>
      <Text style={[s.boxSub, { color: T.textDim }]}>{subtitle}</Text>

      <View style={[s.acceptedRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
        <Feather name="info" size={12} color={T.textDim} />
        <Text style={[s.acceptedText, { color: T.textDim }]}>{acceptedDocs.join(' · ')}</Text>
      </View>

      {uri ? (
        <View style={s.previewWrap}>
          <Image source={{ uri }} style={s.preview} resizeMode="cover" />
          <TouchableOpacity
            style={[s.changeBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={onClear}
          >
            <Feather name="refresh-cw" size={14} color={T.textDim} />
            <Text style={[s.changeBtnText, { color: T.textDim }]}>Change document</Text>
          </TouchableOpacity>
          <View style={[s.successBanner, { backgroundColor: '#10B98112', borderColor: '#10B98130' }]}>
            <Feather name="check-circle" size={14} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>Document ready</Text>
          </View>
        </View>
      ) : (
        <View style={s.uploadGrid}>
          <TouchableOpacity
            style={[s.uploadCard, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={onCamera}
            activeOpacity={0.8}
          >
            <View style={[s.uploadIconWrap, { backgroundColor: T.primary + '12' }]}>
              <Feather name="camera" size={22} color={T.primary} />
            </View>
            <Text style={[s.uploadCardTitle, { color: T.text }]}>Camera</Text>
            <Text style={[s.uploadCardSub, { color: T.textDim }]}>Take a photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.uploadCard, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={onGallery}
            activeOpacity={0.8}
          >
            <View style={[s.uploadIconWrap, { backgroundColor: T.primary + '12' }]}>
              <Feather name="image" size={22} color={T.primary} />
            </View>
            <Text style={[s.uploadCardTitle, { color: T.text }]}>Gallery</Text>
            <Text style={[s.uploadCardSub, { color: T.textDim }]}>Choose file</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          onPress={() => step === 0 ? navigation.goBack() : setStep((step - 1) as DocStep)}
          style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}
        >
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Business Documents</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Step indicator */}
      <View style={[s.stepBar, { borderBottomColor: T.border }]}>
        {STEPS.map((st, i) => {
          const done   = i < step;
          const active = i === step;
          const color  = done ? '#10B981' : active ? T.primary : T.textDim;
          return (
            <React.Fragment key={i}>
              <View style={s.stepItem}>
                <View style={[s.stepCircle, {
                  backgroundColor: done ? '#10B981' : active ? T.primary : T.surfaceLow,
                  borderColor: done ? '#10B981' : active ? T.primary : T.border,
                }]}>
                  {done
                    ? <Feather name="check" size={11} color="#FFF" />
                    : <Text style={[s.stepNum, { color: active ? '#FFF' : T.textDim }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, { color }]}>{st.label}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[s.stepConnector, { backgroundColor: i < step ? '#10B981' : T.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 0: Business Document ── */}
        {step === 0 && (
          <UploadBox
            uri={bizDocUri}
            onCamera={() => takePhoto(setBizDocUri)}
            onGallery={() => pickImage(setBizDocUri)}
            onClear={() => setBizDocUri(null)}
            title="Business Registration Document"
            subtitle="Upload your official business registration certificate, trade license, or incorporation document."
            acceptedDocs={[
              'Certificate of Incorporation',
              'Trade License',
              'Business Registration',
              'Company Extract',
            ]}
          />
        )}

        {/* ── STEP 1: Director ID ── */}
        {step === 1 && (
          <UploadBox
            uri={dirDocUri}
            onCamera={() => takePhoto(setDirDocUri)}
            onGallery={() => pickImage(setDirDocUri)}
            onClear={() => setDirDocUri(null)}
            title="Director / Owner Government ID"
            subtitle="Upload a valid government-issued photo ID of the director or primary business owner."
            acceptedDocs={[
              'Passport',
              'National ID Card',
              "Driver's License",
              'Residence Permit',
            ]}
          />
        )}

        {/* ── STEP 2: Review ── */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            <Text style={[s.reviewTitle, { color: T.text }]}>Review & Submit</Text>
            <Text style={[s.reviewSub, { color: T.textDim }]}>
              Both documents are ready. Review before submitting for compliance verification.
            </Text>

            {/* Business doc preview */}
            <View style={[s.reviewCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <View style={s.reviewCardHeader}>
                <View style={[s.reviewCardIcon, { backgroundColor: T.primary + '15' }]}>
                  <Feather name="file-text" size={16} color={T.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.reviewCardTitle, { color: T.text }]}>Business Document</Text>
                  <Text style={[s.reviewCardSub, { color: T.textDim }]}>Registration / Trade License</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(0)}>
                  <Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}>Change</Text>
                </TouchableOpacity>
              </View>
              {bizDocUri && (
                <Image source={{ uri: bizDocUri }} style={s.reviewThumb} resizeMode="cover" />
              )}
            </View>

            {/* Director ID preview */}
            <View style={[s.reviewCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <View style={s.reviewCardHeader}>
                <View style={[s.reviewCardIcon, { backgroundColor: '#6366F115' }]}>
                  <Feather name="credit-card" size={16} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.reviewCardTitle, { color: T.text }]}>Director / Owner ID</Text>
                  <Text style={[s.reviewCardSub, { color: T.textDim }]}>Passport / National ID</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}>Change</Text>
                </TouchableOpacity>
              </View>
              {dirDocUri && (
                <Image source={{ uri: dirDocUri }} style={s.reviewThumb} resizeMode="cover" />
              )}
            </View>

            {/* Compliance notice */}
            <View style={[s.complianceBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="shield" size={14} color={T.success} />
              <Text style={[s.complianceText, { color: T.textDim }]}>
                Documents are encrypted and stored securely. Used only for compliance verification. Review takes 1–3 business days.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[s.footer, { borderTopColor: T.border, backgroundColor: T.background }]}>
        {step < 2 ? (
          <TouchableOpacity
            style={[s.btn, {
              opacity: (step === 0 ? !!bizDocUri : !!dirDocUri) ? 1 : 0.4,
            }]}
            onPress={() => setStep((step + 1) as DocStep)}
            disabled={step === 0 ? !bizDocUri : !dirDocUri}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#EC2629', '#93000d']} style={s.btnGrad}>
              <Text style={s.btnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.btn, { opacity: loading ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#EC2629', '#93000d']} style={s.btnGrad}>
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <><Text style={s.btnText}>Submit for Review</Text><Feather name="send" size={16} color="#FFF" /></>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  iconBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },

  stepBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  stepItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCircle:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum:       { fontSize: 11, fontWeight: '800' },
  stepLabel:     { fontSize: 11, fontWeight: '700' },
  stepConnector: { flex: 1, height: 1.5, marginHorizontal: 6 },

  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },

  boxTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 6 },
  boxSub:   { fontSize: 13, lineHeight: 20, marginBottom: 14 },

  acceptedRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  acceptedText: { flex: 1, fontSize: 12, lineHeight: 18 },

  uploadGrid:     { flexDirection: 'row', gap: 14, marginBottom: 16 },
  uploadCard:     { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 28, borderRadius: 18, borderWidth: 1.5 },
  uploadIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  uploadCardTitle:{ fontSize: 14, fontWeight: '800' },
  uploadCardSub:  { fontSize: 12 },

  previewWrap:   { gap: 12, marginBottom: 16 },
  preview:       { width: '100%', height: 200, borderRadius: 16 },
  changeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: 12, borderWidth: 1 },
  changeBtnText: { fontSize: 13, fontWeight: '700' },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },

  reviewTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  reviewSub:   { fontSize: 13, lineHeight: 20 },
  reviewCard:  { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  reviewCardIcon:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  reviewCardTitle:  { fontSize: 14, fontWeight: '800' },
  reviewCardSub:    { fontSize: 12, marginTop: 1 },
  reviewThumb:      { width: '100%', height: 140 },

  complianceBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  complianceText: { flex: 1, fontSize: 12, lineHeight: 18 },

  footer:  { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderTopWidth: 1 },
  btn:     { borderRadius: 16, overflow: 'hidden' },
  btnGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
