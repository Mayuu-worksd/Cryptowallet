import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Animated, Dimensions, StatusBar
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { kycService, KYCRecord, KYCStatus, cardRequestService } from '../services/supabaseService';

const { width } = Dimensions.get('window');

const STATUS_CFG: Record<NonNullable<KYCStatus>, { icon: any; color: string; grad: [string,string]; label: string; desc: string }> = {
  pending:      { icon: 'upload-cloud', color: '#F59E0B', grad: ['#F59E0B', '#D97706'], label: 'Identity Pending',  desc: 'Finish your verification to unlock premium features.' },
  under_review: { icon: 'clock',        color: '#6366F1', grad: ['#6366F1', '#4338CA'], label: 'Under Review',     desc: 'Our security team is currently reviewing your documents.' },
  verified:     { icon: 'shield',       color: '#10B981', grad: ['#10B981', '#059669'], label: 'Account Verified',  desc: 'Your identity is confirmed. Your account is fully secured.' },
  rejected:     { icon: 'x-circle',     color: '#EF4444', grad: ['#EF4444', '#DC2626'], label: 'Action Needed',    desc: 'Verification failed. Please re-submit clear documents.' },
};

const STEPS = [
  { key: 'pending',      label: 'Personal Details',   icon: 'user' },
  { key: 'under_review', label: 'Identity Documents', icon: 'file-text' },
  { key: 'verified',     label: 'Final Verification', icon: 'shield' },
];

function stepState(status: KYCStatus, key: string): 'done' | 'active' | 'idle' {
  const order = ['pending', 'under_review', 'verified'];
  const si = order.indexOf(status ?? '');
  const ti = order.indexOf(key);
  if (status === 'rejected') return ti === 0 ? 'done' : ti === 1 ? 'active' : 'idle';
  if (si > ti) return 'done';
  if (si === ti) return 'active';
  return 'idle';
}

export default function KYCStatusScreen({ navigation }: any) {
  const { walletAddress, refreshKYCStatus, isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [record,  setRecord]  = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardReq, setCardReq] = useState<any>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [data, reqs] = await Promise.all([
        kycService.getStatus(walletAddress),
        cardRequestService.getRequests(walletAddress),
      ]);
      setRecord(data);
      setCardReq(reqs[0] ?? null);
      if (refreshKYCStatus) refreshKYCStatus();
    } catch {}
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(lineAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
    ]).start();
  }, [walletAddress]);

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const status = record?.status ?? null;
  const cfg    = status ? STATUS_CFG[status] : null;

  const fields = record ? [
    { label: 'Full Name',     value: record.full_name     || '—' },
    { label: 'Nationality',   value: record.nationality   || '—' },
    { label: 'Date of Birth', value: record.dob           || '—' },
    { label: 'Phone',         value: record.phone         || '—' },
    { label: 'Document',      value: record.document_type || '—' },
  ] : [];

  if (loading) {
     return <View style={[s.root, s.center, { backgroundColor: T.background }]}><ActivityIndicator size="large" color={T.primary} /></View>;
  }

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Custom Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
           <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Identity Status</Text>
        <TouchableOpacity onPress={load} style={[s.backBtn, { backgroundColor: T.surfaceLow }]}>
           <Feather name="refresh-cw" size={18} color={T.textDim} />
        </TouchableOpacity>
      </View>

      {!record ? (
        <View style={s.emptyContainer}>
           <View style={[s.emptyIconCircle, { backgroundColor: `${T.primary}10`, borderColor: `${T.primary}20` }]}>
              <Feather name="shield" size={50} color={T.primary} />
           </View>
           <Text style={[s.emptyTitle, { color: T.text }]}>Verification Needed</Text>
           <Text style={[s.emptySub, { color: T.textDim }]}>To access premium card features and higher limits, please verify your identity.</Text>
           <TouchableOpacity style={[s.startBtn, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('KYCIntro')}>
              <Text style={s.startBtnText}>Begin Verification</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
           </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
           
           {/* Hero Card */}
           <LinearGradient colors={cfg!.grad} style={s.heroCard} start={{x:0, y:0}} end={{x:1, y:1}}>
              <View style={s.heroContent}>
                 <View style={s.heroTextWrap}>
                    <Text style={s.heroLabel}>{cfg!.label}</Text>
                    <Text style={s.heroDesc}>{cfg!.desc}</Text>
                 </View>
                 <View style={s.heroIconCircle}>
                    <Feather name={cfg!.icon} size={32} color={cfg!.color} />
                 </View>
              </View>
              <View style={s.heroStatusPill}>
                 <View style={[s.statusDot, { backgroundColor: '#FFF' }]} />
                 <Text style={s.statusPillText}>{status?.replace('_', ' ').toUpperCase()}</Text>
              </View>
           </LinearGradient>

           {/* Timeline Section */}
           <Text style={[s.sectionTitle, { color: T.textDim }]}>VERIFICATION TIMELINE</Text>
           <View style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              {STEPS.map((step, i) => {
                 const state = stepState(status, step.key);
                 const isActive = state === 'active';
                 const isDone = state === 'done';
                 const color = isDone ? T.success : isActive ? cfg!.color : T.border;
                 
                 return (
                    <View key={step.key} style={s.timelineItem}>
                       <View style={s.timelineLeft}>
                          <View style={[s.timelineDot, { backgroundColor: isDone ? T.success : T.surface, borderColor: color, borderWidth: 2 }]}>
                             {isDone && <Feather name="check" size={12} color="#FFF" />}
                             {isActive && <View style={[s.activeInner, { backgroundColor: color }]} />}
                          </View>
                          {i < STEPS.length - 1 && (
                             <View style={[s.timelineLine, { backgroundColor: T.border }]}>
                                {isDone && <Animated.View style={[s.timelineLineFill, { backgroundColor: T.success, height: lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />}
                             </View>
                          )}
                       </View>
                       <View style={s.timelineRight}>
                          <Text style={[s.timelineLabel, { color: state === 'idle' ? T.textDim : T.text }]}>{step.label}</Text>
                          <Text style={[s.timelineState, { color: isDone ? T.success : isActive ? cfg!.color : T.textDim }]}>
                             {isDone ? 'Completed' : isActive ? 'Action Required' : 'Pending'}
                          </Text>
                       </View>
                    </View>
                 );
              })}
           </View>

           {/* Details Section */}
           <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: T.textDim }]}>PERSONAL DETAILS</Text>
              {status !== 'verified' && (
                <TouchableOpacity style={[s.editFab, { backgroundColor: T.surfaceHigh }]} onPress={() => navigation.navigate('KYCForm', { editMode: true })}>
                   <Feather name="edit-3" size={16} color={T.primary} />
                </TouchableOpacity>
              )}
           </View>
           <View style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border, padding: 0 }]}>
              {fields.map((f, i) => (
                 <View key={f.label} style={[s.detailRow, i < fields.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}>
                    <Text style={[s.detailLabel, { color: T.textDim }]}>{f.label}</Text>
                    <Text style={[s.detailValue, { color: T.text }]}>{f.value}</Text>
                 </View>
              ))}
           </View>

           {/* Documents Section */}
           <Text style={[s.sectionTitle, { color: T.textDim, marginTop: 24 }]}>UPLOADED DOCUMENTS</Text>
           <View style={s.docGrid}>
              <View style={[s.docCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                 <View style={[s.docIconWrap, { backgroundColor: record.document_url ? `${T.success}10` : `${T.error}10` }]}>
                    <Feather name="file-text" size={24} color={record.document_url ? T.success : T.error} />
                 </View>
                 <Text style={[s.docLabel, { color: T.text }]}>Identity ID</Text>
                 <Text style={[s.docStatus, { color: record.document_url ? T.success : T.error }]}>
                    {record.document_url ? 'Uploaded' : 'Missing'}
                 </Text>
              </View>
              <View style={[s.docCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                 <View style={[s.docIconWrap, { backgroundColor: record.selfie_url ? `${T.success}10` : `${T.error}10` }]}>
                    <Feather name="user" size={24} color={record.selfie_url ? T.success : T.error} />
                 </View>
                 <Text style={[s.docLabel, { color: T.text }]}>Selfie Data</Text>
                 <Text style={[s.docStatus, { color: record.selfie_url ? T.success : T.error }]}>
                    {record.selfie_url ? 'Uploaded' : 'Missing'}
                 </Text>
              </View>
           </View>

           {/* Actions */}
           <View style={s.actionGroup}>
              {/* PENDING — no document yet: continue from document step */}
              {status === 'pending' && !record.document_url && (
                 <TouchableOpacity style={[s.mainAction, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('KYCDocument', { kycData: { full_name: record.full_name, name: record.full_name, email: record.email, phone: record.phone, nationality: record.nationality, dob: record.dob, address: record.address, document_type: record.document_type } })}>
                    <Feather name="camera" size={20} color="#FFF" />
                    <Text style={s.mainActionText}>Continue — Scan Document</Text>
                 </TouchableOpacity>
              )}
              {/* PENDING — document uploaded but no selfie yet: continue from selfie step */}
              {status === 'pending' && !!record.document_url && !record.selfie_url && (
                 <TouchableOpacity style={[s.mainAction, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('KYCSelfieMode', { kycData: { full_name: record.full_name, name: record.full_name, email: record.email, phone: record.phone, nationality: record.nationality, dob: record.dob, address: record.address, document_type: record.document_type }, docImages: { frontUri: record.document_url, backUri: null }, docType: record.document_type })}>
                    <Feather name="user" size={20} color="#FFF" />
                    <Text style={s.mainActionText}>Continue — Take Selfie</Text>
                 </TouchableOpacity>
              )}
              {status === 'rejected' && (
                 <TouchableOpacity style={[s.mainAction, { backgroundColor: T.primary }]} onPress={() => navigation.navigate('KYCForm')}>
                    <Text style={s.mainActionText}>Re-submit Documents</Text>
                    <Feather name="refresh-cw" size={20} color="#FFF" />
                 </TouchableOpacity>
              )}
              {status === 'verified' && (
                 <TouchableOpacity style={[s.mainAction, { backgroundColor: T.success }]} onPress={() => navigation.navigate('ApplyPhysicalCard')}>
                    <Text style={s.mainActionText}>Order Physical Card</Text>
                    <Feather name="credit-card" size={20} color="#FFF" />
                 </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.secondaryAction, { backgroundColor: T.surfaceLow }]} onPress={() => navigation.navigate('Main')}>
                 <Text style={[s.secondaryActionText, { color: T.text }]}>Back to Dashboard</Text>
              </TouchableOpacity>
           </View>

        </Animated.ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: '900', marginBottom: 12 },
  emptySub: { fontSize: 16, textAlign: 'center', lineHeight: 24, opacity: 0.7, marginBottom: 40 },
  startBtn: { height: 64, width: '100%', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  startBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  
  heroCard: { width: '100%', borderRadius: 32, padding: 24, marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroTextWrap: { flex: 1, marginRight: 16 },
  heroLabel: { color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  heroDesc: { color: '#FFF', fontSize: 14, opacity: 0.9, lineHeight: 20 },
  heroIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  heroStatusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  premiumCard: { borderRadius: 28, borderWidth: 1.5, padding: 24, marginBottom: 24 },
  
  timelineItem: { flexDirection: 'row', gap: 16 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  activeInner: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineLineFill: { width: '100%', borderRadius: 2 },
  timelineRight: { flex: 1, paddingBottom: 24 },
  timelineLabel: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  timelineState: { fontSize: 13, fontWeight: '600' },
  
  editFab: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  detailLabel: { fontSize: 14, fontWeight: '600' },
  detailValue: { fontSize: 15, fontWeight: '800' },
  
  docGrid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  docCard: { flex: 1, borderRadius: 24, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  docIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  docLabel: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  docStatus: { fontSize: 12, fontWeight: '700' },
  
  actionGroup: { gap: 12 },
  mainAction: { height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  mainActionText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  secondaryAction: { height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { fontSize: 16, fontWeight: '700' }
});
