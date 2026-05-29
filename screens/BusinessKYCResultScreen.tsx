import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Animated, ActivityIndicator, StatusBar, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { businessKYCService, BusinessKYCStatus } from '../services/merchantService';

const ICON_SIZE = 90;

function PulsingRing({ color }: { color: string }) {
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const o1 = useRef(new Animated.Value(0.4)).current;
  const o2 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 1.6, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(o, { toValue: 0,   duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: delay === 0 ? 0.4 : 0.2, duration: 0, useNativeDriver: true }),
        ]),
      ])).start();
    loop(s1, o1, 0);
    loop(s2, o2, 750);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[st.ring, { borderColor: color, opacity: o1, transform: [{ scale: s1 }] }]} />
      <Animated.View style={[st.ring, { borderColor: color, opacity: o2, transform: [{ scale: s2 }] }]} />
    </View>
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
    isApproved  ? 'Business Identity Verified' :
    isRejected  ? 'Verification Rejected' :
    isIncomplete ? 'Complete Your Setup' :
    status === 'under_review' ? 'Business Details In Review' : 'Documents Queueing';

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
      <View style={[st.header, { paddingTop: insets.top + 12, borderBottomColor: T.border }]}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}
        >
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: T.text }]}>Merchant Profile</Text>
        <TouchableOpacity onPress={load} style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={16} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Brutalist Hero status card */}
        <View style={[st.heroWrap, { backgroundColor: T.surface, borderColor: T.border }]}>
          <LinearGradient
            colors={[accentColor + '0E', 'transparent']}
            style={st.heroGrad}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <View style={st.iconWrap}>
            {(isReviewing || isIncomplete) && (
              <PulsingRing color={accentColor} />
            )}
            <LinearGradient
              colors={[accentColor + '1F', accentColor + '05']}
              style={[st.iconCircle, { borderColor: accentColor + '2A' }]}
            >
              <Feather
                name={isApproved ? 'briefcase' : isRejected ? 'alert-triangle' : isIncomplete ? 'upload-cloud' : 'clock'}
                size={40}
                color={accentColor}
              />
            </LinearGradient>
          </View>

          <View style={[st.statusBadge, { backgroundColor: accentColor + '14', borderColor: accentColor + '24' }]}>
            <View style={[st.statusDot, { backgroundColor: accentColor }]} />
            <Text style={[st.statusBadgeText, { color: accentColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[st.heroTitle, { color: T.text }]}>{heroTitle}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{heroSub}</Text>

          {isReviewing && (
            <View style={[st.refreshPill, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <ActivityIndicator size="small" color={T.primary} style={{ transform: [{ scale: 0.65 }] }} />
              <Text style={[st.refreshPillText, { color: T.textDim }]}>Auto-checking status</Text>
            </View>
          )}
        </View>

        {/* Progress steps timeline */}
        {(isReviewing || isIncomplete) && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[st.cardLabel, { color: T.textDim, marginBottom: 18 }]}>COMPLIANCE SCHEDULE</Text>
            {[
              { icon: 'briefcase',    label: 'Corporate Info Saved', sub: 'Business name, registry & director details', done: true,          active: false },
              { icon: 'upload-cloud', label: 'Upload Documents',     sub: 'Business licenses & proof of status',         done: hasDoc,        active: !hasDoc },
              { icon: 'search',       label: 'Operational Audit',    sub: 'Director background validation checks',       done: false,         active: hasDoc },
              { icon: 'shield',       label: 'Authorized Status',    sub: 'Minting merchant signing keys',               done: false,         active: false },
            ].map((step, i, arr) => (
              <StepRow key={i} {...step} T={T} isDarkMode={isDarkMode} accentColor={accentColor} />
            ))}
            <View style={[st.etaRow, { backgroundColor: T.primary + '0A', borderColor: T.primary + '20' }]}>
              <Feather name="clock" size={13} color={T.primary} />
              <Text style={[st.etaText, { color: T.primary }]}>Review takes up to 1-2 business days</Text>
            </View>
          </View>
        )}

        {/* Approved Features */}
        {isApproved && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border, padding: 0 }]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>
              <Text style={[st.cardLabel, { color: T.textDim }]}>UNLOCKED ENTERPRISE FEATURES</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              {[
                { icon: 'qr-code',  label: 'Merchant QR Payments', sub: 'Accept client crypto transfers instantly' },
                { icon: 'repeat',   label: 'P2P Trusted Status',   sub: 'List marketplace trades with premium badge' },
                { icon: 'shield',   label: 'Corporate Safeguard',  sub: 'Corporate limit upgrades on major ledgers' },
              ].map((f, i, arr) => (
                <View
                  key={i}
                  style={[
                    st.featureRow,
                    i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }
                  ]}
                >
                  <View style={[st.featureIcon, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                    <Feather name={f.icon as any} size={16} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.featureLabel, { color: T.text }]}>{f.label}</Text>
                    <Text style={[st.featureSub, { color: T.textDim }]}>{f.sub}</Text>
                  </View>
                  <Feather name="check-circle" size={15} color="#10B981" />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rejected feedbacks */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="info" size={15} color={T.error} />
              </View>
              <Text style={[st.cardLabel, { color: T.error }]}>AUDIT FEEDBACK</Text>
            </View>
            <Text style={[st.cardBody, { color: T.text, marginBottom: 14 }]}>
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
            <TouchableOpacity style={st.primaryBtn} onPress={() => navigation.navigate('MerchantDashboard')} activeOpacity={0.85}>
              <LinearGradient colors={['#10B981', '#059669']} style={st.primaryBtnGrad}>
                <Feather name="briefcase" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Merchant Dashboard</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isIncomplete && (
            <TouchableOpacity style={st.primaryBtn} onPress={() => navigation.replace('BusinessKYCForm')} activeOpacity={0.85}>
              <LinearGradient colors={[T.primary, '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="upload-cloud" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Resume & Upload Documents</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isRejected && (
            <TouchableOpacity style={st.primaryBtn} onPress={() => navigation.replace('BusinessKYCForm')} activeOpacity={0.85}>
              <LinearGradient colors={[T.primary, '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="refresh-cw" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Re-submit Business Details</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.7}
          >
            <Text style={[st.ghostBtnText, { color: T.text }]}>Back to Dashboard</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 16 },

  heroWrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroGrad: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  iconWrap: { width: ICON_SIZE + 32, height: ICON_SIZE + 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ring:     { position: 'absolute', width: ICON_SIZE + 18, height: ICON_SIZE + 18, borderRadius: (ICON_SIZE + 18) / 2, borderWidth: 1 },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 14 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 0.8 },
  heroTitle:       { fontSize: 24, fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  heroSub:         { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  refreshPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  refreshPillText: { fontSize: 11, fontFamily: Fonts.bold },

  card:       { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBox:{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLabel:  { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1.2 },
  cardBody:   { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 20 },

  stepRow:   { flexDirection: 'row', gap: 14, marginBottom: 12 },
  stepLeft:  { alignItems: 'center', width: 22 },
  stepDot:   { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepInner: { width: 7, height: 7, borderRadius: 3.5 },
  stepRight: { flex: 1 },
  stepLabel: { fontSize: 13, fontFamily: Fonts.bold },
  stepSub:   { fontSize: 12, fontFamily: Fonts.medium },
  pill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pillText:  { fontSize: 9, fontFamily: Fonts.extraBold },

  etaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  etaText: { fontSize: 12, fontFamily: Fonts.bold },

  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  featureIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  featureLabel:{ fontSize: 13, fontFamily: Fonts.bold, marginBottom: 2 },
  featureSub:  { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 16 },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bullet:     { width: 5, height: 5, borderRadius: 2.5, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },

  actions:        { gap: 12, marginTop: 8 },
  primaryBtn:     { borderRadius: 32, overflow: 'hidden' },
  primaryBtnGrad: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  ghostBtn:       { height: 60, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ghostBtnText:   { fontSize: 15, fontFamily: Fonts.bold },
});
