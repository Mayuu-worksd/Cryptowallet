import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Animated, ActivityIndicator, StatusBar, Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, BusinessKYCStatus } from '../services/merchantService';

export default function BusinessKYCResultScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [status,  setStatus]  = useState<BusinessKYCStatus>(null);
  const [loading, setLoading] = useState(true);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<BusinessKYCStatus>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const load = useCallback(async () => {
    try {
      const r = await businessKYCService.getStatus(walletAddress);
      const s = r?.status ?? null;
      statusRef.current = s;
      setStatus(s);
      if (s === 'approved' || s === 'rejected') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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

  const isReviewing = status === 'pending' || status === 'under_review';
  const isApproved  = status === 'approved';
  const isRejected  = status === 'rejected';

  const accentColor = isApproved ? '#00C853' : isRejected ? T.error : T.primary;

  const statusLabel = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : status === 'under_review' ? 'UNDER REVIEW' : 'SUBMITTED';
  const heroTitle   = isApproved ? 'Business Verified' : isRejected ? 'Verification Failed' : status === 'under_review' ? 'Under Review' : 'Submitted';
  const heroSub     = isApproved
    ? 'Your business is verified. Merchant QR, P2P marketplace, and verified badge are now active.'
    : isRejected
    ? 'We could not verify your business. Review the reasons below and re-submit.'
    : status === 'under_review'
    ? 'Our compliance team is reviewing your documents. This typically takes 1–3 business days.'
    : 'Your documents are queued for review. We will notify you once complete.';

  return (
    <View style={[st.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Main')} style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: T.text }]}>Business Verification</Text>
        <TouchableOpacity onPress={load} style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={16} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={[st.statusCard, { backgroundColor: T.surface, borderColor: accentColor + '25' }]}>
          <View style={[st.statusIconWrap, { backgroundColor: accentColor + '12' }]}>
            <Feather
              name={isApproved ? 'check-circle' : isRejected ? 'x-circle' : 'clock'}
              size={32}
              color={accentColor}
            />
          </View>
          <View style={[st.statusPill, { backgroundColor: accentColor + '12' }]}>
            <View style={[st.statusDot, { backgroundColor: accentColor }]} />
            <Text style={[st.statusPillText, { color: accentColor }]}>{statusLabel}</Text>
          </View>
          <Text style={[st.heroTitle, { color: T.text }]}>{heroTitle}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{heroSub}</Text>
          {isReviewing && (
            <View style={[st.autoPill, { backgroundColor: T.surfaceLow }]}>
              <ActivityIndicator size="small" color={T.primary} style={{ transform: [{ scale: 0.7 }] }} />
              <Text style={[st.autoPillText, { color: T.textDim }]}>Auto-refreshing every 10s</Text>
            </View>
          )}
        </View>

        {/* Review progress */}
        {isReviewing && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[st.cardTitle, { color: T.text }]}>Review Progress</Text>
            {[
              { icon: 'upload-cloud', label: 'Documents Submitted', sub: 'Business registration & director ID', done: true,  active: false },
              { icon: 'search',       label: 'Compliance Check',     sub: 'Manual review by our team',          done: false, active: true  },
              { icon: 'shield',       label: 'Final Decision',       sub: 'Approval or rejection',              done: false, active: false },
            ].map((step, i, arr) => (
              <View key={i} style={st.stepRow}>
                <View style={st.stepLeft}>
                  <View style={[st.stepDot, {
                    backgroundColor: step.done ? '#00C853' : 'transparent',
                    borderColor: step.done ? '#00C853' : step.active ? T.primary : T.border,
                  }]}>
                    {step.done   && <Feather name="check" size={10} color="#FFF" />}
                    {step.active && <View style={[st.stepInner, { backgroundColor: T.primary }]} />}
                    {!step.done && !step.active && <View style={[st.stepInner, { backgroundColor: T.border }]} />}
                  </View>
                  {i < arr.length - 1 && <View style={[st.stepLine, { backgroundColor: step.done ? '#00C853' : T.border }]} />}
                </View>
                <View style={st.stepRight}>
                  <Text style={[st.stepLabel, { color: step.done || step.active ? T.text : T.textDim }]}>{step.label}</Text>
                  <Text style={[st.stepSub, { color: T.textDim }]}>{step.sub}</Text>
                </View>
              </View>
            ))}
            <View style={[st.etaRow, { backgroundColor: T.primary + '08', borderColor: T.primary + '20' }]}>
              <Feather name="clock" size={13} color={T.primary} />
              <Text style={[st.etaText, { color: T.primary }]}>Typical review time: 1–3 business days</Text>
            </View>
          </View>
        )}

        {/* Approved features */}
        {isApproved && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[st.cardTitle, { color: T.text }]}>Unlocked Features</Text>
            {[
              { icon: 'grid',    label: 'Merchant QR',         sub: 'Accept crypto payments via QR code' },
              { icon: 'repeat',  label: 'P2P Marketplace',     sub: 'Buy & sell with verified badge' },
              { icon: 'shield',  label: 'Verified Badge',      sub: 'Trusted merchant status' },
            ].map((f, i) => (
              <View key={i} style={[st.featureRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <View style={[st.featureIcon, { backgroundColor: '#00C85312' }]}>
                  <Feather name={f.icon as any} size={17} color="#00C853" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.featureLabel, { color: T.text }]}>{f.label}</Text>
                  <Text style={[st.featureSub, { color: T.textDim }]}>{f.sub}</Text>
                </View>
                <Feather name="check" size={15} color="#00C853" />
              </View>
            ))}
          </View>
        )}

        {/* Rejected reasons */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[st.cardTitle, { color: T.text }]}>Common Reasons</Text>
            {[
              'Business registration document is expired or invalid',
              'Director ID does not match submitted details',
              'Business address could not be verified',
              'Incomplete or inconsistent business information',
            ].map((r, i) => (
              <View key={i} style={st.bulletRow}>
                <View style={[st.bullet, { backgroundColor: T.error }]} />
                <Text style={[st.bulletText, { color: T.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={st.actions}>
          {isApproved && (
            <TouchableOpacity style={st.primaryBtn} onPress={() => navigation.navigate('MerchantDashboard')}>
              <LinearGradient colors={['#00C853', '#059669']} style={st.primaryBtnGrad}>
                <Feather name="briefcase" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Go to Merchant Dashboard</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {isRejected && (
            <TouchableOpacity style={st.primaryBtn} onPress={() => navigation.replace('BusinessKYCForm')}>
              <LinearGradient colors={['#EC2629', '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="refresh-cw" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Re-submit Verification</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={() => navigation.navigate('Main')}
          >
            <Text style={[st.ghostBtnText, { color: T.textDim }]}>Back to Dashboard</Text>
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
    paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 12,
  },
  headerBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 8 },

  statusCard:     { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 16 },
  statusIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle:      { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4, marginBottom: 8 },
  heroSub:        { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  autoPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  autoPillText:   { fontSize: 12, fontWeight: '600' },

  card:      { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 16, letterSpacing: -0.2 },

  stepRow:   { flexDirection: 'row', gap: 14, marginBottom: 2 },
  stepLeft:  { alignItems: 'center', width: 22 },
  stepDot:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepInner: { width: 7, height: 7, borderRadius: 4 },
  stepLine:  { width: 2, flex: 1, minHeight: 16, marginVertical: 3 },
  stepRight: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  stepSub:   { fontSize: 12 },

  etaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1 },
  etaText: { fontSize: 12, fontWeight: '600' },

  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  featureLabel:{ fontSize: 13, fontWeight: '700', marginBottom: 1 },
  featureSub:  { fontSize: 12 },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  bullet:     { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },

  actions:        { gap: 10, marginTop: 4 },
  primaryBtn:     { borderRadius: 16, overflow: 'hidden' },
  primaryBtnGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  ghostBtn:       { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ghostBtnText:   { fontSize: 14, fontWeight: '700' },
});
