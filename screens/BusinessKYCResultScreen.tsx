import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Animated, ActivityIndicator, StatusBar, Easing, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { businessKYCService, BusinessKYCStatus } from '../services/merchantService';

const { width } = Dimensions.get('window');
const ICON_SIZE = 100;

function GlowingOrb({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[st.glowingOrb, { backgroundColor: color, transform: [{ scale: pulse }] }]} />
  );
}

function StepRow({ icon, label, sub, done, active, T, isDarkMode, accentColor }: {
  icon: string; label: string; sub: string; done: boolean; active: boolean; T: any; isDarkMode: boolean; accentColor: string;
}) {
  const dotColor = done ? '#10B981' : active ? accentColor : isDarkMode ? 'rgba(255,255,255,0.12)' : '#E4E7EC';
  const dotBg    = done ? '#10B981' : 'transparent';

  return (
    <View style={st.stepRow}>
      <View style={st.stepLeft}>
        <View style={[st.stepDot, { backgroundColor: dotBg, borderColor: dotColor }]}>
          {done   && <Feather name="check" size={11} color="#FFF" />}
          {active && <View style={[st.stepInner, { backgroundColor: accentColor }]} />}
          {!done && !active && <View style={[st.stepInner, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#E4E7EC' }]} />}
        </View>
        <View style={[st.stepLine, { backgroundColor: done ? '#10B981' : isDarkMode ? 'rgba(255,255,255,0.06)' : '#E4E7EC' }]} />
      </View>
      <View style={st.stepRight}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Feather name={icon as any} size={13} color={done ? '#10B981' : active ? accentColor : T.textDim} />
          <Text style={[st.stepLabel, { color: done || active ? T.text : T.textDim }]}>{label}</Text>
          {done   && <View style={[st.pill, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Text style={[st.pillText, { color: '#10B981' }]}>Done</Text></View>}
          {active && <View style={[st.pill, { backgroundColor: accentColor + '1A' }]}><Text style={[st.pillText, { color: accentColor }]}>Active</Text></View>}
        </View>
        <Text style={[st.stepSub, { color: T.textDim }]}>{sub}</Text>
      </View>
    </View>
  );
}

export default function BusinessKYCResultScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [status,  setStatus]  = useState<BusinessKYCStatus>(null);
  const [record,  setRecord]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<BusinessKYCStatus>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const load = useCallback(async () => {
    try {
      const r = await businessKYCService.getStatus(walletAddress);
      const s = r?.status ?? null;
      statusRef.current = s;
      setStatus(s);
      setRecord(r);
      if (s === 'approved' || s === 'rejected') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [walletAddress]);

  useEffect(() => { load(); }, []);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => {
      if (statusRef.current === 'approved' || statusRef.current === 'rejected') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }
      load();
    }, 10_000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [load]));

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const hasDoc = !!record?.document_url;
  const isIncomplete = status === 'pending' && !hasDoc;
  const isReviewing = (status === 'pending' && hasDoc) || status === 'under_review';
  const isApproved  = status === 'approved';
  const isRejected  = status === 'rejected';

  const accentColor =
    isApproved  ? '#10B981' :
    isRejected  ? T.error   :
    isIncomplete ? '#EF4444' :
    '#F59E0B'; // Amber orange for review/pending

  const statusLabel =
    isApproved  ? 'APPROVED' :
    isRejected  ? 'REJECTED' :
    isIncomplete ? 'INCOMPLETE SETUP' :
    status === 'under_review' ? 'UNDER REVIEW' : 'SUBMITTED';

  const heroTitle =
    isApproved  ? 'Business Verified' :
    isRejected  ? 'Verification Rejected' :
    isIncomplete ? 'Complete Your Setup' :
    status === 'under_review' ? 'In Review' : 'Documents Queueing';

  const heroSub =
    isApproved  ? 'Your business registration details have been verified. All enterprise merchant privileges are unlocked.'
    : isRejected
    ? 'We could not authenticate your business files. Please address compliance details and try again.'
    : isIncomplete
    ? 'Your company details are saved, but your setup is incomplete. Please finish uploading the required documents.'
    : status === 'under_review'
    ? 'Our compliance desk is currently validating your business ledger. Review takes 1-2 business days.'
    : 'Your documents are securely received and logged in our system. You will receive an alert once complete.';

  return (
    <View style={[st.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          style={st.headerBtn}
        >
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: T.text }]}>Merchant Profile</Text>
        <TouchableOpacity onPress={load} style={st.headerBtn}>
          <Feather name="refresh-cw" size={20} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Hero status card */}
        <View style={st.heroWrap}>
          <View style={st.iconWrap}>
            <GlowingOrb color={accentColor + '30'} />
            <LinearGradient
              colors={[accentColor, accentColor + '99']}
              style={st.iconCircle}
            >
              <Feather
                name={isApproved ? 'check' : isRejected ? 'x' : isIncomplete ? 'upload-cloud' : 'clock'}
                size={44}
                color="#FFF"
              />
            </LinearGradient>
          </View>

          <View style={[st.statusBadge, { backgroundColor: accentColor + '15' }]}>
            <Text style={[st.statusBadgeText, { color: accentColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[st.heroTitle, { color: T.text }]}>{heroTitle}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{heroSub}</Text>
        </View>

        {/* Progress steps timeline */}
        {(isReviewing || isIncomplete) && (
          <View style={[st.card, { backgroundColor: T.surfaceLow }]}>
            <Text style={[st.cardLabel, { color: T.textDim, marginBottom: 18 }]}>Compliance Schedule</Text>
            {[
              { icon: 'briefcase',    label: 'Corporate Info Saved', sub: 'Business name, registry & director details', done: true,          active: false },
              { icon: 'upload-cloud', label: 'Upload Documents',     sub: 'Business licenses & proof of status',         done: hasDoc,        active: !hasDoc },
              { icon: 'search',       label: 'Operational Audit',    sub: 'Director background validation checks',       done: false,         active: hasDoc },
              { icon: 'shield',       label: 'Authorized Status',    sub: 'Minting merchant signing keys',               done: false,         active: false },
            ].map((step, i, arr) => (
              <StepRow key={i} {...step} T={T} isDarkMode={isDarkMode} accentColor={accentColor} />
            ))}
            <View style={[st.etaRow, { backgroundColor: T.primary + '0A', borderColor: T.primary + '20' }]}>
              <Feather name="clock" size={16} color={T.primary} />
              <Text style={[st.etaText, { color: T.primary }]}>Review takes up to 1-2 business days</Text>
            </View>
          </View>
        )}

        {/* Approved Features */}
        {isApproved && (
          <View style={[st.card, { backgroundColor: T.surfaceLow, padding: 0 }]}>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 }}>
              <Text style={[st.cardLabel, { color: T.textDim }]}>Unlocked Enterprise Features</Text>
            </View>
            <View>
              {[
                { icon: 'qr-code',  label: 'Merchant QR Payments', sub: 'Accept client crypto transfers instantly' },
                { icon: 'repeat',   label: 'P2P Trusted Status',   sub: 'List marketplace trades with premium badge' },
                { icon: 'shield',   label: 'Corporate Safeguard',  sub: 'Corporate limit upgrades on major ledgers' },
              ].map((f, i, arr) => (
                <View
                  key={i}
                  style={[
                    st.featureRow,
                    i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                  ]}
                >
                  <View style={[st.featureIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Feather name={f.icon as any} size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.featureLabel, { color: T.text }]}>{f.label}</Text>
                    <Text style={[st.featureSub, { color: T.textDim }]}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rejected feedbacks */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surfaceLow }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="info" size={16} color={T.error} />
              </View>
              <Text style={[st.cardLabel, { color: T.error }]}>Audit Feedback</Text>
            </View>
            <Text style={[st.cardBody, { color: T.text, marginBottom: 16 }]}>
              Corporate details did not satisfy security parameters. Primary reject reasons:
            </Text>
            {[
              'Business certificate image was blurry or invalid model',
              'Submitting director details did not match KYC profile',
              'Provided corporate proof of address could not be verified',
              'Missing beneficial ownership details document',
            ].map((r, i) => (
              <View key={i} style={st.bulletRow}>
                <View style={[st.bullet, { backgroundColor: T.error }]} />
                <Text style={[st.bulletText, { color: T.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Panel Buttons */}
        <View style={st.actions}>
          {isApproved && (
            <>
              <TouchableOpacity style={[st.primaryBtn, { backgroundColor: '#10B981' }]} onPress={() => navigation.navigate('MerchantDashboard')} activeOpacity={0.85}>
                <Feather name="briefcase" size={20} color="#FFF" />
                <Text style={[st.primaryBtnText, { color: '#FFF' }]}>Merchant Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.primaryBtn, { backgroundColor: T.surfaceLow, marginTop: 12 }]} onPress={() => navigation.navigate('BusinessKYCForm')} activeOpacity={0.85}>
                <Feather name="edit-2" size={20} color={T.text} />
                <Text style={[st.primaryBtnText, { color: T.text }]}>Edit Business Details</Text>
              </TouchableOpacity>
            </>
          )}

          {isIncomplete && (
            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: T.text }]} onPress={() => navigation.replace('BusinessKYCForm')} activeOpacity={0.85}>
              <Feather name="upload-cloud" size={20} color={T.background} />
              <Text style={[st.primaryBtnText, { color: T.background }]}>Resume Document Upload</Text>
            </TouchableOpacity>
          )}

          {isRejected && (
            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: T.text }]} onPress={() => navigation.replace('BusinessKYCForm')} activeOpacity={0.85}>
              <Feather name="refresh-cw" size={20} color={T.background} />
              <Text style={[st.primaryBtnText, { color: T.background }]}>Re-submit Business Details</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: 'transparent' }]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.7}
          >
            <Text style={[st.ghostBtnText, { color: T.textDim }]}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBtn:   { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.bold },

  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 16 },

  heroWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 32,
  },
  iconWrap: { width: ICON_SIZE + 40, height: ICON_SIZE + 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  glowingOrb: { position: 'absolute', width: ICON_SIZE + 40, height: ICON_SIZE + 40, borderRadius: (ICON_SIZE + 40) / 2 },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },

  statusBadge:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  statusBadgeText: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1 },
  heroTitle:       { fontSize: 32, fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -1, marginBottom: 12 },
  heroSub:         { fontSize: 16, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 24 },

  card:       { borderRadius: 24, padding: 24, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardIconBox:{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardLabel:  { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1, textTransform: 'uppercase' },
  cardBody:   { fontSize: 15, fontFamily: Fonts.medium, lineHeight: 22 },

  stepRow:   { flexDirection: 'row', gap: 16, marginBottom: 4 },
  stepLeft:  { alignItems: 'center', width: 24 },
  stepDot:   { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepInner: { width: 8, height: 8, borderRadius: 4 },
  stepLine:  { width: 2, flex: 1, minHeight: 20, marginVertical: 4 },
  stepRight: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 15, fontFamily: Fonts.bold },
  stepSub:   { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2 },
  pill:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pillText:  { fontSize: 10, fontFamily: Fonts.bold },

  etaRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  etaText: { fontSize: 14, fontFamily: Fonts.bold },

  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 20 },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  featureLabel:{ fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  featureSub:  { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 18 },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  bullet:     { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, lineHeight: 20 },

  actions:        { gap: 16, marginTop: 16 },
  primaryBtn:     { height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryBtnText: { fontSize: 18, fontFamily: Fonts.bold },
  ghostBtn:       { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText:   { fontSize: 16, fontFamily: Fonts.bold },
});
