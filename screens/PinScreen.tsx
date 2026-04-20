import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform, Vibration, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { savePin, verifyPin, getLockoutState } from '../services/pinService';

const PIN_LENGTH = 6;

type Mode = 'setup' | 'verify';

interface Props {
  mode: Mode;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PinScreen({ mode, onSuccess, onCancel }: Props) {
  const { isDarkMode, walletName } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [pin, setPin]             = useState('');
  const [step, setStep]           = useState<'enter' | 'confirm'>('enter');
  const [error, setError]         = useState('');
  const [locked, setLocked]       = useState(false);
  const [countdown, setCountdown] = useState(0);

  const firstPinRef   = useRef('');
  const stepRef       = useRef<'enter' | 'confirm'>('enter');
  const processingRef = useRef(false);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims  = useRef(Array.from({ length: PIN_LENGTH }, () => new Animated.Value(1))).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // On mount — check if already locked out (persisted across restarts)
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    if (mode === 'verify') {
      getLockoutState().then(state => {
        if (state.isLocked) startCountdown(state.remainingMs);
      });
    }

    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Animate newly filled dot
  useEffect(() => {
    const idx = pin.length - 1;
    if (idx >= 0 && idx < PIN_LENGTH) {
      Animated.sequence([
        Animated.spring(dotAnims[idx], { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(dotAnims[idx], { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 6  }),
      ]).start();
    }
  }, [pin]);

  const startCountdown = useCallback((ms: number) => {
    setLocked(true);
    setCountdown(Math.ceil(ms / 1000));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setLocked(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const shake = useCallback(() => {
    if (Platform.OS !== 'web') Vibration.vibrate(Platform.OS === 'android' ? [0, 80, 60, 80] : 400);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const goToStep = useCallback((s: 'enter' | 'confirm') => {
    stepRef.current = s;
    setStep(s);
  }, []);

  const clearPin = useCallback((delay = 0) => {
    setTimeout(() => {
      setPin('');
      dotAnims.forEach(a => a.setValue(1));
      processingRef.current = false;
    }, delay);
  }, [dotAnims]);

  const processPin = useCallback(async (newPin: string) => {
    if (mode === 'setup') {
      if (stepRef.current === 'enter') {
        firstPinRef.current = newPin;
        goToStep('confirm');
        clearPin(150);
        return;
      }
      if (newPin === firstPinRef.current) {
        await savePin(newPin);
        if (Platform.OS !== 'web') Vibration.vibrate(100);
        onSuccess();
      } else {
        shake();
        setError('PINs do not match. Try again.');
        firstPinRef.current = '';
        goToStep('enter');
        clearPin(300);
      }
      return;
    }

    // Verify mode — use new VerifyResult API
    const result = await verifyPin(newPin);

    if (result.success) {
      if (Platform.OS !== 'web') Vibration.vibrate(100);
      onSuccess();
      return;
    }

    shake();

    if (result.lockout.isLocked) {
      const secs = Math.ceil(result.lockout.remainingMs / 1000);
      const mins = Math.floor(secs / 60);
      const label = mins > 0 ? `${mins} minute${mins > 1 ? 's' : ''}` : `${secs} seconds`;
      setError(`Too many attempts. Try again in ${label}.`);
      startCountdown(result.lockout.remainingMs);
    } else {
      const left = result.lockout.attemptsLeft;
      setError(`Incorrect PIN. ${left} attempt${left !== 1 ? 's' : ''} left.`);
    }

    clearPin(300);
  }, [mode, shake, goToStep, clearPin, onSuccess, startCountdown]);

  const handleKey = useCallback((key: string) => {
    if (locked || processingRef.current) return;

    if (key === '⌫') {
      setError('');
      setPin(p => p.slice(0, -1));
      return;
    }

    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const newPin = prev + key;
      if (newPin.length === PIN_LENGTH) {
        processingRef.current = true;
        processPin(newPin);
      }
      return newPin;
    });
  }, [locked, processPin]);

  const formatCountdown = (secs: number) => {
    if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    return `${secs}s`;
  };

  const title = mode === 'setup'
    ? (step === 'enter' ? 'Create PIN' : 'Confirm PIN')
    : 'Enter PIN';

  const subtitle = mode === 'setup'
    ? (step === 'enter' ? 'Choose a 6-digit PIN to secure your wallet' : 'Re-enter your PIN to confirm')
    : `Welcome back${walletName ? `, ${walletName}` : ''}`;

  return (
    <Animated.View style={[styles.container, { backgroundColor: T.background, opacity: fadeAnim }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: T.primary + '18' }]}>
          <Feather name="shield" size={20} color={T.primary} />
        </View>
        <Text style={[styles.appName, { color: T.primary }]}>CryptoWallet</Text>
        {onCancel ? (
          <TouchableOpacity onPress={onCancel} style={[styles.cancelBtn, { backgroundColor: T.surface }]}>
            <Feather name="x" size={18} color={T.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: T.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: T.textMuted }]}>{subtitle}</Text>

        {/* PIN dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: filled ? T.primary : 'transparent',
                    borderColor: filled ? T.primary : T.border,
                    transform: [{ scale: dotAnims[i] }],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Error / lockout */}
        <View style={styles.errorWrap}>
          {locked && countdown > 0 ? (
            <View style={[styles.lockoutBox, { backgroundColor: T.error + '15' }]}>
              <Feather name="lock" size={13} color={T.error} />
              <Text style={[styles.lockoutText, { color: T.error }]}>
                Locked · {formatCountdown(countdown)}
              </Text>
            </View>
          ) : !!error ? (
            <Text style={[styles.errorText, { color: T.error }]}>{error}</Text>
          ) : null}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {[['1','2','3'],['4','5','6'],['7','8','9']].map((row, ri) => (
            <View key={ri} style={styles.keyRow}>
              {row.map(k => (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.key,
                    { backgroundColor: T.surface, borderColor: T.border },
                    locked && styles.keyDisabled,
                  ]}
                  onPress={() => handleKey(k)}
                  activeOpacity={0.55}
                  disabled={locked}
                >
                  <Text style={[styles.keyText, { color: locked ? T.textDim : T.text }]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.keyRow}>
            <View style={styles.keyEmpty} />
            <TouchableOpacity
              style={[
                styles.key,
                { backgroundColor: T.surface, borderColor: T.border },
                locked && styles.keyDisabled,
              ]}
              onPress={() => handleKey('0')}
              activeOpacity={0.55}
              disabled={locked}
            >
              <Text style={[styles.keyText, { color: locked ? T.textDim : T.text }]}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keyEmpty}
              onPress={() => handleKey('⌫')}
              onLongPress={() => { setPin(''); setError(''); dotAnims.forEach(a => a.setValue(1)); }}
              disabled={locked}
            >
              <Feather name="delete" size={24} color={locked ? T.textDim : T.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Step indicator for setup */}
        {mode === 'setup' && (
          <View style={styles.stepRow}>
            {(['enter', 'confirm'] as const).map(s => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  { backgroundColor: step === s ? T.primary : T.border, width: step === s ? 20 : 8 },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export { hasPinSetup, clearPin } from '../services/pinService';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  logoCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  appName:    { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  cancelBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },

  title:    { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 40 },

  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dot:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },

  errorWrap: { height: 36, marginBottom: 28, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  lockoutBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  lockoutText: { fontSize: 13, fontWeight: '700' },

  keypad:   { width: '100%', maxWidth: 300, gap: 14 },
  keyRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  key: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  keyDisabled: { opacity: 0.35 },
  keyText:  { fontSize: 28, fontWeight: '400' },
  keyEmpty: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },

  stepRow: { flexDirection: 'row', gap: 8, marginTop: 36, alignItems: 'center' },
  stepDot: { height: 8, borderRadius: 4 },
});
