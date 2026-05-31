import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, ActivityIndicator, StatusBar, Easing, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { kycService, KYCStatus } from '../services/supabaseService';

const { width } = Dimensions.get('window');
const POLL_MS = 10_000;
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
    isVerified  ? 'Identity Verified' :
    isRejected  ? 'Verification Failed' :
    isReviewing ? 'Under Review' :
    hasDoc && hasSelfie ? 'Submitted' :
    hasDoc ? 'Docs Uploaded' : 'Complete Identity';

  const subtitle =
    isVerified  ? 'Your identity has been securely verified. Full wallet and card privileges are now unlocked.' :
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
      <View style={[st.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          style={st.headerBtn}
        >
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: T.text }]}>Identity Status</Text>
        <TouchableOpacity onPress={load} style={st.headerBtn}>
          <Feather name="refresh-cw" size={20} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Hero Section */}
        <View style={st.heroWrap}>
          <View style={st.iconWrap}>
            <GlowingOrb color={statusColor + '30'} />
            <LinearGradient
              colors={[statusColor, statusColor + '99']}
              style={st.iconCircle}
            >
              <Feather
                name={isVerified ? 'check' : isRejected ? 'x' : isReviewing ? 'clock' : 'upload-cloud'}
                size={44}
                color="#FFF"
              />
            </LinearGradient>
          </View>

          <View style={[st.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[st.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[st.heroTitle, { color: T.text }]}>{title}</Text>
          <Text style={[st.heroSub, { color: T.textDim }]}>{subtitle}</Text>
        </View>

        {/* Progress Timeline for Pending/Reviewing */}
        {(isPending || isReviewing) && (
          <View style={[st.card, { backgroundColor: T.surfaceLow }]}>
            <Text style={[st.cardLabel, { color: T.textDim }]}>Verification Timeline</Text>
            <View style={{ marginTop: 20 }}>
              {steps.map((step, i) => (
                <Step key={i} {...step} last={i === steps.length - 1} color={statusColor} T={T} isDarkMode={isDarkMode} />
              ))}
            </View>
          </View>
        )}

        {/* Verified User Details Ledger */}
        {isVerified && record && (
          <View style={[st.card, { backgroundColor: T.surfaceLow, padding: 0 }]}>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 }}>
              <Text style={[st.cardLabel, { color: T.textDim }]}>Verified Credentials</Text>
            </View>
            <View>
              {[
                { label: 'Full Legal Name', value: record.full_name },
                { label: 'Nationality', value: record.nationality },
                { label: 'Date of Birth', value: record.dob },
                { label: 'Document Type', value: record.document_type?.toUpperCase() },
              ].map((row, idx, arr) => (
                <View
                  key={row.label}
                  style={[
                    st.ledgerRow,
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                  ]}
                >
                  <Text style={[st.ledgerLabel, { color: T.textDim }]}>{row.label}</Text>
                  <Text style={[st.ledgerValue, { color: T.text }]}>{row.value || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rejected Reason Banner Card */}
        {isRejected && (
          <View style={[st.card, { backgroundColor: T.surfaceLow }]}>
            <View style={st.cardHeader}>
              <View style={[st.cardIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="info" size={16} color={T.error} />
              </View>
              <Text style={[st.cardLabel, { color: T.error }]}>Rejection Feedback</Text>
            </View>
            <Text style={[st.cardBody, { color: T.text, marginBottom: 16 }]}>
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
          {isPending && !hasDoc && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: T.text }]}
              onPress={() => navigation.navigate('KYCDocument', { kycData })}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={20} color={T.background} />
              <Text style={[st.primaryBtnText, { color: T.background }]}>Scan Identity Document</Text>
            </TouchableOpacity>
          )}

          {isPending && hasDoc && !hasSelfie && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: T.text }]}
              onPress={() => navigation.navigate('KYCSelfieMode', {
                kycData,
                docImages: { frontUri: record?.document_url, backUri: null },
                docType: record?.document_type,
              })}
              activeOpacity={0.85}
            >
              <Feather name="smile" size={20} color={T.background} />
              <Text style={[st.primaryBtnText, { color: T.background }]}>Take Face Selfie Match</Text>
            </TouchableOpacity>
          )}

          {isVerified && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.navigate('Card', { initialTab: 'physical' })}
              activeOpacity={0.85}
            >
              <Feather name="credit-card" size={20} color="#FFF" />
              <Text style={[st.primaryBtnText, { color: '#FFF' }]}>Get Your Physical Card</Text>
            </TouchableOpacity>
          )}

          {isRejected && (
            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: T.text }]}
              onPress={() => navigation.navigate('KYCForm')}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={20} color={T.background} />
              <Text style={[st.primaryBtnText, { color: T.background }]}>Restart Verification</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[st.ghostBtn, { backgroundColor: 'transparent' }]}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
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

  ledgerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  ledgerLabel: { fontSize: 14, fontFamily: Fonts.medium },
  ledgerValue: { fontSize: 15, fontFamily: Fonts.bold },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  bullet:     { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, lineHeight: 20 },

  actions:        { gap: 16, marginTop: 16 },
  primaryBtn:     { height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryBtnText: { fontSize: 18, fontFamily: Fonts.bold },
  ghostBtn:       { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText:   { fontSize: 16, fontFamily: Fonts.bold },
});
