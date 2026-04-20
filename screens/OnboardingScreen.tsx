import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

const AsyncStorage = Platform.OS === 'web'
  ? {
      getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
      setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
    }
  : require('@react-native-async-storage/async-storage').default;
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';

const { width: W } = Dimensions.get('window');
const ONBOARDING_KEY = 'cw_onboarding_done';

const SLIDES = [
  {
    icon:     'account-balance-wallet',
    iconLib:  'material',
    gradient: ['#FF3B3B', '#800010'] as [string, string],
    title:    'Your Crypto,\nYour Control',
    body:     'A non-custodial wallet — only you hold your private keys. No bank, no middleman, no limits.',
  },
  {
    icon:     'trending-up',
    iconLib:  'feather',
    gradient: ['#627EEA', '#3B4FCC'] as [string, string],
    title:    'Live Prices &\nReal-Time Data',
    body:     'Track ETH, BTC, SOL and more with live CoinGecko prices that refresh every 30 seconds.',
  },
  {
    icon:     'credit-card',
    iconLib:  'feather',
    gradient: ['#00C853', '#007A32'] as [string, string],
    title:    'Virtual Card\nSimulation',
    body:     'Top up your virtual card with crypto and simulate real-world payments anywhere.',
  },
  {
    icon:     'shield',
    iconLib:  'feather',
    gradient: ['#F59E0B', '#B45309'] as [string, string],
    title:    'Secured &\nPrivate',
    body:     'Private keys stored with OS-level encryption. Set a PIN for extra protection.',
  },
];

export async function shouldShowOnboarding(): Promise<boolean> {
  const done = await AsyncStorage.getItem(ONBOARDING_KEY);
  return !done;
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

interface Props {
  onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const goTo = (idx: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.4, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
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
    onFinish();
  };

  const slide = SLIDES[current];

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleFinish} activeOpacity={0.7}>
        <Text style={[styles.skipText, { color: T.textMuted }]}>Skip</Text>
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
            <Animated.View style={[styles.slideContent, { opacity: i === current ? fadeAnim : 1 }]}>
              {/* Icon */}
              <LinearGradient
                colors={s.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
              >
                {s.iconLib === 'material'
                  ? <MaterialIcons name={s.icon as any} size={56} color="#FFF" />
                  : <Feather name={s.icon as any} size={52} color="#FFF" />
                }
              </LinearGradient>

              {/* Text */}
              <Text style={[styles.title, { color: T.text }]}>{s.title}</Text>
              <Text style={[styles.body, { color: T.textMuted }]}>{s.body}</Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <Animated.View style={[
                styles.dot,
                {
                  backgroundColor: i === current ? slide.gradient[0] : T.border,
                  width: i === current ? 28 : 8,
                },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.gradient[0] }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {current === SLIDES.length - 1 ? "Let's Go 🚀" : 'Next'}
          </Text>
          {current < SLIDES.length - 1 && (
            <Feather name="arrow-right" size={18} color="#FFF" />
          )}
        </TouchableOpacity>

        {/* Step counter */}
        <Text style={[styles.stepText, { color: T.textMuted }]}>
          {current + 1} of {SLIDES.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute', top: Platform.OS === 'web' ? 24 : 60,
    right: 24, zIndex: 10, padding: 8,
  },
  skipText: { fontSize: 15, fontWeight: '600' },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40 },

  iconCircle: {
    width: 140, height: 140, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3, shadowRadius: 32, elevation: 16,
  },

  title: {
    fontSize: 34, fontWeight: '800', textAlign: 'center',
    letterSpacing: -0.8, lineHeight: 42, marginBottom: 20,
  },
  body: {
    fontSize: 16, textAlign: 'center', lineHeight: 26, fontWeight: '500',
  },

  bottom: {
    paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 52 : 36,
    paddingTop: 24, alignItems: 'center', gap: 20,
  },
  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },

  nextBtn: {
    width: '100%', height: 60, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  nextBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  stepText: { fontSize: 13, fontWeight: '600' },
});
