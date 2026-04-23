import React, { useEffect, useRef, memo } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

type Variant = 'text' | 'circle' | 'card' | 'list-item';

type Props = {
  variant?: Variant;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  isDark?: boolean;
};

const DARK_COLOR  = '#2E3036';
const LIGHT_COLOR = '#E5E7EB';

export const SkeletonBox = memo(({ width = '100%', height = 16, borderRadius = 8, style, isDark = true }: Props) => {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: isDark ? DARK_COLOR : LIGHT_COLOR, opacity: anim },
        style,
      ]}
    />
  );
});

export default memo(function SkeletonLoader({ variant = 'text', width, height, borderRadius, style, isDark = true }: Props) {
  const color = isDark ? DARK_COLOR : LIGHT_COLOR;

  if (variant === 'circle') {
    const size = (height ?? 44);
    return <SkeletonBox width={size} height={size} borderRadius={size / 2} style={style} isDark={isDark} />;
  }

  if (variant === 'card') {
    return (
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1D21' : '#F2F4F6' }, style]}>
        <SkeletonBox width="60%" height={18} borderRadius={8} isDark={isDark} />
        <SkeletonBox width="40%" height={13} borderRadius={6} style={{ marginTop: 10 }} isDark={isDark} />
        <SkeletonBox width="80%" height={13} borderRadius={6} style={{ marginTop: 8 }} isDark={isDark} />
      </View>
    );
  }

  if (variant === 'list-item') {
    return (
      <View style={[styles.listItem, style]}>
        <SkeletonBox width={46} height={46} borderRadius={23} isDark={isDark} />
        <View style={{ flex: 1, gap: 7, marginLeft: 12 }}>
          <SkeletonBox width="45%" height={14} borderRadius={6} isDark={isDark} />
          <SkeletonBox width="65%" height={11} borderRadius={5} isDark={isDark} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 7 }}>
          <SkeletonBox width={72} height={14} borderRadius={6} isDark={isDark} />
          <SkeletonBox width={48} height={11} borderRadius={5} isDark={isDark} />
        </View>
      </View>
    );
  }

  // text (default)
  return <SkeletonBox width={width ?? '100%'} height={height ?? 16} borderRadius={borderRadius ?? 8} style={style} isDark={isDark} />;
});

const styles = StyleSheet.create({
  card:     { borderRadius: 20, padding: 20, gap: 4 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
