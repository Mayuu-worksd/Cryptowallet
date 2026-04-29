import React, { useEffect, useState } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Modal, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { shippingFeeService, ShippingFee, VCCCardVariant } from '../services/supabaseService';

const PHYSICAL_BASE_FEE = 50;

export default function VCCPhysicalScreen({ navigation, route }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { variant, holderName, previewNumber, previewExpiry, previewCVV }: { variant: VCCCardVariant; holderName: string; previewNumber?: string; previewExpiry?: string; previewCVV?: string } = route?.params ?? {};

  const [shippingFees,    setShippingFees]    = useState<ShippingFee[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<ShippingFee | null>(null);
  const [countryModal,    setCountryModal]    = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [wantsPhysical,   setWantsPhysical]   = useState<boolean | null>(null);

  useEffect(() => {
    shippingFeeService.getAll()
      .then(setShippingFees)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shippingFee = selectedCountry?.fee_usd ?? 0;
  const total       = PHYSICAL_BASE_FEE + shippingFee;

  const handleConfirm = () => {
    navigation.navigate('VCCProcessing', {
      variant,
      holderName,
      previewNumber,
      previewExpiry,
      previewCVV,
      isPhysical:     wantsPhysical === true,
      shippingFeeUsd: wantsPhysical ? shippingFee : 0,
      country:        selectedCountry?.country_name ?? '',
    });
  };

  const canConfirm = wantsPhysical === false || (wantsPhysical === true && !!selectedCountry);

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Physical Card</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Country modal */}
      <Modal visible={countryModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: T.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryModal(false)}>
                <Feather name="x" size={22} color={T.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {shippingFees.map(sf => (
                <TouchableOpacity
                  key={sf.country_name}
                  style={[s.countryRow, { borderBottomColor: T.border }]}
                  onPress={() => { setSelectedCountry(sf); setCountryModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.countryName, { color: T.text }]}>{sf.country_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.countryFee, { color: T.textMuted }]}>${sf.fee_usd.toFixed(2)} shipping</Text>
                    {selectedCountry?.country_name === sf.country_name && <Feather name="check" size={16} color={T.primary} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.iconRing, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
          <Feather name="package" size={36} color={T.primary} />
        </View>
        <Text style={[s.title, { color: T.text }]}>Want a Physical Card?</Text>
        <Text style={[s.sub, { color: T.textMuted }]}>Get a real card delivered to your door. Completely optional.</Text>

        {/* Physical option */}
        <TouchableOpacity
          style={[
            s.optionCard, 
            { backgroundColor: T.surface, borderColor: T.border },
            wantsPhysical === true && { borderColor: T.primary, backgroundColor: T.primary + '08' }
          ]}
          onPress={() => setWantsPhysical(true)}
          activeOpacity={0.85}
        >
          <View style={s.optionLeft}>
            <View style={[s.optionRadio, { borderColor: T.border }, wantsPhysical === true && { borderColor: T.primary }]}>
              {wantsPhysical === true && <View style={[s.optionRadioDot, { backgroundColor: T.primary }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optionTitle, { color: T.text }]}>Yes, send me a physical card</Text>
              <Text style={[s.optionSub, { color: T.textMuted }]}>Base fee: ${PHYSICAL_BASE_FEE} + shipping by country</Text>
            </View>
          </View>
        </TouchableOpacity>

        {wantsPhysical === true && (
          <View style={s.shippingSection}>
            {loading ? (
              <ActivityIndicator color={T.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[s.countrySelector, { backgroundColor: T.surface, borderColor: selectedCountry ? T.primary : T.border }]}
                  onPress={() => setCountryModal(true)}
                  activeOpacity={0.8}
                >
                  <Feather name="map-pin" size={18} color={selectedCountry ? T.primary : T.textMuted} />
                  <Text style={[s.countrySelectorText, { color: selectedCountry ? T.text : T.textDim }]}>
                    {selectedCountry?.country_name ?? 'Select shipping country'}
                  </Text>
                  <Feather name="chevron-down" size={18} color={T.textMuted} />
                </TouchableOpacity>

                {selectedCountry && (
                  <View style={[s.costBreakdown, { backgroundColor: T.surface }]}>
                    {[
                      { label: 'Physical Card Fee', value: `$${PHYSICAL_BASE_FEE.toFixed(2)}` },
                      { label: `Shipping to ${selectedCountry.country_name}`, value: `$${shippingFee.toFixed(2)}` },
                    ].map(row => (
                      <View key={row.label} style={s.costRow}>
                        <Text style={[s.costLabel, { color: T.textMuted }]}>{row.label}</Text>
                        <Text style={[s.costValue, { color: T.text }]}>{row.value}</Text>
                      </View>
                    ))}
                    <View style={[s.costRow, s.totalRow, { borderTopColor: T.border }]}>
                      <Text style={[s.totalLabel, { color: T.text }]}>Total</Text>
                      <Text style={[s.totalValue, { color: T.primary }]}>${total.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Virtual only option */}
        <TouchableOpacity
          style={[
            s.optionCard, 
            { backgroundColor: T.surface, borderColor: T.border },
            wantsPhysical === false && { borderColor: T.primary, backgroundColor: T.primary + '08' }
          ]}
          onPress={() => { setWantsPhysical(false); setSelectedCountry(null); }}
          activeOpacity={0.85}
        >
          <View style={s.optionLeft}>
            <View style={[s.optionRadio, { borderColor: T.border }, wantsPhysical === false && { borderColor: T.primary }]}>
              {wantsPhysical === false && <View style={[s.optionRadioDot, { backgroundColor: T.primary }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optionTitle, { color: T.text }]}>No, virtual only (free)</Text>
              <Text style={[s.optionSub, { color: T.textMuted }]}>Use your card instantly for online payments</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.confirmBtn, { backgroundColor: T.primary }, !canConfirm && { opacity: 0.4 }]}
          disabled={!canConfirm}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={s.confirmBtnText}>Confirm & Apply</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 28, alignItems: 'center' },
  iconRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  sub: { fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 22, fontWeight: '500' },
  optionCard: {
    width: '100%', borderRadius: 20,
    borderWidth: 1.5, padding: 20, marginBottom: 16,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  optionRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  optionRadioDot: { width: 12, height: 12, borderRadius: 6 },
  optionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  optionSub: { fontSize: 13, fontWeight: '500' },
  shippingSection: { width: '100%', marginBottom: 16, gap: 14 },
  countrySelector: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 18, borderRadius: 16, borderWidth: 1.5,
  },
  countrySelectorText: { flex: 1, fontSize: 16, fontWeight: '600' },
  costBreakdown: { borderRadius: 18, padding: 20, gap: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { fontSize: 14, fontWeight: '600' },
  costValue: { fontSize: 14, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, paddingTop: 14, marginTop: 4 },
  totalLabel: { fontSize: 17, fontWeight: '900' },
  totalValue: { fontSize: 20, fontWeight: '900' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 64, borderRadius: 20, width: '100%', marginTop: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  countryName: { fontSize: 16, fontWeight: '700' },
  countryFee: { fontSize: 14, fontWeight: '600' },
});

