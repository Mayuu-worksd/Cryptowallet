import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Modal, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import {
  cardVariantService, cardRequestService, kycService,
  CardVariant, COUNTRIES, SHIPPING_FEES,
} from '../services/supabaseService';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CRIMSON = '#EC2629';

// Fallback metadata to ensure instant rendering with zero blank states
const DEFAULT_VARIANTS: CardVariant[] = [
  {
    id: 'classic',
    name: 'Classic',
    price: 0,
    features: ['No annual maintenance fee', 'Global ATM cash withdrawals', '2% Cashback on retail spend'],
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 49.99,
    features: ['Elite metal card finish', 'Complimentary lounge key access', '4% Cashback on all dining'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price: 99.99,
    features: ['Brushed solid steel weight', 'Comprehensive travel insurance', '24/7 dedicated personal concierge'],
  },
  {
    id: 'travel',
    name: 'Travel',
    price: 79.99,
    features: ['Zero foreign exchange markups', 'Double points on airlines & hotel booking', 'Priority global lounge access'],
  },
];

const VARIANT_GRADIENTS: Record<string, readonly [string, string, string]> = {
  Classic:  ['#2B2B30', '#18181A', '#0D0D0E'] as const,
  Gold:     ['#E5A93C', '#996515', '#4A3B18'] as const,
  Platinum: ['#E5E7EB', '#9CA3AF', '#374151'] as const,
  Travel:   ['#1E3A8A', '#0F172A', '#050515'] as const,
};

const VARIANT_LABEL_ACCENTS: Record<string, string> = {
  Classic:  'CLASSIC EDITION',
  Gold:     'GOLD CENTURION',
  Platinum: 'PLATINUM STELLAR',
  Travel:   'TRAVEL EXPEDITION',
};

const VARIANT_DESCRIPTIONS: Record<string, string> = {
  Classic:  'Solid matte slate card. Perfect for effortless daily transactions and international ATM withdrawals.',
  Gold:     'Elite Emperor Gold finished metal card. Crafted for global business travelers and high-tier cashbacks.',
  Platinum: 'Solid brushed space platinum steel card. Heavyweight physical profile featuring bespoke concierge privileges.',
  Travel:   'Deep Aero Indigo composite shell card. Zero foreign transaction fees and accelerated flight points.',
};

export default function ApplyPhysicalCardScreen({ navigation }: any) {
  const { isDarkMode, walletAddress, kycStatus, cardDetails } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [variants, setVariants] = useState<CardVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<CardVariant | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countryModal, setCountryModal] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [hasPending, setHasPending] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<any>(null);
  const [liveKycStatus, setLiveKycStatus] = useState(kycStatus);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'success' | 'error' | 'info' });

  const scrollRef = useRef<ScrollView>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') =>
    setToast({ visible: true, message, type });

  useEffect(() => {
    Promise.all([
      cardVariantService.getVariants(),
      cardRequestService.hasPendingRequest(walletAddress),
      cardRequestService.getRequests(walletAddress),
      kycService.getStatus(walletAddress),
    ]).then(([v, pending, requests, kycRecord]) => {
      const activeVariants = v.length > 0 ? v : DEFAULT_VARIANTS;
      setVariants(activeVariants);
      setSelectedVariant(activeVariants[0]);
      setHasPending(pending);
      setExistingRequest(requests[0] ?? null);
      setLiveKycStatus(kycRecord?.status ?? null);
    }).catch(() => {
      // Fallback on offline supabase connectivity
      setVariants(DEFAULT_VARIANTS);
      setSelectedVariant(DEFAULT_VARIANTS[0]);
    }).finally(() => {
      setLoadingVariants(false);
      setCheckingExisting(false);
    });
  }, []);

  const shippingFee = selectedCountry ? (SHIPPING_FEES[selectedCountry] ?? SHIPPING_FEES['Other']) : null;
  const totalCost = (selectedVariant?.price ?? 0) + (shippingFee ?? 0);

  const handleCardScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (variants.length > 0 && index >= 0 && index < variants.length) {
      setSelectedVariant(variants[index]);
    }
  };

  const handleIndicatorPress = (index: number) => {
    if (variants.length > index) {
      setSelectedVariant(variants[index]);
      scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    }
  };

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

  // ── KYC Gate Redesign ──────────────────────────────────────────────────────
  if (liveKycStatus !== 'verified') {
    return (
      <View style={{ flex: 1, backgroundColor: T.background }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[styles.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backArrowCircle, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Feather name="chevron-left" size={20} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Identity Check</Text>
          <View style={{ width: 38 }} />
        </View>
        
        <View style={styles.gateContainer}>
          <View style={[styles.gateIconRing, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
            <Feather name="shield-off" size={38} color="#F59E0B" />
          </View>
          <Text style={[styles.gateTitle, { color: T.text }]}>Verification Required</Text>
          <Text style={[styles.gateSub, { color: T.textMuted }]}>
            Order premium physical smartcards after submitting simple KYC documents to authenticate your wallet credentials.
          </Text>
          
          <View style={[styles.kycStatusBox, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[styles.kycStatusLabel, { color: T.textMuted }]}>STATUS</Text>
            <View style={[styles.kycBadge, { backgroundColor:
              liveKycStatus === 'under_review' ? 'rgba(59,130,246,0.08)' :
              liveKycStatus === 'pending'      ? 'rgba(245,158,11,0.08)' :
              liveKycStatus === 'rejected'     ? 'rgba(236,38,41,0.08)' : T.border,
            }]}>
              <Text style={[styles.kycBadgeText, { color:
                liveKycStatus === 'under_review' ? '#3B82F6' :
                liveKycStatus === 'pending'      ? '#F59E0B' :
                liveKycStatus === 'rejected'     ? CRIMSON : T.textMuted,
              }]}>
                {liveKycStatus === 'under_review' ? 'UNDER REVIEW' :
                 liveKycStatus === 'pending'      ? 'PENDING' :
                 liveKycStatus === 'rejected'     ? 'REJECTED' : 'NOT STARTED'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.gateBtn, { backgroundColor: T.text }]}
            onPress={() => navigation.navigate(liveKycStatus ? 'KYCStatus' : 'KYCForm')}
            activeOpacity={0.9}
          >
            <Feather name="shield" size={16} color={T.background} />
            <Text style={[styles.gateBtnText, { color: T.background }]}>
              {liveKycStatus ? 'Review KYC Details' : 'Verify Identity Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Existing Request Status Screen Redesign ────────────────────────────────
  if (existingRequest && !submitted) {
    const req = existingRequest;
    const isApproved = req.status === 'approved';
    const isRejected = req.status === 'rejected';
    const statusColor = isApproved ? '#00C853' : isRejected ? CRIMSON : '#F59E0B';
    const statusIcon  = isApproved ? 'check-circle' : isRejected ? 'x-circle' : 'clock';
    const statusLabel = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'UNDER REVIEW';
    const statusTitle = isApproved ? 'Card Ready for Dispatch' : isRejected ? 'Order Rejected' : 'Processing Order';
    const statusSub   = isApproved
      ? `Your high-fidelity physical card has been approved and is currently being minted and prepared for dispatch to ${req.country}.`
      : isRejected
      ? 'Your physical card order was declined after profile verification. Tap below to submit a new request.'
      : 'Our core compliance desk is currently validating your wallet. Review will finish shortly.';

    return (
      <View style={{ flex: 1, backgroundColor: T.background }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[styles.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backArrowCircle, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Feather name="chevron-left" size={20} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Order Invoice</Text>
          <View style={{ width: 38 }} />
        </View>
        
        <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.gateIconRing, { backgroundColor: statusColor + '08', marginBottom: 12 }]}>
            <Feather name={statusIcon} size={36} color={statusColor} />
          </View>
          
          <View style={{ backgroundColor: statusColor + '12', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: statusColor }}>{statusLabel}</Text>
          </View>
          
          <Text style={[styles.gateTitle, { color: T.text, marginBottom: 8 }]}>{statusTitle}</Text>
          <Text style={[styles.gateSub, { color: T.textMuted, marginBottom: 24, textAlign: 'center' }]}>{statusSub}</Text>
          
          <View style={[styles.orderSummary, { backgroundColor: T.surface, borderColor: T.border, width: '100%' }]}>
            <Text style={[styles.sectionTitle, { color: T.textMuted, marginBottom: 16 }]}>DISPATCH DETAILS</Text>
            {[
              { label: 'Card Specification', value: req.card_type },
              { label: 'Destination Country', value: req.country },
              { label: 'Express Delivery',   value: `$${parseFloat(req.shipping_fee).toFixed(2)}` },
              { label: 'Total Minting Fee',  value: `$${parseFloat(req.total_cost).toFixed(2)}` },
              { label: 'Purchase Date',     value: new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
            ].map((row, i, arr) => (
              <View key={row.label} style={[styles.summaryRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 12, marginBottom: 12 }
              ]}>
                <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[styles.summaryValue, { color: T.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.gateBtn, {
              backgroundColor: isRejected ? T.text : T.surface,
              borderWidth: isRejected ? 0 : 1,
              borderColor: T.border,
              marginTop: 12,
            }]}
            onPress={() => {
              if (isRejected) { setExistingRequest(null); setHasPending(false); }
              else navigation.goBack();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.gateBtnText, { color: isRejected ? T.background : T.text }]}>
              {isRejected ? 'Reapply for physical card' : 'Go back'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Success Receipt Redesign ────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[styles.successRing, { backgroundColor: 'rgba(0,200,83,0.08)' }]}>
          <Feather name="check-circle" size={44} color="#00C853" />
        </View>
        
        <Text style={[styles.successTitle, { color: T.text }]}>Order Placed Successfully!</Text>
        <Text style={[styles.successSub, { color: T.textMuted }]}>
          Your custom physical metal {selectedVariant?.name} smartcard is currently entering our processing ledger and will arrive shortly.
        </Text>
        
        <View style={[styles.summaryBox, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1, padding: 18 }]}>
          {[
            { label: 'Smartcard Tier', value: selectedVariant?.name ?? '' },
            { label: 'Dispatch Country', value: selectedCountry },
            { label: 'Minting Fee', value: selectedVariant?.price === 0 ? 'Free' : `$${selectedVariant?.price.toFixed(2)}` },
            { label: 'Shipping Charge', value: `$${shippingFee?.toFixed(2)}` },
            { label: 'Total Invoiced', value: `$${totalCost.toFixed(2)}` },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[styles.summaryRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 10, marginBottom: 10 }]}
            >
              <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, {
                color: i === arr.length - 1 ? CRIMSON : T.text,
                fontWeight: i === arr.length - 1 ? '900' : '600',
              }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: T.text }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={[styles.doneBtnText, { color: T.background }]}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main Premium Swipe & Checkout Form ────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Toast
        visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Country selection bottom sheet */}
      <Modal visible={countryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Destination Country</Text>
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
                      ${SHIPPING_FEES[c].toFixed(2)} delivery
                    </Text>
                    {selectedCountry === c && <Feather name="check" size={16} color={CRIMSON} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backArrowCircle, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
          <Feather name="chevron-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Mint physical smartcard</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Verified Banner */}
        <View style={[styles.verifiedBanner, { backgroundColor: 'rgba(0,200,83,0.06)', borderColor: 'rgba(0,200,83,0.2)' }]}>
          <Feather name="shield" size={16} color="#00C853" />
          <Text style={[styles.verifiedText, { color: '#00C853' }]}>KYC Authenticated · Eligible for metal checkout</Text>
        </View>

        {/* Swipe Pager Header */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>SWIPE TO CHOOSE TIER</Text>

        {loadingVariants ? (
          <ActivityIndicator color={CRIMSON} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.carouselContainer}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCardScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.carouselContent}
            >
              {variants.map(v => {
                const gradientColors = VARIANT_GRADIENTS[v.name] ?? VARIANT_GRADIENTS.Classic;
                const labelText = VARIANT_LABEL_ACCENTS[v.name] ?? v.name.toUpperCase();
                
                // Platinum steel uses a silver metallic chip, others use gold
                const isSilverCard = v.name === 'Platinum' || v.name === 'Classic';
                
                return (
                  <View key={v.id} style={styles.carouselItem}>
                    <LinearGradient
                      colors={gradientColors}
                      style={[styles.portraitCard, styles.shadowWrapper]}
                    >
                      <View style={styles.glow} />
                      
                      {/* Premium Card Chip */}
                      <View style={[
                        styles.cardChip,
                        isSilverCard
                          ? { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' }
                          : { backgroundColor: '#E5A93C', borderColor: '#D4942A' }
                      ]}>
                        <View style={[styles.chipLineHorizontal, { backgroundColor: isSilverCard ? '#6B7280' : '#B57C1E' }]} />
                        <View style={[styles.chipLineVertical, { backgroundColor: isSilverCard ? '#6B7280' : '#B57C1E' }]} />
                      </View>

                      {/* Contactless symbol */}
                      <View style={styles.cardWifi}>
                        <Feather name="wifi" size={15} color={isSilverCard ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)'} style={{ transform: [{ rotate: '90deg' }] }} />
                      </View>

                      {/* rotated vertical luxury spaced font */}
                      <View style={styles.brandRotatedContainer}>
                        <View style={[styles.brandDot, { backgroundColor: isSilverCard ? CRIMSON : '#FFFFFF' }]} />
                        <Text style={[
                          styles.brandRotatedText,
                          { color: isSilverCard ? '#131313' : '#FFFFFF' }
                        ]}>
                          {labelText}
                        </Text>
                      </View>

                      {/* Holder name printed horizontally */}
                      <View style={styles.cardFaceHolderWrap}>
                        <Text style={[styles.cardFaceHolderLabel, { color: isSilverCard ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>CARD HOLDER</Text>
                        <Text style={[styles.cardFaceHolderName, { color: isSilverCard ? '#131313' : '#FFFFFF' }]}>
                          {cardDetails?.holderName || 'CARD HOLDER'}
                        </Text>
                      </View>

                      {/* visa logo bottom-left */}
                      <View style={styles.visaRotatedContainer}>
                        <Text style={[styles.visaRotatedText, { color: isSilverCard ? '#131313' : '#FFFFFF' }]}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
            </ScrollView>

            {/* Indicator Dots */}
            <View style={styles.indicatorContainer}>
              {variants.map((v, idx) => {
                const isSelected = selectedVariant?.id === v.id;
                const dotColor = v.name === 'Gold' ? '#E5A93C' : v.name === 'Platinum' ? '#9CA3AF' : v.name === 'Travel' ? '#3B82F6' : '#1C1B1B';
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => handleIndicatorPress(idx)}
                    style={[
                      styles.indicatorDot,
                      isSelected && styles.indicatorDotActive,
                      { backgroundColor: dotColor }
                    ]}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Selected Card tier info */}
        {selectedVariant && (
          <View style={styles.tierInfoBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.tierName, { color: T.text }]}>{selectedVariant.name} Metal</Text>
              <Text style={[styles.tierPrice, { color: selectedVariant.name === 'Gold' ? '#E5A93C' : CRIMSON }]}>
                {selectedVariant.price === 0 ? 'FREE' : `$${selectedVariant.price.toFixed(2)}/yr`}
              </Text>
            </View>
            <Text style={[styles.tierDesc, { color: T.textMuted }]}>
              {VARIANT_DESCRIPTIONS[selectedVariant.name] ?? 'Premium laser-etched heavy metal smartcard.'}
            </Text>

            {/* Custom high-fidelity checkmarks features */}
            <View style={styles.featuresList}>
              {selectedVariant.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <View style={[styles.checkCircle, { backgroundColor: 'rgba(0,200,83,0.06)' }]}>
                    <Feather name="check" size={11} color="#00C853" />
                  </View>
                  <Text style={[styles.featureText, { color: T.text }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Shipping address select field */}
        <Text style={[styles.sectionTitle, { color: T.textMuted, marginTop: 12 }]}>SHIPPING DESTINATION</Text>
        <TouchableOpacity
          style={[styles.countrySelector, { backgroundColor: T.surface, borderColor: selectedCountry ? CRIMSON : T.border }]}
          onPress={() => setCountryModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.selectorLeft}>
            <Feather name="map-pin" size={17} color={selectedCountry ? CRIMSON : T.textDim} />
            <Text style={[styles.countrySelectorText, { color: selectedCountry ? T.text : T.textMuted }]}>
              {selectedCountry || 'Choose dispatch address country'}
            </Text>
          </View>
          <Feather name="chevron-down" size={16} color={T.textDim} />
        </TouchableOpacity>

        {/* transparent checkout summary invoice block */}
        {selectedVariant && selectedCountry && (
          <View style={[styles.orderSummary, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[styles.sectionTitle, { color: T.textMuted, marginBottom: 12, marginLeft: 0 }]}>BILLING LEDGER</Text>
            {[
              { label: `${selectedVariant.name} Card Minting Fee`, value: selectedVariant.price === 0 ? 'Free' : `$${selectedVariant.price.toFixed(2)}` },
              { label: `Express Dispatch to ${selectedCountry}`, value: `$${shippingFee!.toFixed(2)}` },
            ].map(row => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[styles.summaryValue, { color: T.text }]}>{row.value}</Text>
              </View>
            ))}
            
            <View style={[styles.totalRow, { borderTopColor: T.border }]}>
              <Text style={[styles.totalLabel, { color: T.text }]}>Total Invoice</Text>
              <Text style={[styles.totalValue, { color: CRIMSON }]}>${totalCost.toFixed(2)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: T.text },
            (!selectedVariant || !selectedCountry || submitting) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={!selectedVariant || !selectedCountry || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={T.background} />
          ) : (
            <>
              <Feather name="credit-card" size={16} color={T.background} />
              <Text style={[styles.submitBtnText, { color: T.background }]}>
                {selectedVariant && selectedCountry ? `Pay & Order · $${totalCost.toFixed(2)}` : 'Confirm Order'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: T.textDim }]}>
          Mint fee is charged to your main ledger account balance. Express shipping delivery schedules take 4–7 business days.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backArrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 20 },

  // Redesigned KYC gate
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, marginTop: 40 },
  gateIconRing: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  gateSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  kycStatusBox: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  kycStatusLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  kycBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  kycBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  gateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 56, borderRadius: 16, width: '100%',
  },
  gateBtnText: { fontSize: 15, fontWeight: '900' },

  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  verifiedText: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12, marginLeft: 2 },

  // Redesigned Swiping Selector Carousel
  carouselContainer: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
    height: 380,
    marginBottom: 20,
  },
  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitCard: {
    width: 215,
    height: 330,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  shadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    position: 'absolute',
    top: 90,
    left: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    padding: 3,
  },
  chipLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
    height: 1,
  },
  chipLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    width: 1,
  },
  cardWifi: {
    position: 'absolute',
    top: 95,
    right: 24,
  },
  brandRotatedContainer: {
    position: 'absolute',
    top: 75,
    right: -35,
    transform: [{ rotate: '90deg' }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandRotatedText: {
    fontSize: 10,
    fontWeight: '300', // Thin elegant card font style
    letterSpacing: 4,
    opacity: 0.85,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-light',
  },
  cardFaceHolderWrap: {
    position: 'absolute',
    bottom: 50,
    right: 24,
    alignItems: 'flex-end',
  },
  cardFaceHolderLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardFaceHolderName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  visaRotatedContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    transform: [{ rotate: '270deg' }],
  },
  visaRotatedText: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  indicatorContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.25,
  },
  indicatorDotActive: {
    width: 18,
    height: 7,
    borderRadius: 4,
    opacity: 1,
  },

  // Tier info block
  tierInfoBox: {
    borderRadius: 20,
    paddingVertical: 4,
    marginBottom: 20,
  },
  tierName: { fontSize: 20, fontWeight: '900' },
  tierPrice: { fontSize: 16, fontWeight: '900' },
  tierDesc: { fontSize: 13, lineHeight: 20, marginTop: 4, fontWeight: '500' },
  featuresList: { marginTop: 14, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { fontSize: 12, fontWeight: '700' },

  // Form inputs
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  selectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countrySelectorText: { fontSize: 14, fontWeight: '700' },

  orderSummary: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, fontWeight: '700' },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, marginTop: 8, borderTopWidth: 1 },
  totalLabel: { fontSize: 15, fontWeight: '900' },
  totalValue: { fontSize: 18, fontWeight: '900' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: { fontSize: 15, fontWeight: '900' },
  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },

  // Redesigned Success Screens
  successRing: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8, textAlign: 'center', paddingHorizontal: 10 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 12 },
  summaryBox: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 28 },
  doneBtn: { width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '900' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  countryName: { fontSize: 15, fontWeight: '700' },
  countryFee: { fontSize: 13, fontWeight: '500' },
});
