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
import { Theme, Fonts } from '../constants';
import { kycService, KYCStatus } from '../services/supabaseService';

const POLL_MS = 10_000;

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

function Step({ icon, label, sub, state, last, color, T, isDarkMode }: {
  icon: string; label: string; sub: string;
  state: 'done' | 'active' | 'idle'; last: boolean; color: string; T: any; isDarkMode: boolean;
}) {
  const isDone   = state === 'done';
  const isActive = state === 'active';
  const dotColor = isDone ? '#10B981' : isActive ? color : isDarkMode ? 'rgba(255,255,255,0.12)' : '#E4E7EC';
  const dotBg    = isDone ? '#10B981' : 'transparent';

  return (
    <View style={st.stepRow}>
      <View style={st.stepLeft}>
        <View style={[st.stepDot, { backgroundColor: dotBg, borderColor: dotColor }]}>
          {isDone   && <Feather name="check" size={11} color="#FFF" />}
          {isActive && <View style={[st.stepInner, { backgroundColor: color }]} />}
          {!isDone && !isActive && <View style={[st.stepInner, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#E4E7EC' }]} />}
        </View>
        {!last && <View style={[st.stepLine, { backgroundColor: isDone ? '#10B981' : isDarkMode ? 'rgba(255,255,255,0.06)' : '#E4E7EC' }]} />}
      </View>
      <View style={st.stepRight}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Feather name={icon as any} size={13} color={isDone ? '#10B981' : isActive ? color : T.textDim} />
          <Text style={[st.stepLabel, { color: isDone || isActive ? T.text : T.textDim }]}>{label}</Text>
          {isDone   && <View style={[st.pill, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Text style={[st.pillText, { color: '#10B981' }]}>Done</Text></View>}
          {isActive && <View style={[st.pill, { backgroundColor: color + '1A' }]}><Text style={[st.pillText, { color }]}>Active</Text></View>}
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
  const slideAnim = useRef(new Animated.Value(24)).current;

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
    isVerified  ? '#10B981' :
    isRejected  ? T.error   :
    '#F59E0B'; // Amber orange for review/pending

  const statusLabel =
    isVerified  ? 'VERIFIED' :
    isRejected  ? 'REJECTED' :
    isReviewing ? 'UNDER REVIEW' :
    hasDoc && hasSelfie ? 'SUBMITTED' :
    hasDoc ? 'DOCS UPLOADED' : 'INCOMPLETE';

  const title =
    isVerified  ? 'Verification Completed' :
    isRejected  ? 'Verification Failed' :
    isReviewing ? 'Documents Under Review' :
    hasDoc && hasSelfie ? 'Submitted for Review' :
    hasDoc ? 'Documents Uploaded' : 'Continue Identity Check';

  const subtitle =
    isVerified  ? 'Identity checked and verified successfully. Your smart card privileges are unlocked.' :
    isRejected  ? "We could not verify your identity. Please review the reasons and restart verification." :
    isReviewing ? 'Our compliance desk is currently validating your documents. Review takes 1-2 hours.' :
    hasDoc && hasSelfie ? "Your documents are securely queued for review. We will notify you once done." :
    hasDoc ? 'Identity document uploaded. Please complete the selfie scan to finalize.' :
    'Your details are saved. Continue to upload your identity document to proceed.';

  const kycData = record ? {
    full_name: record.full_name, name: record.full_name,
    email: record.email, phone: record.phone,
    nationality: record.nationality, dob: record.dob,
    address: record.address, document_type: record.document_type,
  } : {};

  const steps: Array<{ icon: string; label: string; sub: string; state: 'done' | 'active' | 'idle' }> = [
    { icon: 'user',      label: 'Personal Details',    sub: 'Name, DOB & contact details',    state: 'done' },
    { icon: 'file-text', label: 'Document Upload',     sub: 'Government-issued ID passport',  state: hasDoc ? 'done' : 'active' },
    { icon: 'camera',    label: 'Selfie Verification', sub: 'Facial identification match',    state: hasSelfie ? 'done' : hasDoc ? 'active' : 'idle' },
    { icon: 'shield',    label: 'Compliance Review',   sub: 'Manual security verification',   state: isReviewing || isVerified ? (isVerified ? 'done' : 'active') : 'idle' },
  ];

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
        <Text style={[st.headerTitle, { color: T.text }]}>Identity Status</Text>
        <TouchableOpacity onPress={load} style={[st.headerBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={16} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Brutalist Hero card container */}
        <View style={[st.heroWrap, { backgroundColor: T.surface, borderColor: T.border }]}>
          <LinearGradient
            colors={[statusColor + '0E', 'transparent']}
            style={st.heroGrad}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          
          <View style={st.iconWrap}>
            {(isReviewing || (isPending && hasDoc && hasSelfie)) && (
              <PulsingRing color={statusColor} />
            )}
            <LinearGradient
              colors={[statusColor + '1F', statusColor + '05']}
              style={[st.iconCircle, { borderColor: statusColor + '2A' }]}
            >
              <Feather
                name={isVerified ? 'shield' : isRejected ? 'alert-triangle' : isReviewing ? 'clock' : 'upload-cloud'}
                size={40}
                color={statusColor}
              />
            </LinearGradient>
          </View>

          <View style={[st.statusBadge, { backgroundColor: statusColor + '14', borderColor: statusColor + '24' }]}>
            <View style={[st.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[st.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[st.heroTitle, { color: T.text }]}>{title}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{subtitle}</Text>

          {(isReviewing || (isPending && hasDoc && hasSelfie)) && (
            <View style={[st.refreshPill, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <ActivityIndicator size="small" color={T.primary} style={{ transform: [{ scale: 0.65 }] }} />
              <Text style={[st.refreshPillText, { color: T.textDim }]}>Auto-checking status</Text>
            </View>
          )}
        </View>

        {/* Progress Timeline for Pending/Reviewing */}
        {(isPending || isReviewing) && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[st.cardLabel, { color: T.textDim }]}>VERIFICATION TIMELINE</Text>
            <View style={{ marginTop: 16 }}>
              {steps.map((step, i) => (
                <Step key={i} {...step} last={i === steps.length - 1} color={statusColor} T={T} isDarkMode={isDarkMode} />
              ))}
            </View>
          </View>
        )}

        {/* Verified User Details Ledger */}
        {isVerified && record && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border, padding: 0 }]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>
              <Text style={[st.cardLabel, { color: T.textDim }]}>VERIFIED CREDENTIALS</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              {[
                { label: 'Full Legal Name', value: record.full_name },
                { label: 'Nationality', value: record.nationality },
                { label: 'Date of Birth', value: record.dob },
                { label: 'Document Type', value: record.document_type?.toUpperCase() },
                { label: 'Audit Status', value: 'Approved & Signed', color: '#10B981' },
              ].map((row, idx, arr) => (
                <View
                  key={row.label}
                  style={[
                    st.ledgerRow,
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }
                  ]}
                >
                  <Text style={[st.ledgerLabel, { color: T.textDim }]}>{row.label}</Text>
                  <Text style={[st.ledgerValue, { color: row.color || T.text }]}>{row.value || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rejected Reason Banner Card */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="info" size={15} color={T.error} />
              </View>
              <Text style={[st.cardLabel, { color: T.error }]}>REJECTION FEEDBACK</Text>
            </View>
            <Text style={[st.cardBody, { color: T.text, marginBottom: 14 }]}>
              Your submitted data failed our compliance checks. Common issues include:
            </Text>
            {[
              'Blurry, cropped or low-contrast document photos',
              'Expired or unsupported passport/national ID model',
              'Selfie image did not match the document photograph',
              'Inconsistent or mismatching user profile names',
            ].map((r, i) => (
              <View key={i} style={st.bulletRow}>
                <View style={[st.bullet, { backgroundColor: T.error }]} />
                <Text style={[st.bulletText, { color: T.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions Button panel */}
        <View style={st.actions}>
          {/* pending + no doc → scan document */}
          {isPending && !hasDoc && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCDocument', { kycData })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[T.primary, '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="camera" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Scan Identity Document</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* pending + has doc but no selfie → selfie mode */}
          {isPending && hasDoc && !hasSelfie && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCSelfieMode', {
                kycData,
                docImages: { frontUri: record?.document_url, backUri: null },
                docType: record?.document_type,
              })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[T.primary, '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="smile" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Take Face Selfie Match</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* verified → go to card section tab */}
          {isVerified && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('Card', { initialTab: 'physical' })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={st.primaryBtnGrad}>
                <Feather name="credit-card" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Get Your Physical Card</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* rejected → restart form */}
          {isRejected && (
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => navigation.navigate('KYCForm')}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[T.primary, '#93000d']} style={st.primaryBtnGrad}>
                <Feather name="refresh-cw" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Restart Verification Flow</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
            activeOpacity={0.7}
          >
            <Text style={[st.ghostBtnText, { color: T.text }]}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const ICON_SIZE = 90;

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

  stepRow:   { flexDirection: 'row', gap: 14, marginBottom: 2 },
  stepLeft:  { alignItems: 'center', width: 22 },
  stepDot:   { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepInner: { width: 7, height: 7, borderRadius: 3.5 },
  stepLine:  { width: 2, flex: 1, minHeight: 18, marginVertical: 3 },
  stepRight: { flex: 1, paddingBottom: 18 },
  stepLabel: { fontSize: 13, fontFamily: Fonts.bold },
  stepSub:   { fontSize: 12, fontFamily: Fonts.medium },
  pill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pillText:  { fontSize: 9, fontFamily: Fonts.extraBold },

  ledgerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  ledgerLabel: { fontSize: 12, fontFamily: Fonts.bold },
  ledgerValue: { fontSize: 13, fontFamily: Fonts.extraBold },

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
