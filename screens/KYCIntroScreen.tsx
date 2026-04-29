import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Platform, StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, G, Polygon } from 'react-native-svg';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';

const IDVerificationIllustration = ({ isDark }: { isDark: boolean }) => (
  <Svg width={280} height={240} viewBox="0 0 280 240" fill="none">
    <Defs>
      <SvgLinearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#EC2629" />
        <Stop offset="100%" stopColor="#9b181a" />
      </SvgLinearGradient>
      <SvgLinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgLinearGradient>
      <SvgLinearGradient id="bgGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#EC2629" stopOpacity="0.1" />
        <Stop offset="100%" stopColor="#EC2629" stopOpacity="0" />
      </SvgLinearGradient>
    </Defs>
    
    {/* Background Glow */}
    <Circle cx="140" cy="120" r="100" fill="url(#bgGlow)" />
    
    {/* Background Abstract Elements */}
    <Path d="M40 80 Q70 50 100 80 T160 80" stroke={isDark ? "#ffffff20" : "#00000010"} strokeWidth="2" strokeDasharray="4 4" />
    <Circle cx="50" cy="160" r="4" fill="#EC2629" opacity="0.4" />
    <Circle cx="220" cy="60" r="6" fill="#10B981" opacity="0.4" />
    <Rect x="230" y="150" width="8" height="8" rx="2" fill="#EC2629" opacity="0.3" transform="rotate(45 234 154)" />
    
    {/* ID Card Base */}
    <G transform="translate(60, 50) rotate(-5)">
      {/* Shadow */}
      <Rect x="5" y="10" width="160" height="100" rx="12" fill="#000" opacity={isDark ? "0.3" : "0.1"} />
      {/* Card Body */}
      <Rect x="0" y="0" width="160" height="100" rx="12" fill={isDark ? "#2A2A2A" : "#FFFFFF"} stroke={isDark ? "#444" : "#E5E7EB"} strokeWidth="1" />
      {/* Header Bar */}
      <Path d="M0 12 C0 5.373 5.373 0 12 0 H148 C154.627 0 160 5.373 160 12 V24 H0 V12 Z" fill="url(#primaryGrad)" />
      
      {/* Profile Photo Placeholder */}
      <Rect x="16" y="40" width="40" height="44" rx="6" fill={isDark ? "#444" : "#F3F4F6"} />
      <Circle cx="36" cy="56" r="10" fill={isDark ? "#666" : "#D1D5DB"} />
      <Path d="M22 80 Q36 68 50 80 Z" fill={isDark ? "#666" : "#D1D5DB"} />
      
      {/* Text Lines */}
      <Rect x="68" y="44" width="70" height="6" rx="3" fill={isDark ? "#444" : "#E5E7EB"} />
      <Rect x="68" y="58" width="50" height="4" rx="2" fill={isDark ? "#444" : "#E5E7EB"} />
      <Rect x="68" y="68" width="60" height="4" rx="2" fill={isDark ? "#444" : "#E5E7EB"} />
      
      {/* Chip/Hologram */}
      <Rect x="126" y="74" width="18" height="14" rx="2" fill="#F59E0B" opacity="0.8" />
    </G>

    {/* Hand/Person holding (Abstract minimalist representation) */}
    <Path d="M40 240 Q60 180 100 160" fill="none" stroke={isDark ? "#444" : "#E5E7EB"} strokeWidth="16" strokeLinecap="round" />
    <Path d="M90 155 Q100 145 110 155" fill="none" stroke={isDark ? "#555" : "#D1D5DB"} strokeWidth="12" strokeLinecap="round" />

    {/* Security Shield Overlay */}
    <G transform="translate(140, 100)">
      {/* Shield Glow */}
      <Circle cx="35" cy="40" r="45" fill="#10B981" opacity="0.15" />
      {/* Shield Body */}
      <Path d="M35 0 L70 15 V45 C70 70 35 90 35 90 C35 90 0 70 0 45 V15 L35 0 Z" fill="url(#shieldGrad)" />
      {/* Shield Highlight */}
      <Path d="M35 0 L70 15 V45 C70 70 35 90 35 90 V0 Z" fill="#FFF" opacity="0.15" />
      {/* Checkmark */}
      <Path d="M20 45 L30 55 L50 30" stroke="#FFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  </Svg>
);

const STEPS = [
  {
    title: 'Personal Info',
    desc: 'Enter your basic details',
    icon: 'user',
  },
  {
    title: 'Upload ID',
    desc: 'Passport or driver\'s license',
    icon: 'credit-card',
  },
  {
    title: 'Take Selfie',
    desc: 'Quick face scan to verify it\'s you',
    icon: 'camera',
  },
];

export default function KYCIntroScreen({ navigation }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.iconBtn, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F3F4F6' }]}
        >
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }],
          alignItems: 'center'
        }}>
          {/* Illustration */}
          <View style={styles.illustrationWrap}>
            <IDVerificationIllustration isDark={isDarkMode} />
          </View>

          <Text style={[styles.title, { color: T.text }]}>
            Verify your Identity
          </Text>
          <Text style={[styles.subtitle, { color: T.textMuted }]}>
            To keep CryptoWallet secure and comply with regulations, we need to verify who you are. It only takes 2 minutes.
          </Text>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {STEPS.map((step, index) => (
              <View 
                key={index} 
                style={[
                  styles.stepCard, 
                  { 
                    backgroundColor: T.surface,
                    borderColor: T.border,
                  }
                ]}
              >
                <View style={[styles.stepIconRing, { backgroundColor: isDarkMode ? '#EC262915' : '#EC262910' }]}>
                  <Feather name={step.icon as any} size={20} color="#EC2629" />
                </View>
                <View style={styles.stepTextContent}>
                  <Text style={[styles.stepTitle, { color: T.text }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: T.textDim }]}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom Fixed Area */}
      <Animated.View style={[
        styles.bottomContainer, 
        { 
          backgroundColor: T.background,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        {/* Trust Bar */}
        <View style={styles.trustBar}>
          <Feather name="lock" size={12} color="#10B981" />
          <Text style={styles.trustText}>
            256-bit encrypted · Bank-grade security · Never shared
          </Text>
        </View>

        {/* Start Button */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('KYCForm')}>
          <LinearGradient
            colors={['#EC2629', '#D91C1E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Start Verification</Text>
            <View style={styles.btnIconRing}>
              <Feather name="arrow-right" size={18} color="#EC2629" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 10,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 160, // Space for bottom container
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 240,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  stepsContainer: {
    width: '100%',
    gap: 16,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepTextContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    borderTopWidth: 0, // removed to make it blend better
  },
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  trustText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    borderRadius: 20,
    shadowColor: '#EC2629',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 12,
  },
  btnIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
