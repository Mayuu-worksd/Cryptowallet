import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, BUSINESS_TYPES } from '../services/merchantService';
import Toast from '../components/Toast';

const COUNTRIES = ['United States','United Kingdom','India','UAE','Singapore','Germany','France','Australia','Canada','Brazil','Other'];

export default function BusinessKYCFormScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [typeModal, setTypeModal]       = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as any });
  const [form, setForm] = useState({
    business_name: '', business_type: '', registration_number: '',
    business_address: '', country: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    businessKYCService.getStatus(walletAddress).then(r => {
      if (r && (r.status === 'under_review' || r.status === 'approved')) {
        navigation.replace('BusinessKYCResult');
      }
    }).catch(() => {}).finally(() => setChecking(false));
  }, []);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.business_name.trim() || form.business_name.trim().length < 2) e.business_name = 'Enter your business name';
    if (!form.business_type) e.business_type = 'Select business type';
    if (!form.registration_number.trim()) e.registration_number = 'Enter registration number';
    if (!form.business_address.trim() || form.business_address.trim().length < 10) e.business_address = 'Enter full business address';
    if (!form.country) e.country = 'Select country';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await businessKYCService.submit(walletAddress, form);
      navigation.navigate('BusinessKYCDocument', { form });
    } catch (e: any) {
      setToast({ visible: true, message: e?.message ?? 'Failed. Try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* Type Modal */}
      <Modal visible={typeModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            <Text style={[s.modalTitle, { color: T.text }]}>Business Type</Text>
            <FlatList data={BUSINESS_TYPES} keyExtractor={i => i} renderItem={({ item }) => (
              <TouchableOpacity style={[s.modalRow, { borderBottomColor: T.border }]} onPress={() => { set('business_type')(item); setTypeModal(false); }}>
                <Text style={[s.modalRowText, { color: T.text }]}>{item}</Text>
                {form.business_type === item && <Feather name="check" size={16} color={T.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      {/* Country Modal */}
      <Modal visible={countryModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            <Text style={[s.modalTitle, { color: T.text }]}>Country</Text>
            <FlatList data={COUNTRIES} keyExtractor={i => i} renderItem={({ item }) => (
              <TouchableOpacity style={[s.modalRow, { borderBottomColor: T.border }]} onPress={() => { set('country')(item); setCountryModal(false); }}>
                <Text style={[s.modalRowText, { color: T.text }]}>{item}</Text>
                {form.country === item && <Feather name="check" size={16} color={T.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Business Verification</Text>
        <View style={[s.badge, { backgroundColor: T.primary + '20' }]}>
          <Text style={[s.badgeText, { color: T.primary }]}>MERCHANT</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.infoBox, { backgroundColor: T.primary + '10', borderColor: T.primary + '30' }]}>
          <Feather name="briefcase" size={18} color={T.primary} />
          <Text style={[s.infoText, { color: T.textMuted }]}>Upgrade to Merchant to access QR payments and P2P marketplace with verified badge.</Text>
        </View>

        <Text style={[s.sectionTitle, { color: T.text }]}>Business Details</Text>

        {/* Business Name */}
        <View style={[s.field, { borderColor: errors.business_name ? T.error : T.border, backgroundColor: T.surface }]}>
          <Text style={[s.fieldLabel, { color: T.textDim }]}>Business Name</Text>
          <TextInput style={[s.fieldInput, { color: T.text }]} value={form.business_name} onChangeText={set('business_name')} placeholderTextColor={T.textDim} autoCapitalize="words" />
        </View>
        {errors.business_name ? <Text style={[s.error, { color: T.error }]}>{errors.business_name}</Text> : null}

        {/* Business Type */}
        <TouchableOpacity style={[s.field, { borderColor: errors.business_type ? T.error : T.border, backgroundColor: T.surface }]} onPress={() => setTypeModal(true)}>
          <Text style={[s.fieldLabel, { color: T.textDim }]}>Business Type</Text>
          <View style={s.fieldRow}>
            <Text style={[s.fieldInput, { color: form.business_type ? T.text : T.textDim }]}>{form.business_type || 'Select type'}</Text>
            <Feather name="chevron-down" size={16} color={T.textDim} />
          </View>
        </TouchableOpacity>
        {errors.business_type ? <Text style={[s.error, { color: T.error }]}>{errors.business_type}</Text> : null}

        {/* Registration Number */}
        <View style={[s.field, { borderColor: errors.registration_number ? T.error : T.border, backgroundColor: T.surface }]}>
          <Text style={[s.fieldLabel, { color: T.textDim }]}>Registration Number</Text>
          <TextInput style={[s.fieldInput, { color: T.text }]} value={form.registration_number} onChangeText={set('registration_number')} placeholderTextColor={T.textDim} autoCapitalize="characters" />
        </View>
        {errors.registration_number ? <Text style={[s.error, { color: T.error }]}>{errors.registration_number}</Text> : null}

        {/* Country */}
        <TouchableOpacity style={[s.field, { borderColor: errors.country ? T.error : T.border, backgroundColor: T.surface }]} onPress={() => setCountryModal(true)}>
          <Text style={[s.fieldLabel, { color: T.textDim }]}>Country</Text>
          <View style={s.fieldRow}>
            <Text style={[s.fieldInput, { color: form.country ? T.text : T.textDim }]}>{form.country || 'Select country'}</Text>
            <Feather name="chevron-down" size={16} color={T.textDim} />
          </View>
        </TouchableOpacity>
        {errors.country ? <Text style={[s.error, { color: T.error }]}>{errors.country}</Text> : null}

        {/* Business Address */}
        <View style={[s.field, { borderColor: errors.business_address ? T.error : T.border, backgroundColor: T.surface, minHeight: 80 }]}>
          <Text style={[s.fieldLabel, { color: T.textDim }]}>Business Address</Text>
          <TextInput style={[s.fieldInput, { color: T.text }]} value={form.business_address} onChangeText={set('business_address')} placeholderTextColor={T.textDim} autoCapitalize="words" multiline />
        </View>
        {errors.business_address ? <Text style={[s.error, { color: T.error }]}>{errors.business_address}</Text> : null}

        <TouchableOpacity style={[s.btn, { backgroundColor: T.primary, shadowColor: T.primary }, loading && { opacity: 0.6 }]} onPress={handleNext} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#FFF" /> : <><Text style={s.btnText}>Continue</Text><Feather name="arrow-right" size={17} color="#FFF" /></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 24 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 28 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, letterSpacing: -0.4 },
  field: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4, justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: { fontSize: 15, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { fontSize: 12, fontWeight: '600', marginBottom: 12, marginLeft: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 60, borderRadius: 18, marginTop: 24, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '70%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  modalRowText: { fontSize: 15, fontWeight: '600' },
});
