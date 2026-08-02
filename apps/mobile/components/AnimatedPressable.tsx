import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity, TouchableOpacityProps, StyleProp,
  ViewStyle, Animated, View,
} from 'react-native';
import { haptics } from '../utils/haptics';

interface AnimatedPressableProps extends Omit<TouchableOpacityProps, 'onPressIn' | 'onPressOut'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  ripple?: boolean;
  rippleColor?: string;
  onLongPress?: () => void;
}

export default function AnimatedPressable({
  children,
  style,
  scaleTo = 0.95,
  haptic = true,
  ripple = false,
  rippleColor = 'rgba(255,255,255,0.15)',
  onPress,
  onLongPress,
  ...rest
}: AnimatedPressableProps) {
  const scale      = useRef(new Animated.Value(1)).current;
  const rippleScale   = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
    if (ripple) {
      rippleScale.setValue(0);
      rippleOpacity.setValue(0.3);
      Animated.parallel([
        Animated.timing(rippleScale,   { toValue: 1,   duration: 350, useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0,   duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [scale, scaleTo, ripple, rippleScale, rippleOpacity]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePress = useCallback((e: any) => {
    if (haptic) haptics.selection();
    onPress?.(e);
  }, [haptic, onPress]);

  const handleLongPress = useCallback(() => {
    if (haptic) haptics.heavy();
    onLongPress?.();
  }, [haptic, onLongPress]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={500}
        {...rest}
      >
        {ripple && (
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 999,
              backgroundColor: rippleColor,
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            }}
          />
        )}
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Need StyleSheet for absoluteFillObject
import { StyleSheet } from 'react-native';
