import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CARD_DESIGNS, CardDesignKey } from './CardDesigns';
import CardPreview from './CardPreview';

type Props = {
  visible: boolean;
  currentName: string;
  currentDesign: string;
  cardNumber: string;
  expiry: string;
  onSave: (patch: { holderName?: string; design?: string }) => void;
  onClose: () => void;
};

export default function EditCardSheet({ visible, currentName, currentDesign, cardNumber, expiry, onSave, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const [design, setDesign] = useState<CardDesignKey>(currentDesign as CardDesignKey);
  const [nameError, setNameError] = useState('');

  // Sync when modal opens
  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setDesign(currentDesign as CardDesignKey);
      setNameError('');
    }
  }, [visible, currentName, currentDesign]);

  const handleSave = () => {
    if (!name.trim()) { setNameError('Name cannot be empty'); return; }
    onSave({ holderName: name.trim().toUpperCase(), design });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Card</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Live preview */}
            <View style={styles.previewWrap}>
              <CardPreview
                cardNumber={cardNumber}
                holderName={name.toUpperCase() || currentName}
                expiry={expiry}
                designKey={design}
              />
            </View>

            {/* Name field */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CARD HOLDER NAME</Text>
              <TextInput
                style={[styles.input, nameError ? styles.inputError : null]}
                value={name}
                onChangeText={t => { setName(t.toUpperCase()); setNameError(''); }}
                autoCapitalize="characters"
                maxLength={26}
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </View>

            {/* Locked fields notice */}
            <View style={styles.lockedNotice}>
              <Feather name="lock" size={13} color="rgba(255,255,255,0.3)" />
              <Text style={styles.lockedText}>Card number, CVV and expiry cannot be changed</Text>
            </View>

            {/* Design picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CARD DESIGN</Text>
              <View style={styles.designGrid}>
                {CARD_DESIGNS.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => setDesign(d.key)}
                    activeOpacity={0.8}
                    style={[styles.designOption, design === d.key && styles.designOptionSelected]}
                  >
                    <CardPreview
                      cardNumber={cardNumber}
                      holderName={name.toUpperCase() || currentName}
                      expiry={expiry}
                      designKey={d.key}
                      compact
                    />
                    <View style={styles.designLabelRow}>
                      <Text style={[styles.designLabel, design === d.key && styles.designLabelActive]}>
                        {d.label}
                      </Text>
                      {design === d.key && <Feather name="check-circle" size={13} color="#FF3B3B" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Save CTA */}
            <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient colors={['#ff544e', '#8b201f']} style={styles.saveFullBtn}>
                <Text style={styles.saveFullBtnText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#101114' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1c1b1b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FF3B3B' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },
  previewWrap: { marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 10 },
  input: {
    backgroundColor: '#1c1b1b',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputError: { borderColor: '#FF3B3B' },
  errorText: { color: '#FF3B3B', fontSize: 12, fontWeight: '600', marginTop: 6 },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1c1b1b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  lockedText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  designGrid: { gap: 14 },
  designOption: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1b1b',
    padding: 12,
  },
  designOptionSelected: { borderColor: '#FF3B3B' },
  designLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 10 },
  designLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  designLabelActive: { color: '#FFF' },
  saveFullBtn: { paddingVertical: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  saveFullBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
