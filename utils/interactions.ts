/**
 * interactions.ts — Premium fintech-grade interaction primitives
 * Reusable hooks and utilities for gestures, animations, and micro-interactions
 */

import { useRef, useCallback } from 'react';
import { Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { haptics } from './haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Spring configs ───────────────────────────────────────────────────────────
export const SPRING = {
  snappy:  { tension: 300, friction: 20, useNativeDriver: true },
  bouncy:  { tension: 200, friction: 14, useNativeDriver: true },
  smooth:  { tension: 150, friction: 22, useNativeDriver: true },
  gentle:  { tension: 100, friction: 26, useNativeDriver: true },
};

// ─── Button press scale animation ────────────────────────────────────────────
export function usePressScale(scaleTo = 0.94) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleTo, ...SPRING.snappy }).start();
  }, [scale, scaleTo]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, ...SPRING.bouncy }).start();
  }, [scale]);

  return { scale, onPressIn, onPressOut };
}

// ─── Double tap detector ──────────────────────────────────────────────────────
export function useDoubleTap(onDoubleTap: () => void, delay = 300) {
  const lastTap = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < delay) {
      onDoubleTap();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [onDoubleTap, delay]);

  return handleTap;
}

// ─── Long press with haptic ───────────────────────────────────────────────────
export function useLongPress(onLongPress: () => void, duration = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, ...SPRING.smooth }).start();
    timer.current = setTimeout(() => {
      haptics.heavy();
      onLongPress();
    }, duration);
  }, [onLongPress, duration, scale]);

  const onPressOut = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.spring(scale, { toValue: 1, ...SPRING.bouncy }).start();
  }, [scale]);

  return { scale, onPressIn, onPressOut };
}

// ─── Bottom sheet drag gesture ────────────────────────────────────────────────
export function useBottomSheetGesture(onDismiss: () => void, snapThreshold = 0.35) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
          opacity.setValue(1 - (g.dy / (SCREEN_HEIGHT * 0.5)));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SCREEN_HEIGHT * snapThreshold || g.vy > 0.8) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0,             duration: 280, useNativeDriver: true }),
          ]).start(() => onDismiss());
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, ...SPRING.snappy }),
            Animated.spring(opacity,    { toValue: 1, ...SPRING.snappy }),
          ]).start();
        }
      },
    })
  ).current;

  const show = useCallback(() => {
    translateY.setValue(SCREEN_HEIGHT);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, ...SPRING.smooth }),
      Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  return { translateY, opacity, panResponder, show };
}

// ─── Fade-in on mount ─────────────────────────────────────────────────────────
export function useFadeIn(duration = 300, delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;

  const start = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration, delay]);

  return { opacity, start };
}

// ─── Slide-up on mount ────────────────────────────────────────────────────────
export function useSlideUp(distance = 24, duration = 350) {
  const translateY = useRef(new Animated.Value(distance)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const start = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, ...SPRING.smooth }),
      Animated.timing(opacity,    { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity, duration]);

  return { translateY, opacity, start };
}

// ─── Staggered list animation ─────────────────────────────────────────────────
export function useStaggeredList(count: number, staggerMs = 60) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;

  const start = useCallback(() => {
    Animated.stagger(
      staggerMs,
      anims.map(a =>
        Animated.spring(a, { toValue: 1, ...SPRING.smooth })
      )
    ).start();
  }, [anims, staggerMs]);

  return { anims, start };
}

// ─── Pulse animation (for loading dots, live indicators) ─────────────────────
export function usePulse(minOpacity = 0.3, maxOpacity = 1, duration = 900) {
  const opacity = useRef(new Animated.Value(maxOpacity)).current;

  const start = useCallback(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: minOpacity, duration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: maxOpacity, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, minOpacity, maxOpacity, duration]);

  return { opacity, start };
}

// ─── Number counter animation ─────────────────────────────────────────────────
export function useCountUp(target: number, duration = 800) {
  const value = useRef(new Animated.Value(0)).current;

  const animate = useCallback((from: number, to: number) => {
    value.setValue(from);
    Animated.timing(value, {
      toValue: to,
      duration,
      useNativeDriver: false, // must be false for non-transform/opacity props
    }).start();
  }, [value, duration]);

  return { value, animate };
}

// ─── Shake animation (for errors) ────────────────────────────────────────────
export function useShake() {
  const translateX = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    haptics.error();
    Animated.sequence([
      Animated.timing(translateX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue:  6, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -3, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [translateX]);

  return { translateX, shake };
}

// ─── Success checkmark animation ─────────────────────────────────────────────
export function useSuccessAnim() {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const play = useCallback(() => {
    haptics.success();
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, ...SPRING.bouncy }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const reset = useCallback(() => {
    scale.setValue(0);
    opacity.setValue(0);
  }, [scale, opacity]);

  return { scale, opacity, play, reset };
}

// ─── Tab indicator slide ──────────────────────────────────────────────────────
export function useTabIndicator(tabCount: number, tabWidth: number) {
  const translateX = useRef(new Animated.Value(0)).current;

  const moveTo = useCallback((index: number) => {
    Animated.spring(translateX, {
      toValue: index * tabWidth,
      ...SPRING.snappy,
    }).start();
  }, [translateX, tabWidth]);

  return { translateX, moveTo };
}

// ─── Swipe horizontal gesture ─────────────────────────────────────────────────
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 60
) {
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -threshold && onSwipeLeft)  { haptics.selection(); onSwipeLeft();  }
        if (g.dx >  threshold && onSwipeRight) { haptics.selection(); onSwipeRight(); }
      },
    })
  ).current;

  return panResponder;
}

// ─── Card flip animation ──────────────────────────────────────────────────────
export function useCardFlip() {
  const rotateY = useRef(new Animated.Value(0)).current;
  const isFlipped = useRef(false);

  const flip = useCallback(() => {
    const toValue = isFlipped.current ? 0 : 1;
    isFlipped.current = !isFlipped.current;
    haptics.selection();
    Animated.spring(rotateY, { toValue, ...SPRING.smooth }).start();
  }, [rotateY]);

  const frontInterpolate = rotateY.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = rotateY.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  return { flip, frontInterpolate, backInterpolate };
}

// ─── Ripple effect (pure Animated, no native) ────────────────────────────────
export function useRipple() {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  const trigger = useCallback(() => {
    scale.setValue(0);
    opacity.setValue(0.3);
    Animated.parallel([
      Animated.timing(scale,   { toValue: 1,   duration: 400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 400, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return { scale, opacity, trigger };
}
