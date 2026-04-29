import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, p2pService } from '../services/merchantService';

export default function MerchantDashboardScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
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
    { icon: 'grid', label: 'QR Generator',   sub: 'Create payment QR codes',     screen: 'MerchantQR',    color: '#6366F1' },
    { icon: 'repeat', label: 'P2P Marketplace', sub: 'Buy & sell crypto P2P',    screen: 'P2PMarketplace', color: '#10B981', badge: pending },
    { icon: 'bar-chart-2', label: 'My Orders', sub: 'View all your P2P orders',  screen: 'MyP2POrders',   color: '#F59E0B' },
    { icon: 'settings', label: 'Business Profile', sub: 'Edit business details', screen: 'BusinessKYCForm', color: T.primary },
  ];

  if (loading) return <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;

  // Business KYC not submitted yet — prompt to complete it
  if (!business) {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border }]}>
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

  // Business KYC submitted but not approved yet
  if (business.status === 'pending' || business.status === 'under_review') {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
            <Feather name="arrow-left" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.emptyIcon, { backgroundColor: '#6366F115', borderColor: '#6366F130' }]}>
            <Feather name="clock" size={40} color="#6366F1" />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Under Review</Text>
          <Text style={[s.emptySub, { color: T.textDim }]}>
            Your Business KYC is currently being reviewed by our team. This usually takes 1–24 hours. You'll be notified once approved.
          </Text>
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: '#6366F1' }]}
            onPress={() => navigation.navigate('BusinessKYCForm')}
          >
            <Feather name="eye" size={18} color="#FFF" />
            <Text style={s.startBtnText}>View Submission</Text>
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

  // Business KYC rejected
  if (business.status === 'rejected') {
    return (
      <View style={[s.root, { backgroundColor: T.background }]}>
        <View style={[s.header, { borderBottomColor: T.border }]}>
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
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Merchant Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Business Card */}
        <View style={[s.bizCard, { backgroundColor: T.primary + '12', borderColor: T.primary + '25' }]}>
          <View style={[s.bizIconWrap, { backgroundColor: T.primary + '20' }]}>
            <Feather name="briefcase" size={24} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.bizName, { color: T.text }]}>{business?.business_name ?? 'Your Business'}</Text>
              <View style={[s.verifiedBadge, { backgroundColor: '#10B981' + '20' }]}>
                <Feather name="check-circle" size={11} color="#10B981" />
                <Text style={s.verifiedText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={[s.bizType, { color: T.textMuted }]}>{business?.business_type} · {business?.country}</Text>
          </View>
        </View>

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

        {/* Menu */}
        <Text style={[s.sectionLabel, { color: T.textDim }]}>FEATURES</Text>
        {MENU.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[s.menuCard, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.8}
          >
            <View style={[s.menuIcon, { backgroundColor: item.color + '15' }]}>
              <Feather name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.menuLabel, { color: T.text }]}>{item.label}</Text>
              <Text style={[s.menuSub, { color: T.textDim }]}>{item.sub}</Text>
            </View>
            {item.badge ? (
              <View style={[s.notifBadge, { backgroundColor: T.primary }]}>
                <Text style={s.notifText}>{item.badge}</Text>
              </View>
            ) : (
              <Feather name="chevron-right" size={18} color={T.textDim} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 24 },
  bizCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  bizIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bizName: { fontSize: 16, fontWeight: '900' },
  bizType: { fontSize: 13, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  verifiedText: { fontSize: 9, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  statValue: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  menuCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  menuIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  menuSub: { fontSize: 12 },
  notifBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  notifText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  startBtn: { height: 56, width: '100%', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  startBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  ghostBtn: { height: 52, width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 15, fontWeight: '700' },
});
