import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert, Animated, Modal,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';

const SAVING_STEPS = [
  { icon: 'lock',         label: 'Encrypting keys...' },
  { icon: 'shield',       label: 'Securing wallet...' },
  { icon: 'check-circle', label: 'Wallet ready!'      },
];

function SavingOverlay({ visible, done, isDarkMode }: { visible: boolean; done: boolean; isDarkMode: boolean }) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const stepFade  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) { fadeAnim.setValue(0); scaleAnim.setValue(0.85); setStep(0); return; }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: true }),
    ]).start();
    const spin = Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true }));
    spin.start();
    const t = setTimeout(() => setStep(1), 600);
    return () => { spin.stop(); clearTimeout(t); };
  }, [visible]);

  useEffect(() => {
    if (!done) return;
    Animated.sequence([
      Animated.timing(stepFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(stepFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(2);
  }, [done]);

  const spin    = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const current = SAVING_STEPS[step] ?? SAVING_STEPS[0];
  const isDone  = step === 2;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ovStyles.overlay, { opacity: fadeAnim, backgroundColor: isDarkMode ? 'rgba(10,10,10,0.96)' : 'rgba(240,242,245,0.97)' }]}>
        <Animated.View style={[ovStyles.card, { backgroundColor: T.surface, borderColor: T.border, transform: [{ scale: scaleAnim }] }]}>
          <View style={ovStyles.iconWrap}>
            {!isDone && <Animated.View style={[ovStyles.spinRing, { borderColor: T.primary, transform: [{ rotate: spin }] }]} />}
            <View style={[ovStyles.iconCircle, { backgroundColor: isDone ? T.success + '20' : T.primary + '18' }]}>
              <Feather name={current.icon as any} size={32} color={isDone ? T.success : T.primary} />
            </View>
          </View>
          <Animated.Text style={[ovStyles.title, { color: T.text, opacity: stepFade }]}>{current.label}</Animated.Text>
          <View style={ovStyles.dotsRow}>
            {SAVING_STEPS.map((_, i) => (
              <View key={i} style={[ovStyles.dot, { backgroundColor: i <= step ? T.primary : T.border, width: i === step ? 20 : 8 }]} />
            ))}
          </View>
          <Text style={[ovStyles.subtitle, { color: T.textMuted }]}>
            {isDone ? 'Taking you to your wallet...' : 'Please wait, do not close the app'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

type Step = 'info' | 'phrase' | 'verify' | 'done';

export default function CreateWalletScreen({ navigation }: any) {
  const { createWallet, importWallet, isDarkMode } = useWallet();
  const [loading, setLoading]       = useState(false);
  const [savingDone, setSavingDone] = useState(false);
  const [step, setStep]             = useState<Step>('info');
  const [mnemonic, setMnemonic]     = useState('');
  const [confirmed, setConfirmed]   = useState(false);
  const [shuffledWords, setShuffled] = useState<string[]>([]);
  const [selectedWords, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'success' });

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const handleCreate = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      const data = await createWallet();
      setMnemonic(data.mnemonic);
      setStep('phrase');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to create wallet. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPhrase = async () => {
    await Clipboard.setStringAsync(mnemonic);
    showToast('Seed phrase copied. Store it somewhere safe!', 'info');
  };

  const handleConfirm = () => {
    if (!confirmed) {
      Alert.alert('Backup Required', 'Please confirm you have saved your seed phrase before continuing.');
      return;
    }
    const w = mnemonic.split(' ');
    setShuffled([...w].sort(() => Math.random() - 0.5));
    setSelected([]);
    setStep('verify');
  };

  const handleVerifyWord = (word: string) => {
    setSelected(prev => [...prev, word]);
    setShuffled(prev => {
      const next = [...prev];
      next.splice(next.indexOf(word), 1);
      return next;
    });
  };

  const handleRemoveWord = (word: string, idx: number) => {
    setSelected(prev => prev.filter((_, i) => i !== idx));
    setShuffled(prev => [...prev, word].sort(() => Math.random() - 0.5));
  };

  const handleGoToWallet = async () => {
    if (loading) return; // prevent double-call
    setStep('done');
    setLoading(true);
    setSavingDone(false);
    await new Promise(r => setTimeout(r, 100));
    try {
      await importWallet(mnemonic);
      setSavingDone(true);
      await new Promise(r => setTimeout(r, 900));
    } catch (e) {
      setLoading(false);
      setSavingDone(false);
      setStep('verify');
      showToast('Failed to save wallet.', 'error');
    }
  };

  const isVerificationCorrect = selectedWords.join(' ') === mnemonic;
  const words = mnemonic.split(' ');

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <SavingOverlay visible={loading && step === 'done'} done={savingDone} isDarkMode={isDarkMode} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => step === 'phrase' ? setStep('info') : navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: T.primary }]}>CryptoWallet</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['info', 'phrase', 'verify', 'done'] as Step[]).map(s => (
            <View key={s} style={[styles.stepDot, { backgroundColor: step === s ? T.primary : T.border }]} />
          ))}
        </View>
      </View>

      {/* STEP 1: Info */}
      {step === 'info' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ marginBottom: 40 }}>
            <Text style={[styles.title, { color: T.text }]}>Create Wallet</Text>
            <Text style={[styles.subtitle, { color: T.textMuted }]}>
              Generate a completely new, secure private key on your device. Fully decentralized and{' '}
              <Text style={{ color: T.primary, fontWeight: '700' }}>anonymous.</Text>
            </Text>
          </View>
          <View style={[styles.infoContainer, { backgroundColor: T.surfaceLow }]}>
            {[
              'Securely generated strictly locally.',
              'No KYC or personal information required.',
              'Full access to global decentralized networks.',
            ].map((desc, i) => (
              <View key={i} style={[styles.stepBox, i < 2 && { marginBottom: 20 }]}>
                <View style={[styles.stepNum, { backgroundColor: T.primaryLight + '20' }]}>
                  <Text style={[styles.stepNumTxt, { color: T.primary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepDesc, { color: T.text }]}>{desc}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.warningBox, { backgroundColor: T.surface, borderColor: T.border }]}>
            <MaterialIcons name="security" size={24} color="#ff544e" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warningTitle, { color: T.text }]}>Self Custody</Text>
              <Text style={[styles.warningText, { color: T.textMuted }]}>
                You must manually backup your recovery phrase in the next screen. If you lose it, you lose your wallet permanently.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* STEP 2: Seed Phrase */}
      {step === 'phrase' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: T.text }]}>Your Seed Phrase</Text>
          <Text style={[styles.subtitle, { color: T.textMuted }]}>
            Write these 12 words down in order and store them somewhere safe. This is the{' '}
            <Text style={{ color: T.error, fontWeight: '700' }}>only way</Text> to recover your wallet.
          </Text>
          <View style={[styles.phraseGrid, { backgroundColor: T.surface, borderColor: T.border }]}>
            {words.map((word, i) => (
              <View key={i} style={[styles.wordBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                <Text style={[styles.wordNum, { color: T.textMuted }]}>{i + 1}</Text>
                <Text style={[styles.wordText, { color: T.text }]}>{word}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.copyBtn, { borderColor: T.border, backgroundColor: T.surface }]} onPress={handleCopyPhrase} activeOpacity={0.7}>
            <Feather name="copy" size={16} color={T.primary} />
            <Text style={[styles.copyBtnText, { color: T.primary }]}>Copy to Clipboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmed(p => !p)} activeOpacity={0.7}>
            <View style={[styles.checkbox, { borderColor: confirmed ? T.primary : T.border, backgroundColor: confirmed ? T.primary : 'transparent' }]}>
              {confirmed && <Feather name="check" size={14} color="#FFF" />}
            </View>
            <Text style={[styles.checkText, { color: T.textMuted }]}>
              I have safely stored my seed phrase and understand I cannot recover it if lost.
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 3: Verify */}
      {step === 'verify' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: T.text }]}>Verify Phrase</Text>
          <Text style={[styles.subtitle, { color: T.textMuted }]}>
            Tap the words in the correct order to prove you have securely backed up your phrase.
          </Text>
          <View style={[styles.phraseGrid, { backgroundColor: T.surface, borderColor: T.border, minHeight: 120, marginBottom: 32 }]}>
            {selectedWords.length === 0 && (
              <Text style={{ color: T.textDim, fontSize: 13, textAlign: 'center', width: '100%', marginTop: 20 }}>
                Selected words will appear here...
              </Text>
            )}
            {selectedWords.map((word, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.wordBox, { backgroundColor: T.primary + '10', borderColor: T.primary + '40' }]}
                onPress={() => handleRemoveWord(word, i)}
              >
                <Text style={[styles.wordNum, { color: T.primary }]}>{i + 1}</Text>
                <Text style={[styles.wordText, { color: T.text }]}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {shuffledWords.map((word, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.verifyWordChip, { backgroundColor: T.surface, borderColor: T.border }]}
                onPress={() => handleVerifyWord(word)}
              >
                <Text style={[styles.verifyWordText, { color: T.text }]}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!isVerificationCorrect && selectedWords.length === words.length && (
            <View style={[styles.errorRow, { marginTop: 24, justifyContent: 'center' }]}>
              <Feather name="alert-circle" size={14} color={T.error} />
              <Text style={{ color: T.error, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>
                Order is incorrect. Please try again.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* STEP 4: Done */}
      {step === 'done' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[styles.successIcon, { backgroundColor: T.success + '20' }]}>
            <Feather name="check-circle" size={56} color={T.success} />
          </View>
          <Text style={[styles.title, { color: T.text, textAlign: 'center', marginTop: 24 }]}>Wallet Created!</Text>
          <Text style={[styles.subtitle, { color: T.textMuted, textAlign: 'center' }]}>
            Your wallet is ready. You can now send, receive, and manage your crypto assets.
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: T.background }]}>
        {step === 'info' && (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: T.primaryDark, opacity: loading ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Text style={styles.primaryBtnText}>Generate New Wallet</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ImportWallet')} activeOpacity={0.7}>
              <Text style={[styles.footerLink, { color: T.textMuted }]}>
                Already have a wallet?{' '}
                <Text style={{ textDecorationLine: 'underline', color: T.text }}>Import instead.</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'phrase' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: confirmed ? T.primaryDark : T.surfaceLow }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryBtnText, { color: confirmed ? '#FFF' : T.textMuted }]}>I've Saved My Phrase</Text>
            <MaterialIcons name="chevron-right" size={24} color={confirmed ? '#FFF' : T.textMuted} />
          </TouchableOpacity>
        )}

        {step === 'verify' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: isVerificationCorrect ? T.primary : T.surfaceLow }]}
            onPress={() => isVerificationCorrect && handleGoToWallet()}
            activeOpacity={0.8}
            disabled={!isVerificationCorrect}
          >
            <Text style={[styles.primaryBtnText, { color: isVerificationCorrect ? '#FFF' : T.textMuted }]}>
              {isVerificationCorrect ? 'Verify & Continue' : 'Select Words in Order'}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color={isVerificationCorrect ? '#FFF' : T.textMuted} />
          </TouchableOpacity>
        )}

        {step === 'done' && (
          <View style={[styles.primaryBtn, { backgroundColor: T.surfaceLow, opacity: 0.5 }]}>
            <ActivityIndicator color="#FFF" />
          </View>
        )}
      </View>
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
  iconBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  stepDot:  { width: 8, height: 8, borderRadius: 4 },
  scroll:   { paddingTop: 130, paddingHorizontal: 24, paddingBottom: 160 },

  title:    { fontSize: 36, fontWeight: '800', marginBottom: 12, lineHeight: 44, letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 24, marginBottom: 32 },

  infoContainer: { borderRadius: 16, padding: 20, marginBottom: 24 },
  stepBox:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepNum:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt:{ fontSize: 13, fontWeight: '800' },
  stepDesc:  { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22 },

  warningBox:   { flexDirection: 'row', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1 },
  warningTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  warningText:  { fontSize: 13, lineHeight: 20 },

  phraseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  wordBox:    { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  wordNum:    { fontSize: 11, fontWeight: '700', minWidth: 16 },
  wordText:   { fontSize: 14, fontWeight: '700', flex: 1 },

  copyBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  copyBtnText: { fontSize: 14, fontWeight: '700' },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkText: { flex: 1, fontSize: 14, lineHeight: 22 },

  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 16, gap: 16 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 64, borderRadius: 16, gap: 8,
    shadowColor: '#FF544E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  footerLink:     { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  verifyWordChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  verifyWordText: { fontSize: 14, fontWeight: '700' },
  errorRow:       { flexDirection: 'row', alignItems: 'center' },
});

const ovStyles = StyleSheet.create({
  overlay:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card:       { width: '100%', maxWidth: 340, borderRadius: 28, borderWidth: 1, padding: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 20 },
  iconWrap:   { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  spinRing:   { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3 },
  dotsRow:    { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 16 },
  dot:        { height: 8, borderRadius: 4 },
  subtitle:   { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
