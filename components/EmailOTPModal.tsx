import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, Fonts } from '../constants';
import { backupService } from '../services/backupService';

interface Props {
  visible: boolean;
  isDarkMode: boolean;
  onVerified: (email: string) => void;
  onCancel: () => void;
}

export default function EmailOTPModal({ visible, isDarkMode, onVerified, onCancel }: Props) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep('email');
      setEmail('');
      setOtp('');
      setError('');
      setCountdown(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOTP = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@') || !clean.includes('.')) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    const res = await backupService.sendOTP(clean);
    setLoading(false);
    if (res.success) {
      setCountdown(60);
      setStep('otp');
    } else {
      setError(res.error || 'Failed to send code. Try again.');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.trim().length < 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    const res = await backupService.verifyOTP(email.trim().toLowerCase(), otp.trim());
    setLoading(false);
    if (res.success) {
      onVerified(email.trim().toLowerCase());
    } else {
      setError('Invalid or expired code. Try again.');
      setOtp('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <View style={[s.card, { backgroundColor: T.surface, borderColor: T.border }]}>

            {/* Icon */}
            <View style={[s.iconCircle, { backgroundColor: T.primary + '18' }]}>
              <Feather name={step === 'email' ? 'mail' : 'shield'} size={28} color={T.primary} />
            </View>

            <Text style={[s.title, { color: T.text }]}>
              {step === 'email' ? 'Verify Your Email' : 'Enter OTP Code'}
            </Text>
            <Text style={[s.subtitle, { color: T.textMuted }]}>
              {step === 'email'
                ? 'A one-time code will be sent to your email to secure your wallet.'
                : `We sent a 6-digit code to\n${email}`}
            </Text>

            {/* Input */}
            {step === 'email' ? (
              <TextInput
                style={[s.input, { color: T.text, borderColor: error ? T.primary : T.border, backgroundColor: T.surfaceLow }]}
                placeholder="your@email.com"
                placeholderTextColor={T.textDim}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            ) : (
              <TextInput
                style={[s.input, s.otpInput, { color: T.text, borderColor: error ? T.primary : T.border, backgroundColor: T.surfaceLow }]}
                placeholder="000000"
                placeholderTextColor={T.textDim}
                value={otp}
                onChangeText={v => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            )}

            {!!error && (
              <View style={s.errorRow}>
                <Feather name="alert-circle" size={13} color={T.primary} />
                <Text style={[s.errorText, { color: T.primary }]}>{error}</Text>
              </View>
            )}

            {/* Resend */}
            {step === 'otp' && (
              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={countdown > 0 || loading}
                style={{ marginTop: 8, alignSelf: 'center' }}
              >
                <Text style={{ color: countdown > 0 ? T.textDim : T.primary, fontSize: 13, fontWeight: '700' }}>
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Buttons */}
            <TouchableOpacity
              style={[s.btn, { opacity: loading ? 0.7 : 1 }]}
              onPress={step === 'email' ? handleSendOTP : handleVerifyOTP}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[T.primary, '#D32F2F']}
                style={s.btnGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={s.btnText}>{step === 'email' ? 'Send Code' : 'Verify & Continue'}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onCancel} style={{ marginTop: 12, alignSelf: 'center' }}>
              <Text style={{ color: T.textDim, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, borderRadius: 28, borderWidth: 1,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3, shadowRadius: 40, elevation: 20,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  input: {
    width: '100%', height: 54, borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16, fontWeight: '600', marginBottom: 4,
  },
  otpInput: { fontSize: 28, fontWeight: '800', letterSpacing: 12, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  errorText: { fontSize: 13, fontWeight: '600' },
  btn: { width: '100%', height: 54, borderRadius: 27, overflow: 'hidden', marginTop: 20 },
  btnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
