import React, { useState, useRef, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import EmailOTPModal from '../components/EmailOTPModal';
import { storageService } from '../services/storageService';
import { haptics } from '../utils/haptics';

const STEPS = [
  { icon: 'lock',          label: 'Verifying phrase...'  },
  { icon: 'check-circle',  label: 'Wallet restored!'      },
];

function ImportingOverlay({ visible, isDarkMode, done }: { visible: boolean; isDarkMode: boolean; done: boolean }) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const stepFade  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    spin.start();
    return () => spin.stop();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
    }
  }, [visible]);

  useEffect(() => {
    if (done) {
      Animated.sequence([
        Animated.timing(stepFade, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(stepFade, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      setStep(1);
    }
  }, [done]);

  const spin    = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const current = STEPS[step] ?? STEPS[0];
  const isDone  = step === 1;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: isDarkMode ? 'rgba(10,11,14,0.96)' : 'rgba(240,242,245,0.97)' }]}>
        <Animated.View style={[styles.overlayCard, { backgroundColor: T.surface, borderColor: T.border, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconWrap}>
            {!isDone && (
              <Animated.View style={[styles.spinRing, { borderColor: T.primary, transform: [{ rotate: spin }] }]} />
            )}
            <View style={[styles.iconCircle, { backgroundColor: isDone ? T.success + '22' : T.primary + '18' }]}>
              <Feather name={current.icon as any} size={30} color={isDone ? T.success : T.primary} />
            </View>
          </View>
          <Animated.Text style={[styles.overlayTitle, { color: T.text, opacity: stepFade }]}>
            {current.label}
          </Animated.Text>
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={StyleSheet.flatten([
                  styles.dot,
                  { backgroundColor: i <= step ? T.primary : T.border, width: i === step ? 20 : 8 }
                ])}
              />
            ))}
          </View>
          <Text style={[styles.overlaySubtitle, { color: T.textMuted }]}>
            {isDone ? 'Taking you to your wallet...' : 'Please wait, do not close the app'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function ImportWalletScreen({ navigation }: any) {
  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading]   = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [invalidWords, setInvalidWords] = useState<string[]>([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'success' | 'error' | 'info' });
  const { importWallet, isDarkMode, hasWallet } = useWallet();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const email = await storageService.getVerifiedEmail() || await AsyncStorage.getItem('cw_user_email') || await AsyncStorage.getItem('cw_email');
      if (email) setVerifiedEmail(email);
    })();
  }, []);

  useEffect(() => {
    if (!mnemonic.trim()) { setInvalidWords([]); return; }
    const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const invalid = words.filter(w => !/^[a-z]{3,8}$/.test(w));
    setInvalidWords(invalid);
  }, [mnemonic]);

  useEffect(() => {
    if (hasWallet && importDone) {
      const timer = setTimeout(() => setLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [hasWallet, importDone]);

  const VALID_COUNTS = [12, 15, 18, 21, 24];
  const wordsArray  = mnemonic.trim() ? mnemonic.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount   = wordsArray.length;
  const isValid     = VALID_COUNTS.includes(wordCount) && invalidWords.length === 0;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') =>
    setToast({ visible: true, message, type });

  const handlePaste = async () => {
    haptics.selection();
    const text = await Clipboard.getStringAsync();
    if (text) {
      const clean = text.toLowerCase()
        .replace(/\d+\./g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setMnemonic(clean);
    }
  };

  const handleImport = async () => {
    const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const words   = trimmed.split(' ');

    if (invalidWords.length > 0) {
      haptics.error();
      showToast(`Invalid words found: ${invalidWords.join(', ')}`, 'error');
      return;
    }

    if (!VALID_COUNTS.includes(words.length)) {
      haptics.error();
      showToast(`Seed phrase must be 12, 15, 18, 21, or 24 words. (You have ${words.length})`, 'error');
      return;
    }

    let email = verifiedEmail;
    if (!email) {
      const stored = await storageService.getVerifiedEmail() || await AsyncStorage.getItem('cw_user_email') || await AsyncStorage.getItem('cw_email');
      if (stored) {
        email = stored;
        setVerifiedEmail(stored);
      }
    }

    const isDeviceVerified = (await AsyncStorage.getItem('cw_device_verified')) === 'true' || (await AsyncStorage.getItem('cw_has_ever_verified')) === 'true';

    if (!email && !isDeviceVerified) {
      haptics.selection();
      setShowOTP(true);
      return;
    }

    await storageService.setVerifiedEmail(email || 'verified_user@device');
    await AsyncStorage.setItem('cw_device_verified', 'true');
    await AsyncStorage.setItem('cw_has_ever_verified', 'true');

    doImport(trimmed);
  };

  const handleOTPVerified = async (email: string) => {
    haptics.success();
    setVerifiedEmail(email);
    await storageService.setVerifiedEmail(email);
    await AsyncStorage.setItem('cw_user_email', email);
    setShowOTP(false);
    const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    doImport(trimmed);
  };

  const doImport = (trimmed: string) => {
    setLoading(true);
    setImportDone(false);

    setTimeout(async () => {
      try {
        console.log('[ImportScreen] Starting wallet import...');
        const t0 = Date.now();
        const preferredNetwork = await AsyncStorage.getItem('cw_network').catch(() => null);
        
        await importWallet(trimmed, false, preferredNetwork || undefined);
        console.log(`[ImportScreen] importWallet() completed in ${Date.now() - t0}ms`);
        setImportDone(true);
      } catch (e: any) {
        console.error('[ImportScreen] Import failed:', e?.message);
        setLoading(false);
        setImportDone(false);
        showToast('Checksum failed. Ensure words are in the correct order.', 'error');
      }
    }, 50);
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <ImportingOverlay visible={loading} isDarkMode={isDarkMode} done={importDone} />
      <EmailOTPModal
        visible={showOTP}
        isDarkMode={isDarkMode}
        onVerified={handleOTPVerified}
        onCancel={() => setShowOTP(false)}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)', paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { haptics.selection(); navigation.goBack(); }} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: T.primary }]}>CryptoWallet</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 32 }}>
            <Text style={[styles.title, { color: T.text }]}>Import Wallet</Text>
            <Text style={[styles.subtitle, { color: T.textMuted }]}>
              Enter your{' '}
              <Text style={{ color: T.primary, fontFamily: Fonts.bold }}>12 or 24-word recovery phrase</Text>
              {' '}in correct order to restore your assets.
            </Text>
          </View>

          {/* Input Area */}
          <View style={[styles.inputContainer, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.inputLabel, { color: T.textMuted }]}>Recovery Phrase</Text>
              <View style={[styles.wordCountBadge, {
                backgroundColor: isValid ? T.success + '20' : wordCount > 0 ? T.error + '20' : T.border,
              }]}>
                <Text style={[styles.wordCountText, {
                  color: isValid ? T.success : wordCount > 0 ? T.error : T.textMuted,
                }]}>
                  {wordCount} Words
                </Text>
              </View>
            </View>

            <TextInput
              style={[styles.inputBlock, { color: T.text, backgroundColor: T.surfaceLow, borderColor: isValid ? T.success + '80' : T.border }]}
              placeholder="word1 word2 word3 ..."
              placeholderTextColor={T.textDim}
              value={mnemonic}
              onChangeText={(text) => setMnemonic(text.toLowerCase().replace(/[^a-z\s]/g, ''))}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              keyboardType="visible-password"
              textContentType="none"
            />

            {invalidWords.length > 0 && (
              <View style={styles.invalidRow}>
                <Feather name="alert-circle" size={14} color={T.error} />
                <Text style={[styles.invalidText, { color: T.error }]}>
                  Invalid words: {invalidWords.join(', ')}
                </Text>
              </View>
            )}

            <View style={[styles.inputFooter, { borderTopColor: T.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="lock" size={16} color={T.textMuted} />
                <Text style={[styles.encryptionText, { color: T.textMuted }]}>ENCRYPTED OFFLINE</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {mnemonic.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { haptics.selection(); setMnemonic(''); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={14} color={T.textMuted} />
                    <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: Fonts.bold }}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handlePaste}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="content-paste" size={16} color={T.primary} />
                  <Text style={{ color: T.primary, fontSize: 13, fontFamily: Fonts.bold }}>Paste</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Live Word Grid Preview */}
          {wordsArray.length > 0 && (
            <View style={[styles.gridContainer, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.inputLabel, { color: T.textMuted }]}>Parsed Word Slots</Text>
                <Text style={[styles.wordCountText, { color: isValid ? T.success : T.textMuted }]}>
                  {isValid ? 'Ready to import' : 'Checking format...'}
                </Text>
              </View>
              <View style={styles.phraseGridPreview}>
                {wordsArray.map((word, i) => {
                  const isInvalid = invalidWords.includes(word);
                  return (
                    <View
                      key={i}
                      style={[styles.wordSlotBox, {
                        backgroundColor: isInvalid ? T.error + '18' : T.surfaceLow,
                        borderColor: isInvalid ? T.error : T.border,
                      }]}
                    >
                      <Text style={[styles.wordSlotNum, { color: isInvalid ? T.error : T.textMuted }]}>{i + 1}</Text>
                      <Text style={[styles.wordSlotText, { color: isInvalid ? T.error : T.text }]} numberOfLines={1}>
                        {word}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Security Warning */}
          <View style={[styles.warningBox, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Feather name="alert-triangle" size={22} color={T.error} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warningTitle, { color: T.text }]}>Stay Private</Text>
              <Text style={[styles.warningText, { color: T.textMuted }]}>
                Never share your recovery phrase with anyone. CryptoWallet support will never ask for this information.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: T.background, borderTopColor: T.border, borderTopWidth: 1 }]}>
          <TouchableOpacity
            style={[styles.importBtn, { backgroundColor: isValid && !loading ? T.primary : T.surfaceLow }]}
            onPress={handleImport}
            disabled={loading || !isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.importBtnText, { color: isValid && !loading ? '#FFF' : T.textMuted }]}>
              Import Wallet
            </Text>
            <MaterialIcons name="chevron-right" size={24} color={isValid && !loading ? '#FFF' : T.textMuted} />
          </TouchableOpacity>
          <Text style={[styles.footerTerms, { color: T.textMuted }]}>
            By importing, you agree to our{' '}
            <Text style={{ textDecorationLine: 'underline', color: T.text, fontFamily: Fonts.bold }}>Terms of Service</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoText: { fontSize: 20, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },

  scroll: { paddingTop: 120, paddingHorizontal: 24, paddingBottom: 160 },

  title: { fontSize: 32, fontFamily: Fonts.extraBold, marginBottom: 12, lineHeight: 40, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, fontFamily: Fonts.medium, lineHeight: 24 },

  inputContainer: { borderRadius: 20, padding: 20, marginBottom: 20 },
  inputLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
  wordCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  wordCountText: { fontSize: 12, fontFamily: Fonts.bold },
  inputBlock: { fontSize: 16, minHeight: 120, lineHeight: 26, fontFamily: Fonts.medium, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4 },
  inputFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1,
  },
  encryptionText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1 },

  gridContainer: { borderRadius: 20, padding: 18, marginBottom: 20 },
  phraseGridPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordSlotBox: { width: '31%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  wordSlotNum: { fontSize: 11, fontFamily: Fonts.bold, minWidth: 16 },
  wordSlotText: { fontSize: 13, fontFamily: Fonts.bold, flex: 1 },

  warningBox: { flexDirection: 'row', gap: 16, padding: 20, borderRadius: 20, borderWidth: 1 },
  warningTitle: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 },
  warningText: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 20 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 16, gap: 12 },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 58, borderRadius: 16, gap: 8,
  },
  importBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  footerTerms: { textAlign: 'center', fontSize: 12, fontFamily: Fonts.medium },

  // Overlay
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  overlayCard: {
    width: '100%', maxWidth: 340, borderRadius: 28, borderWidth: 1,
    padding: 36, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 20,
  },
  iconWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  spinRing: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderTopColor: 'transparent', borderRightColor: 'transparent',
  },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  overlayTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 20, letterSpacing: -0.3 },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 16 },
  dot: { height: 8, borderRadius: 4 },
  overlaySubtitle: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center' },
  invalidRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 4 },
  invalidText: { fontSize: 13, fontFamily: Fonts.bold },
});

