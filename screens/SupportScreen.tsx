import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Linking,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';

const FAQ_ITEMS = [
  {
    q: 'How do I secure my wallet?',
    a: 'Your wallet is encrypted locally on your device. Never share your 12/24 word recovery phrase with anyone.',
  },
  {
    q: 'What are network fees?',
    a: "Also known as 'gas', this is a fee paid to validators to process your transaction on the blockchain.",
  },
  {
    q: 'How do I activate the Virtual Card?',
    a: 'Go to the Card tab and top up your card balance by converting crypto. You can then simulate payments.',
  },
  {
    q: 'Why is my balance showing 0?',
    a: 'Make sure you are on the correct network. Pull down to refresh your balance or switch networks in Settings.',
  },
  {
    q: 'How do I backup my wallet?',
    a: 'Go to Profile → View Seed Phrase. Write down all 12 words in order and store them somewhere safe offline.',
  },
];

export default function SupportScreen({ navigation }: any) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [expanded, setExpanded] = useState<number | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') =>
    setToast({ visible: true, message, type });

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.95)' : 'rgba(247,249,251,0.95)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>Support Center</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ marginBottom: 32, alignItems: 'center', marginTop: 20 }}>
          <View style={[styles.glowRing, { backgroundColor: T.primary + '20' }]}>
            <MaterialIcons name="headset-mic" size={48} color={T.primary} />
          </View>
          <Text style={[styles.title, { color: T.text }]}>How can we help?</Text>
          <Text style={[styles.subtitle, { color: T.textMuted }]}>
            Our team typically responds within 24 hours.
          </Text>
        </View>

        {/* Contact Cards */}
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('mailto:support@cryptowallet.app')}
          >
            <View style={[styles.contactIconBox, { backgroundColor: T.primary + '20' }]}>
              <MaterialIcons name="email" size={22} color={T.primary} />
            </View>
            <Text style={[styles.contactCardTitle, { color: T.text }]}>Email Us</Text>
            <Text style={[styles.contactCardSub, { color: T.textMuted }]}>support@cryptowallet.app</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
            activeOpacity={0.7}
            onPress={() => showToast('Live chat coming soon! Use email for now.', 'info')}
          >
            <View style={[styles.contactIconBox, { backgroundColor: T.success + '20' }]}>
              <MaterialIcons name="chat-bubble-outline" size={22} color={T.success} />
            </View>
            <Text style={[styles.contactCardTitle, { color: T.text }]}>Live Chat</Text>
            <Text style={[styles.contactCardSub, { color: T.textMuted }]}>Coming soon</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <View style={[styles.quickLinks, { backgroundColor: T.surface, borderColor: T.border }]}>
          <TouchableOpacity
            style={[styles.quickLinkRow, { borderBottomWidth: 1, borderBottomColor: T.border }]}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
          >
            <Feather name="list" size={18} color={T.primary} />
            <Text style={[styles.quickLinkText, { color: T.text }]}>View Transaction History</Text>
            <Feather name="chevron-right" size={18} color={T.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={18} color={T.primary} />
            <Text style={[styles.quickLinkText, { color: T.text }]}>Go to Settings</Text>
            <Feather name="chevron-right" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionTitle, { color: T.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>

        <View style={[styles.faqContainer, { backgroundColor: T.surface, borderColor: T.border }]}>
          {FAQ_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.faqItem,
                index < FAQ_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border },
              ]}
              onPress={() => setExpanded(expanded === index ? null : index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQ, { color: T.text, flex: 1 }]}>{item.q}</Text>
                <Feather
                  name={expanded === index ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={T.textMuted}
                />
              </View>
              {expanded === index && (
                <Text style={[styles.faqA, { color: T.textMuted }]}>{item.a}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 60, paddingBottom: 16,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  scroll: { paddingTop: 100, paddingHorizontal: 24, paddingBottom: 60 },

  glowRing: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },

  contactRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  contactCard: { flex: 1, padding: 20, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  contactIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  contactCardSub: { fontSize: 12 },

  quickLinks: { borderRadius: 16, borderWidth: 1, marginBottom: 32 },
  quickLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  quickLinkText: { flex: 1, fontSize: 15, fontWeight: '600' },

  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 16, marginLeft: 4 },
  faqContainer: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  faqItem: { padding: 20 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqQ: { fontSize: 15, fontWeight: '700', marginBottom: 0 },
  faqA: { fontSize: 13, lineHeight: 20, marginTop: 10 },
});
