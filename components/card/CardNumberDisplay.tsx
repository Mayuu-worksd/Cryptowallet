/**
 * CardNumberDisplay — Production fintech card number renderer
 *
 * Strategy (same as Revolut / RedotPay):
 *   - Split into 4 groups of 4 characters
 *   - Each group is ONE Text element with a fixed minWidth
 *   - No per-character splitting → no width calculation bugs
 *   - No letterSpacing → no overflow on any Android OEM
 *   - No adjustsFontSizeToFit → no shrink surprises
 *   - Inter_700Bold bundled font → identical on every device
 *   - AppState listener → auto-mask on background
 *   - usePreventScreenCapture → blocks screenshots while revealed
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, AppState, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { haptics } from '../../utils/haptics';

// Prevent screen capture only when revealed — lazy import so it never crashes
let preventScreenCapture: (() => void) | null = null;
let allowScreenCapture: (() => void) | null = null;
try {
  const sc = require('expo-screen-capture');
  preventScreenCapture = sc.preventScreenCaptureAsync ?? sc.preventScreenCapture ?? null;
  allowScreenCapture   = sc.allowScreenCaptureAsync   ?? sc.allowScreenCapture   ?? null;
} catch (_e) {}

interface Props {
  cardNumber: string;   // raw 16-digit string or formatted "1234 5678 9012 3456"
  expiry:     string;   // "MM/YY"
  cvv:        string;   // "123"
  holderName: string;
  textColor:  string;
  accentColor: string;
  mutedColor:  string;
  // standalone widget mode (used in CardScreen credentials panel)
  widgetMode?: boolean;
  widgetBg?:   string;
  widgetBorder?: string;
}

// Split raw digits into 4 groups of 4
function toGroups(raw: string): [string, string, string, string] {
  const d = raw.replace(/\D/g, '').padEnd(16, '0');
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12), d.slice(12, 16)];
}

// A single group — either 4 digits or 4 bullets
function Group({ value, revealed, color }: { value: string; revealed: boolean; color: string }) {
  const display = revealed ? value : '••••';
  return (
    <View style={g.wrap}>
      <Text style={[g.text, { color }]} allowFontScaling={false}>
        {display}
      </Text>
    </View>
  );
}

const g = StyleSheet.create({
  wrap: {
    width: 56,          // fixed — same on every screen density
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
    // NO letterSpacing — causes overflow on Android
    // NO adjustsFontSizeToFit — causes shrink on small screens
  },
});

// ─── Standalone Widget (used in CardScreen credentials panel) ─────────────────
export function CardCredentialsWidget({
  cardNumber, expiry, cvv, holderName,
  textColor, accentColor, mutedColor,
  widgetBg = '#1c1b1b', widgetBorder = '#2a2a2a',
}: Props) {
  const [revealed,    setRevealed]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-mask when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') setRevealed(false);
    });
    return () => sub.remove();
  }, []);

  // Auto-mask after 30 seconds
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (revealed) {
      timerRef.current = setTimeout(() => setRevealed(false), 30000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revealed]);

  // Screen capture prevention
  useEffect(() => {
    if (revealed) {
      try { preventScreenCapture?.(); } catch (_e) {}
    } else {
      try { allowScreenCapture?.(); } catch (_e) {}
    }
  }, [revealed]);

  // Fade animation on toggle
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: revealed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [revealed]);

  const handleToggle = useCallback(() => {
    if (loading) return;
    haptics.selection();
    if (!revealed) {
      setLoading(true);
      setTimeout(() => { setLoading(false); setRevealed(true); }, 500);
    } else {
      setRevealed(false);
    }
  }, [loading, revealed]);

  const groups = toGroups(cardNumber);
  const last4  = groups[3];

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
        <View style={w.numberRow}>
          {groups.map((grp, i) => (
            <React.Fragment key={i}>
              <Group value={grp} revealed={revealed} color={textColor} />
              {i < 3 && <View style={w.dot} />}
            </React.Fragment>
          ))}
          {revealed && (
            <TouchableOpacity
              style={w.copyBtn}
              onPress={() => {
                haptics.selection();
                // copy handled by parent via onCopy prop if needed
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="copy" size={14} color={accentColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={[w.divider, { backgroundColor: widgetBorder }]} />

      {/* Expiry + CVV */}
      <View style={w.bottomRow}>
        <View style={w.bottomItem}>
          <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>EXPIRES</Text>
          <Text style={[w.bottomValue, { color: textColor }]} allowFontScaling={false}>
            {revealed ? expiry : '••/••'}
          </Text>
        </View>
        <View style={[w.bottomDivider, { backgroundColor: widgetBorder }]} />
        <View style={w.bottomItem}>
          <Text style={[w.label, { color: mutedColor }]} allowFontScaling={false}>CVV</Text>
          <Text style={[w.bottomValue, { color: textColor }]} allowFontScaling={false}>
            {revealed ? cvv : '•••'}
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

      {/* Auto-hide notice */}
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
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  revealBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
  },
  revealText: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  section: { marginBottom: 16 },
  label: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: 10 },

  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  dot: {
    width: 8,
    alignItems: 'center',
  },
  copyBtn: { marginLeft: 12 },

  divider: { height: 1, marginBottom: 16 },

  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  bottomItem: { flex: 1 },
  bottomDivider: { width: 1, height: 32, marginHorizontal: 12 },
  bottomValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    includeFontPadding: false,
  },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 14, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  noticeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Inline card face number (used inside card gradient) ──────────────────────
export function CardFaceNumber({
  cardNumber, revealed, color,
}: { cardNumber: string; revealed: boolean; color: string }) {
  const groups = toGroups(cardNumber);
  return (
    <View style={f.row}>
      {groups.map((grp, i) => (
        <React.Fragment key={i}>
          <Group value={grp} revealed={revealed} color={color} />
          {i < 3 && <Text style={[f.sep, { color }]} allowFontScaling={false}> </Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

const f = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  sep: { fontFamily: 'Inter_700Bold', fontSize: 20, width: 8 },
});
