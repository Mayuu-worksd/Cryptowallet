import React, { useState } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Image, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { kycService } from '../services/supabaseService';

const STEPS = ['Details', 'Your Code', 'Documents', 'Review'];

export default function KYCUploadScreen({ navigation, route }: any) {
  const { walletAddress, refreshKYCStatus } = useWallet() as any;
  const T = Theme.colors;

  const verificationCode: string = route?.params?.verificationCode ?? 'XXXX-XXXX';

  const [step, setStep]           = useState<'code' | 'upload'>('code');
  const [docUri, setDocUri]       = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') =>
    setToast({ visible: true, message, type });

  const copyCode = async () => {
    await Clipboard.setStringAsync(verificationCode);
    setCodeCopied(true);
    showToast('Code copied to clipboard', 'success');
    setTimeout(() => setCodeCopied(false), 3000);
  };

  const pickImage = async (type: 'document' | 'selfie') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      if (type === 'document') setDocUri(result.assets[0].uri);
      else setSelfieUri(result.assets[0].uri);
    }
  };

  const takePhoto = async (type: 'document' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      if (type === 'document') setDocUri(result.assets[0].uri);
      else setSelfieUri(result.assets[0].uri);
    }
  };

  const showPickOptions = (type: 'document' | 'selfie') => {
    if (Platform.OS === 'web') { pickImage(type); return; }
    Alert.alert('Upload Photo', 'Choose source', [
      { text: 'Camera',        onPress: () => takePhoto(type) },
      { text: 'Photo Library', onPress: () => pickImage(type) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!docUri)    { showToast('Please upload your ID document'); return; }
    if (!selfieUri) { showToast('Please upload your selfie with the code'); return; }

    setLoading(true);
    try {
      const [documentUrl, selfieUrl] = await Promise.all([
        kycService.uploadFile(walletAddress, docUri,    'document', 'image/jpeg'),
        kycService.uploadFile(walletAddress, selfieUri, 'selfie',   'image/jpeg'),
      ]);
      await kycService.finalizeSubmission(walletAddress, documentUrl, selfieUrl);
      if (refreshKYCStatus) await refreshKYCStatus();
      navigation.replace('KYCStatus');
    } catch (e: any) {
      showToast(e?.message ?? 'Upload failed. Check your connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = step === 'code' ? 1 : 2;

  const UploadBox = ({
    type, uri, label, hint, icon,
  }: { type: 'document' | 'selfie'; uri: string | null; label: string; hint: string; icon: any }) => (
    <View style={[styles.uploadBox, { backgroundColor: T.surface, borderColor: uri ? T.success : T.surfaceHigh }]}>
      <View style={styles.uploadBoxHeader}>
        <View style={[styles.uploadIconBg, { backgroundColor: uri ? T.success + '15' : T.primary + '15' }]}>
          <Feather name={icon} size={20} color={uri ? T.success : T.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.uploadLabel, { color: T.text }]}>{label}</Text>
          <Text style={[styles.uploadHint, { color: T.textMuted }]}>{hint}</Text>
        </View>
        {uri && <Feather name="check-circle" size={22} color={T.success} />}
      </View>
      {uri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.previewImg} resizeMode="cover" />
          <TouchableOpacity
            style={[styles.reuploadBtn, { backgroundColor: T.surfaceLow }]}
            onPress={() => showPickOptions(type)}
          >
            <Feather name="refresh-cw" size={14} color={T.textMuted} />
            <Text style={[styles.reuploadText, { color: T.textMuted }]}>Replace Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadTrigger, { borderColor: T.border, backgroundColor: T.surfaceLow }]}
          onPress={() => showPickOptions(type)}
          activeOpacity={0.75}
        >
          <Feather name="camera" size={22} color={T.textMuted} />
          <Text style={[styles.uploadTriggerText, { color: T.textMuted }]}>Take or Upload Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.background }}>
      <Toast
        visible={toast.visible} message={toast.message} type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.surfaceHigh }]}>
        <TouchableOpacity
          onPress={() => step === 'upload' ? setStep('code') : navigation.goBack()}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          {step === 'code' ? 'Verification Code' : 'Upload Documents'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Progress */}
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, {
                  backgroundColor:
                    i < currentStepIndex ? T.success :
                    i === currentStepIndex ? T.primary : T.surfaceHigh,
                }]}>
                  {i < currentStepIndex
                    ? <Feather name="check" size={13} color="#FFF" />
                    : <Text style={{ color: i === currentStepIndex ? '#FFF' : T.textDim, fontSize: 11, fontWeight: '900' }}>{i + 1}</Text>
                  }
                </View>
                <Text style={[styles.progressLabel, {
                  color: i < currentStepIndex ? T.success : i === currentStepIndex ? T.primary : T.textDim,
                }]}>{s}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, { backgroundColor: i < currentStepIndex ? T.success : T.surfaceHigh }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── STEP 1: Show verification code ── */}
        {step === 'code' && (
          <>
            <View style={[styles.codeCard, { backgroundColor: T.surface, borderColor: T.primary + '30' }]}>
              <View style={[styles.codeIconRing, { backgroundColor: T.primary + '15' }]}>
                <Feather name="key" size={28} color={T.primary} />
              </View>
              <Text style={[styles.codeCardTitle, { color: T.text }]}>Your Unique Code</Text>
              <Text style={[styles.codeCardSub, { color: T.textMuted }]}>
                Write this code on a piece of paper. You must hold it clearly in your selfie photo.
              </Text>

              {/* The code itself */}
              <View style={[styles.codeBox, { backgroundColor: T.background, borderColor: T.primary }]}>
                <Text style={[styles.codeText, { color: T.primary }]}>{verificationCode}</Text>
              </View>

              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: codeCopied ? T.success + '15' : T.surfaceLow, borderColor: codeCopied ? T.success : T.surfaceHigh }]}
                onPress={copyCode}
                activeOpacity={0.8}
              >
                <Feather name={codeCopied ? 'check' : 'copy'} size={16} color={codeCopied ? T.success : T.textMuted} />
                <Text style={[styles.copyBtnText, { color: codeCopied ? T.success : T.textMuted }]}>
                  {codeCopied ? 'Copied to Clipboard' : 'Copy Code'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <Text style={[styles.sectionTitle, { color: T.textDim }]}>INSTRUCTIONS</Text>
            <View style={[styles.instructionsBox, { backgroundColor: T.surface, borderColor: T.surfaceHigh, borderWidth: 1 }]}>
              {[
                { icon: 'edit-3',    text: 'Write the code above on a blank piece of paper in large letters' },
                { icon: 'camera',    text: 'Take a selfie clearly showing your face AND the paper' },
                { icon: 'file-text', text: 'Prepare a clear photo of your government ID or passport' },
                { icon: 'upload',    text: 'Upload both photos on the next screen' },
              ].map((item, i, arr) => (
                <View
                  key={i}
                  style={[styles.instructionRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.surfaceHigh }]}
                >
                  <View style={[styles.instrIconBox, { backgroundColor: T.primary + '15' }]}>
                    <Feather name={item.icon as any} size={16} color={T.primary} />
                  </View>
                  <Text style={[styles.instrText, { color: T.textMuted }]}>{item.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: T.primary }]}
              onPress={() => setStep('upload')}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>I've Written the Code</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2: Upload documents ── */}
        {step === 'upload' && (
          <>
            {/* Code reminder */}
            <View style={[styles.codeReminder, { backgroundColor: T.primary + '12', borderColor: T.primary + '30' }]}>
              <Feather name="key" size={16} color={T.primary} />
              <Text style={[styles.codeReminderText, { color: T.primary }]}>
                Your code: <Text style={{ fontWeight: '900' }}>{verificationCode}</Text>
              </Text>
            </View>

            <UploadBox
              type="document"
              uri={docUri}
              label="ID Document / Passport"
              hint="Must be valid and clearly readable"
              icon="file-text"
            />

            <UploadBox
              type="selfie"
              uri={selfieUri}
              label="Selfie with Code"
              hint={`Hold the code "${verificationCode}" next to your face`}
              icon="camera"
            />

            {/* Checklist */}
            <View style={[styles.checklistBox, { backgroundColor: T.surface, borderColor: T.surfaceHigh }]}>
              <Text style={[styles.checklistTitle, { color: T.text }]}>Before submitting, ensure:</Text>
              {[
                'Face is clearly visible in the selfie',
                `Code "${verificationCode}" is readable on paper`,
                'ID document is not blurry or cut off',
                'Good lighting and no glare',
              ].map((item, i) => (
                <View key={i} style={styles.checklistRow}>
                  <Feather name="check-circle" size={14} color={T.success} />
                  <Text style={[styles.checklistText, { color: T.textMuted }]}>{item}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: T.primary },
                (!docUri || !selfieUri || loading) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={!docUri || !selfieUri || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Text style={styles.submitBtnText}>Submit for Review</Text>
                    <Feather name="shield" size={18} color="#FFF" />
                  </>
              }
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 18,
    borderBottomWidth: 1,
    backgroundColor: Theme.colors.background,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Theme.colors.surfaceLow },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 24 },

  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  progressStep: { alignItems: 'center', gap: 6 },
  progressDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  progressLine: { flex: 1, height: 2, marginHorizontal: 8, marginBottom: 18 },

  codeCard: {
    borderRadius: 24, borderWidth: 1, padding: 28,
    alignItems: 'center', gap: 14, marginBottom: 32,
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12,
  },
  codeIconRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  codeCardTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  codeCardSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  codeBox: {
    borderWidth: 2, borderRadius: 20, paddingHorizontal: 36, paddingVertical: 18,
    borderStyle: 'dashed', marginVertical: 8,
  },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderWidth: 1,
  },
  copyBtnText: { fontSize: 14, fontWeight: '800' },

  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 16, marginLeft: 2, textTransform: 'uppercase', opacity: 0.6 },

  instructionsBox: { borderRadius: 20, overflow: 'hidden', marginBottom: 32 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 18 },
  instrIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  instrText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '600', opacity: 0.8 },

  codeReminder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24,
  },
  codeReminderText: { fontSize: 14, fontWeight: '800' },

  uploadBox: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 20 },
  uploadBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  uploadIconBg: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  uploadLabel: { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  uploadHint: { fontSize: 13, lineHeight: 19, opacity: 0.7 },
  previewWrap: { gap: 12 },
  previewImg: { width: '100%', height: 200, borderRadius: 16 },
  reuploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  reuploadText: { fontSize: 14, fontWeight: '700' },
  uploadTrigger: {
    height: 120, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  uploadTriggerText: { fontSize: 15, fontWeight: '800' },

  checklistBox: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 32, gap: 12 },
  checklistTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checklistText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', opacity: 0.8 },

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: Theme.roundness.xl, marginBottom: 12,
  },
  nextBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: Theme.roundness.xl,
  },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});

