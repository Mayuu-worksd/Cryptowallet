import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert, RefreshControl, TextInput, Modal, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { adminService, AdminKYCRow, AdminCardRequest, AdminBusinessKYCRow } from '../services/adminService';
import { p2pService } from '../services/merchantService';

type Tab = 'stats' | 'kyc' | 'merchant' | 'cards' | 'p2p';

const sanitizeError = (msg: string) =>
  msg.replace(/<[^>]*>/g, '').replace(/[\r\n]/g, ' ').trim() || 'An unexpected error occurred.';

export default function AdminScreen({ navigation }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [tab, setTab]           = useState<Tab>('stats');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats]             = useState<any>(null);
  const [kycList, setKycList]         = useState<AdminKYCRow[]>([]);
  const [merchantList, setMerchantList] = useState<AdminBusinessKYCRow[]>([]);
  const [cards, setCards]             = useState<AdminCardRequest[]>([]);
  const [p2pOrders, setP2POrders]     = useState<any[]>([]);

  const [kycFilter, setKycFilter]         = useState('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [cardFilter, setCardFilter]       = useState('all');
  const [p2pFilter, setP2PFilter]         = useState('all');

  // Merchant KYC action modal
  const [merchantModal, setMerchantModal]     = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<AdminBusinessKYCRow | null>(null);
  const [merchantNotes, setMerchantNotes]     = useState('');

  // KYC action modal
  const [kycModal, setKycModal]   = useState(false);
  const [selectedKYC, setSelectedKYC] = useState<AdminKYCRow | null>(null);
  const [kycNotes, setKycNotes]   = useState('');

  // P2P action modal
  const [p2pModal, setP2PModal]           = useState(false);
  const [selectedP2P, setSelectedP2P]     = useState<any>(null);
  const [p2pNotes, setP2PNotes]           = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, k, m, c, p] = await Promise.all([
        adminService.getStats(),
        adminService.getAllKYC(kycFilter),
        adminService.getAllBusinessKYC(merchantFilter),
        adminService.getAllCardRequests(cardFilter),
        adminService.getAllP2POrders(p2pFilter === 'all' ? undefined : p2pFilter),
      ]);
      setStats(s);
      setKycList(k);
      setMerchantList(m);
      setCards(c);
      setP2POrders(p);
    } catch (e: any) {
      Alert.alert('Error', sanitizeError(e?.message ?? 'Failed to load admin data.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kycFilter, merchantFilter, cardFilter, p2pFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleMerchantAction = async (status: 'approved' | 'rejected' | 'under_review') => {
    if (!selectedMerchant) return;
    setActionLoading(true);
    try {
      await adminService.updateBusinessKYCStatus(selectedMerchant.wallet_address, status, merchantNotes);
      setMerchantModal(false);
      setMerchantNotes('');
      load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeError(e?.message ?? 'Failed.'));
    } finally { setActionLoading(false); }
  };

  const handleKYCAction = async (status: 'verified' | 'rejected') => {
    if (!selectedKYC) return;
    setActionLoading(true);
    try {
      await adminService.updateKYCStatus(selectedKYC.wallet_address, status, kycNotes);
      setKycModal(false);
      setKycNotes('');
      load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeError(e?.message ?? 'Failed.'));
    } finally { setActionLoading(false); }
  };

  const handleCardAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    try {
      if (action === 'approve') await adminService.approveCardRequest(id);
      else await adminService.rejectCardRequest(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeError(e?.message ?? 'Failed.'));
    } finally { setActionLoading(false); }
  };

  const handleP2PAction = async (action: 'release' | 'refund' | 'verify') => {
    if (!selectedP2P) return;
    setActionLoading(true);
    try {
      if (action === 'release') {
        await adminService.resolveDisputeRelease(selectedP2P.id);
        Alert.alert('Success', 'Dispute resolved in buyer\'s favour. Escrow funds released.');
      } else if (action === 'refund') {
        await adminService.resolveDisputeRefund(selectedP2P.id);
        Alert.alert('Success', 'Dispute resolved in seller\'s favour. Escrow funds refunded.');
      } else if (action === 'verify') {
        await adminService.verifyPaymentAndRelease(selectedP2P.id, p2pNotes);
        Alert.alert('Success', 'Payment verified and escrow funds released.');
      }
      setP2PModal(false);
      setP2PNotes('');
      load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeError(e?.message ?? 'Failed to perform P2P operation.'));
    } finally { setActionLoading(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'verified' || s === 'approved' || s === 'shipped' || s === 'completed' || s === 'crypto_released') return '#10B981';
    if (s === 'rejected' || s === 'cancelled' || s === 'disputed') return '#EF4444';
    if (s === 'under_review' || s === 'in_escrow' || s === 'escrow_locked') return '#6366F1';
    if (s === 'fiat_sent' || s === 'payment_pending' || s === 'payment_verification') return '#F59E0B';
    return '#6B7280';
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'stats',    label: 'Stats',    icon: 'bar-chart-2' },
    { key: 'kyc',      label: 'KYC',      icon: 'user-check' },
    { key: 'merchant', label: 'Merchant', icon: 'briefcase' },
    { key: 'cards',    label: 'Cards',    icon: 'credit-card' },
    { key: 'p2p',      label: 'P2P',      icon: 'refresh-cw' },
  ];

  const KYC_FILTERS      = ['all', 'pending', 'under_review', 'verified', 'rejected'];
  const MERCHANT_FILTERS = ['all', 'pending', 'under_review', 'approved', 'rejected'];
  const CARD_FILTERS     = ['all', 'pending', 'approved', 'rejected', 'shipped'];

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: T.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={T.primary} />
        <Text style={{ color: T.textDim, marginTop: 12, fontWeight: '600' }}>Accessing Secure Console...</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Merchant KYC Action Modal */}
      <Modal visible={merchantModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMerchantModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={[s.modalTitle, { color: T.text }]}>Merchant Review</Text>
              <TouchableOpacity onPress={() => setMerchantModal(false)} style={{ padding: 4 }}>
                <Feather name="x" size={20} color={T.textDim} />
              </TouchableOpacity>
            </View>
            {selectedMerchant && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[s.modalInfoBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>BUSINESS NAME</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.business_name}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>TYPE · COUNTRY</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.business_type} · {selectedMerchant.country}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>REG. NUMBER</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.registration_number}</Text>
                  </View>
                  {selectedMerchant.vat_tax_id ? (
                    <><View style={[s.infoDivider, { backgroundColor: T.border }]} />
                    <View style={s.infoRowItem}>
                      <Text style={[s.infoLabel, { color: T.textDim }]}>VAT / TAX ID</Text>
                      <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.vat_tax_id}</Text>
                    </View></>
                  ) : null}
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>DIRECTOR</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.director_name ?? '—'} · {selectedMerchant.director_nationality ?? '—'}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>ADDRESS</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.business_address}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>WALLET</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedMerchant.wallet_address}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>STATUS</Text>
                    <View style={[s.badgeSmall, { backgroundColor: statusColor(selectedMerchant.status) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[s.badgeTextSmall, { color: statusColor(selectedMerchant.status) }]}>{selectedMerchant.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {selectedMerchant.document_url && (
                  <TouchableOpacity
                    style={[s.docPreviewBtn, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}
                    onPress={async () => {
                      try {
                        const { getKYCSignedUrl, extractStoragePath } = await import('../services/supabaseClient');
                        const path = extractStoragePath(selectedMerchant.document_url!);
                        const signedUrl = await getKYCSignedUrl(path, 3600);
                        const { Linking } = await import('react-native');
                        await Linking.openURL(signedUrl);
                      } catch (e: any) {
                        Alert.alert('Error', 'Could not open document. ' + (e?.message ?? ''));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="file-text" size={16} color={T.primary} />
                    <Text style={{ color: T.primary, fontWeight: '800', fontSize: 13 }}>View Business Document</Text>
                  </TouchableOpacity>
                )}

                <Text style={[s.fieldLabel, { color: T.textDim }]}>DECISION NOTES</Text>
                <TextInput
                  style={[s.notesInput, { backgroundColor: T.surfaceLow, color: T.text, borderColor: T.border }]}
                  placeholder="Reason for approval or rejection..."
                  placeholderTextColor={T.textDim}
                  value={merchantNotes}
                  onChangeText={setMerchantNotes}
                  multiline
                />

                {(selectedMerchant.status === 'pending' || selectedMerchant.status === 'under_review') && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: T.surfaceHigh, flex: 1, borderWidth: 1, borderColor: T.border }]}
                      onPress={() => handleMerchantAction('rejected')}
                      disabled={actionLoading}
                    >
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>REJECT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: T.primary, flex: 1.5 }]}
                      onPress={() => handleMerchantAction('approved')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.actionBtnText}>APPROVE</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* KYC Action Modal */}
      <Modal visible={kycModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setKycModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
               <Text style={[s.modalTitle, { color: T.text }]}>Review Verification</Text>
               <TouchableOpacity onPress={() => setKycModal(false)} style={{ padding: 4 }}>
                 <Feather name="x" size={20} color={T.textDim} />
               </TouchableOpacity>
            </View>

            {selectedKYC && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[s.modalInfoBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>USER WALLET</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedKYC.wallet_address}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>FULL NAME</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedKYC.full_name ?? '—'}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>STATUS</Text>
                    <View style={[s.badgeSmall, { backgroundColor: statusColor(selectedKYC.status ?? '') + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[s.badgeTextSmall, { color: statusColor(selectedKYC.status ?? '') }]}>{(selectedKYC.status ?? '').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {selectedKYC.document_url && (
                  <TouchableOpacity
                    style={[s.docPreviewBtn, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}
                    onPress={async () => {
                      try {
                        const { getKYCSignedUrl, extractStoragePath } = await import('../services/supabaseClient');
                        const path = extractStoragePath(selectedKYC.document_url!);
                        const signedUrl = await getKYCSignedUrl(path, 3600);
                        const { Linking } = await import('react-native');
                        await Linking.openURL(signedUrl);
                      } catch (e: any) {
                        Alert.alert('Error', 'Could not open document. ' + (e?.message ?? ''));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="file-text" size={16} color={T.primary} />
                    <Text style={{ color: T.primary, fontWeight: '800', fontSize: 13 }}>View ID Document</Text>
                  </TouchableOpacity>
                )}

                {selectedKYC.selfie_url && (
                  <TouchableOpacity
                    style={[s.docPreviewBtn, { backgroundColor: T.success + '10', borderColor: T.success + '30', marginTop: -8 }]}
                    onPress={async () => {
                      try {
                        const { getKYCSignedUrl, extractStoragePath } = await import('../services/supabaseClient');
                        const path = extractStoragePath(selectedKYC.selfie_url!);
                        const signedUrl = await getKYCSignedUrl(path, 3600);
                        const { Linking } = await import('react-native');
                        await Linking.openURL(signedUrl);
                      } catch (e: any) {
                        Alert.alert('Error', 'Could not open selfie. ' + (e?.message ?? ''));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="user" size={16} color={T.success} />
                    <Text style={{ color: T.success, fontWeight: '800', fontSize: 13 }}>View Selfie Photo</Text>
                  </TouchableOpacity>
                )}

                <Text style={[s.fieldLabel, { color: T.textDim }]}>DECISION NOTES</Text>
                <TextInput
                  style={[s.notesInput, { backgroundColor: T.surfaceLow, color: T.text, borderColor: T.border }]}
                  placeholder="Explain the reason for verification or rejection..."
                  placeholderTextColor={T.textDim}
                  value={kycNotes}
                  onChangeText={setKycNotes}
                  multiline
                />
                
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: T.surfaceHigh, flex: 1, borderWidth: 1, borderColor: T.border }]}
                    onPress={() => handleKYCAction('rejected')}
                    disabled={actionLoading}
                  >
                    <Text style={[s.actionBtnText, { color: '#EF4444' }]}>REJECT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: T.primary, flex: 1.5 }]}
                    onPress={() => handleKYCAction('verified')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.actionBtnText}>APPROVE USER</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* P2P Action Modal */}
      <Modal visible={p2pModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setP2PModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={[s.modalTitle, { color: T.text }]}>P2P Order Audit</Text>
              <TouchableOpacity onPress={() => setP2PModal(false)} style={{ padding: 4 }}>
                <Feather name="x" size={20} color={T.textDim} />
              </TouchableOpacity>
            </View>
            {selectedP2P && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[s.modalInfoBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>ORDER ID</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedP2P.id}</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>TRADE SPECIFICATION</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedP2P.amount} {selectedP2P.token} for {selectedP2P.fiat_total} {selectedP2P.fiat_currency} ({selectedP2P.payment_method})</Text>
                  </View>
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>SELLER WALLET</Text>
                    <Text style={[s.infoVal, { color: T.text }]}>{selectedP2P.seller_wallet}</Text>
                  </View>
                  {selectedP2P.buyer_wallet ? (
                    <>
                      <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                      <View style={s.infoRowItem}>
                        <Text style={[s.infoLabel, { color: T.textDim }]}>BUYER WALLET</Text>
                        <Text style={[s.infoVal, { color: T.text }]}>{selectedP2P.buyer_wallet}</Text>
                      </View>
                    </>
                  ) : null}
                  <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                  <View style={s.infoRowItem}>
                    <Text style={[s.infoLabel, { color: T.textDim }]}>STATUS</Text>
                    <View style={[s.badgeSmall, { backgroundColor: statusColor(selectedP2P.status) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[s.badgeTextSmall, { color: statusColor(selectedP2P.status) }]}>{selectedP2P.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  {selectedP2P.payment_reference ? (
                    <>
                      <View style={[s.infoDivider, { backgroundColor: T.border }]} />
                      <View style={s.infoRowItem}>
                        <Text style={[s.infoLabel, { color: T.textDim }]}>PAYMENT UTR / REFERENCE</Text>
                        <Text style={[s.infoVal, { color: T.text }]}>{selectedP2P.payment_reference}</Text>
                      </View>
                    </>
                  ) : null}
                </View>

                {selectedP2P.payment_proof_url && (
                  <TouchableOpacity
                    style={[s.docPreviewBtn, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}
                    onPress={async () => {
                      try {
                        const { Linking } = await import('react-native');
                        await Linking.openURL(selectedP2P.payment_proof_url!);
                      } catch (e: any) {
                        Alert.alert('Error', 'Could not open payment proof link. ' + (e?.message ?? ''));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="file-text" size={16} color={T.primary} />
                    <Text style={{ color: T.primary, fontWeight: '800', fontSize: 13 }}>View Buyer Payment Proof</Text>
                  </TouchableOpacity>
                )}

                <Text style={[s.fieldLabel, { color: T.textDim }]}>AUDIT NOTES / REASONING</Text>
                <TextInput
                  style={[s.notesInput, { backgroundColor: T.surfaceLow, color: T.text, borderColor: T.border }]}
                  placeholder="Notes for release/refund/verification audits..."
                  placeholderTextColor={T.textDim}
                  value={p2pNotes}
                  onChangeText={setP2PNotes}
                  multiline
                />

                {selectedP2P.status === 'payment_verification' && (
                  <View style={{ marginTop: 24, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: T.primary, width: '100%' }]}
                      onPress={() => handleP2PAction('verify')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.actionBtnText}>APPROVE PAYMENT & RELEASE ESCROW</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {selectedP2P.status === 'disputed' && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: T.surfaceHigh, flex: 1, borderWidth: 1, borderColor: T.border }]}
                      onPress={() => handleP2PAction('refund')}
                      disabled={actionLoading}
                    >
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>REFUND SELLER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: T.primary, flex: 1.5 }]}
                      onPress={() => handleP2PAction('release')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.actionBtnText}>RELEASE TO BUYER</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="chevron-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[s.headerTitle, { color: T.text }]}>Admin Console</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
            <Text style={{ fontSize: 10, color: T.textDim, fontWeight: '700' }}>LIVE SYSTEM</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRefresh} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="refresh-cw" size={18} color={T.text} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={[s.tabBar, { borderBottomColor: T.border, backgroundColor: T.surface }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabItem, tab === t.key && [s.tabItemActive, { borderBottomColor: T.primary }]]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon as any} size={15} color={tab === t.key ? T.primary : T.textMuted} />
            <Text style={[s.tabText, { color: tab === t.key ? T.primary : T.textMuted }]}>{t.label.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* ── STATS ── */}
        {tab === 'stats' && stats && (
          <>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: T.textDim }]}>IDENTITY VERIFICATION</Text>
              <Feather name="user-check" size={12} color={T.textDim} />
            </View>
            <View style={s.statsGrid}>
              <View style={[s.statCardLarge, { backgroundColor: T.surface, borderColor: T.border }]}>
                <View style={[s.statIconBox, { backgroundColor: T.primary + '15' }]}>
                  <Feather name="users" size={20} color={T.primary} />
                </View>
                <View>
                  <Text style={[s.statValBig, { color: T.text }]}>{stats.kyc.total}</Text>
                  <Text style={[s.statKey, { color: T.textDim }]}>TOTAL USERS</Text>
                </View>
              </View>
              
              <View style={s.statsGridSub}>
                <View style={[s.statCardSmall, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <Text style={[s.statValSmall, { color: '#6366F1' }]}>{String((stats.kyc.pending ?? 0) + (stats.kyc.under_review ?? 0))}</Text>
                  <Text style={[s.statKey, { color: T.textDim }]}>ACTIVE QUEUE</Text>
                </View>
                <View style={[s.statCardSmall, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <Text style={[s.statValSmall, { color: '#10B981' }]}>{stats.kyc.verified}</Text>
                  <Text style={[s.statKey, { color: T.textDim }]}>VERIFIED</Text>
                </View>
              </View>
            </View>

            <View style={[s.sectionHeader, { marginTop: 32 }]}>
              <Text style={[s.sectionTitle, { color: T.textDim }]}>FINANCIAL PRODUCTS</Text>
              <Feather name="credit-card" size={12} color={T.textDim} />
            </View>
            <View style={s.statsGridSub}>
               <TouchableOpacity style={[s.statCardFlat, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={[s.statIconBox, { backgroundColor: '#10B98115' }]}>
                    <Feather name="check-circle" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.statKey, { color: T.textDim }]}>APPROVED CARDS</Text>
                    <Text style={[s.statValMid, { color: T.text }]}>{stats.cards.approved}</Text>
                  </View>
               </TouchableOpacity>

               <TouchableOpacity style={[s.statCardFlat, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={[s.statIconBox, { backgroundColor: '#F59E0B15' }]}>
                    <Feather name="clock" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.statKey, { color: T.textDim }]}>PENDING ISSUANCE</Text>
                    <Text style={[s.statValMid, { color: T.text }]}>{stats.cards.pending}</Text>
                  </View>
               </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── MERCHANT KYC ── */}
        {tab === 'merchant' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MERCHANT_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, { backgroundColor: merchantFilter === f ? T.primary : T.surfaceLow, borderColor: merchantFilter === f ? T.primary : T.border }]}
                    onPress={() => setMerchantFilter(f)}
                  >
                    <Text style={[s.chipText, { color: merchantFilter === f ? '#FFF' : T.text }]}>{f.replace('_', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {merchantList.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyCircle, { backgroundColor: T.surfaceLow }]}>
                  <Feather name="briefcase" size={32} color={T.textDim} />
                </View>
                <Text style={[s.emptyText, { color: T.textDim }]}>No merchant KYC submissions</Text>
              </View>
            ) : merchantList.map(m => (
              <TouchableOpacity
                key={m.wallet_address}
                style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border }]}
                onPress={() => { setSelectedMerchant(m); setMerchantNotes(m.admin_notes ?? ''); setMerchantModal(true); }}
                activeOpacity={0.8}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.avatarSmall, { backgroundColor: T.primary + '20' }]}>
                    <Feather name="briefcase" size={16} color={T.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.cardTitle, { color: T.text }]} numberOfLines={1}>{m.business_name}</Text>
                    <Text style={[s.cardSub, { color: T.textDim }]}>{m.business_type} · {m.country}</Text>
                  </View>
                  <View style={[s.badgeSmall, { backgroundColor: statusColor(m.status) + '15' }]}>
                    <Text style={[s.badgeTextSmall, { color: statusColor(m.status) }]}>{m.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={[s.cardDivider, { backgroundColor: T.border }]} />
                <View style={s.cardBottomRow}>
                  <Text style={[s.cardDate, { color: T.textDim }]}>{m.wallet_address.slice(0, 10)}...{m.wallet_address.slice(-6)}</Text>
                  <Text style={[s.cardDate, { color: T.textDim }]}>{new Date(m.created_at).toLocaleDateString()}</Text>
                </View>
                {m.document_url && (
                  <View style={s.docTag}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                    <Text style={s.docTagText}>DOC ATTACHED</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── KYC ── */}
        {tab === 'kyc' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {KYC_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, { backgroundColor: kycFilter === f ? T.primary : T.surfaceLow, borderColor: kycFilter === f ? T.primary : T.border }]}
                    onPress={() => setKycFilter(f)}
                  >
                    <Text style={[s.chipText, { color: kycFilter === f ? '#FFF' : T.text }]}>{f.replace('_', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {kycList.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyCircle, { backgroundColor: T.surfaceLow }]}>
                  <Feather name="users" size={32} color={T.textDim} />
                </View>
                <Text style={[s.emptyText, { color: T.textDim }]}>No verification records found</Text>
              </View>
            ) : kycList.map(k => (
              <TouchableOpacity
                key={k.wallet_address}
                style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border }]}
                onPress={() => { setSelectedKYC(k); setKycNotes(k.admin_notes ?? ''); setKycModal(true); }}
                activeOpacity={0.8}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.avatarSmall, { backgroundColor: T.primary + '20' }]}>
                    <Text style={[s.avatarText, { color: T.primary }]}>{(k.full_name ?? 'U').charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.cardTitle, { color: T.text }]} numberOfLines={1}>{k.full_name || 'Anonymous User'}</Text>
                    <Text style={[s.cardSub, { color: T.textDim }]}>{k.wallet_address.slice(0, 10)}...{k.wallet_address.slice(-6)}</Text>
                  </View>
                  <View style={[s.badgeSmall, { backgroundColor: statusColor(k.status ?? '') + '15' }]}>
                    <Text style={[s.badgeTextSmall, { color: statusColor(k.status ?? '') }]}>{(k.status ?? '').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={[s.cardDivider, { backgroundColor: T.border }]} />

                <View style={s.cardBottomRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="mail" size={12} color={T.textDim} />
                    <Text style={[s.cardDate, { color: T.textDim }]}>{k.email || 'No email'}</Text>
                  </View>
                  <Text style={[s.cardDate, { color: T.textDim }]}>{new Date(k.created_at).toLocaleDateString()}</Text>
                </View>

                {k.document_url && (
                  <View style={s.docTag}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                    <Text style={s.docTagText}>ID ATTACHED</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── CARDS ── */}
        {tab === 'cards' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CARD_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, { backgroundColor: cardFilter === f ? T.primary : T.surfaceLow, borderColor: cardFilter === f ? T.primary : T.border }]}
                    onPress={() => setCardFilter(f)}
                  >
                    <Text style={[s.chipText, { color: cardFilter === f ? '#FFF' : T.text }]}>{f.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {cards.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyCircle, { backgroundColor: T.surfaceLow }]}>
                  <Feather name="credit-card" size={32} color={T.textDim} />
                </View>
                <Text style={[s.emptyText, { color: T.textDim }]}>No card requests found</Text>
              </View>
            ) : cards.map(c => (
              <View key={c.id} style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                <View style={s.cardTopRow}>
                   <View style={[s.avatarSmall, { backgroundColor: '#6366F120' }]}>
                    <Feather name="credit-card" size={16} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.cardTitle, { color: T.text }]}>{c.full_name || 'Anonymous'}</Text>
                    <Text style={[s.cardSub, { color: T.textDim }]}>REQUEST ID: {c.id?.slice(-8).toUpperCase()}</Text>
                  </View>
                  <View style={[s.badgeSmall, { backgroundColor: statusColor(c.status ?? '') + '15' }]}>
                    <Text style={[s.badgeTextSmall, { color: statusColor(c.status ?? '') }]}>{(c.status ?? '').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={[s.cardDivider, { backgroundColor: T.border }]} />

                <View style={{ gap: 4, marginBottom: 16 }}>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: T.textDim }]}>Wallet:</Text>
                    <Text style={[s.detailVal, { color: T.text }]}>{c.wallet_address?.slice(0, 12)}...{c.wallet_address?.slice(-8)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: T.textDim }]}>Contact:</Text>
                    <Text style={[s.detailVal, { color: T.text }]}>{c.email || 'N/A'}</Text>
                  </View>
                </View>

                {c.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.actionBtnSmall, { backgroundColor: T.surfaceHigh, borderColor: T.border, borderWidth: 1 }]}
                      onPress={() => Alert.alert('Reject', 'Reject this card request?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reject', style: 'destructive', onPress: () => handleCardAction(c.id!, 'reject') },
                      ])}
                      disabled={actionLoading}
                    >
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>REJECT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtnSmall, { backgroundColor: T.primary, flex: 2 }]}
                      onPress={() => Alert.alert('Approve', 'Approve this card request?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Approve', onPress: () => handleCardAction(c.id!, 'approve') },
                      ])}
                      disabled={actionLoading}
                    >
                      <Text style={s.actionBtnText}>APPROVE REQUEST</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* ── P2P ── */}
        {tab === 'p2p' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['all', 'open', 'escrow_locked', 'payment_pending', 'payment_verification', 'crypto_released', 'completed', 'cancelled', 'disputed'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, { backgroundColor: p2pFilter === f ? T.primary : T.surfaceLow, borderColor: p2pFilter === f ? T.primary : T.border }]}
                    onPress={() => setP2PFilter(f)}
                  >
                    <Text style={[s.chipText, { color: p2pFilter === f ? '#FFF' : T.text }]}>{f.replace('_', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.sectionHeader}>
               <Text style={[s.sectionTitle, { color: T.textDim }]}>MARKETPLACE MONITOR</Text>
               <Text style={{ fontSize: 10, color: T.primary, fontWeight: '800' }}>{String(p2pOrders.length)} ORDERS</Text>
            </View>

            {p2pOrders.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyCircle, { backgroundColor: T.surfaceLow }]}>
                  <Feather name="refresh-cw" size={32} color={T.textDim} />
                </View>
                <Text style={[s.emptyText, { color: T.textDim }]}>No matching P2P orders</Text>
              </View>
            ) : p2pOrders.map(o => (
              <TouchableOpacity
                key={o.id}
                style={[s.premiumCard, { backgroundColor: T.surface, borderColor: T.border }]}
                onPress={() => { setSelectedP2P(o); setP2PNotes(''); setP2PModal(true); }}
                activeOpacity={0.8}
              >
                 <View style={s.cardTopRow}>
                    <View style={[s.avatarSmall, { backgroundColor: T.primary + '10' }]}>
                       <Feather name="shopping-bag" size={16} color={T.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                       <Text style={[s.cardTitle, { color: T.text }]}>{o.amount} {o.token}</Text>
                       <Text style={[s.cardSub, { color: T.textDim }]}>Seller: {o.seller_wallet.slice(0, 12)}...</Text>
                    </View>
                    <View style={[s.badgeSmall, { backgroundColor: statusColor(o.status) + '15' }]}>
                       <Text style={[s.badgeTextSmall, { color: statusColor(o.status) }]}>{o.status.toUpperCase()}</Text>
                    </View>
                 </View>
                 <View style={[s.cardDivider, { backgroundColor: T.border }]} />
                 <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: T.textDim }]}>Fiat Total:</Text>
                    <Text style={[s.detailVal, { color: T.text }]}>{o.fiat_total} {o.fiat_currency}</Text>
                 </View>
                 <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: T.textDim }]}>Method:</Text>
                    <Text style={[s.detailVal, { color: T.text }]}>{o.payment_method}</Text>
                 </View>
                 {o.buyer_wallet && (
                   <View style={s.detailRow}>
                      <Text style={[s.detailLabel, { color: T.textDim }]}>Buyer:</Text>
                      <Text style={[s.detailVal, { color: T.text }]}>{o.buyer_wallet.slice(0, 12)}...</Text>
                   </View>
                 )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },

  tabBar:      { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8 },
  tabItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomWidth: 3 },
  tabText:     { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },

  statsGrid: { gap: 12 },
  statsGridSub: { flexDirection: 'row', gap: 12 },
  statCardLarge: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 20 },
  statCardSmall: { flex: 1, borderRadius: 20, padding: 20, borderWidth: 1, gap: 12 },
  statCardFlat: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValBig: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  statValMid: { fontSize: 20, fontWeight: '800' },
  statValSmall: { fontSize: 24, fontWeight: '900' },
  statKey: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  chip:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '900' },

  premiumCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarSmall: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardDivider: { height: 1, marginVertical: 16 },
  cardDate: { fontSize: 11, fontWeight: '600' },

  badgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTextSmall: { fontSize: 10, fontWeight: '900' },
  
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailVal: { fontSize: 12, fontWeight: '800' },

  docTag: { position: 'absolute', top: -10, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  docTagText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  actionBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  actionBtnSmall: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1 },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  empty: { alignItems: 'center', paddingVertical: 80, gap: 20 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalInfoBox: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  infoRowItem: { paddingVertical: 4 },
  infoLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  infoVal: { fontSize: 15, fontWeight: '700' },
  infoDivider: { height: 1, marginVertical: 12 },
  docPreviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  fieldLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  notesInput: { borderWidth: 1, borderRadius: 18, padding: 16, fontSize: 15, minHeight: 120, textAlignVertical: 'top' },
});
