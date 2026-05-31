import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    { icon: 'aperture',    label: 'Generate QR',    sub: 'Receive instant payments', screen: 'MerchantQR',    color: '#10B981', gradient: ['#10B981', '#059669'] },
    { icon: 'user',        label: 'Business Profile',sub: 'Manage KYC & details',    screen: 'BusinessKYCResult', color: T.primary, gradient: [T.primary, '#4F46E5'] },
    { icon: 'repeat',      label: 'P2P Trading',    sub: 'Manage marketplace',       screen: 'P2PMarketplace', color: '#8B5CF6', gradient: ['#8B5CF6', '#6D28D9'], badge: pending },
    { icon: 'bar-chart-2', label: 'Order History',  sub: 'Track performance',        screen: 'MyP2POrders',   color: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
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
        {/* Ultra Premium Business Hero Card */}
        <LinearGradient
          colors={isDarkMode ? ['#1A1B22', '#101114'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.bizCard, { borderColor: isDarkMode ? '#2A2C35' : '#E2E8F0', borderWidth: 1 }]}
        >
          <View style={s.bizTop}>
            <LinearGradient colors={[T.primary, '#4F46E5']} style={s.bizIconWrap}>
              <Feather name="briefcase" size={22} color="#FFF" />
            </LinearGradient>
            <View style={[s.verifiedBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Feather name="check-circle" size={12} color="#10B981" />
              <Text style={[s.verifiedText, { color: '#10B981' }]}>VERIFIED MERCHANT</Text>
            </View>
          </View>
          
          <View style={s.bizBottom}>
            <Text style={[s.bizName, { color: T.text }]}>{business?.business_name ?? 'Your Business'}</Text>
            <Text style={[s.bizType, { color: T.textDim }]}>{business?.business_type} • {business?.country}</Text>
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

        {/* Action List */}
        <Text style={[s.sectionLabel, { color: T.textDim }]}>MERCHANT TERMINAL</Text>
        <View style={{ gap: 16, marginBottom: 40 }}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.actionCard, { backgroundColor: T.surface, borderColor: T.border }]}
              onPress={() => navigation.navigate(item.screen as never)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={item.gradient} style={s.actionIconWrap}>
                <Feather name={item.icon as any} size={22} color="#FFF" />
              </LinearGradient>
              <View style={s.actionTextWrap}>
                <Text style={[s.actionLabel, { color: T.text }]}>{item.label}</Text>
                <Text style={[s.actionSub, { color: T.textDim }]}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={T.textDim} />
              
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
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 24 },
  bizCard: { padding: 28, borderRadius: 32, marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 12, minHeight: 180, justifyContent: 'space-between' },
  bizTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bizBottom: { marginTop: 24 },
  bizIconWrap: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bizName: { fontSize: 26, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
  bizType: { fontSize: 15, fontWeight: '600' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  verifiedText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 36 },
  statCard: { flex: 1, alignItems: 'flex-start', padding: 20, borderRadius: 24, borderWidth: 1 },
  statValue: { fontSize: 24, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1 },
  actionIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionTextWrap: { flex: 1, marginLeft: 16 },
  actionLabel: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  actionSub: { fontSize: 13, fontWeight: '500' },
  notifBadge: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#101114' },
  notifText: { color: '#FFF', fontSize: 12, fontWeight: '900' },

  emptyIcon: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  emptyTitle: { fontSize: 24, fontWeight: '900', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 },
  emptySub: { fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  startBtn: { height: 60, width: '100%', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  startBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  ghostBtn: { height: 56, width: '100%', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontSize: 16, fontWeight: '800' },
});
