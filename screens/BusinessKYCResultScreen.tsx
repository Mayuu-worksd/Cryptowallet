import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, BusinessKYCStatus } from '../services/merchantService';

const CFG: Record<NonNullable<BusinessKYCStatus>, { icon: any; color: string; title: string; sub: string }> = {
  pending:      { icon: 'clock',    color: '#F59E0B', title: 'Under Review',       sub: 'Your business documents are being reviewed. This typically takes 1-3 business days.' },
  under_review: { icon: 'clock',    color: '#6366F1', title: 'Under Review',       sub: 'Our compliance team is reviewing your business verification.' },
  approved:     { icon: 'briefcase',color: '#10B981', title: 'Merchant Approved!', sub: 'Your business is verified. You now have access to QR payments and P2P marketplace.' },
  rejected:     { icon: 'x-circle', color: '#EF4444', title: 'Verification Failed', sub: 'We could not verify your business. Please re-submit with valid documents.' },
};

export default function BusinessKYCResultScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [status, setStatus]   = useState<BusinessKYCStatus>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await businessKYCService.getStatus(walletAddress);
      setStatus(r?.status ?? null);
      if (r?.status === 'approved' || r?.status === 'rejected') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, speed: 14, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }, [walletAddress]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (loading) return <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator size="large" color={T.primary} /></View>;

  const cfg = status ? CFG[status] : null;

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Main')} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Business Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[s.body, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {cfg && (
          <>
            <View style={[s.iconRing, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '30' }]}>
              <Feather name={cfg.icon} size={40} color={cfg.color} />
            </View>
            <View style={[s.badge, { backgroundColor: cfg.color + '18' }]}>
              <View style={[s.badgeDot, { backgroundColor: cfg.color }]} />
              <Text style={[s.badgeText, { color: cfg.color }]}>{(status ?? '').replace('_', ' ').toUpperCase()}</Text>
            </View>
            <Text style={[s.title, { color: T.text }]}>{cfg.title}</Text>
            <Text style={[s.sub, { color: T.textMuted }]}>{cfg.sub}</Text>
          </>
        )}

        {(status === 'pending' || status === 'under_review') && (
          <View style={[s.pollRow]}>
            <ActivityIndicator size="small" color={T.textDim} style={{ transform: [{ scale: 0.7 }] }} />
            <Text style={[s.pollText, { color: T.textDim }]}>Auto-refreshing every 10s</Text>
          </View>
        )}

        <View style={s.ctaGroup}>
          {status === 'approved' && (
            <TouchableOpacity style={[s.btn, { backgroundColor: '#10B981', shadowColor: '#10B981' }]} onPress={() => navigation.navigate('MerchantDashboard')} activeOpacity={0.85}>
              <Text style={s.btnText}>Go to Merchant Dashboard</Text>
              <Feather name="arrow-right" size={16} color="#FFF" />
            </TouchableOpacity>
          )}
          {status === 'rejected' && (
            <TouchableOpacity style={[s.btn, { backgroundColor: T.primary, shadowColor: T.primary }]} onPress={() => navigation.replace('BusinessKYCForm')} activeOpacity={0.85}>
              <Text style={s.btnText}>Re-submit Verification</Text>
              <Feather name="refresh-cw" size={16} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.ghostBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]} onPress={() => navigation.navigate('Main')} activeOpacity={0.7}>
            <Text style={[s.ghostBtnText, { color: T.textMuted }]}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  iconRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  pollRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pollText: { fontSize: 12, fontWeight: '600' },
  ctaGroup: { width: '100%', gap: 10, marginTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58, borderRadius: 18, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  ghostBtn: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ghostBtnText: { fontSize: 15, fontWeight: '700' },
});
