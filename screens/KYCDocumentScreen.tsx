import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Dimensions, StatusBar, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useWallet } from '../store/WalletContext';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 5;

export type DocType = 'national_id' | 'passport' | 'drivers_license';

const PassportIcon = ({ active, T }: { active: boolean; T: any }) => (
  <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
    <Defs>
       <SvgLinearGradient id="passGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={active ? T.primary : T.textDim} />
          <Stop offset="100%" stopColor={active ? (T.primaryDark || T.primary) : T.border} />
       </SvgLinearGradient>
    </Defs>
    <Rect x="12" y="8" width="36" height="44" rx="4" fill="url(#passGrad)" />
    <Circle cx="30" cy="30" r="8" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
    <Path d="M24 30 H36 M30 24 V36" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
    <Path d="M30 14 H34 M30 18 H38" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
  </Svg>
);

const IDCardIcon = ({ active, T }: { active: boolean; T: any }) => (
  <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
    <Defs>
       <SvgLinearGradient id="idGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={active ? T.primary : T.textDim} />
          <Stop offset="100%" stopColor={active ? (T.primaryDark || T.primary) : T.border} />
       </SvgLinearGradient>
    </Defs>
    <Rect x="8" y="14" width="44" height="32" rx="4" fill="url(#idGrad)" />
    <Circle cx="20" cy="26" r="5" fill="#fff" opacity="0.6" />
    <Path d="M12 38 Q20 32 28 38" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <Rect x="34" y="22" width="12" height="2" rx="1" fill="#fff" opacity="0.6" />
    <Rect x="34" y="28" width="10" height="2" rx="1" fill="#fff" opacity="0.6" />
    <Rect x="34" y="34" width="8" height="2" rx="1" fill="#fff" opacity="0.6" />
  </Svg>
);

const LicenseIcon = ({ active, T }: { active: boolean; T: any }) => (
  <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
    <Defs>
       <SvgLinearGradient id="licGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={active ? T.primary : T.textDim} />
          <Stop offset="100%" stopColor={active ? (T.primaryDark || T.primary) : T.border} />
       </SvgLinearGradient>
    </Defs>
    <Circle cx="30" cy="30" r="22" stroke="url(#licGrad)" strokeWidth="4" />
    <Circle cx="30" cy="30" r="4" fill="url(#licGrad)" />
    <Path d="M30 12 V26 M18 40 L26 33 M42 40 L34 33" stroke="url(#licGrad)" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

const DOCS: { id: DocType; label: string; icon: any; chips: string[] }[] = [
  { id: 'passport',        label: 'Passport',          icon: PassportIcon, chips: ['Photo Page', 'High Quality'] },
  { id: 'national_id',     label: 'National ID',       icon: IDCardIcon,   chips: ['Front & Back', 'Full View'] },
  { id: 'drivers_license', label: "Driver's License",  icon: LicenseIcon,  chips: ['Front & Back', 'Clear Text'] },
];

export default function KYCDocumentScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const kycData = route?.params?.kycData ?? {};
  const [selected, setSelected] = useState<DocType | null>(null);

  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected) {
      Animated.spring(btnAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    }
  }, [selected]);

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={{ height: 6, backgroundColor: T.surfaceHigh }}>
        <View style={{ height: 6, backgroundColor: T.primary, width: `${(3 / TOTAL_STEPS) * 100}%`, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
      </View>

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={[s.headerTitle, { color: T.text }]}>Document Type</Text>
          <Text style={[s.stepPill, { color: T.textDim }]}>Step 3 of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: T.text }]}>How would you like{'\n'}to verify?</Text>
        <Text style={[s.sub, { color: T.textMuted }]}>Select the document you have with you right now.</Text>

        {DOCS.map(doc => {
          const active = selected === doc.id;
          return <DocCard key={doc.id} doc={doc} active={active} onPress={() => setSelected(doc.id)} T={T} />;
        })}
      </ScrollView>

      <Animated.View style={[s.footer, { 
        transform: [{ translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }],
        opacity: btnAnim 
      }]}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: T.primary, shadowColor: T.primary }]}
          onPress={() => navigation.navigate('KYCScan', { docType: selected, kycData: { ...kycData, document_type: selected } })}
          activeOpacity={0.9}
        >
          <Text style={s.btnText}>Continue to Scanner</Text>
          <View style={s.btnIconCircle}>
            <Feather name="arrow-right" size={18} color={T.primary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function DocCard({ doc, active, onPress, T }: { doc: any, active: boolean, onPress: () => void, T: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scale, { toValue: active ? 1.02 : 1, duration: 250, useNativeDriver: true }).start();
    Animated.timing(glow, { toValue: active ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [active]);

  const Icon = doc.icon;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ marginBottom: 16 }}>
      <Animated.View style={[
        s.card, 
        { 
          backgroundColor: T.surface, 
          borderColor: active ? T.primary : T.border,
          transform: [{ scale }]
        }
      ]}>
        {active && (
          <Animated.View style={[s.glowBorder, { borderColor: T.primary, opacity: glow }]} />
        )}
        
        <View style={[s.cardIconWrap, { backgroundColor: active ? `${T.primary}12` : T.surfaceLow }]}>
           <Icon active={active} T={T} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.cardLabel, { color: T.text }]}>{doc.label}</Text>
          <View style={s.chipContainer}>
            {doc.chips.map((chip: string, idx: number) => (
              <View key={idx} style={[s.chip, { backgroundColor: active ? `${T.primary}15` : T.surfaceLow }]}>
                <Text style={[s.chipText, { color: active ? T.primary : T.textDim }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.radioCircle, { borderColor: active ? T.primary : T.border }]}>
          {active && (
            <Animated.View style={{ transform: [{ scale: glow }] }}>
              <View style={[s.radioInner, { backgroundColor: T.primary }]}>
                <Feather name="check" size={10} color="#FFF" />
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 48, 
    paddingBottom: 16 
  },
  headerText: { alignItems: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  stepPill: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 12, letterSpacing: -0.8, lineHeight: 34 },
  sub: { fontSize: 16, marginBottom: 32, lineHeight: 24 },
  
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    borderRadius: 24, 
    borderWidth: 1.5, 
    padding: 20, 
    position: 'relative'
  },
  glowBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 2,
  },
  cardIconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12 },
  btn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    height: 64, 
    borderRadius: 20, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 8 
  },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  btnIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }
});
