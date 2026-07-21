import React, { useState, useRef, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ScrollView, Animated, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { backupService } from '../services/backupService';
import { storageService } from '../services/storageService';
import { haptics } from '../utils/haptics';

const RECOVERY_STEPS = [
  { icon: 'download-cloud', label: 'Downloading cloud backup...' },
  { icon: 'unlock',         label: 'Decrypting keys locally...'  },
  { icon: 'check-circle',   label: 'Access restored!'            },
];

function RecoveryOverlay({ visible, isDarkMode, step }: { visible: boolean; isDarkMode: boolean; step: number }) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
    );
    spin.start();
    return () => spin.stop();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
    }
  }, [visible]);

  const spin    = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const current = RECOVERY_STEPS[step] ?? RECOVERY_STEPS[0];
  const isDone  = step === 2;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: isDarkMode ? 'rgba(10,10,10,0.96)' : 'rgba(240,242,245,0.97)' }]}>
        <Animated.View style={[styles.overlayCard, { backgroundColor: T.surface, borderColor: T.border, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconWrap}>
            {!isDone && (
              <Animated.View style={[styles.spinRing, { borderColor: T.primary, transform: [{ rotate: spin }] }]} />
            )}
            <View style={[styles.iconCircle, { backgroundColor: isDone ? T.success + '22' : T.primary + '18' }]}>
              <Feather name={current.icon as any} size={30} color={isDone ? T.success : T.primary} />
            </View>
          </View>
          <Text style={[styles.overlayTitle, { color: T.text }]}>{current.label}</Text>
          <View style={styles.dotsRow}>
            {RECOVERY_STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= step ? T.primary : T.border, width: i === step ? 20 : 8 }]} />
            ))}
          </View>
          <Text style={[styles.overlaySubtitle, { color: T.textMuted }]}>
            {isDone ? 'Taking you to your wallet...' : 'Decrypting secure offline keys'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function RecoverWalletScreen({ navigation }: any) {
  const { isDarkMode, importWallet } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayStep, setOverlayStep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const animateToStep = (nextStep: number) => {
    haptics.selection();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSendOTP = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await backupService.sendOTP(cleanEmail);
      if (res.success) {
        setCountdown(60);
        showToast(`Verification code sent to ${cleanEmail}`, 'success');
        animateToStep(1);
      } else {
        showToast(res.error || 'Failed to send verification code.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'An error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      showToast('Please enter the verification code.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await backupService.verifyOTP(email, cleanOtp);
      if (res.success) {
        setOtpVerified(true);
        await storageService.setVerifiedEmail(email);
        showToast('Email verified successfully!', 'success');
        animateToStep(2);
      } else {
        showToast(res.error || 'Invalid or expired code. Please request a new one.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Verification failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverWallet = async () => {
    if (!password) {
      showToast('Please enter your backup password.', 'error');
      return;
    }
    // Guard: OTP must have been verified in this session before recovery is allowed
    if (!otpVerified) {
      showToast('Email verification required before recovery. Please restart the process.', 'error');
      animateToStep(0);
      return;
    }
    setOverlayStep(0);
    setOverlayVisible(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setOverlayStep(1);
      const res = await backupService.recoverWallet(email, password);
      if (!res.success || !res.mnemonic) throw new Error(res.error || 'Failed to decrypt backup.');
      await new Promise(resolve => setTimeout(resolve, 800));
      setOverlayStep(2);
      await importWallet(res.mnemonic);
      haptics.success();
      showToast('Wallet recovered successfully!', 'success');
      setTimeout(() => setOverlayVisible(false), 1000);
    } catch (e: any) {
      setOverlayVisible(false);
      showToast(e.message || 'Incorrect backup password or corrupted data.', 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <RecoveryOverlay visible={overlayVisible} isDarkMode={isDarkMode} step={overlayStep} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)', paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => step > 0 ? animateToStep(step - 1) : navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: T.primary }]}>Recover Wallet</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {step === 0 && (
              <View>
                <View style={styles.iconHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: T.primary + '18' }]}>
                    <Feather name="mail" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Email Recovery</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    Enter your registered email address to locate and restore your encrypted cloud wallet backup.
                  </Text>
                </View>
                <View style={[styles.inputGroup, { backgroundColor: T.surface }]}>
                  <Text style={[styles.label, { color: T.textMuted }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.border }]}
                    placeholder="Enter your backup email"
                    placeholderTextColor={T.textDim}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: T.primary }]} onPress={handleSendOTP} disabled={loading} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                      <Feather name="arrow-right" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === 1 && (
              <View>
                <View style={styles.iconHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: T.primary + '18' }]}>
                    <Feather name="shield" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Enter Code</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    We've sent a verification code to{' '}
                    <Text style={{ color: T.text, fontWeight: '700' }}>{email}</Text>.
                    {' '}Enter it below to authorize recovery.
                  </Text>
                </View>
                <View style={[styles.inputGroup, { backgroundColor: T.surface }]}>
                  <Text style={[styles.label, { color: T.textMuted }]}>Verification Code</Text>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.border, fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                    placeholder="00000000"
                    placeholderTextColor={T.textDim}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                  <View style={styles.resendRow}>
                    <Text style={{ color: T.textMuted, fontSize: 13 }}>Didn't receive code?</Text>
                    <TouchableOpacity onPress={handleSendOTP} disabled={countdown > 0} activeOpacity={0.7}>
                      <Text style={{ color: countdown > 0 ? T.textMuted : T.primary, fontSize: 13, fontWeight: '700' }}>
                        {countdown > 0 ? ` Resend in ${countdown}s` : ' Resend Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: T.primary }]} onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Text style={styles.primaryBtnText}>Verify Code</Text>
                      <Feather name="check" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View>
                <View style={styles.iconHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: T.primary + '18' }]}>
                    <Feather name="lock" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Enter Password</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    Input the backup password you created when establishing this cloud backup.
                  </Text>
                </View>
                <View style={[styles.inputGroup, { backgroundColor: T.surface }]}>
                  <Text style={[styles.label, { color: T.textMuted }]}>Backup Password</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, { color: T.text, borderColor: T.border, flex: 1, paddingRight: 50 }]}
                      placeholder="Enter backup password"
                      placeholderTextColor={T.textDim}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={T.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: T.primary }]} onPress={handleRecoverWallet} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>Download & Decrypt</Text>
                  <Feather name="download-cloud" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { paddingTop: 130, paddingHorizontal: 24, paddingBottom: 60 },
  iconHeader: { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontFamily: Fonts.extraBold, marginBottom: 12, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 },
  inputGroup: { padding: 20, borderRadius: 16, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  input: {
    height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 16, fontFamily: Fonts.bold, backgroundColor: 'rgba(0,0,0,0.15)',
  },
  resendRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  eyeBtn: { position: 'absolute', right: 16, height: '100%', justifyContent: 'center', zIndex: 10 },
  primaryBtn: {
    height: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.extraBold },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
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
  overlayTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 16 },
  dot: { height: 8, borderRadius: 4 },
  overlaySubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
