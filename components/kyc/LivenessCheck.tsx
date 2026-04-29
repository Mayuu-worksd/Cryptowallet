import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

/**
 * Liveness prompts that are:
 * 1. Physically performable by the user
 * 2. Visible in the final captured selfie (admin can verify)
 * 3. NOT claiming any AI/sensor detection we don't have
 */
const PROMPTS = [
  {
    instruction: 'Smile naturally',
    detail: 'Show a natural smile for the camera',
    duration: 4000,
  },
  {
    instruction: 'Turn head slightly right',
    detail: 'Slowly turn your head to the right, then face forward',
    duration: 5000,
  },
  {
    instruction: 'Hold up your hand',
    detail: 'Raise one open hand next to your face briefly',
    duration: 4000,
  },
];

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  onComplete: () => void;
}

export default function LivenessCheck({ onComplete }: Props) {
  const shuffled = useRef([...PROMPTS].sort(() => Math.random() - 0.5)).current;
  const [index, setIndex]     = useState(0);
  const [expired, setExpired] = useState(false);
  const [done, setDone]       = useState(false);

  const animProgress = useRef(new Animated.Value(1)).current;
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef      = useRef<Animated.CompositeAnimation | null>(null);

  const clearAll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    animRef.current?.stop();
  };

  const startPrompt = (idx: number) => {
    if (idx >= shuffled.length) {
      setDone(true);
      // Small delay so user sees the final ✅ before onComplete fires
      setTimeout(onComplete, 600);
      return;
    }
    setExpired(false);
    animProgress.setValue(1);

    animRef.current = Animated.timing(animProgress, {
      toValue: 0,
      duration: shuffled[idx].duration,
      useNativeDriver: false,
    });
    animRef.current.start();

    timerRef.current = setTimeout(() => setExpired(true), shuffled[idx].duration);
  };

  useEffect(() => {
    startPrompt(0);
    return clearAll;
  }, []);

  const handleConfirm = () => {
    clearAll();
    const next = index + 1;
    setIndex(next);
    startPrompt(next);
  };

  const handleRetry = () => {
    clearAll();
    startPrompt(index);
  };

  const strokeDashoffset = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  if (done) {
    return (
      <View style={s.container}>
        <View style={s.successRing}>
          <Feather name="check" size={36} color="#00C853" />
        </View>
        <Text style={s.successText}>Liveness check passed</Text>
      </View>
    );
  }

  if (index >= shuffled.length) return null;

  const prompt = shuffled[index];

  return (
    <View style={s.container}>
      {/* Step counter + countdown ring */}
      <View style={s.ringWrap}>
        <Svg width={96} height={96} style={StyleSheet.absoluteFill}>
          <Circle
            cx={48} cy={48} r={RADIUS}
            stroke="#2E3036" strokeWidth={5} fill="none"
          />
          <AnimatedCircle
            cx={48} cy={48} r={RADIUS}
            stroke={expired ? '#F59E0B' : '#FF3B3B'}
            strokeWidth={5}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset as any}
            strokeLinecap="round"
            rotation="-90"
            origin="48, 48"
          />
        </Svg>
        <Text style={s.stepNum}>{index + 1} / {shuffled.length}</Text>
      </View>

      {/* Prompt */}
      <Text style={s.promptTitle}>{prompt.instruction}</Text>
      <Text style={s.promptDetail}>{prompt.detail}</Text>

      {/* Action buttons */}
      {expired ? (
        <View style={s.btnRow}>
          <View style={s.expiredBadge}>
            <Feather name="clock" size={13} color="#F59E0B" />
            <Text style={s.expiredText}>Time's up</Text>
          </View>
          <TouchableOpacity style={s.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.doneBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <View style={s.doneBtnInner}>
            <Feather name="check" size={15} color="#FFF" />
            <Text style={s.doneBtnText}>Done</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  ringWrap: {
    width: 96, height: 96,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  promptTitle: {
    fontSize: 20, fontWeight: '900', color: '#FFF',
    textAlign: 'center', letterSpacing: -0.3,
  },
  promptDetail: {
    fontSize: 13, color: '#A1A5AB',
    textAlign: 'center', lineHeight: 18,
  },
  btnRow: { alignItems: 'center', gap: 10, marginTop: 4 },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B20',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6,
  },
  expiredText: { fontSize: 13, fontWeight: '700', color: '#F59E0B', textAlign: 'center' },
  doneBtn: {
    marginTop: 4,
    paddingHorizontal: 40, paddingVertical: 13,
    borderRadius: 22, backgroundColor: '#00C853',
  },
  doneBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  retryBtn: {
    paddingHorizontal: 40, paddingVertical: 13,
    borderRadius: 22, backgroundColor: '#FF3B3B',
  },
  retryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  successRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#00C85320',
    alignItems: 'center', justifyContent: 'center',
  },
  successText: { fontSize: 16, fontWeight: '800', color: '#00C853', marginTop: 4 },
});
