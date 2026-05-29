import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Platform, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { businessKYCService, BUSINESS_TYPES } from '../services/merchantService';
import Toast from '../components/Toast';

const COUNTRIES = [
  'United States', 'United Kingdom', 'India', 'UAE', 'Singapore',
  'Germany', 'France', 'Australia', 'Canada', 'Brazil', 'Japan',
  'South Korea', 'Malaysia', 'Indonesia', 'Nigeria', 'South Africa',
  'Kenya', 'Ghana', 'Pakistan', 'Bangladesh', 'Sri Lanka',
  'Philippines', 'Vietnam', 'Thailand', 'Mexico', 'Argentina',
  'Colombia', 'Turkey', 'Egypt', 'Saudi Arabia', 'Qatar', 'Other',
];

const DIRECTOR_ID_TYPES = [
  'Passport', 'National ID Card', "Driver's License", 'Residence Permit',
];

function Field({ label, optional, error, hint, children }: {
  label: string; optional?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: T.textDim }]}>
        {label}{optional && <Text style={{ fontWeight: '400', fontSize: 11 }}> · optional</Text>}
      </Text>
      <View style={[s.fieldBox, { backgroundColor: T.surface, borderColor: error ? T.error : T.border }]}>
        {children}
      </View>
      {!!hint  && !error && <Text style={[s.hintText,  { color: T.textDim }]}>{hint}</Text>}
      {!!error && <Text style={[s.errorText, { color: T.error }]}>{error}</Text>}
    </View>
  );
}

function PickerModal({ visible, title, data, selected, onSelect, onClose, T }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: T.border }]} />
          <Text style={[s.modalTitle, { color: T.text }]}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(i: string) => i}
            renderItem={({ item }: { item: string }) => (
              <TouchableOpacity
                style={[s.modalRow, { borderBottomColor: T.border }]}
                onPress={() => onSelect(item)}
              >
                <Text style={[s.modalRowText, { color: T.text }]}>{item}</Text>
                {selected === item && <Feather name="check" size={16} color={T.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function BusinessKYCFormScreen({ navigation }: any) {
  const { walletAddress, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [step,         setStep]         = useState(0); // 0=business, 1=director
  const [loading,      setLoading]      = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [typeModal,    setTypeModal]    = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [dirIdModal,   setDirIdModal]   = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as any });

  const [form, setForm] = useState({
    // Business
    business_name:       '',
    business_type:       '',
    registration_number: '',
    vat_tax_id:          '',
    business_address:    '',
    country:             '',
    website:             '',
    incorporation_date:  '',
    // Director
    director_name:         '',
    director_nationality:  '',
    director_id_type:      '',
    director_dob:          '',
    director_address:      '',
    // UBO
    ubo_name:              '',
    ubo_ownership:         '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    businessKYCService.getStatus(walletAddress)
      .then(r => {
        if (r?.status) {
          if (r.status === 'rejected') {
            setChecking(false);
            return;
          }
          // If pending but documents are missing, prefill the text form from the DB so they can continue to documents!
          if (r.status === 'pending' && (!r.document_url || !r.director_id_url)) {
            setForm({
              business_name:       r.business_name ?? '',
              business_type:       r.business_type ?? '',
              registration_number: r.registration_number ?? '',
              vat_tax_id:          r.vat_tax_id ?? '',
              business_address:    r.business_address ?? '',
              country:             r.country ?? '',
              website:             r.website ?? '',
              incorporation_date:  r.incorporation_date ?? '',
              director_name:       r.director_name ?? '',
              director_nationality: r.director_nationality ?? '',
              director_id_type:    r.director_id_type ?? '',
              director_dob:        r.director_dob ?? '',
              director_address:    r.director_address ?? '',
              ubo_name:            r.ubo_name ?? '',
              ubo_ownership:       r.ubo_ownership ?? '',
            });
            setChecking(false);
            return;
          }
          navigation.replace('BusinessKYCResult');
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validateStep0 = () => {
    const e: Record<string, string> = {};
    if (!form.business_name.trim() || form.business_name.trim().length < 2)
      e.business_name = 'Enter your business name';
    if (!form.business_type)
      e.business_type = 'Select a business type';
    if (!form.registration_number.trim())
      e.registration_number = 'Enter registration number';
    if (!form.country)
      e.country = 'Select a country';
    if (!form.business_address.trim() || form.business_address.trim().length < 10)
      e.business_address = 'Enter full registered address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.director_name.trim())
      e.director_name = 'Enter director / owner full name';
    if (!form.director_nationality.trim())
      e.director_nationality = 'Enter nationality';
    if (!form.director_id_type)
      e.director_id_type = 'Select ID type';
    if (!form.director_dob.trim())
      e.director_dob = 'Enter date of birth (DD/MM/YYYY)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (step === 0) {
      if (!validateStep0()) return;
      setStep(1);
      return;
    }
    // Step 1 — submit
    if (!validateStep1()) return;
    setLoading(true);
    try {
      await businessKYCService.submit(walletAddress, {
        business_name:        form.business_name,
        business_type:        form.business_type,
        registration_number:  form.registration_number,
        vat_tax_id:           form.vat_tax_id,
        business_address:     form.business_address,
        country:              form.country,
        director_name:        form.director_name,
        director_nationality: form.director_nationality,
      });
      navigation.navigate('BusinessKYCDocument', { form });
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('ALREADY_SUBMITTED')) {
        navigation.replace('BusinessKYCResult');
        return;
      }
      setToast({ visible: true, message: msg || 'Failed. Try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[s.root, { backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={T.primary} size="large" />
      </View>
    );
  }

  const STEPS = ['Business Info', 'Director / UBO'];

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: T.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      <PickerModal visible={typeModal}    title="Business Type"  data={BUSINESS_TYPES}      selected={form.business_type}    onSelect={(v: string) => { set('business_type')(v);    setTypeModal(false);    }} onClose={() => setTypeModal(false)}    T={T} />
      <PickerModal visible={countryModal} title="Country"        data={COUNTRIES}           selected={form.country}          onSelect={(v: string) => { set('country')(v);           setCountryModal(false); }} onClose={() => setCountryModal(false)} T={T} />
      <PickerModal visible={dirIdModal}   title="ID Document Type" data={DIRECTOR_ID_TYPES} selected={form.director_id_type} onSelect={(v: string) => { set('director_id_type')(v); setDirIdModal(false);   }} onClose={() => setDirIdModal(false)}   T={T} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => step === 0 ? navigation.goBack() : setStep(0)}
          style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}
        >
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Business Verification</Text>
        <View style={[s.merchantTag, { backgroundColor: T.primary + '15' }]}>
          <Text style={[s.merchantTagText, { color: T.primary }]}>MERCHANT</Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={[s.stepBarWrap, { borderBottomColor: T.border }]}>
        {STEPS.map((label, i) => {
          const done   = i < step;
          const active = i === step;
          const color  = done ? '#10B981' : active ? T.primary : T.textDim;
          return (
            <React.Fragment key={i}>
              <View style={s.stepItem}>
                <View style={[s.stepCircle, {
                  backgroundColor: done ? '#10B981' : active ? T.primary : T.surfaceLow,
                  borderColor: done ? '#10B981' : active ? T.primary : T.border,
                }]}>
                  {done
                    ? <Feather name="check" size={11} color="#FFF" />
                    : <Text style={[s.stepNum, { color: active ? '#FFF' : T.textDim }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.stepText, { color }]}>{label}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View style={[s.stepConnector, { backgroundColor: i < step ? '#10B981' : T.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── STEP 0: Business Info ── */}
        {step === 0 && (
          <>
            <Text style={[s.section, { color: T.text }]}>Business Details</Text>

            <Field label="Legal Business Name" error={errors.business_name}>
              <TextInput style={[s.input, { color: T.text }]} value={form.business_name} onChangeText={set('business_name')} placeholder="e.g. Acme Corp Ltd" placeholderTextColor={T.textDim} autoCapitalize="words" />
            </Field>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Business Type" error={errors.business_type}>
                  <TouchableOpacity style={s.selectRow} onPress={() => setTypeModal(true)}>
                    <Text style={[s.input, { color: form.business_type ? T.text : T.textDim, flex: 1 }]} numberOfLines={1}>{form.business_type || 'Select type'}</Text>
                    <Feather name="chevron-down" size={16} color={T.textDim} />
                  </TouchableOpacity>
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Country of Registration" error={errors.country}>
                  <TouchableOpacity style={s.selectRow} onPress={() => setCountryModal(true)}>
                    <Text style={[s.input, { color: form.country ? T.text : T.textDim, flex: 1 }]} numberOfLines={1}>{form.country || 'Select'}</Text>
                    <Feather name="chevron-down" size={16} color={T.textDim} />
                  </TouchableOpacity>
                </Field>
              </View>
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Registration / Company No." error={errors.registration_number}>
                  <TextInput style={[s.input, { color: T.text }]} value={form.registration_number} onChangeText={set('registration_number')} placeholder="e.g. 12345678" placeholderTextColor={T.textDim} autoCapitalize="characters" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="VAT / Tax ID" optional>
                  <TextInput style={[s.input, { color: T.text }]} value={form.vat_tax_id} onChangeText={set('vat_tax_id')} placeholder="e.g. GB123456" placeholderTextColor={T.textDim} autoCapitalize="characters" />
                </Field>
              </View>
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Incorporation Date" optional hint="DD/MM/YYYY">
                  <TextInput style={[s.input, { color: T.text }]} value={form.incorporation_date} onChangeText={set('incorporation_date')} placeholder="01/01/2020" placeholderTextColor={T.textDim} keyboardType="numbers-and-punctuation" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Business Website" optional>
                  <TextInput style={[s.input, { color: T.text }]} value={form.website} onChangeText={set('website')} placeholder="https://example.com" placeholderTextColor={T.textDim} autoCapitalize="none" keyboardType="url" />
                </Field>
              </View>
            </View>

            <Field label="Registered Business Address" error={errors.business_address}>
              <TextInput style={[s.input, s.multiline, { color: T.text }]} value={form.business_address} onChangeText={set('business_address')} placeholder="Full registered address including city, state, postal code" placeholderTextColor={T.textDim} autoCapitalize="words" multiline numberOfLines={3} />
            </Field>

            {/* Info box */}
            <View style={[s.infoBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="globe" size={13} color={T.textDim} />
              <Text style={[s.infoText, { color: T.textDim }]}>
                We support businesses from 30+ countries. All information is encrypted and used only for compliance verification.
              </Text>
            </View>
          </>
        )}

        {/* ── STEP 1: Director / UBO ── */}
        {step === 1 && (
          <>
            <Text style={[s.section, { color: T.text }]}>Director / Authorized Representative</Text>
            <Text style={[s.sectionSub, { color: T.textDim }]}>
              The person legally authorized to operate this business account. Must match the government ID you'll upload next.
            </Text>

            <Field label="Full Legal Name" error={errors.director_name} hint="Exactly as on government ID">
              <TextInput style={[s.input, { color: T.text }]} value={form.director_name} onChangeText={set('director_name')} placeholder="First Middle Last" placeholderTextColor={T.textDim} autoCapitalize="words" />
            </Field>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Nationality" error={errors.director_nationality}>
                  <TextInput style={[s.input, { color: T.text }]} value={form.director_nationality} onChangeText={set('director_nationality')} placeholder="e.g. Indian" placeholderTextColor={T.textDim} autoCapitalize="words" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Date of Birth" error={errors.director_dob} hint="DD/MM/YYYY">
                  <TextInput style={[s.input, { color: T.text }]} value={form.director_dob} onChangeText={set('director_dob')} placeholder="01/01/1990" placeholderTextColor={T.textDim} keyboardType="numbers-and-punctuation" />
                </Field>
              </View>
            </View>

            <Field label="ID Document Type" error={errors.director_id_type}>
              <TouchableOpacity style={s.selectRow} onPress={() => setDirIdModal(true)}>
                <Text style={[s.input, { color: form.director_id_type ? T.text : T.textDim, flex: 1 }]} numberOfLines={1}>{form.director_id_type || 'Select ID type'}</Text>
                <Feather name="chevron-down" size={16} color={T.textDim} />
              </TouchableOpacity>
            </Field>

            <Field label="Residential Address" optional hint="Current home address of the director">
              <TextInput style={[s.input, s.multiline, { color: T.text }]} value={form.director_address} onChangeText={set('director_address')} placeholder="Full residential address" placeholderTextColor={T.textDim} autoCapitalize="words" multiline numberOfLines={2} />
            </Field>

            <Text style={[s.section, { color: T.text, marginTop: 8 }]}>Ultimate Beneficial Owner (UBO)</Text>
            <Text style={[s.sectionSub, { color: T.textDim }]}>
              Person(s) who own 25%+ of the business. Leave blank if the director above is the sole owner.
            </Text>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="UBO Full Name" optional>
                  <TextInput style={[s.input, { color: T.text }]} value={form.ubo_name} onChangeText={set('ubo_name')} placeholder="Full name" placeholderTextColor={T.textDim} autoCapitalize="words" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Ownership %" optional>
                  <TextInput style={[s.input, { color: T.text }]} value={form.ubo_ownership} onChangeText={set('ubo_ownership')} placeholder="e.g. 51" placeholderTextColor={T.textDim} keyboardType="numeric" />
                </Field>
              </View>
            </View>

            {/* Compliance notice */}
            <View style={[s.infoBox, { backgroundColor: T.primary + '08', borderColor: T.primary + '20' }]}>
              <Feather name="shield" size={13} color={T.primary} />
              <Text style={[s.infoText, { color: T.textDim }]}>
                This information is required under global AML/KYC regulations (FATF, EU 5AMLD, FinCEN). All data is encrypted and never shared with third parties.
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[s.btn, { backgroundColor: T.primary }, loading && { opacity: 0.6 }]}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Text style={s.btnText}>{step === 0 ? 'Continue to Director Info' : 'Continue to Documents'}</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  iconBtn:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  merchantTag:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  merchantTagText:{ fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  stepBarWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  stepItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCircle:    { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum:       { fontSize: 11, fontWeight: '800' },
  stepText:      { fontSize: 12, fontWeight: '700' },
  stepConnector: { flex: 1, height: 1.5, marginHorizontal: 8 },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },

  section:    { fontSize: 15, fontWeight: '800', marginBottom: 6, letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, lineHeight: 18, marginBottom: 16 },

  fieldWrap:  { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6, marginLeft: 2 },
  fieldBox:   { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  hintText:   { fontSize: 10, fontWeight: '500', marginTop: 3, marginLeft: 2 },
  errorText:  { fontSize: 11, fontWeight: '600', marginTop: 4, marginLeft: 2 },
  input:      { fontSize: 14, fontWeight: '600', padding: 0 },
  multiline:  { minHeight: 56, textAlignVertical: 'top' },
  selectRow:  { flexDirection: 'row', alignItems: 'center' },
  row:        { flexDirection: 'row', gap: 12 },

  infoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  btn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 16, marginTop: 20 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '65%' },
  modalHandle:  { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  modalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  modalRowText: { fontSize: 14, fontWeight: '600' },
});
