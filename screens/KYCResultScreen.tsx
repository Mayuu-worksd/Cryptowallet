import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, ActivityIndicator, StatusBar, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { kycService, KYCStatus } from '../services/supabaseService';

const POLL_MS = 10_000;

function PulsingRing({ color }: { color: string }) {
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const o1 = useRef(new Animated.Value(0.6)).current;
  const o2 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 1.6, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(o, { toValue: 0,   duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: delay === 0 ? 0.6 : 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])).start();
    loop(s1, o1, 0);
    loop(s2, o2, 700);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[st.ring, { borderColor: color, opacity: o1, transform: [{ scale: s1 }] }]} />
      <Animated.View style={[st.ring, { borderColor: color, opacity: o2, transform: [{ scale: s2 }] }]} />
    </View>
  );
}

function Step({ icon, label, sub, state, last, color, T }: {
  icon: string; label: string; sub: string;
  state: 'done' | 'active' | 'idle'; last: boolean; color: string; T: any;
}) {
  const isDone   = state === 'done';
  const isActive = state === 'active';
  const dotColor = isDone ? '#00C853' : isActive ? color : T.border;
  return (
    <View style={st.stepRow}>
      <View style={st.stepLeft}>
        <View style={[st.stepDot, { backgroundColor: isDone ? '#00C853' : 'transparent', borderColor: dotColor }]}>
          {isDone   && <Feather name="check" size={11} color="#FFF" />}
          {isActive && <View style={[st.stepInner, { backgroundColor: color }]} />}
          {!isDone && !isActive && <View style={[st.stepInner, { backgroundColor: T.border }]} />}
        </View>
        {!last && <View style={[st.stepLine, { backgroundColor: isDone ? '#00C853' : T.border }]} />}
      </View>
      <View style={st.stepRight}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Feather name={icon as any} size={13} color={isDone ? '#00C853' : isActive ? color : T.textDim} />
          <Text style={[st.stepLabel, { color: isDone || isActive ? T.text : T.textDim }]}>{label}</Text>
          {isDone   && <View style={[st.pill, { backgroundColor: '#00C85320' }]}><Text style={[st.pillText, { color: '#00C853' }]}>Done</Text></View>}
          {isActive && <View style={[st.pill, { backgroundColor: color + '20' }]}><Text style={[st.pillText, { color }]}>In Progress</Text></View>}
        </View>
        <Text style={[st.stepSub, { color: T.textDim }]}>{sub}</Text>
      </View>
    </View>
  );
}

export default function KYCResultScreen({ navigation }: any) {
  const { walletAddress, refreshKYCStatus, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [status,  setStatus]  = useState<KYCStatus>(null);
  const [record,  setRecord]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<KYCStatus>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const load = useCallback(async () => {
    try {
      const rec = await kycService.getStatus(walletAddress);
      const s   = rec?.status ?? null;
      statusRef.current = s;
      setStatus(s);
      setRecord(rec);
      if (refreshKYCStatus) refreshKYCStatus();
      if (s === 'verified' || s === 'rejected') {
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
      if (statusRef.current === 'verified' || statusRef.current === 'rejected') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }
      load();
    }, POLL_MS);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [load]));

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const isVerified  = status === 'verified';
  const isRejected  = status === 'rejected';
  const isReviewing = status === 'under_review';
  const isPending   = status === 'pending';
  const hasDoc      = !!record?.document_url;
  const hasSelfie   = !!record?.selfie_url;

  const statusColor =
    isVerified  ? '#00C853' :
    isRejected  ? T.error   :
    '#EC2629';

  const statusLabel =
    isVerified  ? 'VERIFIED' :
    isRejected  ? 'REJECTED' :
    isReviewing ? 'UNDER REVIEW' :
    hasDoc && hasSelfie ? 'SUBMITTED' :
    hasDoc ? 'DOCS UPLOADED' : 'INCOMPLETE';

  const title =
    isVerified  ? 'Identity Verified' :
    isRejected  ? 'Verification Failed' :
    isReviewing ? 'Under Review' :
    hasDoc && hasSelfie ? 'Submitted for Review' :
    hasDoc ? 'Almost There' : 'Continue Verification';

  const subtitle =
    isVerified  ? 'Your identity is confirmed. You now have full access to all CryptoWallet features.' :
    isRejected  ? "We couldn't verify your details. Please review the reasons below and re-submit." :
    isReviewing ? 'Our compliance team is reviewing your documents. This typically takes 1–24 hours.' :
    hasDoc && hasSelfie ? "Your documents are queued for review. We'll notify you once complete." :
    hasDoc ? 'Document uploaded. Complete the selfie step to finish.' :
    'Your details are saved. Continue to upload your document.';

  const kycData = record ? {
    full_name: record.full_name, name: record.full_name,
    email: record.email, phone: record.phone,
    nationality: record.nationality, dob: record.dob,
    address: record.address, document_type: record.document_type,
  } : {};

  const steps: Array<{ icon: string; label: string; sub: string; state: 'done' | 'active' | 'idle' }> = [
    { icon: 'user',      label: 'Personal Details',    sub: 'Name, DOB, address & contact',  state: 'done' },
    { icon: 'file-text', label: 'Document Upload',     sub: 'Government-issued ID photo',     state: hasDoc ? 'done' : 'active' },
    { icon: 'camera',    label: 'Selfie Verification', sub: 'Face match with your document',  state: hasSelfie ? 'done' : hasDoc ? 'active' : 'idle' },
    { icon: 'shield',    label: 'Compliance Review',   sub: 'Manual review by our team',      state: isReviewing || isVerified ? (isVerified ? 'done' : 'active') : 'idle' },
  ];

  return (
    <View style={[st.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}
        >
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: T.text }]}>Verification Status</Text>
        <TouchableOpacity onPress={load} style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={17} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={st.heroWrap}>
          <LinearGradient
            colors={[statusColor + '18', statusColor + '05', 'transparent']}
            style={st.heroGrad}
          />
          <View style={st.iconWrap}>
            {(isReviewing || (isPending && hasDoc && hasSelfie)) && (
              <PulsingRing color={statusColor} />
            )}
            <LinearGradient
              colors={[statusColor + '30', statusColor + '10']}
              style={[st.iconCircle, { borderColor: statusColor + '40' }]}
            >
              <Feather
                name={isVerified ? 'shield' : isRejected ? 'x-circle' : isReviewing ? 'clock' : 'upload-cloud'}
                size={44}
                color={statusColor}
              />
            </LinearGradient>
          </View>

          <View style={[st.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '30' }]}>
            <View style={[st.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[st.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[st.heroTitle, { color: T.text }]}>{title}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{subtitle}</Text>

          {(isReviewing || (isPending && hasDoc && hasSelfie)) && (
            <View style={[st.refreshPill, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
              <ActivityIndicator size="small" color={T.primary} style={{ transform: [{ scale: 0.65 }] }} />
              <Text style={[st.refreshPillText, { color: T.primary }]}>Auto-checking every 10s</Text>
            </View>
          )}
        </View>

        {/* Progress Steps */}
        {(isPending || isReviewing) && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.primary + '15' }]}>
                <Feather name="list" size={16} color={T.primary} />
              </View>
              <Text style={[st.cardLabel, { color: T.textDim }]}>VERIFICATION PROGRESS</Text>
            </View>
            {steps.map((step, i) => (
              <Step key={i} {...step} last={i === steps.length - 1} color={statusColor} T={T} />
            ))}
          </View>
        )}

        {/* Under Review */}
        {isReviewing && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.primary + '30' }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.primary + '15' }]}>
                <Feather name="clock" size={16} color={T.primary} />
              </View>
              <Text style={[st.cardLabel, { color: T.primary }]}>REVIEW IN PROGRESS</Text>
            </View>
            <Text style={[st.cardBody, { color: T.textDim }]}>
              Our compliance team is manually reviewing your submitted documents. You'll receive a notification once the review is complete.
            </Text>
            <View style={[st.etaRow, { backgroundColor: T.primary + '10', borderColor: T.primary + '25' }]}>
              <Feather name="zap" size={13} color={T.primary} />
              <Text style={[st.etaText, { color: T.primary }]}>Typical review time: 1–24 hours</Text>
            </View>
            <View style={[st.timelineRow, { marginTop: 16 }]}>
              {['Submitted', 'In Review', 'Decision'].map((lbl, i) => (
                <React.Fragment key={i}>
                  <View style={st.timelineStep}>
                    <View style={[st.timelineDot, {
                      backgroundColor: i <= 1 ? T.primary : T.surfaceHigh,
                      borderColor: i <= 1 ? T.primary : T.border,
                    }]}>
                      {i < 1  && <Feather name="check" size={10} color="#FFF" />}
                      {i === 1 && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' }} />}
                    </View>
                    <Text style={[st.timelineLabel, { color: i <= 1 ? T.text : T.textDim }]}>{lbl}</Text>
                  </View>
                  {i < 2 && <View style={[st.timelineBar, { backgroundColor: i === 0 ? T.primary : T.border }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Rejected */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.error + '30' }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="alert-triangle" size={16} color={T.error} />
              </View>
              <Text style={[st.cardLabel, { color: T.error }]}>COMMON REASONS</Text>
            </View>
            {[
              'Blurry or unreadable document photo',
              'Expired or invalid ID document',
              'Selfie does not match the ID photo',
              'Incomplete or incorrect personal details',
            ].map((r, i) => (
              <View key={i} style={st.bulletRow}>
                <View style={[st.bullet, { backgroundColor: T.error }]} />
                <Text style={[st.bulletText, { color: T.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Verified */}
        {isVerified && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: '#00C85330' }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: '#00C85315' }]}>
                <Feather name="check-circle" size={16} color="#00C853" />
              </View>
              <Text style={[st.cardLabel, { color: '#00C853' }]}>VERIFIED DOCUMENTS</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[{ icon: 'file-text', label: 'Identity Doc' }, { icon: 'user-check', label: 'Selfie Match' }].map((d, i) => (
                <View key={i} style={st.docBox}>
                  <LinearGradient colors={['#00C85320', '#00C85308']} style={st.docGrad}>
                    <Feather name={d.icon as any} size={24} color="#00C853" />
                    <Text style={[st.docLabel, { color: T.text }]}>{d.label}</Text>
                    <View style={st.docVerifiedPill}>
                      <Feather name="check" size={10} color="#00C853" />
                      <Text style={st.docVerifiedText}>Verified</Text>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={st.actions}>
          {/* BUG FIX: pending + no doc → go to document scan */}
          {isPending && !hasDoc && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCDocument', { kycData })}
            >
              <LinearGradient colors={['#EC2629', '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="camera" size={19} color="#FFF" />
                <Text style={st.primaryBtnText}>Continue — Scan Document</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {/* BUG FIX: pending + has doc but no selfie → go to selfie, NOT KYCDocument */}
          {isPending && hasDoc && !hasSelfie && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCSelfieMode', {
                kycData,
                docImages: { frontUri: record?.document_url, backUri: null },
                docType: record?.document_type,
              })}
            >
              <LinearGradient colors={['#EC2629', '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="user" size={19} color="#FFF" />
                <Text style={st.primaryBtnText}>Continue — Take Selfie</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {isVerified && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('VCCVariant')}
            >
              <LinearGradient colors={['#00C853', '#059669']} style={st.primaryBtnGrad}>
                <Feather name="credit-card" size={19} color="#FFF" />
                <Text style={st.primaryBtnText}>Get Your Physical Card</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {isRejected && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCForm')}
            >
              <LinearGradient colors={['#EC2629', '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="refresh-cw" size={19} color="#FFF" />
                <Text style={st.primaryBtnText}>Restart Verification</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          >
            <Text style={[st.ghostBtnText, { color: T.textDim }]}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const ICON_SIZE = 108;

const st = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  heroWrap: { alignItems: 'center', paddingTop: 24, paddingBottom: 32 },
  heroGrad: { position: 'absolute', top: 0, left: -20, right: -20, height: 280 },
  iconWrap: { width: ICON_SIZE + 40, height: ICON_SIZE + 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ring:     { position: 'absolute', width: ICON_SIZE + 20, height: ICON_SIZE + 20, borderRadius: (ICON_SIZE + 20) / 2, borderWidth: 1.5 },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle:       { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6, marginBottom: 10 },
  heroSub:         { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  refreshPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  refreshPillText: { fontSize: 12, fontWeight: '700' },

  card:       { borderRadius: 24, borderWidth: 1.5, padding: 20, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBox:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardLabel:  { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  cardBody:   { fontSize: 14, lineHeight: 22 },
  etaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1 },
  etaText:    { fontSize: 12, fontWeight: '700' },

  timelineRow:   { flexDirection: 'row', alignItems: 'center' },
  timelineStep:  { alignItems: 'center', gap: 6 },
  timelineDot:   { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  timelineLabel: { fontSize: 11, fontWeight: '700' },
  timelineBar:   { flex: 1, height: 2, marginBottom: 18 },

  stepRow:   { flexDirection: 'row', gap: 14, marginBottom: 2 },
  stepLeft:  { alignItems: 'center', width: 24 },
  stepDot:   { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepInner: { width: 8, height: 8, borderRadius: 4 },
  stepLine:  { width: 2, flex: 1, minHeight: 18, marginVertical: 3 },
  stepRight: { flex: 1, paddingBottom: 18 },
  stepLabel: { fontSize: 14, fontWeight: '800' },
  stepSub:   { fontSize: 12, fontWeight: '500' },
  pill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pillText:  { fontSize: 10, fontWeight: '800' },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  bullet:     { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },

  docBox:          { flex: 1 },
  docGrad:         { borderRadius: 18, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#00C85325' },
  docLabel:        { fontSize: 13, fontWeight: '800' },
  docVerifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00C85320', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  docVerifiedText: { fontSize: 10, fontWeight: '800', color: '#00C853' },

  actions:        { gap: 12, marginTop: 8 },
  primaryBtn:     { borderRadius: 18, overflow: 'hidden' },
  primaryBtnGrad: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  ghostBtn:       { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ghostBtnText:   { fontSize: 15, fontWeight: '700' },
});
