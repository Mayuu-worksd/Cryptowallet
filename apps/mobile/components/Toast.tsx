import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, View, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
  isDarkMode?: boolean;
};

const TYPE_CONFIG = {
  success: { icon: 'check'        as const, color: '#00C853' },
  error:   { icon: 'alert-circle' as const, color: '#EC2629' },
  info:    { icon: 'info'         as const, color: '#EC2629' },
};

export default function Toast({
  visible, message, type = 'success', onHide, duration = 3000, isDarkMode = true,
}: Props) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      opacity.setValue(0);
      translateY.setValue(-10);

      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -10, duration: 180, useNativeDriver: true }),
        ]).start(() => {
          setModalVisible(false);
          onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!modalVisible) return null;

  const cfg       = TYPE_CONFIG[type];
  const bg        = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDarkMode ? '#F5F5F5' : '#131313';
  const border    = isDarkMode ? '#2E2E2E' : '#E8EAED';

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
    >
      <Animated.View
        style={[styles.container, { opacity, transform: [{ translateY }] }]}
        pointerEvents="none"
      >
        <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
          <View style={[styles.dot, { backgroundColor: cfg.color }]} />
          <Feather name={cfg.icon} size={15} color={cfg.color} />
          <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position:   'absolute',
    top:        Platform.OS === 'ios' ? 60 : Platform.OS === 'web' ? 20 : 48,
    left:       20,
    right:      20,
    alignItems: 'center',
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   13,
    borderRadius:      14,
    borderWidth:       1,
    width:             '100%',
    maxWidth:          420,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.12,
    shadowRadius:      12,
    elevation:         8,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    flexShrink:   0,
  },
  text: {
    flex:          1,
    fontSize:      14,
    fontWeight:    '600',
    lineHeight:    20,
    letterSpacing: -0.1,
  },
});
