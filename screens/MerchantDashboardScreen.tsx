import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, p2pService } from '../services/merchantService';

export default function MerchantDashboardScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  const [business, setBusiness] = useState<any>(null);
  const [stats, setStats]       = useState({ total: 0, completed: 0, rate: 100 });
  const [pending, setPending]   = useState(0);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [biz, st, pendingOrders] = await Promise.all([
        businessKYCService.getStatus(walletAddress),
        p2pService.getSellerStats(walletAddress),
        p2pService.getPendingSellerOrders(walletAddress),
      ]);
      setBusiness(biz);
      setStats(st);
      setPending(pendingOrders.length);
    } catch {}
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const MENU = [
    { icon: 'aperture',    label: 'POS Terminal',   sub: 'Accept crypto',     screen: 'MerchantQR',    color: '#10B981' },
    { icon: 'user',        label: 'My Profile',     sub: 'Status & Info',     screen: 'BusinessKYCResult', color: T.primary },
    { icon: 'repeat',      label: 'P2P Trading',    sub: 'Marketplace',       screen: 'P2PMarketplace', color: '#8B5CF6', badge: pending },
    { icon: 'bar-chart-2', label: 'My Orders',  sub: 'P2P History',       screen: 'MyP2POrders',   color: '#F59E0B' },
  ];

  if (loading) return <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;

  // Business KYC not submitted yet — prompt to complete it
  if (!business) {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.emptyIcon, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
            <Feather name="briefcase" size={40} color={T.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Business KYC Required</Text>
          <Text style={[s.emptySub, { color: T.textDim }]}>
            To access the Merchant Dashboard, you need to complete your Business KYC verification. This is separate from your personal identity verification.
          </Text>
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.navigate('BusinessKYCForm')}
          >
            <Feather name="shield" size={18} color="#FFF" />
            <Text style={s.startBtnText}>Complete Business KYC</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ghostBtn, { backgroundColor: T.surfaceLow, marginTop: 12 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[s.ghostBtnText, { color: T.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (business && business.status === 'pending' && !business.document_url) {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.emptyIcon, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
            <Feather name="alert-circle" size={40} color={T.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Setup Incomplete</Text>
          <Text style={[s.emptySub, { color: T.textDim }]}>
            You have successfully filled in your company and director details, but you have not uploaded the required registration documents yet.
          </Text>
          <TouchableOpacity style={[s.startBtn, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('BusinessKYCResult')}>
            <Feather name="upload-cloud" size={18} color="#FFF" />
            <Text style={s.startBtnText}>Resume & Upload Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ghostBtn, { backgroundColor: T.surfaceLow, marginTop: 12 }]} onPress={() => navigation.goBack()}>
            <Text style={[s.ghostBtnText, { color: T.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (business && ((business.status === 'pending' && !!business.document_url) || business.status === 'under_review')) {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.emptyIcon, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
            <Feather name="clock" size={40} color={T.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Under Review</Text>
          <Text style={[s.emptySub, { color: T.textDim }]}>
            Your Business KYC is being reviewed. This usually takes 1–3 business days. You'll be notified once approved.
          </Text>
          <TouchableOpacity style={[s.startBtn, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('BusinessKYCResult')}>
            <Feather name="eye" size={18} color="#FFF" />
            <Text style={s.startBtnText}>View Submission Status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ghostBtn, { backgroundColor: T.surfaceLow, marginTop: 12 }]} onPress={() => navigation.goBack()}>
            <Text style={[s.ghostBtnText, { color: T.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Business KYC rejected
  if (business.status === 'rejected') {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.emptyIcon, { backgroundColor: T.error + '15', borderColor: T.error + '30' }]}>
            <Feather name="x-circle" size={40} color={T.error} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Business KYC Rejected</Text>
          <Text style={[s.emptySub, { color: T.textDim }]}>
            Your Business KYC was not approved. Please re-submit with correct business documents.
          </Text>
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.navigate('BusinessKYCForm')}
          >
            <Feather name="refresh-cw" size={18} color="#FFF" />
            <Text style={s.startBtnText}>Re-submit Business KYC</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Sleek Fintech Hero Card */}
        <LinearGradient
          colors={isDarkMode ? ['#1A1D24', '#13151A'] : ['#F8FAFC', '#F1F5F9']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.bizCard, { borderColor: isDarkMode ? '#2A2D35' : '#E2E8F0' }]}
        >
          <View style={[s.bizIconWrap, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFF', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0', borderWidth: 1 }]}>
            <Feather name="briefcase" size={24} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.bizName, { color: T.text }]}>{business?.business_name ?? 'Your Business'}</Text>
              <View style={[s.verifiedBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <Feather name="check-circle" size={11} color="#10B981" />
                <Text style={s.verifiedText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={[s.bizType, { color: T.textDim }]}>{business?.business_type} · {business?.country}</Text>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {[
            { label: 'Total Orders', value: stats.total },
            { label: 'Completed',    value: stats.completed },
            { label: 'Success Rate', value: `${stats.rate}%` },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <Text style={[s.statValue, { color: T.text }]}>{st.value}</Text>
              <Text style={[s.statLabel, { color: T.textDim }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu Grid */}
        <Text style={[s.sectionLabel, { color: T.textDim }]}>MERCHANT TOOLS</Text>
        <View style={s.gridContainer}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.gridCard, { backgroundColor: T.surface, borderColor: T.border }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <View style={[s.gridIcon, { backgroundColor: item.color + '15' }]}>
                <Feather name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={s.gridTextWrap}>
                <Text style={[s.gridLabel, { color: T.text }]}>{item.label}</Text>
                <Text style={[s.gridSub, { color: T.textDim }]}>{item.sub}</Text>
              </View>
              {item.badge ? (
                <View style={[s.notifBadge, { backgroundColor: T.primary }]}>
                  <Text style={s.notifText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 24 },
  bizCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
  bizIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  bizName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  bizType: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifiedText: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: { flex: 1, alignItems: 'flex-start', padding: 16, borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
  gridIcon: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  gridTextWrap: { alignItems: 'center' },
  gridLabel: { fontSize: 15, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  gridSub: { fontSize: 12, textAlign: 'center', lineHeight: 16, fontWeight: '500' },
  notifBadge: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  notifText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  startBtn: { height: 56, width: '100%', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  startBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  ghostBtn: { height: 52, width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 15, fontWeight: '700' },
});
