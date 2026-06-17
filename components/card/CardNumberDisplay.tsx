import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  AppState, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { haptics } from '../../utils/haptics';

let preventScreenCapture: (() => void) | null = null;
let allowScreenCapture: (() => void) | null = null;
try {
  const sc = require('expo-screen-capture');
  preventScreenCapture = sc.preventScreenCaptureAsync ?? sc.preventScreenCapture ?? null;
  allowScreenCapture   = sc.allowScreenCaptureAsync   ?? sc.allowScreenCapture   ?? null;
} catch {}

interface Props {
  cardNumber: string;
  expiry:     string;
  cvv:        string;
  holderName: string;
  textColor:  string;
  accentColor: string;
  mutedColor:  string;
  widgetMode?: boolean;
  widgetBg?:   string;
  widgetBorder?: string;
}

function normalizeNumber(raw: any): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\s/g, '').replace(/\D/g, '');
  if (digits.length !== 16) return String(raw);
  return `${digits.slice(0,4)} ${digits.slice(4,8)} ${digits.slice(8,12)} ${digits.slice(12,16)}`;
}

function maskNumber(normalized: string): string {
  if (!normalized || normalized.includes('•')) return '•••• •••• •••• ••••';
  const clean = normalized.replace(/\s/g, '');
  if (clean.length < 4) return '•••• •••• •••• ••••';
  const last4 = clean.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function hasFullNumber(raw: any): boolean {
  if (!raw) return false;
  return String(raw).replace(/\s/g, '').replace(/\D/g, '').length === 16;
}

export function CardCredentialsWidget({
  cardNumber, expiry, cvv, holderName,
  textColor, accentColor, mutedColor,
  widgetBg = '#1c1b1b', widgetBorder = '#2a2a2a',
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [loading,  setLoading]  = useState(false);

  // Source of truth: props from WalletContext (decrypted from Supabase)
  const realNumber = normalizeNumber(cardNumber);
  const realCvv    = cvv ? String(cvv).trim() : '';
  const realExpiry = expiry ? String(expiry).trim() : '';

  // Auto-mask on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') setRevealed(false);
    });
    return () => sub.remove();
  }, []);

  // Auto-mask after 30s
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (revealed) timerRef.current = setTimeout(() => setRevealed(false), 30000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revealed]);

  useEffect(() => {
    if (revealed) { try { preventScreenCapture?.(); } catch {} }
    else          { try { allowScreenCapture?.();   } catch {} }
  }, [revealed]);

  const handleToggle = useCallback(() => {
    if (loading) return;
    
    // Check if we actually have real data to reveal (not just bullets)
    if (!hasFullNumber(realNumber) || realCvv.includes('•') || realExpiry.includes('•')) {
      haptics.error();
      // Use standard alert to inform user that credentials need to be fetched
      // since the context currently holds the fallback masked version.
      Alert.alert('Unavailable', 'Secure credentials unavailable. Please pull down to refresh the card data.');
      return;
    }

    haptics.selection();
    if (!revealed) {
      setLoading(true);
      setTimeout(() => { setLoading(false); setRevealed(true); }, 300);
    } else {
      setRevealed(false);
    }
  }, [loading, revealed, realNumber, realCvv, realExpiry]);

  const displayNumber = revealed && realNumber ? realNumber : maskNumber(realNumber);
  const displayCvv    = revealed && realCvv    ? realCvv    : '•••';
  const displayExpiry = revealed && realExpiry ? realExpiry : '••/••';

  return (
    <View style={[w.container, { backgroundColor: widgetBg, borderColor: widgetBorder }]}>
      {/* Header */}
      <View style={w.header}>
        <View style={w.titleRow}>
          <View style={[w.iconBadge, { backgroundColor: accentColor + '15' }]}>
            <Feather name="shield" size={13} color={accentColor} />
          </View>
          <Text style={[w.title, { color: mutedColor }]} allowFontScaling={false}>
            CARD CREDENTIALS
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleToggle}
          style={[w.revealBtn, { backgroundColor: accentColor + '15' }]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {loading
            ? <ActivityIndicator size="small" color={accentColor} />
            : <Feather name={revealed ? 'eye' : 'eye-off'} size={14} color={accentColor} />
          }
          <Text style={[w.revealText, { color: accentColor }]} allowFontScaling={false}>
            {revealed ? 'Hide' : 'Reveal'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card Number */}
      <View style={w.section}>
        <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>CARD NUMBER</Text>
        <Text
          style={[w.numberText, { color: textColor, fontFamily: 'Inter_700Bold' }]}
          allowFontScaling={false}
        >
          {displayNumber}
        </Text>
      </View>

      <View style={[w.divider, { backgroundColor: widgetBorder }]} />

      {/* Expiry + CVV + Holder */}
      <View style={w.bottomRow}>
        <View style={w.bottomItem}>
          <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>EXPIRES</Text>
          <Text style={[w.bottomValue, { color: textColor }]} allowFontScaling={false}>
            {displayExpiry}
          </Text>
        </View>
        <View style={[w.bottomDivider, { backgroundColor: widgetBorder }]} />
        <View style={w.bottomItem}>
          <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>CVV</Text>
          <Text style={[w.bottomValue, { color: textColor }]} allowFontScaling={false}>
            {displayCvv}
          </Text>
        </View>
        <View style={[w.bottomDivider, { backgroundColor: widgetBorder }]} />
        <View style={w.bottomItem}>
          <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>HOLDER</Text>
          <Text
            style={[w.bottomValue, { color: textColor, fontSize: 11 }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {holderName.toUpperCase()}
          </Text>
        </View>
      </View>

      {revealed && (
        <View style={[w.notice, { backgroundColor: accentColor + '10' }]}>
          <Feather name="clock" size={10} color={accentColor} />
          <Text style={[w.noticeText, { color: accentColor }]} allowFontScaling={false}>
            Auto-hides in 30s
          </Text>
        </View>
      )}
    </View>
  );
}

const w = StyleSheet.create({
  container:    { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 20 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge:    { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  revealBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  revealText:   { fontSize: 12, fontWeight: '700' },
  section:      { marginBottom: 16 },
  label:        { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  numberText:   { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  divider:      { height: 1, marginBottom: 16 },
  bottomRow:    { flexDirection: 'row', alignItems: 'center' },
  bottomItem:   { flex: 1 },
  bottomDivider:{ width: 1, height: 32, marginHorizontal: 12 },
  bottomValue:  { fontSize: 15, fontWeight: '700' },
  notice:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  noticeText:   { fontSize: 10, fontWeight: '600' },
});

// Inline card face number (used on card gradient)
export function CardFaceNumber({
  cardNumber, revealed, color,
}: { cardNumber: string; revealed: boolean; color: string }) {
  const normalized = normalizeNumber(cardNumber);
  const groups = normalized ? normalized.split(' ') : ['••••', '••••', '••••', '••••'];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {groups.map((grp, i) => (
        <React.Fragment key={i}>
          <Text
            style={{ fontFamily: 'Inter_700Bold', fontSize: 18, fontWeight: '700', color }}
            allowFontScaling={false}
          >
            {revealed ? grp : '••••'}
          </Text>
          {i < 3 && (
            <Text style={{ color, fontSize: 18, marginHorizontal: 4 }} allowFontScaling={false}> </Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}
