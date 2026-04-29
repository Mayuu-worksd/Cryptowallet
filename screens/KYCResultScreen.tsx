import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Animated, ActivityIndicator, Dimensions, StatusBar, Easing
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { kycService, KYCStatus, cardRequestService } from '../services/supabaseService';
import Svg, { Circle, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const POLL_MS = 10_000;

// ── Confetti (verified only) ──────────────────────────────────────────────────
const Confetti = () => {
  const anims = useRef([...Array(20)].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.parallel(
      anims.map((a, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 100),
            Animated.timing(a, { toValue: 1, duration: 2000 + Math.random() * 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ])
        )
      )
    ).start();
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((anim, i) => (
        <Animated.View key={i} style={[s.confetti, {
          left: (i / 20) * width,
          opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, height] }) },
            { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          ],
        }]}>
          {i % 2 === 0
            ? <Rect width={10} height={10} fill={['#EC2629', '#00C853', '#6366F1'][i % 3]} />
            : <Circle r={5} fill={['#EC2629', '#00C853', '#6366F1'][i % 3]} />}
        </Animated.View>
      ))}
    </View>
  );
};

// ── Pulsing ring (review state) ───────────────────────────────────────────────
const PulsingRing = ({ color }: { color: string }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.pulsingRing, { borderColor: color + '40', transform: [{ scale: pulse }] }]} />
  );
};

// ── Step row ──────────────────────────────────────────────────────────────────
function StepRow({ icon, label, sublabel, done, active, last, color }: {
  icon: string; label: string; sublabel: string;
  done: boolean; active: boolean; last: boolean; color: string;
}) {
  const T = Theme.colors;
  return (
    <View style={s.stepRow}>
      <View style={s.stepLeft}>
        <View style={[s.stepDot, {
          backgroundColor: done ? color : active ? 'transparent' : 'transparent',
          borderColor: done ? color : active ? color : '#444',
          borderWidth: 2,
        }]}>
          {done
            ? <Feather name="check" size={12} color="#FFF" />
            : active
            ? <View style={[s.stepDotInner, { backgroundColor: color }]} />
            : <View style={[s.stepDotInner, { backgroundColor: '#444' }]} />}
        </View>
        {!last && <View style={[s.stepLine, { backgroundColor: done ? color : '#333' }]} />}
      </View>
      <View style={s.stepRight}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name={icon as any} size={14} color={done ? color : active ? color : '#666'} />
          <Text style={[s.stepLabel, { color: done || active ? '#FFF' : '#666' }]}>{label}</Text>
          {done && (
            <View style={[s.donePill, { backgroundColor: color + '20' }]}>
              <Text style={[s.donePillText, { color }]}>Done</Text>
            </View>
          )}
          {active && (
            <View style={[s.donePill, { backgroundColor: color + '20' }]}>
              <Text style={[s.donePillText, { color }]}>Pending</Text>
            </View>
          )}
        </View>
        <Text style={s.stepSub}>{sublabel}</Text>
      </View>
    </View>
  );
}

export default function KYCResultScreen({ navigation }: any) {
  const { walletAddress, refreshKYCStatus, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [status,  setStatus]  = useState<KYCStatus>(null);
  const [record,  setRecord]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cardReq, setCardReq] = useState<any>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [rec, reqs] = await Promise.all([
        kycService.getStatus(walletAddress),
        cardRequestService.getRequests(walletAddress),
      ]);
      const s = rec?.status ?? null;
      setStatus(s);
      setRecord(rec);
      setCardReq(reqs[0] ?? null);
      if (refreshKYCStatus) refreshKYCStatus();
      if (s === 'verified' || s === 'rejected') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
      if (s === 'rejected') {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6,   duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
        ]).start();
      }
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [walletAddress]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const isVerified  = status === 'verified';
  const isRejected  = status === 'rejected';
  const isReviewing = status === 'under_review';
  const isPending   = status === 'pending';

  // Where did the user leave off?
  const hasDoc    = !!record?.document_url;
  const hasSelfie = !!record?.selfie_url;

  // Colors per state
  const statusColor = isVerified ? '#00C853' : isRejected ? T.error : isReviewing ? '#6366F1' : T.primary;
  const statusIcon  = isVerified ? 'shield' : isRejected ? 'x-circle' : isReviewing ? 'clock' : 'upload-cloud';

  const statusLabel =
    isVerified  ? 'VERIFIED' :
    isRejected  ? 'REJECTED' :
    isReviewing ? 'UNDER REVIEW' :
    hasDoc && hasSelfie ? 'SUBMITTED' :
    hasDoc ? 'DOCS UPLOADED' : 'INCOMPLETE';

  const title =
    isVerified  ? 'Verification Complete!' :
    isRejected  ? 'Verification Failed' :
    isReviewing ? 'Under Review' :
    hasDoc && hasSelfie ? 'Submitted — Awaiting Review' :
    hasDoc ? 'Almost There!' : 'Continue Verification';

  const subtitle =
    isVerified  ? 'Your identity is confirmed. You now have full access to all CryptoWallet features.' :
    isRejected  ? "We couldn't verify your details. Please check the reasons below and try again." :
    isReviewing ? 'Our team is reviewing your documents. This usually takes 1–24 hours. We\'ll notify you when done.' :
    hasDoc && hasSelfie ? 'Your documents are submitted and queued for review. Check back soon.' :
    hasDoc ? 'Your document is uploaded. Complete the selfie step to finish verification.' :
    'Your personal details are saved. Continue to upload your document and take a selfie.';

  const kycData = record ? {
    full_name: record.full_name, name: record.full_name,
    email: record.email, phone: record.phone,
    nationality: record.nationality, dob: record.dob,
    address: record.address, document_type: record.document_type,
  } : {};

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {isVerified && <Confetti />}

      {/* Header */}
      <View style={[s.header, { backgroundColor: T.background }]}>
        <TouchableOpacity onPress={() => navigation.replace('Main')} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Verification Status</Text>
        <TouchableOpacity onPress={load} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={18} color={T.textDim} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.heroWrap}>
          <LinearGradient
            colors={[statusColor + '22', statusColor + '08', 'transparent']}
            style={s.heroGrad}
          />
          <View style={s.iconWrap}>
            {(isReviewing || (isPending && hasDoc && hasSelfie)) && (
              <PulsingRing color={statusColor} />
            )}
            <View style={[s.iconCircle, { backgroundColor: statusColor + '18', borderColor: statusColor + '35' }]}>
              <Feather name={statusIcon as any} size={52} color={statusColor} />
            </View>
          </View>

          <View style={[s.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          <Text style={[s.title, { color: T.text }]}>{title}</Text>
          <Text style={[s.subtitle, { color: T.textDim }]}>{subtitle}</Text>
        </View>

        {/* ── Progress Steps (pending / incomplete) ── */}
        {(isPending || isReviewing) && (
          <View style={[s.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[s.cardTitle, { color: T.textDim }]}>VERIFICATION PROGRESS</Text>
            <StepRow
              icon="user" label="Personal Details" sublabel="Name, DOB, address & contact"
              done={true} active={false} last={false} color="#00C853"
            />
            <StepRow
              icon="file-text" label="Document Scan" sublabel="Government-issued ID photo"
              done={hasDoc} active={!hasDoc} last={false} color={hasDoc ? '#00C853' : statusColor}
            />
            <StepRow
              icon="camera" label="Selfie Verification" sublabel="Face scan or photo with code"
              done={hasSelfie} active={hasDoc && !hasSelfie} last={false} color={hasSelfie ? '#00C853' : statusColor}
            />
            <StepRow
              icon="shield" label="Final Review" sublabel="Our team verifies everything"
              done={isReviewing} active={isPending && hasDoc && hasSelfie} last={true} color={isReviewing ? '#6366F1' : statusColor}
            />
          </View>
        )}

        {/* ── Review in progress info card ── */}
        {isReviewing && (
          <View style={[s.card, { backgroundColor: '#1e1b4b', borderColor: '#6366F130' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={[s.infoIconBox, { backgroundColor: '#6366F120' }]}>
                <Feather name="clock" size={20} color="#818CF8" />
              </View>
              <Text style={[s.cardTitle, { color: '#818CF8', marginBottom: 0 }]}>REVIEW IN PROGRESS</Text>
            </View>
            <Text style={{ color: '#A5B4FC', fontSize: 14, lineHeight: 22 }}>
              Our compliance team is manually reviewing your submitted documents. You'll receive a notification once the review is complete.
            </Text>
            <View style={[s.etaBadge, { backgroundColor: '#6366F115', borderColor: '#6366F130' }]}>
              <Feather name="zap" size={13} color="#818CF8" />
              <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700' }}>Typical review time: 1–24 hours</Text>
            </View>
          </View>
        )}

        {/* ── Rejected reasons ── */}
        {isRejected && (
          <View style={[s.card, { backgroundColor: T.surface, borderColor: T.error + '30' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={[s.infoIconBox, { backgroundColor: T.error + '15' }]}>
                <Feather name="alert-triangle" size={20} color={T.error} />
              </View>
              <Text style={[s.cardTitle, { color: T.error, marginBottom: 0 }]}>COMMON REASONS</Text>
            </View>
            {[
              'Blurry or unreadable document photo',
              'Expired or invalid ID document',
              'Selfie does not match the ID photo',
              'Incomplete or incorrect personal details',
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <View style={[s.bulletDot, { backgroundColor: T.error }]} />
                <Text style={{ color: T.textDim, fontSize: 14, lineHeight: 20, flex: 1 }}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Verified — uploaded docs summary ── */}
        {isVerified && (
          <View style={[s.card, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[s.cardTitle, { color: T.textDim }]}>SUBMITTED DOCUMENTS</Text>
            <View style={s.docRow}>
              <View style={[s.docBox, { backgroundColor: '#00C85312', borderColor: '#00C85330' }]}>
                <Feather name="file-text" size={22} color="#00C853" />
                <Text style={[s.docLabel, { color: T.text }]}>Identity Doc</Text>
                <Text style={[s.docStatus, { color: '#00C853' }]}>✓ Verified</Text>
              </View>
              <View style={[s.docBox, { backgroundColor: '#00C85312', borderColor: '#00C85330' }]}>
                <Feather name="user-check" size={22} color="#00C853" />
                <Text style={[s.docLabel, { color: T.text }]}>Selfie</Text>
                <Text style={[s.docStatus, { color: '#00C853' }]}>✓ Verified</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={s.actions}>
          {/* Incomplete — no doc yet */}
          {isPending && !hasDoc && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.primary }]}
              onPress={() => navigation.navigate('KYCDocument', { kycData })}
            >
              <Feather name="camera" size={20} color="#FFF" />
              <Text style={s.primaryBtnText}>Continue — Scan Document</Text>
            </TouchableOpacity>
          )}

          {/* Incomplete — doc done, no selfie */}
          {isPending && hasDoc && !hasSelfie && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.primary }]}
              onPress={() => navigation.navigate('KYCSelfieMode', {
                kycData,
                docImages: { frontUri: record?.document_url, backUri: null },
                docType: record?.document_type,
              })}
            >
              <Feather name="user" size={20} color="#FFF" />
              <Text style={s.primaryBtnText}>Continue — Take Selfie</Text>
            </TouchableOpacity>
          )}

          {/* Verified */}
          {isVerified && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: '#00C853' }]}
              onPress={() => navigation.replace('VCCVariant')}
            >
              <Feather name="credit-card" size={20} color="#FFF" />
              <Text style={s.primaryBtnText}>Get Your Physical Card</Text>
            </TouchableOpacity>
          )}

          {/* Rejected */}
          {isRejected && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.primary }]}
              onPress={() => navigation.replace('KYCForm')}
            >
              <Feather name="refresh-cw" size={20} color="#FFF" />
              <Text style={s.primaryBtnText}>Restart Verification</Text>
            </TouchableOpacity>
          )}

          {/* Under review — auto refresh note */}
          {isReviewing && (
            <View style={[s.refreshNote, { backgroundColor: T.surfaceLow }]}>
              <Feather name="refresh-cw" size={14} color={T.textDim} />
              <Text style={[s.refreshNoteText, { color: T.textDim }]}>Auto-checking every 10 seconds</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.ghostBtn, { backgroundColor: T.surfaceLow }]}
            onPress={() => navigation.replace('Main')}
          >
            <Text style={[s.ghostBtnText, { color: T.text }]}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 16,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },

  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  // Hero
  heroWrap: { alignItems: 'center', paddingVertical: 32, position: 'relative' },
  heroGrad: { position: 'absolute', top: 0, left: -20, right: -20, height: 260, borderBottomLeftRadius: 200, borderBottomRightRadius: 200 },
  iconWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  pulsingRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 2 },
  iconCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 14 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6, marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  // Card
  card: { borderRadius: 24, borderWidth: 1.5, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 16 },
  infoIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  etaBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: 12, borderWidth: 1 },

  // Steps
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 24 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDotInner: { width: 8, height: 8, borderRadius: 4 },
  stepLine: { width: 2, flex: 1, minHeight: 20, marginVertical: 3 },
  stepRight: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 15, fontWeight: '800' },
  stepSub: { fontSize: 12, color: '#666', marginTop: 3, fontWeight: '500' },
  donePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  donePillText: { fontSize: 10, fontWeight: '800' },

  // Rejected
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },

  // Verified docs
  docRow: { flexDirection: 'row', gap: 12 },
  docBox: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 8 },
  docLabel: { fontSize: 13, fontWeight: '800' },
  docStatus: { fontSize: 12, fontWeight: '700' },

  // Actions
  actions: { gap: 12, marginTop: 8 },
  primaryBtn: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  ghostBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 15, fontWeight: '700' },
  refreshNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14 },
  refreshNoteText: { fontSize: 13, fontWeight: '600' },

  confetti: { position: 'absolute', top: -20, zIndex: 10 },
});
