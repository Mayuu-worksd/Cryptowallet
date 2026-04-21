import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, StatusBar, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Theme } from '../constants';

const { width, height } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const logoScale      = useRef(new Animated.Value(0.3)).current;
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const contentY       = useRef(new Animated.Value(30)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity  = useRef(new Animated.Value(0)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Logo pop in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Text slide up
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(contentY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 30,
          friction: 8,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Footer fade in
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Finish sequence
    Animated.sequence([
      Animated.delay(3500),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.wrapper, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.primary} />

      {/* Background with Depth */}
      <View style={[styles.bg, { backgroundColor: Theme.colors.primary }]}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        <Animated.View style={[
          styles.logoContainer,
          { transform: [{ scale: logoScale }], opacity: logoOpacity }
        ]}>
          <View style={styles.logoShadow} />
          <View style={styles.logoBox}>
            <Image 
              source={require('../assets/icon.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View style={{ 
          opacity: contentOpacity, 
          transform: [{ translateY: contentY }],
          alignItems: 'center'
        }}>
          <Text style={styles.appName}>CRYPTO WALLET</Text>
          <Text style={styles.tagline}>SECURE ASSET MANAGEMENT</Text>
          
          <View style={styles.loaderContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
          </View>
        </Animated.View>
      </View>

      {/* Footer Area */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <View style={styles.poweredBy}>
          <Text style={styles.poweredText}>POWERED BY</Text>
          <Text style={styles.brandText}>CRYPTOWALLET</Text>
        </View>

        <View style={styles.badge}>
          <Feather name="shield" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 40,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShadow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    transform: [{ translateY: 10 }],
    filter: 'blur(15px)',
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  logoImage: {
    width: '70%',
    height: '70%',
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    marginTop: 8,
    textAlign: 'center',
  },
  loaderContainer: {
    marginTop: 64,
  },
  footer: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  poweredBy: {
    alignItems: 'center',
    marginBottom: 16,
  },
  poweredText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
});
