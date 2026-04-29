import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Animated, Platform,
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, G, Polygon, Ellipse } from 'react-native-svg';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';

const AsyncStorage = Platform.OS === 'web'
  ? {
      getItem: async (k: string) => { try { return localStorage.getItem(k); } catch (_e) { return null; } },
      setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
    }
  : require('@react-native-async-storage/async-storage').default;

const { width: W, height: H } = Dimensions.get('window');
const ONBOARDING_KEY = 'cw_onboarding_done';

export async function shouldShowOnboarding(): Promise<boolean> {
  const done = await AsyncStorage.getItem(ONBOARDING_KEY);
  return !done;
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

// Custom SVG Illustrations
const WalletIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#EC2629" stopOpacity="1" />
        <Stop offset="100%" stopColor="#9b181a" stopOpacity="1" />
      </SvgLinearGradient>
      <SvgLinearGradient id="coin1" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#B45309" />
      </SvgLinearGradient>
      <SvgLinearGradient id="coin2" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgLinearGradient>
    </Defs>
    {/* Floating Coins */}
    <Circle cx="40" cy="60" r="15" fill="url(#coin1)" />
    <Path d="M35 55 h10 v10 h-10 z" fill="#FFF" opacity="0.4" />
    
    <Circle cx="190" cy="180" r="20" fill="url(#coin2)" />
    <Circle cx="200" cy="50" r="10" fill="url(#coin1)" opacity="0.6" />
    
    {/* Wallet Base */}
    <Rect x="40" y="80" width="160" height="100" rx="20" fill="url(#walletGrad)" />
    <Rect x="40" y="80" width="160" height="40" rx="20" fill="#FFF" opacity="0.1" />
    <Path d="M40 100 h160 v60 a20 20 0 0 1 -20 20 h-120 a20 20 0 0 1 -20 -20 z" fill="url(#walletGrad)" />
    
    {/* Wallet Flap */}
    <Path d="M40 100 Q120 140 200 100 L200 120 Q120 160 40 120 Z" fill="#7a1214" />
    
    {/* Center Coin */}
    <Circle cx="120" cy="120" r="25" fill="#FFF" />
    <Circle cx="120" cy="120" r="20" fill="url(#coin1)" />
    <Path d="M115 110 h10 v20 h-10 z" fill="#FFF" />
  </Svg>
);

const SwapIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="swapLeft" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#6366F1" />
        <Stop offset="100%" stopColor="#4338CA" />
      </SvgLinearGradient>
      <SvgLinearGradient id="swapRight" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgLinearGradient>
      <SvgLinearGradient id="chart" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFF" stopOpacity="0.2" />
        <Stop offset="100%" stopColor="#FFF" stopOpacity="0" />
      </SvgLinearGradient>
    </Defs>
    {/* Chart Background */}
    <Path d="M20 180 L60 140 L100 160 L160 80 L220 120 L220 200 L20 200 Z" fill="url(#chart)" />
    <Path d="M20 180 L60 140 L100 160 L160 80 L220 120" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
    
    {/* Left Coin */}
    <Circle cx="80" cy="120" r="40" fill="url(#swapLeft)" />
    <Path d="M65 120 l15 -15 l15 15 m-15 -15 v30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Right Coin */}
    <Circle cx="160" cy="120" r="40" fill="url(#swapRight)" />
    <Path d="M145 120 l15 15 l15 -15 m-15 15 v-30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Swap Arrows */}
    <Circle cx="120" cy="120" r="18" fill="#FFF" />
    <Path d="M110 115 h20 m-5 -5 l5 5 l-5 5 m5 5 h-20 m5 -5 l-5 5 l5 5" stroke="#EC2629" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SecurityIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#B45309" />
      </SvgLinearGradient>
      <SvgLinearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FFF" stopOpacity="0.8" />
        <Stop offset="100%" stopColor="#FFF" stopOpacity="0.2" />
      </SvgLinearGradient>
    </Defs>
    
    {/* Network Nodes */}
    <Path d="M120 40 L180 80 L180 160 L120 200 L60 160 L60 80 Z" stroke="#FFF" strokeWidth="2" strokeDasharray="6 6" opacity="0.3" />
    <Circle cx="120" cy="40" r="6" fill="url(#nodeGrad)" />
    <Circle cx="180" cy="80" r="6" fill="url(#nodeGrad)" />
    <Circle cx="180" cy="160" r="6" fill="url(#nodeGrad)" />
    <Circle cx="120" cy="200" r="6" fill="url(#nodeGrad)" />
    <Circle cx="60" cy="160" r="6" fill="url(#nodeGrad)" />
    <Circle cx="60" cy="80" r="6" fill="url(#nodeGrad)" />
    
    {/* Main Shield */}
    <Path d="M120 50 L170 70 V120 C170 160 120 190 120 190 C120 190 70 160 70 120 V70 L120 50 Z" fill="url(#shieldGrad)" />
    <Path d="M120 50 L170 70 V120 C170 160 120 190 120 190 V50 Z" fill="#FFF" opacity="0.15" />
    
    {/* Lock Inside */}
    <Rect x="105" y="110" width="30" height="24" rx="4" fill="#FFF" />
    <Path d="M110 110 V100 C110 90 130 90 130 100 V110" stroke="#FFF" strokeWidth="4" strokeLinecap="round" />
    <Circle cx="120" cy="122" r="3" fill="#B45309" />
    <Path d="M120 122 v6" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const SLIDES = [
  {
    gradient: ['#1A0506', '#3B090A'] as [string, string], // Dark red tones
    lightGradient: ['#FFF0F0', '#FFE0E0'] as [string, string],
    title:    'Your Crypto,\nYour Control',
    body:     'Store, send and receive crypto securely from your phone.',
    Illustration: WalletIllustration,
  },
  {
    gradient: ['#0A0B1A', '#13153B'] as [string, string], // Deep blue/indigo tones
    lightGradient: ['#F0F4FF', '#E0EAFF'] as [string, string],
    title:    'Instant Swaps',
    body:     'Swap between 50+ cryptocurrencies at the best rates.',
    Illustration: SwapIllustration,
  },
  {
    gradient: ['#1A1005', '#3B2409'] as [string, string], // Deep amber tones
    lightGradient: ['#FFF8F0', '#FFEDD6'] as [string, string],
    title:    'Bank-Grade Security',
    body:     'Your keys, your coins. Protected by military-grade encryption.',
    Illustration: SecurityIllustration,
  },
];

interface Props {
  onFinish?: () => void;
  navigation?: any;
}

export default function OnboardingScreen({ onFinish, navigation }: Props) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Initial animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const goTo = (idx: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setCurrent(idx);
    scrollRef.current?.scrollTo({ x: idx * W, animated: true });
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await markOnboardingDone();
    if (onFinish) onFinish();
    if (navigation) navigation.replace('Main');
  };

  const slide = SLIDES[current];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Background Gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={isDarkMode ? slide.gradient : slide.lightGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleFinish} activeOpacity={0.7}>
        <Text style={[styles.skipText, { color: isDarkMode ? '#FFFFFF80' : '#00000080' }]}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            <Animated.View style={[
              styles.slideContent, 
              { 
                opacity: i === current ? fadeAnim : 0,
                transform: [{
                  translateY: i === current ? slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  }) : 0
                }]
              }
            ]}>
              {/* Illustration container */}
              <View style={styles.illustrationContainer}>
                <s.Illustration />
              </View>

              {/* Text */}
              <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#131313' }]}>{s.title}</Text>
              <Text style={[styles.body, { color: isDarkMode ? '#FFFFFFB3' : '#131313B3' }]}>{s.body}</Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Area */}
      <View style={[styles.bottom, { backgroundColor: isDarkMode ? '#1c1b1b' : '#FFFFFF' }]}>
        {/* Progress Bar & Indicators */}
        <View style={styles.progressContainer}>
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[
                styles.dot,
                {
                  backgroundColor: i === current ? T.primary : (isDarkMode ? '#FFFFFF20' : '#00000020'),
                  width: i === current ? 32 : 8,
                },
              ]} />
            ))}
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: T.primary }]}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <Text style={styles.nextBtnText}>
            {current === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          {current < SLIDES.length - 1 && (
            <Feather name="arrow-right" size={20} color="#FFF" style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute', 
    top: Platform.OS === 'web' ? 24 : 60,
    right: 24, 
    zIndex: 10, 
    padding: 12,
  },
  skipText: { fontSize: 16, fontWeight: '600' },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40, width: '100%', marginBottom: 60 },

  illustrationContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    // Add subtle glow effect
    shadowColor: '#EC2629',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
  },

  title: {
    fontSize: 36, 
    fontWeight: '800', 
    textAlign: 'center',
    letterSpacing: -1, 
    lineHeight: 44, 
    marginBottom: 20,
  },
  body: {
    fontSize: 17, 
    textAlign: 'center', 
    lineHeight: 28, 
    fontWeight: '500',
    paddingHorizontal: 10,
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 32, 
    paddingBottom: Platform.OS === 'ios' ? 52 : 36,
    paddingTop: 32, 
    alignItems: 'center', 
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },

  nextBtn: {
    width: '100%', 
    height: 64, 
    borderRadius: 20,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#EC2629',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  nextBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
