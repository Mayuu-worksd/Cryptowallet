import React, { useState, useRef, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ScrollView, Animated, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { backupService } from '../services/backupService';
import { storageService } from '../services/storageService';
import { haptics } from '../utils/haptics';

export default function CloudBackupScreen({ navigation }: any) {
  const { isDarkMode, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  // Navigation / Stepper State
  // 0: Enter Email, 1: Verify OTP, 2: Create Password, 3: Success
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Countdown timer for OTP resend
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

  // Step 0: Send OTP
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

  // Step 1: Verify OTP
  const handleVerifyOTP = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      showToast('Verification code must be 6 digits.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await backupService.verifyOTP(email, cleanOtp);
      if (res.success) {
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

  // Step 2: Set Password & Encrypt & Upload
  const handleCreateBackup = async () => {
    if (password.length < 8) {
      showToast('Backup password must be at least 8 characters long.', 'error');
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      showToast('Password must contain both letters and numbers.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Get mnemonic from secure storage
      const mnemonic = await storageService.getMnemonic();
      if (!mnemonic) {
        throw new Error('No local wallet seed phrase found to back up.');
      }

      // 2. Encrypt and Upload
      const res = await backupService.uploadBackup(walletAddress, email, password, mnemonic);
      if (res.success) {
        haptics.success();
        showToast('Secure cloud backup completed!', 'success');
        animateToStep(3);
      } else {
        showToast(res.error || 'Failed to complete cloud backup.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to complete cloud backup.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => step > 0 && step < 3 ? animateToStep(step - 1) : navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name={step === 3 ? "close" : "arrow-back"} size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: T.primary }]}>Cloud Backup</Text>
        </View>
        {step < 3 && (
          <View style={[styles.stepIndicator, { backgroundColor: T.surfaceLow }]}>
            <Text style={[styles.stepText, { color: T.textMuted }]}>Step {step + 1} of 3</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {step === 0 && (
              <View>
                <View style={styles.iconHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: T.primary + '18' }]}>
                    <Feather name="cloud" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Secure Cloud Backup</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    Secure your digital assets with an encrypted, double-redundant backup stored in your private cloud vault. Highly secure, easy recovery.
                  </Text>
                </View>

                {/* Email Form */}
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
                  <Text style={[styles.hint, { color: T.textMuted }]}>
                    Used solely for OTP authorization during recovery.
                  </Text>
                </View>

                {/* Continue button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: T.primary }]}
                  onPress={handleSendOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
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
                    <Feather name="mail" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Verify Email</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    We've sent a 6-digit verification code to{' '}
                    <Text style={{ color: T.text, fontWeight: '700' }}>{email}</Text>.
                    {' '}Check your inbox and enter the code below.
                  </Text>
                </View>

                {/* OTP input */}
                <View style={[styles.inputGroup, { backgroundColor: T.surface }]}>
                  <Text style={[styles.label, { color: T.textMuted }]}>Verification Code</Text>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.border, fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                    placeholder="000000"
                    placeholderTextColor={T.textDim}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.resendRow}>
                    <Text style={{ color: T.textMuted, fontSize: 13 }}>Didn't receive code?</Text>
                    <TouchableOpacity
                      onPress={handleSendOTP}
                      disabled={countdown > 0}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: countdown > 0 ? T.textMuted : T.primary, fontSize: 13, fontWeight: '700' }}>
                        {countdown > 0 ? ` Resend in ${countdown}s` : ' Resend Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Continue button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: T.primary }]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
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
                  <Text style={[styles.title, { color: T.text }]}>Backup Password</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    Create a strong backup password. Your seed phrase is encrypted locally using this password before upload. Without it, your backup is completely unrecoverable.
                  </Text>
                </View>

                {/* Password input */}
                <View style={[styles.inputGroup, { backgroundColor: T.surface, gap: 16 }]}>
                  <View style={{ width: '100%' }}>
                    <Text style={[styles.label, { color: T.textMuted, marginBottom: 8 }]}>Create Password</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={[styles.input, { color: T.text, borderColor: T.border, flex: 1, paddingRight: 50 }]}
                        placeholder="Min 8 characters, letters & numbers"
                        placeholderTextColor={T.textDim}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                      >
                        <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={T.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ width: '100%' }}>
                    <Text style={[styles.label, { color: T.textMuted, marginBottom: 8 }]}>Confirm Password</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={[styles.input, { color: T.text, borderColor: T.border, flex: 1, paddingRight: 50 }]}
                        placeholder="Repeat your password"
                        placeholderTextColor={T.textDim}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        activeOpacity={0.7}
                      >
                        <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={T.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Warning Alert */}
                <View style={[styles.warningBox, { backgroundColor: T.error + '10', borderColor: T.error + '30' }]}>
                  <Feather name="alert-triangle" size={20} color={T.error} />
                  <Text style={[styles.warningText, { color: T.error }]}>
                    No one can recover your password if lost. We never store your password on our servers.
                  </Text>
                </View>

                {/* Create button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: T.primary }]}
                  onPress={handleCreateBackup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Encrypt & Back Up</Text>
                      <Feather name="shield" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View style={{ alignItems: 'center', paddingTop: 20 }}>
                <View style={[styles.iconCircle, { backgroundColor: T.success + '18', width: 96, height: 96, borderRadius: 48, marginBottom: 24 }]}>
                  <Feather name="check-circle" size={48} color={T.success} />
                </View>
                <Text style={[styles.title, { color: T.text, textAlign: 'center' }]}>Backup Complete!</Text>
                <Text style={[styles.subtitle, { color: T.textMuted, textAlign: 'center', marginHorizontal: 20, marginBottom: 40 }]}>
                  Your wallet backup has been securely encrypted locally and stored in your private cloud vault. You can now restore this wallet using your email and backup password on any device.
                </Text>

                {/* Done button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: T.primary, width: '100%' }]}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Return to Settings</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
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
  stepIndicator: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stepText: { fontSize: 12, fontWeight: '700' },

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
  hint: { fontSize: 12, marginTop: 10, lineHeight: 18 },
  resendRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },

  passwordWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  eyeBtn: { position: 'absolute', right: 16, height: '100%', justifyContent: 'center', zIndex: 10 },

  warningBox: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 24, alignItems: 'center' },
  warningText: { fontSize: 13, flex: 1, lineHeight: 18, fontFamily: Fonts.bold },

  primaryBtn: {
    height: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.extraBold },
});
