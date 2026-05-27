import React from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, Alert, Image } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function LandingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const isWeb = Platform.OS === 'web';
  if (isWeb) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: T.background }]}>
        {/* Navbar */}
        <View style={styles.webNav}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={require('../assets/logo.png')} style={{ width: 36, height: 36, borderRadius: 8 }} resizeMode="contain" />
            <Text style={[styles.headerTitle, { color: T.primary, fontSize: 24 }]}>CryptoWallet</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.webNavLinks}>
            <TouchableOpacity onPress={() => Alert.alert('Feature coming soon!')} activeOpacity={0.7}>
              <Text style={[styles.webNavLink, { color: T.textMuted }]}>Wealth Management</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Feature coming soon!')} activeOpacity={0.7}>
              <Text style={[styles.webNavLink, { color: T.textMuted }]}>Security Ledger</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Feature coming soon!')} activeOpacity={0.7}>
              <Text style={[styles.webNavLink, { color: T.textMuted }]}>Governance</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.webNavBtn, { backgroundColor: T.primary }]}
              onPress={() => navigation.navigate('CreateWallet')}
            >
              <Text style={styles.webNavBtnText}>Initialize Vault</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section Ported from Stitch */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <View style={webLandingStyles.securityPill}>
               <Feather name="shield" size={14} color={T.primary} />
               <Text style={[webLandingStyles.securityPillText, { color: T.primary }]}>NON-CUSTODIAL Â· OPEN SOURCE</Text>
            </View>
            <Text style={[styles.heroTitle, { color: T.text, fontSize: 80, lineHeight: 88 }]}>
              The Future of{'\n'}
              <Text style={{ color: T.primary }}>Wealth Security</Text>
            </Text>
            <Text style={[styles.heroSub, { color: T.textMuted, fontSize: 22, maxWidth: 700 }]}>
              CryptoWallet provides professional digital asset custody with multi-signature security and real-time market access.
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.primary, width: 280 }]}
                onPress={() => navigation.navigate('CreateWallet')}
              >
                <Text style={styles.primaryBtnText}>Open Personal Vault</Text>
                <Feather name="arrow-right" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: T.border, width: 200 }]}
                onPress={() => navigation.navigate('ImportWallet')}
              >
                <Text style={[styles.secondaryBtnText, { color: T.text }]}>Mnemonic Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: T.border, width: 200 }]}
                onPress={() => navigation.navigate('RecoverWallet')}
              >
                <Text style={[styles.secondaryBtnText, { color: T.text }]}>Email Recovery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Core Value Props */}
        <View style={webLandingStyles.valueProps}>
           <Text style={[webLandingStyles.sectionLabel, { color: T.primary }]}>SYSTEM CAPABILITIES</Text>
           <Text style={[webLandingStyles.sectionTitle, { color: T.text }]}>Professional Grade Infrastructure</Text>
           
           <View style={styles.featuresGrid}>
              {[
                { title: 'Obsidian Ledger', desc: 'Immutable audit logs and transparent reporting for regulatory compliance.', icon: 'database' },
                { title: 'Vault Cold Storage', desc: 'Secure air-gapped custody with multi-party computation protocol.', icon: 'hard-drive' },
                { title: 'Fiat Rails', desc: 'Seamlessly move between global fiat currencies and digital assets.', icon: 'refresh-cw' },
                { title: 'Priority Support', desc: '24/7 dedicated relationship managers for large-scale operations.', icon: 'headphones' },
              ].map((f, i) => (
                <View key={i} style={[styles.featureCard, { backgroundColor: T.surface, borderColor: T.border + '20' }]}>
                   <View style={[styles.featureIconWrap, { backgroundColor: T.primary + '15' }]}>
                     <Feather name={f.icon as any} size={24} color={T.primary} />
                   </View>
                   <Text style={[styles.featureTitle, { color: T.text }]}>{f.title}</Text>
                   <Text style={[styles.featureDesc, { color: T.textMuted }]}>{f.desc}</Text>
                </View>
              ))}
           </View>
        </View>

        {/* Global Security Section */}
        <View style={webLandingStyles.securityStrip}>
           <LinearGradient colors={['#101114', '#1C1D21']} style={webLandingStyles.securityInner}>
              <View style={webLandingStyles.securityText}>
                 <Text style={webLandingStyles.securityTitle}>Multi-Layer Global Security</Text>
                 <Text style={webLandingStyles.securityDesc}>
                    Your assets are protected by OS-level encryption and non-custodial key storage. Only you hold your private keys â€” no third party can access your funds.
                 </Text>
              </View>
              <View style={webLandingStyles.securityStats}>
                 <View style={webLandingStyles.statBox}>
                    <Text style={webLandingStyles.statVal}>100%</Text>
                    <Text style={webLandingStyles.statLab}>Non-Custodial</Text>
                 </View>
                 <View style={webLandingStyles.statBox}>
                    <Text style={webLandingStyles.statVal}>0</Text>
                    <Text style={webLandingStyles.statLab}>Data Collected</Text>
                 </View>
              </View>
           </LinearGradient>
        </View>

        {/* Footer */}
        <View style={[styles.webFooter, { borderTopColor: T.border + '20' }]}>
          <Text style={[styles.webFooterText, { color: T.textMuted }]}>Â© 2025 CryptoWallet. Self-custody wallet. Not a financial service.</Text>
          <View style={styles.webFooterLinks}>
            <Text style={[styles.webFooterLink, { color: T.textMuted }]}>Institutions</Text>
            <Text style={[styles.webFooterLink, { color: T.textMuted }]}>Privacy</Text>
            <Text style={[styles.webFooterLink, { color: T.textMuted }]}>Transparency Report</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Mobile version
  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <View pointerEvents="none" style={[styles.glowLeft,  { backgroundColor: T.primaryDark + '15' }]} />
      <View pointerEvents="none" style={[styles.glowRight, { backgroundColor: T.primary + '15' }]} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../assets/logo.png')} style={{ width: 28, height: 28, borderRadius: 6 }} resizeMode="contain" />
          <Text style={[styles.headerTitle, { color: T.primary }]}>CryptoWallet</Text>
        </View>
        <View style={[styles.langBadge, { backgroundColor: T.surface, borderColor: T.border }]}>
          <MaterialIcons name="language" size={16} color={T.primary} />
          <Text style={[styles.langText, { color: T.textMuted }]}>EN</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.graphicContainer}>
          <Image source={require('../assets/logo.png')} style={{ width: 140, height: 140, borderRadius: 36 }} resizeMode="contain" />
        </View>

        <Text style={[styles.title, { color: T.text }]}>Your Crypto,{'\n'}Your Control</Text>
        <Text style={[styles.subtitle, { color: T.textMuted }]}>
          A non-custodial wallet â€” only you hold your keys. No bank, no middleman.
        </Text>

        <View style={styles.pillRow}>
          {['CryptoWallet', 'Non-Custodial', 'Global'].map(f => (
            <View key={f} style={[styles.pill, { backgroundColor: T.surface, borderColor: T.border }]}>
              <Text style={[styles.pillText, { color: T.textMuted }]}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.getStartedBtn, { backgroundColor: T.primary }]}
            onPress={() => navigation.navigate('CreateWallet')}
          >
            <Text style={styles.getStartedText}>Create Wallet</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </TouchableOpacity>
          <Text style={[styles.btnHint, { color: T.textMuted }]}>New to crypto? Start here</Text>
          <TouchableOpacity
            style={[styles.restoreBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => navigation.navigate('ImportWallet')}
          >
            <Text style={[styles.restoreText, { color: T.text }]}>Import Existing Wallet</Text>
          </TouchableOpacity>
          <Text style={[styles.btnHint, { color: T.textMuted }]}>Already have a wallet? Restore it here</Text>

          <TouchableOpacity
            style={[styles.restoreBtn, { backgroundColor: T.surface, borderColor: T.border }]}
            onPress={() => navigation.navigate('RecoverWallet')}
          >
            <Text style={[styles.restoreText, { color: T.text }]}>Recover Using Email</Text>
          </TouchableOpacity>
          <Text style={[styles.btnHint, { color: T.textMuted }]}>Recover encrypted cloud backup via OTP</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: T.textMuted }]}>
          SECURE â€¢ MODERN â€¢ TRANSPARENT
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowLeft:  { position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.4 },
  glowRight: { position: 'absolute', bottom: -100, right: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.4 },

  webNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 60, paddingVertical: 32 },
  webNavLinks: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  webNavLink: { fontSize: 16, fontWeight: '600', cursor: 'pointer' as any },
  webNavBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  webNavBtnText: { color: '#FFF', fontFamily: Fonts.extraBold, fontSize: 15 },

  heroSection: { flexDirection: 'row', paddingHorizontal: 60, paddingVertical: 120, alignItems: 'center', minHeight: 700 },
  heroContent: { flex: 1, paddingRight: 40 },
  heroTitle: { fontSize: 80, fontFamily: Fonts.extraBold, letterSpacing: -2, lineHeight: 88, marginBottom: 24 },
  heroSub: { fontSize: 22, lineHeight: 36, marginBottom: 48, maxWidth: 800 },
  heroActions: { flexDirection: 'row', gap: 20 },
  primaryBtn: { height: 72, paddingHorizontal: 32, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 18, fontFamily: Fonts.extraBold },
  secondaryBtn: { height: 72, paddingHorizontal: 32, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 17, fontFamily: Fonts.bold },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 40 },
  featureCard: { flex: 1, minWidth: 280, padding: 40, borderRadius: 40, borderWidth: 1 },
  featureIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  featureTitle: { fontSize: 24, fontFamily: Fonts.extraBold, marginBottom: 16 },
  featureDesc: { fontSize: 16, lineHeight: 26 },

  webFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 60, paddingVertical: 60, borderTopWidth: 1 },
  webFooterText: { fontSize: 15, fontFamily: Fonts.semiBold },
  webFooterLinks: { flexDirection: 'row', gap: 48 },
  webFooterLink: { fontSize: 15, fontFamily: Fonts.bold },

  header: { position: 'absolute', top: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, zIndex: 10 },
  headerTitle: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: -1 },
  langBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  langText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1 },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, zIndex: 5 },
  graphicContainer: { width: 180, height: 180, marginBottom: 40, justifyContent: 'center', alignItems: 'center' },
  graphicCore: { width: 140, height: 140, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3B3B', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 12 },
  floatingIcon: { position: 'absolute', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  title: { fontSize: 32, fontFamily: Fonts.extraBold, textAlign: 'center', marginBottom: 16, letterSpacing: -1, lineHeight: 40 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 24, paddingHorizontal: 8 },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 48 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  pillText: { fontSize: 12, fontFamily: Fonts.extraBold },

  actions: { width: '100%', maxWidth: 340, gap: 16 },
  btnHint: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center', marginTop: -8, marginBottom: 4 },
  getStartedBtn: { height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#FF3B3B', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 },
  getStartedText: { color: '#FFF', fontSize: 17, fontFamily: Fonts.extraBold },
  restoreBtn: { height: 60, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontSize: 16, fontFamily: Fonts.bold },

  footer: { position: 'absolute', bottom: 32, width: '100%', alignItems: 'center' },
  footerText: { fontSize: 11, fontFamily: Fonts.extraBold, letterSpacing: 2, textAlign: 'center', opacity: 0.5 },
});

const webLandingStyles = StyleSheet.create({
  securityPill: { 
     flexDirection: 'row', 
     alignItems: 'center', 
     gap: 10, 
     backgroundColor: 'rgba(255,59,59,0.1)', 
     paddingHorizontal: 16, 
     paddingVertical: 10, 
     borderRadius: 30, 
     marginBottom: 32,
     alignSelf: 'flex-start'
  },
  securityPillText: { fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 1.5 },
  valueProps: { paddingHorizontal: 60, paddingVertical: 100 },
  sectionLabel: { fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 3, marginBottom: 20 },
  sectionTitle: { fontSize: 48, fontFamily: Fonts.extraBold, letterSpacing: -1.5, marginBottom: 40 },
  securityStrip: { paddingHorizontal: 60, paddingVertical: 100 },
  securityInner: { borderRadius: 48, padding: 80, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  securityText: { flex: 1.5, paddingRight: 80 },
  securityTitle: { color: '#FFF', fontSize: 42, fontFamily: Fonts.extraBold, marginBottom: 24 },
  securityDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 30 },
  securityStats: { flex: 1, flexDirection: 'row', gap: 60 },
  statBox: { gap: 8 },
  statVal: { color: '#FFF', fontSize: 48, fontFamily: Fonts.extraBold },
  statLab: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 1 },
});



