import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Theme } from '../../constants';

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  isDarkMode?: boolean;
  type?: 'send' | 'swap' | 'p2p' | 'generic';
}

const STEP_ICONS: Record<string, string[]> = {
  send:    ['shield', 'zap', 'check-circle'],
  swap:    ['refresh-cw', 'trending-up', 'check-circle'],
  p2p:     ['lock', 'clock', 'check-circle'],
  generic: ['loader', 'activity', 'check-circle'],
};

const STEP_LABELS: Record<string, string[]> = {
  send:    ['Signing transaction', 'Broadcasting', 'Confirming'],
  swap:    ['Fetching route', 'Executing swap', 'Finalizing'],
  p2p:     ['Locking escrow', 'Verifying funds', 'Order placed'],
  generic: ['Preparing', 'Processing', 'Completing'],
};

export default function TransactionLoader({ visible, title, subtitle, isDarkMode = true, type = 'generic' }: Props) {
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const spin    = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(1)).current;
  const step1   = useRef(new Animated.Value(0)).current;
  const step2   = useRef(new Animated.Value(0)).current;
  const step3   = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Spin ring
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Pulse glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Step indicators cascade
    Animated.sequence([
      Animated.timing(step1, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(step2, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(step3, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Progress bar
    Animated.timing(barAnim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

    return () => {
      spin.setValue(0); pulse.setValue(1);
      step1.setValue(0); step2.setValue(0); step3.setValue(0);
      barAnim.setValue(0);
    };
  }, [visible]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const icons  = STEP_ICONS[type];
  const labels = STEP_LABELS[type];
  const steps  = [step1, step2, step3];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.88)' }]}>
        <View style={[s.card, { backgroundColor: T.surface }]}>

          {/* Spinning ring + icon */}
          <View style={s.iconWrap}>
            <Animated.View style={[s.ring, { borderColor: T.primary + '40', transform: [{ rotate }] }]} />
            <Animated.View style={[s.ringInner, { borderColor: T.primary, transform: [{ scale: pulse }] }]} />
            <View style={[s.iconBox, { backgroundColor: T.primary + '18' }]}>
              <Feather name={type === 'send' ? 'send' : type === 'swap' ? 'repeat' : type === 'p2p' ? 'shield' : 'zap'} size={28} color={T.primary} />
            </View>
          </View>

          <Text style={[s.title, { color: T.text }]}>{title ?? 'Processing...'}</Text>
          {!!subtitle && <Text style={[s.sub, { color: T.textMuted }]}>{subtitle}</Text>}

          {/* Progress bar */}
          <View style={[s.barTrack, { backgroundColor: T.surfaceHigh }]}>
            <Animated.View style={[s.barFill, {
              backgroundColor: T.primary,
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '92%'] }),
            }]} />
          </View>

          {/* Step indicators */}
          <View style={s.steps}>
            {steps.map((anim, i) => (
              <Animated.View key={i} style={[s.stepRow, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
                <View style={[s.stepDot, { backgroundColor: T.primary + '20', borderColor: T.primary + '50' }]}>
                  <Feather name={icons[i] as any} size={12} color={T.primary} />
                </View>
                <Text style={[s.stepLabel, { color: T.textMuted }]}>{labels[i]}</Text>
              </Animated.View>
            ))}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card:    { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center', gap: 0 },

  iconWrap:  { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ring:      { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ringInner: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderTopColor: 'transparent', borderLeftColor: 'transparent' },
  iconBox:   { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6, textAlign: 'center' },
  sub:   { fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 20, lineHeight: 20 },

  barTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 24 },
  barFill:  { height: '100%', borderRadius: 2 },

  steps:     { width: '100%', gap: 10 },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot:   { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 13, fontWeight: '600' },
});
