import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Modal,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Theme } from '../constants';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';

// Two-step overlay: loading → success
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

  // Spin animation while loading
  useEffect(() => {
    if (!visible) return;
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    spin.start();
    return () => spin.stop();
  }, [visible]);

  // Fade-in on mount, reset on hide
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

  // Jump to success step when done
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
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: isDarkMode ? 'rgba(10,10,10,0.96)' : 'rgba(240,242,245,0.97)' }]}>
        <Animated.View style={[styles.overlayCard, { backgroundColor: T.surface, borderColor: T.border, transform: [{ scale: scaleAnim }] }]}>

          {/* Icon with spinner ring */}
          <View style={styles.iconWrap}>
            {!isDone && (
              <Animated.View style={[styles.spinRing, { borderColor: T.primary, transform: [{ rotate: spin }] }]} />
            )}
            <View style={[styles.iconCircle, { backgroundColor: isDone ? T.success + '22' : T.primary + '18' }]}>
              <Feather name={current.icon as any} size={30} color={isDone ? T.success : T.primary} />
            </View>
          </View>

          {/* Label */}
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
  const [invalidWords, setInvalidWords] = useState<string[]>([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'success' | 'error' | 'info' });
  const { importWallet, isDarkMode, hasWallet } = useWallet();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  // Real-time validation
  useEffect(() => {
    if (!mnemonic.trim()) { setInvalidWords([]); return; }
    const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    // Basic check: BIP39 words are 3-8 chars, letters only
    const invalid = words.filter(w => !/^[a-z]{3,8}$/.test(w));
    setInvalidWords(invalid);
  }, [mnemonic]);

  // Once import succeeds + hasWallet is true, close overlay quickly and let App.tsx navigate
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
    const text = await Clipboard.getStringAsync();
    if (text) {
      // Clean up pasted text: lowercase, remove numbers like "1. ", and collapse spaces
      const clean = text.toLowerCase()
        .replace(/\d+\./g, ' ') // remove "1. ", "2. "
        .replace(/[^a-z\s]/g, ' ') // remove any non-alpha chars
        .replace(/\s+/g, ' ') // collapse spaces
        .trim();
      setMnemonic(clean);
    }
  };

  const handleImport = () => {
    const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const words   = trimmed.split(' ');

    if (invalidWords.length > 0) {
      showToast(`Invalid words found: ${invalidWords.join(', ')}`, 'error');
      return;
    }

    if (!VALID_COUNTS.includes(words.length)) {
      showToast(`Seed phrase must be 12, 15, 18, 21, or 24 words. (You have ${words.length})`, 'error');
      return;
    }
    setLoading(true);
    setImportDone(false);

    // Small defer so the Modal mounts and animates before the JS thread gets busy
    setTimeout(async () => {
      try {
        await importWallet(trimmed);
        setImportDone(true); // triggers success step in overlay
      } catch (e: any) {
        setLoading(false);
        setImportDone(false);
        // If checksum fails but words are valid
        showToast('Checksum failed. Ensure words are in the correct order.', 'error');
      }
    }, 50);
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <ImportingOverlay visible={loading} isDarkMode={isDarkMode} done={importDone} />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
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
              <Text style={{ color: T.primary, fontWeight: '700' }}>12 or 24-word recovery phrase</Text>
              {' '}in correct order to restore your assets.
            </Text>
          </View>

          {/* Input Area */}
          <View style={[styles.inputContainer, { backgroundColor: T.surfaceLow }]}>
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
              style={[styles.inputBlock, { color: T.text }]}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="lock" size={16} color={T.textMuted} />
                <Text style={[styles.encryptionText, { color: T.textMuted }]}>ENCRYPTED OFFLINE</Text>
              </View>
              <TouchableOpacity
                onPress={handlePaste}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="content-paste" size={16} color={T.primary} />
                <Text style={{ color: T.primary, fontSize: 13, fontWeight: '700' }}>Paste</Text>
              </TouchableOpacity>
            </View>
          </View>

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
        <View style={[styles.footer, { backgroundColor: T.background }]}>
          <TouchableOpacity
            style={[styles.importBtn, { backgroundColor: isValid && !loading ? T.primaryDark : T.surfaceLow }]}
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
            <Text style={{ textDecorationLine: 'underline', color: T.text }}>Terms of Service</Text>
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
    paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },

  scroll: { paddingTop: 130, paddingHorizontal: 24, paddingBottom: 160 },

  title: { fontSize: 36, fontWeight: '800', marginBottom: 12, lineHeight: 44, letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 24 },

  inputContainer: { borderRadius: 16, padding: 20, marginBottom: 24 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  wordCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  wordCountText: { fontSize: 12, fontWeight: '700' },
  inputBlock: { fontSize: 17, minHeight: 120, lineHeight: 28, fontWeight: '500', textAlignVertical: 'top' },
  inputFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1,
  },
  encryptionText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  warningBox: { flexDirection: 'row', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1 },
  warningTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  warningText: { fontSize: 13, lineHeight: 20 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 16, gap: 12 },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 64, borderRadius: 16, gap: 8,
    shadowColor: '#FF544E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  importBtnText: { fontSize: 18, fontWeight: '800' },
  footerTerms: { textAlign: 'center', fontSize: 12 },

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
  overlayTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3 },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 16 },
  dot: { height: 8, borderRadius: 4 },
  overlaySubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  invalidRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 4 },
  invalidText: { fontSize: 13, fontWeight: '700' },
});
