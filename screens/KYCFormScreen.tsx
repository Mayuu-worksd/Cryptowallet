import React, { useState, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView,
  Animated, Modal, FlatList, Dimensions, StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, G } from 'react-native-svg';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { kycService } from '../services/supabaseService';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 5;

const COUNTRY_CODES = [
  { code: '+1',   name: 'United States' },
  { code: '+44',  name: 'United Kingdom' },
  { code: '+91',  name: 'India' },
  { code: '+61',  name: 'Australia' },
  { code: '+1',   name: 'Canada' },
  { code: '+49',  name: 'Germany' },
  { code: '+33',  name: 'France' },
  { code: '+65',  name: 'Singapore' },
  { code: '+971', name: 'UAE' },
  { code: '+55',  name: 'Brazil' },
  { code: '+81',  name: 'Japan' },
  { code: '+82',  name: 'South Korea' },
  { code: '+86',  name: 'China' },
  { code: '+60',  name: 'Malaysia' },
  { code: '+63',  name: 'Philippines' },
  { code: '+62',  name: 'Indonesia' },
  { code: '+234', name: 'Nigeria' },
  { code: '+27',  name: 'South Africa' },
  { code: '+52',  name: 'Mexico' },
  { code: '+54',  name: 'Argentina' },
];

const NATIONALITIES = [
  'American','British','Canadian','Australian','German','French',
  'Indian','Singaporean','Emirati','Brazilian','Japanese','Korean',
  'Chinese','Malaysian','Filipino','Indonesian','Nigerian',
  'South African','Mexican','Argentine','Other',
];

type TC = typeof Theme.colors;

const IDIllustration = ({ isDark, T }: { isDark: boolean; T: TC }) => (
  <Svg width={240} height={200} viewBox="0 0 240 200" fill="none">
    <Defs>
      <SvgLinearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={T.primary} />
        <Stop offset="100%" stopColor={T.primaryDark || '#9b181a'} />
      </SvgLinearGradient>
      <SvgLinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={T.success} />
        <Stop offset="100%" stopColor="#009624" />
      </SvgLinearGradient>
    </Defs>
    
    <Circle cx="120" cy="100" r="80" fill={T.primary} opacity="0.05" />
    
    <G transform="translate(40, 40) rotate(-4)">
      <Rect x="0" y="0" width="160" height="100" rx="12" fill={isDark ? "#2a2a2a" : "#fff"} stroke={isDark ? "#3a3a3a" : "#eee"} strokeWidth="2" />
      <Rect x="0" y="0" width="160" height="20" rx="0" fill="url(#cardGrad)" opacity="0.1" />
      <Rect x="12" y="32" width="40" height="40" rx="6" fill={isDark ? "#3a3a3a" : "#f5f5f5"} />
      <Rect x="64" y="36" width="80" height="8" rx="4" fill={isDark ? "#3a3a3a" : "#f5f5f5"} />
      <Rect x="64" y="52" width="60" height="8" rx="4" fill={isDark ? "#3a3a3a" : "#f5f5f5"} />
      <Rect x="64" y="68" width="70" height="8" rx="4" fill={isDark ? "#3a3a3a" : "#f5f5f5"} />
    </G>

    <G transform="translate(140, 90)">
      <Circle cx="30" cy="35" r="40" fill={T.success} opacity="0.1" />
      <Path d="M30 0 L55 12 V35 C55 55 30 70 30 70 C30 70 5 55 5 35 V12 L30 0 Z" fill="url(#shieldGrad)" />
      <Path d="M18 35 L26 43 L42 27" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  </Svg>
);

function ProgressBar({ step, total, T }: { step: number; total: number; T: TC }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: step / total, duration: 600, useNativeDriver: false }).start();
  }, [step]);
  return (
    <View style={{ height: 6, backgroundColor: T.surfaceHigh, overflow: 'hidden' }}>
      <Animated.View style={{ height: 6, backgroundColor: T.primary, width: anim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }), borderRadius: 3 }} />
    </View>
  );
}

function Field({
  label, value, onChangeText, keyboardType, error, editable = true, rightElement, T,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: any; error?: string; editable?: boolean; rightElement?: React.ReactNode; T: TC;
}) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const accentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: focused || value ? 1 : 0, duration: 200, useNativeDriver: false }).start();
    Animated.timing(accentAnim, { toValue: focused ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [focused, value]);

  const labelTop  = anim.interpolate({ inputRange: [0,1], outputRange: [18, 8] });
  const labelSize = anim.interpolate({ inputRange: [0,1], outputRange: [15, 11] });
  
  return (
    <View style={{ marginBottom: error ? 6 : 16 }}>
      <View style={{ 
        borderWidth: 1, 
        borderRadius: 16, 
        paddingHorizontal: 16, 
        paddingBottom: 12, 
        minHeight: 64, 
        justifyContent: 'center', 
        backgroundColor: T.surface, 
        borderColor: error ? T.error : T.border,
        overflow: 'hidden'
      }}>
        <Animated.View style={{ 
          position: 'absolute', 
          left: 0, 
          top: 0, 
          bottom: 0, 
          width: 4, 
          backgroundColor: T.primary,
          opacity: accentAnim 
        }} />
        
        <Animated.Text style={{ 
          position: 'absolute', 
          left: 16, 
          fontWeight: '700', 
          top: labelTop, 
          fontSize: labelSize, 
          color: error ? T.error : focused ? T.primary : T.textDim 
        }}>
          {label}
        </Animated.Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.text, paddingTop: 22 }}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
            editable={editable}
            placeholderTextColor={T.textDim}
          />
          {rightElement}
        </View>
      </View>
      {error ? <Text style={{ fontSize: 12, color: T.error, fontWeight: '700', marginTop: 4, marginLeft: 4 }}>{error}</Text> : null}
    </View>
  );
}

function SheetModal({ visible, title, onClose, children, T }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode; T: TC;
}) {
  const [search, setSearch] = useState('');
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' }}>
          <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: T.surfaceHigh, alignSelf: 'center', marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: T.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color={T.text} />
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceLow, borderRadius: 16, paddingHorizontal: 16, height: 50, marginBottom: 16 }}>
            <Feather name="search" size={18} color={T.textDim} style={{ marginRight: 10 }} />
            <TextInput 
              placeholder="Search..." 
              placeholderTextColor={T.textDim}
              style={{ flex: 1, color: T.text, fontWeight: '600' }}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {React.Children.map(children, child => {
            if (React.isValidElement(child) && child.type === FlatList) {
              return React.cloneElement(child as any, {
                data: (child.props.data as any[]).filter(item => 
                  (typeof item === 'string' ? item : (item.name || '')).toLowerCase().includes(search.toLowerCase())
                )
              });
            }
            return child;
          })}
        </View>
      </View>
    </Modal>
  );
}

export default function KYCFormScreen({ navigation, route }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const isEditMode = route?.params?.editMode === true;

  const [step, setStep]         = useState<'intro' | 'details'>(isEditMode ? 'details' : 'intro');
  const [checking, setChecking] = useState(!isEditMode);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [toast, setToast]       = useState({ visible: false, message: '', type: 'error' as any });
  const [nationalityModal, setNationalityModal] = useState(false);
  const [countryCodeModal, setCountryCodeModal] = useState(false);
  const [form, setForm] = useState({ name: '', dob: '', nationality: '', countryCode: '+1', phone: '', email: '', address: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Animations
  const heroSlide = useRef(new Animated.Value(50)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const checkItems = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step === 'intro') {
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(heroSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start();

      checkItems.forEach((anim, i) => {
        Animated.timing(anim, { toValue: 1, duration: 500, delay: 400 + (i * 150), useNativeDriver: true }).start();
      });

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [step]);

  useEffect(() => {
    kycService.getStatus(walletAddress)
      .then(r => {
        if (!r) return;
        if (isEditMode) {
          const sorted  = [...COUNTRY_CODES].sort((a,b) => b.code.length - a.code.length);
          const matched = sorted.find(c => (r.phone ?? '').startsWith(c.code));
          const dial    = matched?.code ?? '+1';
          setForm({ name: r.full_name ?? '', dob: r.dob ?? '', nationality: r.nationality ?? '', countryCode: dial, phone: matched ? (r.phone ?? '').slice(dial.length) : (r.phone ?? ''), email: r.email ?? '', address: r.address ?? '' });
          return;
        }
        if (r.status === 'verified' || r.status === 'under_review' || (r.status === 'pending' && !!r.document_url)) {
          navigation.replace('KYCResult');
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const set = (key: keyof typeof form) => (val: string) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || /\d/.test(form.name) || form.name.trim().length < 3)
      e.name = 'Enter your full legal name';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Enter a valid email address';
    if (!form.dob) {
      e.dob = 'Date of birth is required';
    } else {
      const [dd, mm, yyyy] = form.dob.split('/');
      const age = (Date.now() - new Date(+yyyy, +mm - 1, +dd).getTime()) / (1000*60*60*24*365.25);
      if (isNaN(age) || age < 18) e.dob = 'Must be at least 18 years old';
    }
    if (!form.nationality) e.nationality = 'Select nationality';
    if (!form.phone.trim() || form.phone.trim().length < 6) e.phone = 'Enter valid phone';
    if (!form.address.trim() || form.address.trim().length < 10) e.address = 'Enter full address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    if (isEditMode) {
      try {
        await kycService.updateDetails(walletAddress, {
          full_name: form.name.trim(), email: form.email.trim(),
          phone: `${form.countryCode}${form.phone.trim()}`,
          nationality: form.nationality, dob: form.dob, address: form.address.trim(),
        });
        setSuccess(true);
        setTimeout(() => navigation.goBack(), 1500);
      } catch (e: any) {
        setToast({ visible: true, message: e?.message ?? 'Failed to save.', type: 'error' });
      }
      setLoading(false);
      return;
    }
    try {
      const existing = await kycService.getStatus(walletAddress);
      if (existing?.status === 'verified' || existing?.status === 'under_review' ||
          (existing?.status === 'pending' && !!existing.document_url)) {
        setLoading(false); navigation.replace('KYCResult'); return;
      }
      const kycData = {
        name: form.name.trim(), full_name: form.name.trim(), email: form.email.trim(),
        phone: `${form.countryCode}${form.phone.trim()}`, nationality: form.nationality,
        dob: form.dob, address: form.address.trim(), document_type: '',
      };
      await kycService.submitKYC(walletAddress, kycData);
      setSuccess(true);
      setTimeout(() => {
        setLoading(false);
        navigation.navigate('KYCDocument', { kycData });
      }, 1000);
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message ?? '';
      if (msg.startsWith('ALREADY_SUBMITTED:pending')) {
        navigation.navigate('KYCDocument', { kycData: { name: form.name.trim(), full_name: form.name.trim(), email: form.email.trim(), phone: `${form.countryCode}${form.phone.trim()}`, nationality: form.nationality, dob: form.dob, address: form.address.trim(), document_type: '' } });
        return;
      }
      setToast({ visible: true, message: msg || 'Failed to save. Try again.', type: 'error' });
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (step === 'intro') {
    return (
      <View style={{ flex: 1, backgroundColor: T.background }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <View style={s.headerStepContainer}>
             <Text style={[s.headerTitle, { color: T.text }]}>Identity Verification</Text>
             <Text style={[s.stepPill, { color: T.textDim }]}>Step 1 of {TOTAL_STEPS}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={[s.heroWrap, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
            <IDIllustration isDark={isDarkMode} T={T} />
            <Text style={[s.heroTitle, { color: T.text }]}>Let's verify your identity</Text>
            <Text style={[s.heroSub, { color: T.textMuted }]}>This keeps your account secure and helps us follow legal requirements.</Text>
          </Animated.View>

          {[
            { icon: 'file-text', title: 'Personal Details', sub: 'Full name, DOB and address' },
            { icon: 'credit-card', title: 'Government ID',  sub: "Passport or Driver's License" },
            { icon: 'user-check',  title: 'Face Scan',      sub: 'Quick selfie to confirm identity' },
          ].map((item, i) => (
            <Animated.View key={i} style={[s.checkRow, { backgroundColor: T.surface, borderColor: T.border, opacity: checkItems[i] }]}>
              <View style={s.accentLine} />
              <View style={[s.checkIcon, { backgroundColor: `${T.primary}15` }]}>
                <Feather name={item.icon as any} size={20} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.checkTitle, { color: T.text }]}>{item.title}</Text>
                <Text style={[s.checkSub, { color: T.textDim }]}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={T.textDim} />
            </Animated.View>
          ))}

          <View style={s.trustBadge}>
            <Feather name="lock" size={14} color={T.success} />
            <Text style={[s.trustText, { color: T.textDim }]}>Bank-grade 256-bit encryption security</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity 
              style={[s.btn, { backgroundColor: T.primary, shadowColor: T.primary }]} 
              onPress={() => setStep('details')} 
              activeOpacity={0.9}
            >
              <Text style={s.btnText}>Continue to Verification</Text>
              <View style={s.btnIconCircle}>
                <Feather name="arrow-right" size={18} color={T.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      <SheetModal visible={nationalityModal} title="Select Nationality" onClose={() => setNationalityModal(false)} T={T}>
        <FlatList
          data={NATIONALITIES}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.sheetRow, { borderBottomColor: T.border }]}
              onPress={() => { set('nationality')(item); setNationalityModal(false); }}
              activeOpacity={0.7}
            >
              <Text style={[s.sheetRowText, { color: T.text }]}>{item}</Text>
              {form.nationality === item && (
                <View style={[s.checkBadge, { backgroundColor: T.primary }]}>
                   <Feather name="check" size={12} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </SheetModal>

      <SheetModal visible={countryCodeModal} title="Country Code" onClose={() => setCountryCodeModal(false)} T={T}>
        <FlatList
          data={COUNTRY_CODES}
          keyExtractor={(item, i) => `${item.code}-${i}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.sheetRow, { borderBottomColor: T.border }]}
              onPress={() => { set('countryCode')(item.code); setCountryCodeModal(false); }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[s.sheetRowText, { color: T.text }]}>{item.name}</Text>
                <Text style={{ color: T.textDim, fontSize: 13, fontWeight: '700' }}>{item.code}</Text>
              </View>
              {form.countryCode === item.code && (
                 <View style={[s.checkBadge, { backgroundColor: T.primary }]}>
                    <Feather name="check" size={12} color="#FFF" />
                 </View>
              )}
            </TouchableOpacity>
          )}
        />
      </SheetModal>

      <View style={s.header}>
        <TouchableOpacity onPress={() => isEditMode ? navigation.goBack() : setStep('intro')} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <View style={s.headerStepContainer}>
          <Text style={[s.headerTitle, { color: T.text }]}>{isEditMode ? 'Edit Profile' : 'Personal Details'}</Text>
          <Text style={[s.stepPill, { color: T.textDim }]}>Step 2 of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      
      <ProgressBar step={2} total={TOTAL_STEPS} T={T} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.sectionHeader}>
           <View style={[s.stepCircle, { backgroundColor: T.primary }]}>
              <Text style={s.stepNumber}>01</Text>
           </View>
           <View>
             <Text style={[s.sectionTitle, { color: T.text }]}>Identity</Text>
             <Text style={[s.sectionSub, { color: T.textDim }]}>Enter details as they appear on your ID.</Text>
           </View>
        </View>

        <Field label="Full Legal Name" value={form.name} onChangeText={set('name')} error={errors.name} T={T} />
        <Field
          label="Date of Birth (DD/MM/YYYY)"
          value={form.dob}
          onChangeText={val => {
            const d = val.replace(/\D/g, '').slice(0, 8);
            let out = d;
            if (d.length > 4) out = d.slice(0,2) + '/' + d.slice(2,4) + '/' + d.slice(4);
            else if (d.length > 2) out = d.slice(0,2) + '/' + d.slice(2);
            set('dob')(out);
          }}
          keyboardType="numeric"
          error={errors.dob}
          T={T}
        />

        <View style={s.sectionHeader}>
           <View style={[s.stepCircle, { backgroundColor: T.primary }]}>
              <Text style={s.stepNumber}>02</Text>
           </View>
           <View>
             <Text style={[s.sectionTitle, { color: T.text }]}>Contact</Text>
           </View>
        </View>

        <Field label="Email Address" value={form.email} onChangeText={set('email')} keyboardType="email-address" error={errors.email} T={T} />

        <View style={{ marginBottom: errors.phone ? 6 : 16 }}>
          <View style={[s.premiumSelector, { borderColor: errors.phone ? T.error : T.border, backgroundColor: T.surface }]}>
            <TouchableOpacity style={[s.dialBtn, { backgroundColor: T.surfaceLow }]} onPress={() => setCountryCodeModal(true)} activeOpacity={0.8}>
              <Text style={[s.dialText, { color: T.text }]}>{form.countryCode}</Text>
              <Feather name="chevron-down" size={14} color={T.textDim} />
            </TouchableOpacity>
            <View style={[s.phoneDivider, { backgroundColor: T.border }]} />
            <View style={{ flex: 1, paddingLeft: 14 }}>
              <Text style={[s.phoneLabel, { color: T.textDim }]}>Phone Number</Text>
              <TextInput
                style={[s.phoneInput, { color: T.text }]}
                value={form.phone}
                onChangeText={set('phone')}
                keyboardType="phone-pad"
                placeholderTextColor={T.textDim}
                autoCapitalize="none"
              />
            </View>
          </View>
          {errors.phone ? <Text style={{ fontSize: 12, color: T.error, fontWeight: '700', marginTop: 4, marginLeft: 4 }}>{errors.phone}</Text> : null}
        </View>

        <View style={s.sectionHeader}>
           <View style={[s.stepCircle, { backgroundColor: T.primary }]}>
              <Text style={s.stepNumber}>03</Text>
           </View>
           <View>
             <Text style={[s.sectionTitle, { color: T.text }]}>Location</Text>
           </View>
        </View>

        <TouchableOpacity
          style={[s.premiumSelector, { borderColor: errors.nationality ? T.error : form.nationality ? T.primary : T.border, backgroundColor: T.surface }]}
          onPress={() => setNationalityModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.selectorLabel, { color: T.textDim }]}>Nationality</Text>
            <Text style={[s.selectorValue, { color: form.nationality ? T.text : T.textDim }]}>
              {form.nationality || 'Select nationality'}
            </Text>
          </View>
          <Feather name="chevron-down" size={18} color={T.textDim} />
        </TouchableOpacity>
        {errors.nationality ? <Text style={{ fontSize: 12, color: T.error, fontWeight: '700', marginTop: 4, marginLeft: 4, marginBottom: 12 }}>{errors.nationality}</Text> : <View style={{ height: 16 }} />}

        <Field label="Residential Address" value={form.address} onChangeText={set('address')} error={errors.address} T={T} />

        <TouchableOpacity 
          style={[s.btn, { backgroundColor: T.primary, shadowColor: T.primary }, (loading || success) && { opacity: 0.8 }]} 
          onPress={handleNext} 
          disabled={loading || success} 
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : success ? (
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
               <Text style={s.btnText}>Success</Text>
               <Feather name="check-circle" size={20} color="#FFF" />
            </Animated.View>
          ) : (
            <>
              <Text style={s.btnText}>{isEditMode ? 'Save Changes' : 'Continue'}</Text>
              <View style={s.btnIconCircle}>
                <Feather name={isEditMode ? 'check' : 'arrow-right'} size={18} color={T.primary} />
              </View>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 48, 
    paddingBottom: 16,
  },
  headerStepContainer: {
    alignItems: 'center',
  },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  stepPill: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  scroll: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 24 },

  heroWrap: { alignItems: 'center', marginBottom: 40 },
  heroTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginTop: 20, marginBottom: 10 },
  heroSub: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },

  checkRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 12, 
    borderWidth: 1,
    overflow: 'hidden'
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: Theme.colors.primary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  checkIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  checkTitle:{ fontSize: 17, fontWeight: '800', marginBottom: 2 },
  checkSub:  { fontSize: 14, fontWeight: '500' },

  trustBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 32 },
  trustText: { fontSize: 13, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 20 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sectionSub: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  premiumSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    paddingVertical: 14,
    minHeight: 64
  },
  selectorLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  selectorValue: { fontSize: 16, fontWeight: '700' },

  dialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 12 },
  dialText: { fontSize: 16, fontWeight: '800' },
  phoneDivider:{ width: 1, height: 30, marginLeft: 8 },
  phoneLabel: { fontSize: 11, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
  phoneInput: { fontSize: 16, fontWeight: '700', padding: 0 },

  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  sheetRowText: { fontSize: 16, fontWeight: '700' },
  checkBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  btn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    height: 64, 
    borderRadius: 20, 
    marginTop: 20, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 8 
  },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  btnIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }
});
