import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, Fonts } from '../constants';
import { useWallet } from '../store/WalletContext';

interface Props {
  navigation: any;
  route: {
    params?: {
      authorization_id?: string;
      transaction_id?: string;
    };
  };
}

export default function TransactionAuthScreen({ navigation, route }: Props) {
  const walletCtx = useWallet() as any;
  const isDarkMode = walletCtx?.isDarkMode ?? true;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const authId = route.params?.authorization_id;

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 8-digit OTP
  const [otp, setOtp] = useState<string>('');

  // Timers
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch status
  const fetchStatus = async () => {
    if (!authId) {
      setError('Authorization ID missing');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/authorization/status?id=${authId}`);
      const json = await res.json();
      if (json.success) {
        setStatusData(json.data);
        setError('');

        const expiry = new Date(json.data.expires_at).getTime();
        const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setTimeLeft(diff);
      } else {
        setError(json.error || 'Failed to fetch authorization details.');
      }
    } catch (e: any) {
      setError('Network connection failed. Make sure server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [authId]);

  // Expiry countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          setStatusData((curr: any) => curr ? { ...curr, status: 'expired' } : null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleVerify = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 8) {
      setError('Please enter the complete 8-digit OTP.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/authorization/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_id: authId, otp: cleanOtp }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setSuccessMsg(json.message || 'Transaction approved successfully!');
        setStatusData((prev: any) => ({ ...prev, status: 'authorized' }));
      } else {
        setError(json.error || 'Invalid verification code.');
        setOtp('');
        fetchStatus();
      }
    } catch (e: any) {
      setError('Verification network failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/authorization/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_id: authId }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setResendCooldown(60);
        setTimeLeft(300);
        setSuccessMsg('A new 8-digit OTP code has been sent to your email.');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setError(json.error || 'Failed to resend OTP.');
      }
    } catch (e) {
      setError('Network failed to resend OTP.');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: T.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={[s.loadingText, { color: T.textMuted }]}>Loading Security Details...</Text>
      </View>
    );
  }

  const isPending = statusData?.status === 'pending';
  const isAuthorized = statusData?.status === 'authorized';
  const isRejected = statusData?.status === 'rejected';
  const isExpired = statusData?.status === 'expired';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: T.background }}>
        <Animated.View style={[s.container, { opacity: fadeAnim }]}>
          
          {/* Header Bar */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={T.text} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: T.text }]}>Transaction Authorization</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Main Card */}
          <View style={[s.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            
            {/* Lock Icon */}
            <View style={[s.iconCircle, { backgroundColor: T.primary + '18' }]}>
              <Feather name="shield" size={32} color={T.primary} />
            </View>

            <Text style={[s.title, { color: T.text }]}>KripiCard Secure Check</Text>
            <Text style={[s.subtitle, { color: T.textMuted }]}>
              Verify payment owner approval via 8-digit Email OTP
            </Text>

            {/* Summary Box */}
            <View style={[s.summaryBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: T.textMuted }]}>Merchant</Text>
                <Text style={[s.summaryVal, { color: T.text }]}>{statusData?.merchant || 'Merchant'}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: T.textMuted }]}>Amount</Text>
                <Text style={[s.summaryAmount, { color: T.primary }]}>
                  {statusData?.amount?.toFixed(2)} {statusData?.currency || 'USD'}
                </Text>
              </View>
              <View style={[s.summaryRow, { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 }]}>
                <Text style={[s.summaryLabel, { color: T.textMuted }]}>Card Ending</Text>
                <Text style={[s.summaryMono, { color: T.text }]}>•••• {statusData?.card_last4 || '0000'}</Text>
              </View>
            </View>

            {/* Error & Success Messages */}
            {!!error && (
              <View style={[s.alertBox, { backgroundColor: '#D9302515', borderColor: '#D9302530' }]}>
                <Feather name="alert-circle" size={16} color="#D93025" />
                <Text style={[s.alertText, { color: '#D93025' }]}>{error}</Text>
              </View>
            )}

            {!!successMsg && (
              <View style={[s.alertBox, { backgroundColor: '#00C85315', borderColor: '#00C85330' }]}>
                <Feather name="check-circle" size={16} color="#00C853" />
                <Text style={[s.alertText, { color: '#00C853' }]}>{successMsg}</Text>
              </View>
            )}

            {/* ──────────────── PENDING STATUS (OTP INPUT) ──────────────── */}
            {isPending && (
              <View style={{ width: '100%' }}>
                <Text style={[s.otpHint, { color: T.textMuted }]}>
                  Code sent to <Text style={{ color: T.text, fontWeight: '700' }}>{statusData?.masked_email}</Text>
                </Text>

                {/* 8 Slot Boxes */}
                <View style={s.otpContainer}>
                  <View style={s.slotsRow}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                      const char = otp[idx] || '';
                      const isFocused = otp.length === idx;
                      return (
                        <View
                          key={idx}
                          style={[
                            s.slotBox,
                            {
                              backgroundColor: T.surfaceLow,
                              borderColor: error ? T.primary : isFocused ? T.primary : T.border,
                              borderWidth: isFocused || error ? 2 : 1,
                            },
                          ]}
                        >
                          <Text style={[s.slotText, { color: T.text }]}>{char}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <TextInput
                    style={s.hiddenOtpInput}
                    value={otp}
                    onChangeText={v => { setOtp(v.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                  />
                </View>

                {/* Timer & Resend */}
                <View style={s.timerRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="clock" size={14} color={T.primary} />
                    <Text style={{ color: T.textMuted, fontSize: 12 }}>
                      Expires in: <Text style={{ color: T.text, fontWeight: '700' }}>{formatTime(timeLeft)}</Text>
                    </Text>
                  </View>

                  <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
                    <Text style={{ color: resendCooldown > 0 ? T.textDim : T.primary, fontSize: 12, fontWeight: '700' }}>
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.btn, { opacity: verifying || otp.length < 8 ? 0.6 : 1 }]}
                  onPress={handleVerify}
                  disabled={verifying || otp.length < 8}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[T.primary, '#D32F2F']}
                    style={s.btnGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={s.btnText}>Authorize Transaction</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={[s.attemptText, { color: T.textDim }]}>
                  Attempt {(statusData?.attempts ?? 0) + 1} of 3
                </Text>
              </View>
            )}

            {/* ──────────────── AUTHORIZED STATUS ──────────────── */}
            {isAuthorized && (
              <View style={s.statusResultContainer}>
                <View style={[s.statusIconCircle, { backgroundColor: '#00C85320' }]}>
                  <Feather name="check-circle" size={48} color="#00C853" />
                </View>
                <Text style={[s.statusTitle, { color: T.text }]}>Transaction Authorized</Text>
                <Text style={[s.statusDesc, { color: T.textMuted }]}>
                  The payment request was approved successfully.
                </Text>
                <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={() => navigation.goBack()}>
                  <LinearGradient colors={[T.primary, '#D32F2F']} style={s.btnGradient}>
                    <Text style={s.btnText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ──────────────── REJECTED STATUS ──────────────── */}
            {isRejected && (
              <View style={s.statusResultContainer}>
                <View style={[s.statusIconCircle, { backgroundColor: '#D9302520' }]}>
                  <Feather name="x-circle" size={48} color="#D93025" />
                </View>
                <Text style={[s.statusTitle, { color: T.text }]}>Transaction Declined</Text>
                <Text style={[s.statusDesc, { color: T.textMuted }]}>
                  This authorization request was rejected due to failed verification attempts.
                </Text>
                <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={() => navigation.goBack()}>
                  <LinearGradient colors={['#3a3a3a', '#2a2a2a']} style={s.btnGradient}>
                    <Text style={s.btnText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ──────────────── EXPIRED STATUS ──────────────── */}
            {isExpired && (
              <View style={s.statusResultContainer}>
                <View style={[s.statusIconCircle, { backgroundColor: '#F59E0B20' }]}>
                  <Feather name="clock" size={48} color="#F59E0B" />
                </View>
                <Text style={[s.statusTitle, { color: T.text }]}>Window Expired</Text>
                <Text style={[s.statusDesc, { color: T.textMuted }]}>
                  The 5-minute transaction authorization window has closed.
                </Text>
                <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={() => navigation.goBack()}>
                  <LinearGradient colors={['#3a3a3a', '#2a2a2a']} style={s.btnGradient}>
                    <Text style={s.btnText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justify: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 18,
  },
  summaryBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  summaryVal: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  summaryAmount: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
  },
  summaryMono: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  alertBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  alertText: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    flex: 1,
  },
  otpHint: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 12,
  },
  otpContainer: {
    width: '100%',
    marginVertical: 4,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    width: '100%',
  },
  slotBox: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    textAlign: 'center',
  },
  hiddenOtpInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    color: 'transparent',
    fontSize: 1,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  btn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: Fonts.extraBold,
  },
  attemptText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: 10,
  },
  statusResultContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    textAlign: 'center',
    marginBottom: 6,
  },
  statusDesc: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
