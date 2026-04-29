import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import {
  cardVariantService, cardRequestService, kycService,
  CardVariant, COUNTRIES, SHIPPING_FEES,
} from '../services/supabaseService';

const VARIANT_ICONS: Record<string, string> = {
  Classic:  '💳',
  Gold:     '🥇',
  Platinum: '💎',
  Travel:   '✈️',
};

const VARIANT_GRADIENTS: Record<string, string> = {
  Classic:  '#2A2B31',
  Gold:     '#B8860B',
  Platinum: '#708090',
  Travel:   '#1A3A5C',
};

export default function ApplyPhysicalCardScreen({ navigation }: any) {
  const { isDarkMode, walletAddress, kycStatus } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [variants,        setVariants]        = useState<CardVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<CardVariant | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countryModal,    setCountryModal]    = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [hasPending,      setHasPending]      = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<any>(null);
  const [liveKycStatus,   setLiveKycStatus]   = useState(kycStatus);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') =>
    setToast({ visible: true, message, type });

  useEffect(() => {
    Promise.all([
      cardVariantService.getVariants(),
      cardRequestService.hasPendingRequest(walletAddress),
      cardRequestService.getRequests(walletAddress),
      // Always fetch live KYC status — don't rely on potentially stale context
      kycService.getStatus(walletAddress),
    ]).then(([v, pending, requests, kycRecord]) => {
      setVariants(v);
      setSelectedVariant(v[0] ?? null);
      setHasPending(pending);
      setExistingRequest(requests[0] ?? null);
      setLiveKycStatus(kycRecord?.status ?? null);
    }).catch(() => {}).finally(() => {
      setLoadingVariants(false);
      setCheckingExisting(false);
    });
  }, []);

  const shippingFee = selectedCountry ? (SHIPPING_FEES[selectedCountry] ?? SHIPPING_FEES['Other']) : null;
  const totalCost   = (selectedVariant?.price ?? 0) + (shippingFee ?? 0);

  const handleSubmit = async () => {
    if (!selectedVariant) { showToast('Please select a card type'); return; }
    if (!selectedCountry) { showToast('Please select your country'); return; }

    setSubmitting(true);
    try {
      const req = await cardRequestService.submitRequest({
        wallet_address: walletAddress,
        card_type:      selectedVariant.name,
        country:        selectedCountry,
        shipping_fee:   shippingFee!,
        total_cost:     totalCost,
      });
      setSubmittedRequest(req);
      setSubmitted(true);
    } catch (e: any) {
      showToast(e?.message ?? 'Submission failed. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (checkingExisting) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  // ── KYC gate ──────────────────────────────────────────────────────────────
  if (liveKycStatus !== 'verified') {
    return (
      <View style={{ flex: 1, backgroundColor: T.background }}>
        <View style={[styles.header, { borderBottomColor: T.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Physical Card</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.gateContainer}>
          <View style={[styles.gateIconRing, { backgroundColor: '#F59E0B20' }]}>
            <Feather name="lock" size={40} color="#F59E0B" />
          </View>
          <Text style={[styles.gateTitle, { color: T.text }]}>KYC Required</Text>
          <Text style={[styles.gateSub, { color: T.textMuted }]}>
            You must complete identity verification before applying for a physical card.
          </Text>
          <View style={[styles.kycStatusBox, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[styles.kycStatusLabel, { color: T.textMuted }]}>Current KYC Status</Text>
            <View style={[styles.kycBadge, { backgroundColor:
              liveKycStatus === 'under_review' ? '#3B82F620' :
              liveKycStatus === 'pending'      ? '#F59E0B20' :
              liveKycStatus === 'rejected'     ? T.error + '20' : T.border,
            }]}>
              <Text style={[styles.kycBadgeText, { color:
                liveKycStatus === 'under_review' ? '#3B82F6' :
                liveKycStatus === 'pending'      ? '#F59E0B' :
                liveKycStatus === 'rejected'     ? T.error : T.textMuted,
              }]}>
                {liveKycStatus === 'under_review' ? 'UNDER REVIEW' :
                 liveKycStatus === 'pending'      ? 'PENDING' :
                 liveKycStatus === 'rejected'     ? 'REJECTED' : 'NOT STARTED'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.gateBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.navigate(liveKycStatus ? 'KYCStatus' : 'KYCForm')}
            activeOpacity={0.85}
          >
            <Feather name="shield" size={18} color="#FFF" />
            <Text style={styles.gateBtnText}>
              {kycStatus ? 'View KYC Status' : 'Start Verification'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Existing request status screen ────────────────────────────────────────
  if (existingRequest && !submitted) {
    const req = existingRequest;
    const isApproved = req.status === 'approved';
    const isRejected = req.status === 'rejected';
    const statusColor = isApproved ? Theme.colors.success : isRejected ? Theme.colors.primary : '#3B82F6';
    const statusIcon  = isApproved ? 'check-circle' : isRejected ? 'x-circle' : 'clock';
    const statusLabel = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'UNDER REVIEW';
    const statusTitle = isApproved ? 'Card Request Approved' : isRejected ? 'Request Rejected' : 'Request Under Review';
    const statusSub   = isApproved
      ? `Your physical card has been approved and is being prepared for shipment to ${req.country}.`
      : isRejected
      ? 'Your card request was rejected. You can submit a new request.'
      : 'Your request is being reviewed. This typically takes 3\u20135 business days.';

    return (
      <View style={{ flex: 1, backgroundColor: T.background }}>
        <View style={[styles.header, { borderBottomColor: T.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Card Request Status</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>

          <View style={[styles.gateIconRing, { backgroundColor: statusColor + '20', marginBottom: 12 }]}>
            <Feather name={statusIcon} size={44} color={statusColor} />
          </View>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: statusColor }}>{statusLabel}</Text>
          </View>
          <Text style={[styles.gateTitle, { color: T.text, marginBottom: 8 }]}>{statusTitle}</Text>
          <Text style={[styles.gateSub, { color: T.textMuted, marginBottom: 24, textAlign: 'center' }]}>{statusSub}</Text>

          <View style={[styles.orderSummary, { backgroundColor: T.surface, borderColor: T.border, width: '100%' }]}>
            <Text style={[styles.sectionTitle, { color: T.textMuted, marginBottom: 12 }]}>REQUEST DETAILS</Text>
            {[
              { label: 'Card Type',    value: req.card_type },
              { label: 'Ship To',      value: req.country },
              { label: 'Shipping Fee', value: `$${parseFloat(req.shipping_fee).toFixed(2)}` },
              { label: 'Total Cost',   value: `$${parseFloat(req.total_cost).toFixed(2)}` },
              { label: 'Submitted',    value: new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
              { label: 'Status',       value: statusLabel },
            ].map((row, i, arr) => (
              <View key={row.label} style={[styles.summaryRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 10, marginBottom: 10 }
              ]}>
                <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[styles.summaryValue, {
                  color: row.label === 'Status' ? statusColor : T.text,
                  fontWeight: row.label === 'Status' ? '800' : '600',
                }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {!isRejected && (
            <View style={{ backgroundColor: statusColor + '15', borderRadius: 12, padding: 14, width: '100%', flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <Feather name={isApproved ? 'truck' : 'info'} size={16} color={statusColor} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: statusColor, fontWeight: '600', lineHeight: 19 }}>
                {isApproved
                  ? `Your card is being prepared. Delivery to ${req.country} takes 5\u201310 business days.`
                  : 'Our team reviews requests within 3\u20135 business days. You will be notified once a decision is made.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.gateBtn, {
              backgroundColor: isRejected ? T.primary : T.surface,
              borderWidth: isRejected ? 0 : 1,
              borderColor: T.border,
            }]}
            onPress={() => {
              if (isRejected) { setExistingRequest(null); setHasPending(false); }
              else navigation.goBack();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.gateBtnText, { color: isRejected ? '#FFF' : T.text }]}>
              {isRejected ? 'Submit New Request' : 'Back to Card'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={[styles.successRing, { backgroundColor: T.success + '20' }]}>
          <Feather name="check-circle" size={52} color={T.success} />
        </View>
        <Text style={[styles.successTitle, { color: T.text }]}>Request Submitted!</Text>
        <Text style={[styles.successSub, { color: T.textMuted }]}>
          Your {selectedVariant?.name} card request has been received.{'\n'}
          We'll process and ship it to {selectedCountry} within 3–5 business days.
        </Text>
        <View style={[styles.summaryBox, { backgroundColor: T.surface }]}>
          {[
            { label: 'Card Type',    value: selectedVariant?.name ?? '' },
            { label: 'Ship To',      value: selectedCountry },
            { label: 'Card Fee',     value: selectedVariant?.price === 0 ? 'Free' : `$${selectedVariant?.price.toFixed(2)}` },
            { label: 'Shipping',     value: `$${shippingFee?.toFixed(2)}` },
            { label: 'Total',        value: `$${totalCost.toFixed(2)}` },
            { label: 'Status',       value: 'Pending Approval' },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[styles.summaryRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
            >
              <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, {
                color: i === arr.length - 2 ? T.primary : i === arr.length - 1 ? '#F59E0B' : T.text,
                fontWeight: i >= arr.length - 2 ? '800' : '600',
              }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: T.primary }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.background }}>
      <Toast
        visible={toast.visible} message={toast.message} type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Country picker modal */}
      <Modal visible={countryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryModal(false)}>
                <Feather name="x" size={22} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.countryRow, { borderBottomColor: T.border }]}
                  onPress={() => { setSelectedCountry(c); setCountryModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.countryName, { color: T.text }]}>{c}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.countryFee, { color: T.textMuted }]}>
                      ${SHIPPING_FEES[c].toFixed(2)} shipping
                    </Text>
                    {selectedCountry === c && <Feather name="check" size={16} color={T.primary} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Physical Card</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* KYC verified badge */}
        <View style={[styles.verifiedBanner, { backgroundColor: Theme.colors.success + '12', borderColor: Theme.colors.success + '40' }]}>
          <Feather name="check-circle" size={18} color={Theme.colors.success} />
          <Text style={[styles.verifiedText, { color: Theme.colors.success }]}>Identity Verified — You're eligible for a physical card</Text>
        </View>

        {/* Card variants */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>SELECT CARD TYPE</Text>

        {loadingVariants ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.variantsGrid}>
            {variants.map(v => {
              const isSelected = selectedVariant?.id === v.id;
              const accentColor = VARIANT_GRADIENTS[v.name] ?? T.primary;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.variantCard,
                    { backgroundColor: T.surface, borderColor: isSelected ? accentColor : T.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedVariant(v)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 28, marginBottom: 8 }}>{VARIANT_ICONS[v.name] ?? '💳'}</Text>
                  <Text style={[styles.variantName, { color: T.text }]}>{v.name}</Text>
                  <Text style={[styles.variantPrice, { color: accentColor }]}>
                    {v.price === 0 ? 'Free' : `$${v.price.toFixed(2)}/yr`}
                  </Text>
                  <View style={{ gap: 4, marginTop: 8 }}>
                    {v.features.slice(0, 3).map(f => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                        <Feather name="check" size={11} color={T.success} style={{ marginTop: 2 }} />
                        <Text style={[styles.featureText, { color: T.textMuted }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: accentColor }]}>
                      <Feather name="check" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Country selector */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>SHIPPING COUNTRY</Text>
        <TouchableOpacity
          style={[styles.countrySelector, { backgroundColor: T.surface, borderColor: selectedCountry ? T.primary : T.border }]}
          onPress={() => setCountryModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="map-pin" size={18} color={selectedCountry ? T.primary : T.textMuted} />
          <Text style={[styles.countrySelectorText, { color: selectedCountry ? T.text : T.textMuted }]}>
            {selectedCountry || 'Select your country'}
          </Text>
          <Feather name="chevron-down" size={18} color={T.textMuted} />
        </TouchableOpacity>

        {/* Order summary */}
        {selectedVariant && selectedCountry && (
          <View style={[styles.orderSummary, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[styles.sectionTitle, { color: T.textMuted, marginBottom: 12 }]}>ORDER SUMMARY</Text>
            {[
              { label: `${selectedVariant.name} Card`, value: selectedVariant.price === 0 ? 'Free' : `$${selectedVariant.price.toFixed(2)}` },
              { label: `Shipping to ${selectedCountry}`, value: `$${shippingFee!.toFixed(2)}` },
            ].map(row => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[styles.summaryValue, { color: T.text }]}>{row.value}</Text>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: T.border }]}>
              <Text style={[styles.totalLabel, { color: T.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: T.primary }]}>${totalCost.toFixed(2)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: T.primary },
            (!selectedVariant || !selectedCountry || submitting) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={!selectedVariant || !selectedCountry || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Feather name="send" size={18} color="#FFF" />
                <Text style={styles.submitBtnText}>Submit Request</Text>
              </>
          }
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: T.textDim }]}>
          Your physical card request will be reviewed within 3–5 business days. You will be notified once approved.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 24 },

  // KYC gate
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  gateIconRing: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  gateSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  kycStatusBox: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kycStatusLabel: { fontSize: 13, fontWeight: '600' },
  kycBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  kycBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  gateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 18, width: '100%',
  },
  gateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 24,
  },
  verifiedText: { flex: 1, fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 14, marginLeft: 2 },

  variantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  variantCard: { width: '47%', borderRadius: 18, borderWidth: 1.5, padding: 16, position: 'relative' },
  variantName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  variantPrice: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  featureText: { fontSize: 11, fontWeight: '600', flex: 1 },
  selectedBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  countrySelector: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 24,
  },
  countrySelectorText: { flex: 1, fontSize: 15, fontWeight: '600' },

  orderSummary: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '900' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 58, borderRadius: 18, marginBottom: 16,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Success
  successRing: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  summaryBox: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 28 },
  doneBtn: { width: '100%', height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  countryName: { fontSize: 15, fontWeight: '600' },
  countryFee: { fontSize: 13 },
});

