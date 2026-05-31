import React, { useState, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, StatusBar, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import Toast from '../components/Toast';
import { supabase } from '../services/supabaseClient';
import { haptics } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

function GlowingOrb({ color }: { color: string }) {
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[
      { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
      { backgroundColor: color, transform: [{ scale: pulse }] }
    ]} />
  );
}

export default function RecoverySettingsScreen({ navigation }: any) {
  const { isDarkMode, walletAddress } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(T, isDarkMode), [T, isDarkMode]);

  const [loading, setLoading] = useState(true);
  const [backupExists, setBackupExists] = useState(false);
  const [backupEmail, setBackupEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const loadBackupStatus = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const cleanAddress = walletAddress.trim().toLowerCase();
      const { data, error } = await supabase
        .from('backup_records')
        .select('*')
        .eq('wallet_address', cleanAddress)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBackupExists(true);
        setBackupEmail(data.email);
        setCreatedAt(new Date(data.created_at).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
      } else {
        setBackupExists(false);
      }
    } catch (e: any) {
      console.warn('[RecoverySettings] Failed to load status:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadBackupStatus();
    });
    return unsubscribe;
  }, [navigation, walletAddress]);

  const handleDeleteBackup = () => {
    haptics.heavy();
    Alert.alert(
      'Delete Cloud Backup',
      'Are you absolutely sure you want to delete your cloud backup? This will permanently remove your encrypted keys from Supabase storage. If you lose your device and do not have your recovery phrase written down, your funds will be lost forever.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Backup',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const cleanAddress = walletAddress.trim().toLowerCase();
              
              // 1. Remove storage file
              const storagePath = `${cleanAddress}/backup.json`;
              await supabase.storage
                .from('wallet-backups')
                .remove([storagePath]);

              // 2. Remove database record
              const { error } = await supabase
                .from('backup_records')
                .delete()
                .eq('wallet_address', cleanAddress);

              if (error) throw error;

              haptics.success();
              showToast('Cloud backup deleted successfully.', 'success');
              setBackupExists(false);
              setBackupEmail('');
              setCreatedAt('');
            } catch (e: any) {
              showToast(e.message || 'Failed to delete cloud backup.', 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color={T.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURITY VAULT</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {backupExists ? (
            <View style={{ gap: 20 }}>
              {/* Active State Illustration */}
              <View style={styles.vaultIllustrationContainer}>
                <GlowingOrb color={T.success + '30'} />
                <LinearGradient
                  colors={[T.success, '#059669']}
                  style={styles.glowingIconCircle}
                >
                  <Ionicons name="shield-checkmark" size={44} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Status Header Panel */}
              <View style={styles.statusPanel}>
                <View style={[styles.badgeContainer, { backgroundColor: T.success + '15', borderColor: T.success + '30' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: T.success }]} />
                  <Text style={[styles.badgeText, { color: T.success }]}>SHIELD ACTIVE</Text>
                </View>
                <Text style={styles.vaultTitle}>Cloud Backup Synced</Text>
                <Text style={styles.vaultDesc}>
                  Your recovery keys are securely backed up in a dual-key cryptographic vault on the cloud ledger.
                </Text>
              </View>

              {/* Protection Score Meter */}
              <View style={styles.scoreCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.scoreLabel}>Wallet Protection Index</Text>
                  <Text style={[styles.scoreValue, { color: T.success }]}>100 / 100</Text>
                </View>
                <View style={styles.gaugeBg}>
                  <LinearGradient
                    colors={[T.success, '#81C784']}
                    style={[styles.gaugeFill, { width: '100%' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
                <Text style={styles.scoreSub}>Your cloud backup is fully operational and encrypted under AES-256 standard.</Text>
              </View>

              {/* Metadata Details Grid */}
              <Text style={styles.actionSectionTitle}>Metadata Details</Text>
              <View style={styles.vaultStatsGrid}>
                <View style={styles.vaultStatRow}>
                  <View style={styles.statLeft}>
                    <Feather name="mail" size={14} color={T.textDim} />
                    <Text style={styles.vaultStatLabel}>Recovery Gateway</Text>
                  </View>
                  <Text style={styles.vaultStatValue}>{backupEmail}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.vaultStatRow}>
                  <View style={styles.statLeft}>
                    <Feather name="clock" size={14} color={T.textDim} />
                    <Text style={styles.vaultStatLabel}>Last Vault Sync</Text>
                  </View>
                  <Text style={styles.vaultStatValue}>{createdAt}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.vaultStatRow}>
                  <View style={styles.statLeft}>
                    <Feather name="lock" size={14} color={T.textDim} />
                    <Text style={styles.vaultStatLabel}>Encryption Standard</Text>
                  </View>
                  <Text style={[styles.vaultStatValue, { color: T.success }]}>AES-256-GCM</Text>
                </View>
              </View>

              {/* Actions Section */}
              <Text style={styles.actionSectionTitle}>Credentials & Keys</Text>
              <View style={styles.menuContainer}>
                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('CloudBackup')}
                >
                  <View style={styles.menuIconContainer}>
                    <LinearGradient
                      colors={isDarkMode ? ['#2A2B31', '#1C1D21'] : ['#F1F3F4', '#E8EAED']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Feather name="refresh-cw" size={16} color={T.primary} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Update Master Password</Text>
                    <Text style={styles.menuSub}>Re-encrypt and synchronize backup keys with a new password.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={T.textDim} />
                </TouchableOpacity>

                <View style={styles.statDivider} />

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={handleDeleteBackup}
                >
                  <View style={styles.menuIconContainer}>
                    <LinearGradient
                      colors={isDarkMode ? ['#2A2B31', '#1C1D21'] : ['#F1F3F4', '#E8EAED']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Feather name="trash-2" size={16} color={T.primary} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Deactivate Ledger Sync</Text>
                    <Text style={styles.menuSub}>Completely delete your seed phrase backup from cloud vault storage.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={T.textDim} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {/* Unprotected State Illustration */}
              <View style={styles.vaultIllustrationContainer}>
                <GlowingOrb color={T.primary + '30'} />
                <LinearGradient
                  colors={[T.primary, '#D32F2F']}
                  style={styles.glowingIconCircle}
                >
                  <Ionicons name="shield-outline" size={44} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Status Header Panel */}
              <View style={styles.statusPanel}>
                <View style={[styles.badgeContainer, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: T.primary }]} />
                  <Text style={[styles.badgeText, { color: T.primary }]}>VAULT VULNERABLE</Text>
                </View>
                <Text style={styles.vaultTitle}>Backup Required</Text>
                <Text style={styles.vaultDesc}>
                  You haven't backed up your keys yet. If you lose this device, your assets will be permanently lost. Protect them now.
                </Text>
              </View>

              {/* Protection Score Meter */}
              <View style={styles.scoreCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.scoreLabel}>Wallet Protection Index</Text>
                  <Text style={[styles.scoreValue, { color: T.primary }]}>35 / 100</Text>
                </View>
                <View style={styles.gaugeBg}>
                  <LinearGradient
                    colors={[T.primary, '#EF5350']}
                    style={[styles.gaugeFill, { width: '35%' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
                <Text style={styles.scoreSub}>Setting up cloud backup instantly boosts your protection index to 100/100.</Text>
              </View>

              {/* Value Propositions */}
              <Text style={styles.actionSectionTitle}>Why Cloud Backup?</Text>
              <View style={styles.featureGrid}>
                {[
                  {
                    icon: 'lock',
                    title: 'AES-256 Zero-Knowledge Sync',
                    desc: 'Your keys are encrypted locally BEFORE they touch the cloud. Only you hold the decryption password.',
                  },
                  {
                    icon: 'refresh-cw',
                    title: 'Instant Device Recovery',
                    desc: 'Restore your entire wallet in seconds on any new device using only your email and backup password.',
                  },
                  {
                    icon: 'shield',
                    title: 'Safe from Physical Damage',
                    desc: 'Protect against lost devices, hardware failure, fire, or accidental deletions with dynamic replication.',
                  },
                ].map((f, index) => (
                  <View key={index} style={styles.featureRow}>
                    <View style={[styles.featureIconBox, { backgroundColor: T.primary + '12' }]}>
                      <Feather name={f.icon as any} size={16} color={T.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>{f.title}</Text>
                      <Text style={styles.featureDesc}>{f.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.setupBtn}
                onPress={() => navigation.navigate('CloudBackup')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[T.primary, '#D32F2F']}
                  style={styles.setupBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Feather name="cloud" size={18} color="#FFF" />
                  <Text style={styles.setupBtnText}>ACTIVATE CLOUD BACKUP</Text>
                  <Feather name="arrow-right" size={16} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Fintech Vault Guardian Guide Card */}
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <View style={[styles.guideHeaderIconBox, { backgroundColor: T.primary + '15' }]}>
                <Ionicons name="bulb-outline" size={16} color={T.primary} />
              </View>
              <Text style={styles.guideTitle}>VAULT GUARDIAN GUIDE</Text>
            </View>
            <View style={styles.guideList}>
              {[
                {
                  title: 'Write Down Your Seed Phrase',
                  desc: 'Even with a cloud backup, always write down your 12-word seed phrase on paper and store it in an extremely safe, fireproof location.',
                },
                {
                  title: 'Never Share Credentials',
                  desc: 'Our staff will NEVER ask for your backup password or seed phrase. Keep them private and never enter them on third-party links.',
                },
                {
                  title: 'Double-Check Your Master Password',
                  desc: 'If you forget your master backup password, there is absolutely NO way to recover it. Store it safely in a trusted password manager.',
                },
              ].map((item, i) => (
                <View key={i} style={styles.guideItem}>
                  <View style={styles.guideItemIcon}>
                    <Text style={{ color: T.primary, fontSize: 10, fontFamily: Fonts.extraBold }}>0{i + 1}</Text>
                  </View>
                  <View style={styles.guideItemTextContainer}>
                    <Text style={styles.guideItemTitle}>{item.title}</Text>
                    <Text style={styles.guideItemDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (T: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: T.background,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center'
  },
  headerTitle: {
    color: T.text, fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 2
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  vaultIllustrationContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 24, marginBottom: 24 },
  glowingIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },

  statusPanel: { alignItems: 'center', paddingHorizontal: 16 },
  badgeContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    gap: 6, marginBottom: 16
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1 },
  vaultTitle: { fontSize: 24, fontFamily: Fonts.extraBold, color: T.text, textAlign: 'center', marginBottom: 8 },
  vaultDesc: {
    fontSize: 13, fontFamily: Fonts.medium, color: T.textDim,
    textAlign: 'center', lineHeight: 18, paddingHorizontal: 12
  },

  scoreCard: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 24, padding: 20, marginTop: 24
  },
  scoreLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: T.textMuted },
  scoreValue: { fontSize: 16, fontFamily: Fonts.extraBold },
  gaugeBg: { height: 6, backgroundColor: T.surfaceLow, borderRadius: 3, marginTop: 12, marginBottom: 12, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 3 },
  scoreSub: { fontSize: 11, fontFamily: Fonts.medium, color: T.textDim, lineHeight: 16 },

  actionSectionTitle: {
    fontSize: 11, fontFamily: Fonts.extraBold, color: T.textDim,
    letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 32,
    marginBottom: 12, marginLeft: 4
  },

  vaultStatsGrid: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8
  },
  vaultStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14
  },
  statLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vaultStatLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: T.textMuted },
  vaultStatValue: { fontSize: 13, fontFamily: Fonts.bold, color: T.text },
  statDivider: { height: 1, backgroundColor: T.border },

  menuContainer: {
    backgroundColor: T.surface, borderRadius: 24, borderWidth: 1,
    borderColor: T.border, overflow: 'hidden'
  },
  menuRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18
  },
  menuIconContainer: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', position: 'relative'
  },
  menuTextContainer: { flex: 1, marginLeft: 14, marginRight: 8 },
  menuTitle: { fontSize: 15, fontFamily: Fonts.bold, color: T.text },
  menuSub: { fontSize: 12, fontFamily: Fonts.medium, color: T.textDim, marginTop: 2 },

  featureGrid: { gap: 14 },
  featureRow: {
    flexDirection: 'row', gap: 14, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, borderRadius: 20, padding: 16
  },
  featureIconBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', alignSelf: 'flex-start'
  },
  featureTitle: { fontSize: 14, fontFamily: Fonts.bold, color: T.text },
  featureDesc: { fontSize: 12, fontFamily: Fonts.medium, color: T.textDim, marginTop: 4, lineHeight: 16 },

  setupBtn: { height: 64, borderRadius: 32, overflow: 'hidden', marginTop: 16 },
  setupBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  setupBtnText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.extraBold, letterSpacing: 1 },

  guideCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: T.border, marginTop: 32
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  guideHeaderIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { color: T.text, fontSize: 12, fontFamily: Fonts.extraBold, letterSpacing: 1 },
  guideList: { gap: 16 },
  guideItem: { flexDirection: 'row', gap: 12 },
  guideItemIcon: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: T.surfaceLow,
    alignItems: 'center', justifyContent: 'center', marginTop: 1
  },
  guideItemTextContainer: { flex: 1 },
  guideItemTitle: { fontSize: 13, fontFamily: Fonts.bold, color: T.text },
  guideItemDesc: { fontSize: 12, fontFamily: Fonts.medium, color: T.textDim, marginTop: 2, lineHeight: 16 },
});

