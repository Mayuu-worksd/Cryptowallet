import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const FRAME_W = width * 0.82;
const FRAME_H = FRAME_W * 0.65;
const CORNER = 22;
const THICKNESS = 3;

export type FeedbackState = 'none' | 'closer' | 'glare' | 'good';

interface Props {
  feedback: FeedbackState;
  shape?: 'rect' | 'oval';
}

const CHIP_CONFIG: Record<FeedbackState, { text: string; color: string; bg: string }> = {
  none:   { text: 'Align document inside the frame',    color: '#e5e2e1', bg: '#1c1b1b95' },
  closer: { text: '🔍 Move closer',                      color: '#F59E0B', bg: '#F59E0B20' },
  glare:  { text: '💡 Too much glare — adjust angle',    color: '#F59E0B', bg: '#F59E0B20' },
  good:   { text: '✅ Perfect — hold still',              color: '#00C853', bg: '#00C85320' },
};

export default function CameraOverlay({ feedback, shape = 'rect' }: Props) {
  const cornerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const pulseLoop  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(cornerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    pulseLoop.current?.stop();
    if (feedback === 'good') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [feedback]);

  const borderColor = feedback === 'good' ? '#00C853' : feedback === 'none' ? '#EC2629' : '#F59E0B';

  const chip = CHIP_CONFIG[feedback];

  if (shape === 'oval') {
    return (
      <View style={s.container}>
        <Animated.View style={[s.oval, { borderColor, transform: [{ scale: pulseAnim }] }]} />
        <View style={[s.chip, { backgroundColor: chip.bg }]}>
          <Text style={[s.chipText, { color: chip.color }]}>{chip.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Animated.View style={[s.frame, { borderColor, transform: [{ scale: pulseAnim }] }]}>
        {([
          { top: -THICKNESS, left: -THICKNESS,  borderRightWidth: 0, borderBottomWidth: 0 },
          { top: -THICKNESS, right: -THICKNESS, borderLeftWidth: 0,  borderBottomWidth: 0 },
          { bottom: -THICKNESS, left: -THICKNESS,  borderRightWidth: 0, borderTopWidth: 0 },
          { bottom: -THICKNESS, right: -THICKNESS, borderLeftWidth: 0,  borderTopWidth: 0 },
        ] as any[]).map((pos, i) => (
          <Animated.View
            key={i}
            style={[s.corner, pos, { borderColor, opacity: cornerAnim, transform: [{ scale: cornerAnim }] }]}
          />
        ))}
      </Animated.View>
      <View style={[s.chip, { backgroundColor: chip.bg }]}>
        <Text style={[s.chipText, { color: chip.color }]}>{chip.text}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderWidth: 1.5,
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderWidth: THICKNESS,
    borderRadius: 4,
  },
  oval: {
    width: width * 0.62,
    height: width * 0.78,
    borderRadius: width * 0.39,
    borderWidth: 2.5,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
});
