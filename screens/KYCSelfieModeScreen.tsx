import React, { useEffect, useRef } from 'react';
import { Theme } from '../constants';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Dimensions, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width, height } = Dimensions.get('window');

const FaceOutlineIllustration = ({ isDark, T }: { isDark: boolean; T: any }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.faceWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Svg width={120} height={150} viewBox="0 0 120 150">
           <Path 
             d="M60 10 C30 10 10 40 10 80 C10 120 30 140 60 140 C90 140 110 120 110 80 C110 40 90 10 60 10Z" 
             stroke={T.primary} 
             strokeWidth="3" 
             fill="none"
             strokeDasharray="8 6"
           />
           <Circle cx="40" cy="70" r="4" fill={T.primary} opacity="0.6" />
           <Circle cx="80" cy="70" r="4" fill={T.primary} opacity="0.6" />
           <Path d="M45 110 Q60 120 75 110" stroke={T.primary} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const VideoIcon = ({ T }: { T: any }) => {
  const dotOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Svg width={50} height={50} viewBox="0 0 50 50">
      <Rect x="8" y="12" width="24" height="26" rx="4" fill={T.primary} opacity="0.15" stroke={T.primary} strokeWidth="2" />
      <Path d="M34 18 L42 14 V36 L34 32 V18 Z" fill={T.primary} opacity="0.15" stroke={T.primary} strokeWidth="2" />
      <AnimatedCircle cx="15" cy="18" r="3" fill={T.primary} fillOpacity={dotOpacity} />
    </Svg>
  );
};

const CodeIcon = ({ T }: { T: any }) => (
  <Svg width={50} height={50} viewBox="0 0 50 50">
    <Rect x="10" y="10" width="30" height="30" rx="4" fill={T.primary} opacity="0.15" stroke={T.primary} strokeWidth="2" />
    <Path d="M16 20 H34 M16 28 H28" stroke={T.primary} strokeWidth="2" strokeLinecap="round" />
    <G transform="translate(32, 28) rotate(45)">
       <Rect x="0" y="0" width="4" height="12" rx="1" fill={T.primary} />
    </G>
  </Svg>
);

export default function KYCSelfieModeScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { docType, kycData, docImages } = route?.params ?? {};

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const go = (mode: 'video' | 'code') => {
    if (mode === 'video') {
      navigation.navigate('KYCVideoLiveness', { docType, kycData, docImages });
    } else {
      navigation.navigate('KYCCodeSelfie', { docType, kycData, docImages });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Top Section - Split screen style */}
      <View style={[s.topHalf, { backgroundColor: isDarkMode ? '#1c1b1b' : '#f0f0f0' }]}>
         <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }]}>
               <Feather name="arrow-left" size={24} color={T.text} />
            </TouchableOpacity>
         </View>
         <FaceOutlineIllustration isDark={isDarkMode} T={T} />
      </View>

      <Animated.View style={[s.bottomHalf, { 
        backgroundColor: T.background,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Text style={[s.title, { color: T.text }]}>Identity Check</Text>
        <Text style={[s.sub, { color: T.textDim }]}>Choose your preferred way to verify that you are the real account owner.</Text>

        <TouchableOpacity style={[s.optionCard, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => go('video')} activeOpacity={0.9}>
           <View style={s.optionIconWrap}>
              <VideoIcon T={T} />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={[s.optionTitle, { color: T.text }]}>Video Liveness</Text>
              <Text style={[s.optionDesc, { color: T.textDim }]}>Record a quick face scan following on-screen prompts.</Text>
           </View>
           <View style={[s.goCircle, { backgroundColor: T.surfaceLow }]}>
              <Feather name="chevron-right" size={20} color={T.text} />
           </View>
        </TouchableOpacity>

        <TouchableOpacity style={[s.optionCard, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => go('code')} activeOpacity={0.9}>
           <View style={s.optionIconWrap}>
              <CodeIcon T={T} />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={[s.optionTitle, { color: T.text }]}>Photo with Code</Text>
              <Text style={[s.optionDesc, { color: T.textDim }]}>Write down a 6-digit code and take a selfie with it.</Text>
           </View>
           <View style={[s.goCircle, { backgroundColor: T.surfaceLow }]}>
              <Feather name="chevron-right" size={20} color={T.text} />
           </View>
        </TouchableOpacity>

        <View style={s.footer}>
           <View style={[s.badge, { backgroundColor: `${T.success}15` }]}>
              <Feather name="shield" size={14} color={T.success} />
              <Text style={[s.badgeText, { color: T.success }]}>256-bit encrypted · Biometric grade</Text>
           </View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topHalf: { height: height * 0.38, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  header: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 48, left: 20, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  faceWrap: { marginTop: 0 },
  
  bottomHalf: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginBottom: 12 },
  sub: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
  
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1.5, marginBottom: 16 },
  optionIconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  optionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  optionDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  goCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  
  footer: { marginTop: 'auto', paddingBottom: Platform.OS === 'ios' ? 40 : 24, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }
});
