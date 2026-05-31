import React, { useState, useRef, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ScrollView, Animated, ActivityIndicator, StatusBar,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { backupService } from '../services/backupService';
import { storageService } from '../services/storageService';
import { haptics } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

function GlowingOrb({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[
      { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
      { backgroundColor: color, transform: [{ scale: pulse }] }
    ]} />
  );
}

export default function CloudBackupScreen({ navigation }: any) {
  const { isDarkMode, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(T, isDarkMode), [T, isDarkMode]);

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [alreadyBacked, setAlreadyBacked] = useState(false);
  const [checkingBackup, setCheckingBackup] = useState(true);

  const confirmPasswordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Check if backup already exists on mount
  useEffect(() => {
    if (!walletAddress) { setCheckingBackup(false); return; }
    backupService.checkBackupExists(walletAddress)
      .then(exists => { setAlreadyBacked(exists); setCheckingBackup(false); })
      .catch(() => setCheckingBackup(false));
  }, [walletAddress]);

  // Focus states for dynamic border highlights
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  // Guard to trigger haptic success only once when password becomes fully valid
  const [hasTriggeredSuccessHaptic, setHasTriggeredSuccessHaptic] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Auto-dismiss keyboard + scroll to confirm when password becomes valid
  const prevPasswordValid = useRef(false);
  useEffect(() => {
    if (step !== 2) return;
    if (isPasswordValid && !prevPasswordValid.current) {
      Keyboard.dismiss();
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => confirmPasswordRef.current?.focus(), 350);
      }, 200);
    }
    prevPasswordValid.current = isPasswordValid;
  }, [isPasswordValid, step]);

  // 1. Password Checks
  const isLengthValid = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  const isPasswordValid = isLengthValid && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = password === confirmPassword && confirmPassword !== '';
  const canContinue = isPasswordValid && passwordsMatch;

  // Trigger haptic feedback when transition to fully valid happens
  useEffect(() => {
    if (step === 2) {
      if (canContinue && !hasTriggeredSuccessHaptic) {
        haptics.success();
        setHasTriggeredSuccessHaptic(true);
      } else if (!canContinue && hasTriggeredSuccessHaptic) {
        setHasTriggeredSuccessHaptic(false);
      }
    }
  }, [canContinue, step, hasTriggeredSuccessHaptic]);

  // Live password strength scorer
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: 'Not Started', score: 0, color: T.textDim, bars: [0, 0, 0, 0, 0, 0] };
    
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*]/.test(pwd)) score += 1;

    let label = 'Weak';
    let color = T.primary; // Primary Red
    let filledBars = 2;

    if (score >= 5) {
      label = 'Strong';
      color = T.success; // Success Green
      filledBars = 6;
    } else if (score >= 3) {
      label = 'Medium';
      color = T.pending || '#F59E0B'; // Pending Yellow/Orange
      filledBars = 4;
    }

    const bars = Array.from({ length: 6 }, (_, i) => (i < filledBars ? 1 : 0));
    return { label, score, color, bars };
  };

  const strength = getPasswordStrength(password);

  // Live friendly error message guide
  const getHelperErrorMessage = () => {
    if (password === '') return '';
    if (!isLengthValid) return 'Password too short';
    if (!hasUppercase) return 'Missing uppercase letter';
    if (!hasLowercase) return 'Missing lowercase letter';
    if (!hasNumber) return 'Missing number';
    if (!hasSpecial) return 'Missing special character (!@#$%^&*)';
    if (confirmPassword !== '' && !passwordsMatch) return 'Passwords do not match';
    return '';
  };

  const helperError = getHelperErrorMessage();

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

  const handleCreateBackup = async () => {
    if (!canContinue) {
      haptics.error();
      if (helperError) showToast(helperError, 'error');
      return;
    }
    setLoading(true);
    try {
      const mnemonic = await storageService.getMnemonic();
      if (!mnemonic) throw new Error('No local wallet seed phrase found to back up.');
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

  // Border highlight helpers
  const getPasswordBorderColor = () => {
    if (isPasswordFocused) return T.primary;
    if (password === '') return T.border;
    return isPasswordValid ? T.success : T.primary;
  };

  const getConfirmPasswordBorderColor = () => {
    if (isConfirmPasswordFocused) return T.primary;
    if (confirmPassword === '') return T.border;
    return passwordsMatch ? T.success : T.primary;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => step > 0 && step < 3 ? animateToStep(step - 1) : navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name={step === 3 || alreadyBacked ? 'close' : 'arrow-back'} size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: T.primary }]}>Cloud Backup</Text>
        </View>
        {step < 3 && !alreadyBacked && (
          <View style={[styles.stepIndicator, { backgroundColor: T.surfaceLow }]}>
            <Text style={[styles.stepText, { color: T.textMuted }]}>Step {step + 1} of 3</Text>
          </View>
        )}
      </View>

      {checkingBackup ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : alreadyBacked ? (
        <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center', paddingTop: 60 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            <GlowingOrb color={T.success + '30'} />
            <LinearGradient
              colors={[T.success, '#059669']}
              style={styles.glowingIconCircle}
            >
              <Feather name="check" size={44} color="#FFF" />
            </LinearGradient>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: T.success + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: T.success }]}>PROTECTED</Text>
          </View>
          <Text style={[styles.title, { color: T.text, textAlign: 'center' }]}>Already Backed Up</Text>
          <Text style={[styles.subtitle, { color: T.textMuted, textAlign: 'center', marginHorizontal: 20, marginBottom: 32 }]}>
            Your wallet is already securely backed up in the cloud. You can restore it anytime using your email and backup password.
          </Text>
          <View style={[{ width: '100%', borderRadius: 24, padding: 24, marginBottom: 28 }, { backgroundColor: T.surfaceLow }]}>
            {[
              { icon: 'shield', label: 'End-to-end encrypted', color: T.success },
              { icon: 'cloud', label: 'Stored in your private vault', color: T.primary },
              { icon: 'refresh-cw', label: 'Restorable on any device', color: T.textDim },
            ].map((item, idx, arr) => (
              <View key={item.label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={{ color: T.text, fontSize: 15, fontFamily: Fonts.bold }}>{item.label}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity style={[styles.primaryBtn, { width: '100%', marginBottom: 16, height: 64, borderRadius: 32 }]} onPress={() => { setAlreadyBacked(false); setStep(0); }} activeOpacity={0.8}>
            <LinearGradient colors={[T.primary, '#D32F2F']} style={styles.primaryBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={[styles.primaryBtnText, { fontSize: 18 }]}>Update Backup</Text>
              <Feather name="refresh-cw" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={{ height: 56, alignItems: 'center', justifyContent: 'center' }} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={{ color: T.textDim, fontSize: 16, fontFamily: Fonts.bold }}>Return to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {step === 0 && (
              <View>
                <View style={styles.iconHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: T.primary + '18' }]}>
                    <Feather name="cloud" size={32} color={T.primary} />
                  </View>
                  <Text style={[styles.title, { color: T.text }]}>Secure Cloud Backup</Text>
                  <Text style={[styles.subtitle, { color: T.textMuted }]}>
                    Secure your digital assets with an encrypted, double-redundant backup stored in your private cloud vault.
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
                  <Text style={[styles.hint, { color: T.textMuted }]}>Used solely for OTP authorization during recovery.</Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSendOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Send Verification Code button"
                >
                  {loading ? (
                    <View style={styles.primaryBtnGradient}>
                      <ActivityIndicator color="#FFF" />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[T.primary, '#D32F2F']}
                      style={styles.primaryBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                      <Feather name="arrow-right" size={18} color="#FFF" />
                    </LinearGradient>
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
                    We've sent a verification code to{' '}
                    <Text style={{ color: T.text, fontWeight: '700' }}>{email}</Text>. Check your inbox and enter the code below.
                  </Text>
                </View>
                <View style={[styles.inputGroup, { backgroundColor: T.surface }]}>
                  <Text style={[styles.label, { color: T.textMuted }]}>Verification Code</Text>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.border, fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                    placeholder="000000"
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
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Verify OTP Code button"
                >
                  {loading ? (
                    <View style={styles.primaryBtnGradient}>
                      <ActivityIndicator color="#FFF" />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={[T.primary, '#D32F2F']}
                      style={styles.primaryBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.primaryBtnText}>Verify Code</Text>
                      <Feather name="check" size={18} color="#FFF" />
                    </LinearGradient>
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
                    Create a strong backup password. Your seed phrase is encrypted locally using this password before upload.
                  </Text>
                </View>

                <View style={[styles.inputGroup, { backgroundColor: T.surface, gap: 16 }]}>
                  
                  {/* Create Password Input */}
                  <View style={{ width: '100%' }}>
                    <Text style={[styles.label, { color: T.textMuted, marginBottom: 8 }]}>Create Password</Text>
                    <View style={[styles.passwordWrapper, { borderColor: getPasswordBorderColor() }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: T.text }]}
                        placeholder="Min 8 chars, letters & numbers"
                        placeholderTextColor={T.textDim}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        accessible={true}
                        accessibilityLabel="Create Backup Password Input"
                      />
                      <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                        <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={T.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Password Strength Meter */}
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthHeaderRow}>
                      <Text style={styles.strengthLabel}>Security Strength</Text>
                      {password !== '' && (
                        <Text style={[styles.strengthValue, { color: strength.color }]}>
                          {strength.label}
                        </Text>
                      )}
                    </View>
                    <View style={styles.strengthBarContainer}>
                      {strength.bars.map((filled, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.strengthBarSegment,
                            { backgroundColor: filled ? strength.color : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#E4E7EC') }
                          ]}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Live Password Requirements Checklist - Sleek Horizontal Chips */}
                  <View style={styles.checklistContainer}>
                    {[
                      { key: 'length', text: '8+ chars', valid: isLengthValid },
                      { key: 'uppercase', text: 'A-Z', valid: hasUppercase },
                      { key: 'lowercase', text: 'a-z', valid: hasLowercase },
                      { key: 'number', text: '0-9', valid: hasNumber },
                      { key: 'special', text: 'Special (!@#)', valid: hasSpecial },
                    ].map((req) => {
                      const empty = password === '';
                      const status = empty ? 'pending' : req.valid ? 'success' : 'error';
                      
                      let iconName: any = 'ellipse-outline';
                      let iconColor = T.textDim;
                      let chipBg = isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#F2F4F7';
                      let chipBorder = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#E4E7EC';
                      let textColor = T.textMuted;
                      
                      if (status === 'success') {
                        iconName = 'checkmark-circle';
                        iconColor = T.success;
                        chipBg = T.success + '0A';
                        chipBorder = T.success + '20';
                        textColor = T.success;
                      } else if (status === 'error') {
                        iconName = 'close-circle';
                        iconColor = T.primary;
                        chipBg = T.primary + '0A';
                        chipBorder = T.primary + '20';
                        textColor = T.primary;
                      }

                      return (
                        <View key={req.key} style={[styles.checkRow, { backgroundColor: chipBg, borderColor: chipBorder }]}>
                          <Ionicons name={iconName} size={12} color={iconColor} />
                          <Text style={[styles.checkText, { color: textColor }]}>
                            {req.text}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Confirm Password Input */}
                  <View style={{ width: '100%', marginTop: 4 }}>
                    <Text style={[styles.label, { color: T.textMuted, marginBottom: 8 }]}>Confirm Password</Text>
                    <View style={[styles.passwordWrapper, { borderColor: getConfirmPasswordBorderColor() }]}>
                      <TextInput
                        ref={confirmPasswordRef}
                        style={[styles.passwordInput, { color: T.text }]}
                        placeholder="Repeat your password"
                        placeholderTextColor={T.textDim}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setIsConfirmPasswordFocused(true)}
                        onBlur={() => setIsConfirmPasswordFocused(false)}
                        accessible={true}
                        accessibilityLabel="Confirm Backup Password Input"
                      />
                      <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)} activeOpacity={0.7}>
                        <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={T.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Live Match Validator */}
                    {confirmPassword !== '' && (
                      <View style={styles.matchStatusContainer}>
                        <Ionicons 
                          name={passwordsMatch ? 'checkmark-circle' : 'close-circle'} 
                          size={14} 
                          color={passwordsMatch ? T.success : T.primary} 
                        />
                        <Text style={[styles.matchStatusText, { color: passwordsMatch ? T.success : T.primary }]}>
                          {passwordsMatch ? 'Passwords Match' : 'Passwords Do Not Match'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Live Error Indicator Helper */}
                  {!!helperError && (
                    <View style={styles.errorIndicatorRow}>
                      <Feather name="info" size={12} color={T.primary} />
                      <Text style={styles.errorIndicatorText}>{helperError}</Text>
                    </View>
                  )}
                </View>

                {/* Warning Alert Banner */}
                <View style={[styles.warningBox, { backgroundColor: T.error + '10', borderColor: T.error + '30' }]}>
                  <Feather name="alert-triangle" size={18} color={T.error} />
                  <Text style={[styles.warningText, { color: T.error }]}>
                    No one can recover your password if lost. We never store your password on our servers.
                  </Text>
                </View>

                {/* Submit Action Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { opacity: canContinue && !loading ? 1 : 0.5 }]}
                  onPress={handleCreateBackup}
                  disabled={!canContinue || loading}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Encrypt and Backup Seed Phrase button"
                  accessibilityState={{ disabled: !canContinue }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <LinearGradient
                      colors={canContinue ? [T.primary, '#D32F2F'] : [T.surfaceLow, T.surfaceLow]}
                      style={styles.primaryBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.primaryBtnText}>Encrypt & Back Up</Text>
                      <Feather name="shield" size={18} color="#FFF" />
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <View style={styles.heroWrap}>
                  <GlowingOrb color={T.success + '30'} />
                  <LinearGradient
                    colors={[T.success, '#059669']}
                    style={styles.glowingIconCircle}
                  >
                    <Feather name="shield" size={44} color="#FFF" />
                  </LinearGradient>
                </View>
                
                <View style={[styles.statusBadge, { backgroundColor: T.success + '15' }]}>
                  <Text style={[styles.statusBadgeText, { color: T.success }]}>BACKUP COMPLETE</Text>
                </View>

                <Text style={[styles.title, { color: T.text, textAlign: 'center' }]}>Protected</Text>
                <Text style={[styles.subtitle, { color: T.textMuted, textAlign: 'center', marginHorizontal: 20, marginBottom: 40 }]}>
                  Your wallet backup has been securely encrypted and stored. You can restore this wallet using your email and backup password on any device.
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { width: '100%', height: 64, borderRadius: 32 }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[T.primary, '#D32F2F']}
                    style={styles.primaryBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={[styles.primaryBtnText, { fontSize: 18 }]}>Return to Settings</Text>
                    <Feather name="arrow-right" size={20} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (T: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E4E7EC',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  logoText: { fontSize: 18, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
  stepIndicator: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stepText: { fontSize: 12, fontFamily: Fonts.bold },

  scroll: { paddingTop: 100, paddingHorizontal: 24, paddingBottom: 60 },
  iconHeader: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  
  heroWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  glowingIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  statusBadgeText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1 },

  title: { fontSize: 32, fontFamily: Fonts.extraBold, marginBottom: 12, letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontSize: 16, fontFamily: Fonts.medium, lineHeight: 24, textAlign: 'center', paddingHorizontal: 12 },
  
  inputGroup: { padding: 20, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E4E7EC' },
  label: { fontSize: 11, fontFamily: Fonts.extraBold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  input: {
    height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 16, fontFamily: Fonts.bold, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F2F4F7',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E4E7EC',
  },
  hint: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 10, lineHeight: 18 },
  resendRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Password wrapper input overrides
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#F2F4F7',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E4E7EC',
    position: 'relative',
    overflow: 'hidden'
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  eyeBtn: { position: 'absolute', right: 16, height: '100%', justifyContent: 'center', zIndex: 10 },

  // Strength Meter Styles
  strengthContainer: {
    marginTop: 14,
    marginBottom: 6,
    width: '100%',
  },
  strengthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: T.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  strengthValue: {
    fontSize: 12,
    fontFamily: Fonts.extraBold,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 4,
    height: 6,
    width: '100%',
  },
  strengthBarSegment: {
    flex: 1,
    height: '100%',
    borderRadius: 3,
  },

  // Requirements checklist styles
  checklistContainer: {
    marginTop: 12,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },

  // Confirm password matching status
  matchStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginLeft: 4,
  },
  matchStatusText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },

  // Friendly error helper
  errorIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 4,
  },
  errorIndicatorText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: T.primary,
  },

  warningBox: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24, alignItems: 'center' },
  warningText: { fontSize: 12, flex: 1, lineHeight: 18, fontFamily: Fonts.bold },

  primaryBtn: {
    height: 64, borderRadius: 32, overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  primaryBtnGradient: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: Fonts.extraBold, letterSpacing: 1 },
});
