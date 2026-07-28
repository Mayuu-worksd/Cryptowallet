import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { DiscoveredAsset } from '../services/assetDiscoveryService';
import Toast from '../components/Toast';

export default function RecoveryCenterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    isDarkMode,
    network,
    switchNetwork,
    recoverableAssets,
    isScanningRecovery,
    triggerRecoveryScan,
    importRecoveredAsset,
    ignoreRecoveredAsset,
    recoverAsset
  } = useWallet();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts' | 'wrongNetwork' | 'spam' | 'unsupported'>('tokens');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<DiscoveredAsset | null>(null);
  const [recoveryAddress, setRecoveryAddress] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  // ── Classify Assets ──
  const classified = useMemo(() => {
    const tokens: DiscoveredAsset[] = [];
    const nfts: DiscoveredAsset[] = [];
    const wrongNetwork: DiscoveredAsset[] = [];
    const spam: DiscoveredAsset[] = [];
    const unsupported: DiscoveredAsset[] = [];

    recoverableAssets.forEach((asset: DiscoveredAsset) => {
      // Spam classification
      if (asset.verificationStatus === 'danger') {
        spam.push(asset);
        return;
      }
      
      // Wrong network
      if (asset.network !== network) {
        wrongNetwork.push(asset);
        return;
      }

      // NFTs vs Tokens
      if (asset.type === 'erc721' || asset.type === 'erc1155') {
        nfts.push(asset);
      } else if (asset.type === 'erc20') {
        tokens.push(asset);
      } else {
        unsupported.push(asset);
      }
    });

    return { tokens, nfts, wrongNetwork, spam, unsupported };
  }, [recoverableAssets, network]);

  // ── Health Score Calculation ──
  const healthScore = useMemo(() => {
    const totalIssues = classified.wrongNetwork.length + classified.spam.length * 2 + classified.unsupported.length;
    if (totalIssues === 0) return 100;
    return Math.max(20, 100 - totalIssues * 15);
  }, [classified]);

  const handleImport = async (asset: DiscoveredAsset) => {
    try {
      await importRecoveredAsset(asset);
      showToast(`${asset.symbol} imported to home assets!`, 'success');
    } catch {
      showToast('Failed to import asset', 'error');
    }
  };

  const handleIgnore = async (asset: DiscoveredAsset) => {
    try {
      await ignoreRecoveredAsset(asset);
      showToast('Asset ignored.', 'info');
    } catch {
      showToast('Failed to ignore asset', 'error');
    }
  };

  const startRecovery = (asset: DiscoveredAsset) => {
    setSelectedAsset(asset);
    setRecoveryModalVisible(true);
  };

  const executeRecovery = async () => {
    if (!selectedAsset) return;
    if (!recoveryAddress.trim()) {
      showToast('Please enter a recovery destination address', 'error');
      return;
    }

    setRecoveryModalVisible(false);
    showToast(`Initiating recovery of ${selectedAsset.symbol}...`, 'info');
    
    try {
      const ok = await recoverAsset(selectedAsset, recoveryAddress.trim());
      if (ok) {
        showToast(`Successfully recovered ${selectedAsset.symbol}!`, 'success');
      } else {
        showToast('Recovery failed. Ensure you have gas.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Recovery transaction failed', 'error');
    }
  };

  const handleImportAll = async () => {
    const targetList = activeTab === 'tokens' ? classified.tokens : classified.nfts;
    if (targetList.length === 0) return;
    showToast(`Importing ${targetList.length} assets...`, 'info');
    for (const a of targetList) {
      await importRecoveredAsset(a);
    }
    showToast('All assets imported!', 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: T.text }]}>Recovery Center</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => triggerRecoveryScan()}>
          {isScanningRecovery ? <ActivityIndicator size="small" color={T.primary} /> : <Feather name="refresh-cw" size={20} color={T.text} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Dashboard */}
        <View style={[styles.dashboard, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.dashboardRow}>
            <View>
              <Text style={[styles.healthLabel, { color: T.textMuted }]}>Wallet Health Score</Text>
              <Text style={[styles.healthVal, { color: healthScore > 75 ? T.success : healthScore > 40 ? T.pending : T.error }]}>
                {healthScore}%
              </Text>
            </View>
            <View style={[styles.healthCircle, { borderColor: healthScore > 75 ? T.success : T.error }]}>
              <MaterialCommunityIcons name="shield-check" size={32} color={healthScore > 75 ? T.success : T.error} />
            </View>
          </View>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={[styles.metricNum, { color: T.text }]}>{recoverableAssets.length}</Text>
              <Text style={[styles.metricLabel, { color: T.textMuted }]}>Discovered</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricNum, { color: T.text }]}>{classified.wrongNetwork.length}</Text>
              <Text style={[styles.metricLabel, { color: T.textMuted }]}>Wrong Net</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricNum, { color: T.text }]}>{classified.spam.length}</Text>
              <Text style={[styles.metricLabel, { color: T.textMuted }]}>Spam</Text>
            </View>
          </View>
        </View>

        {/* Tab Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
          {[
            { id: 'tokens', label: `Tokens (${classified.tokens.length})` },
            { id: 'nfts', label: `NFTs (${classified.nfts.length})` },
            { id: 'wrongNetwork', label: `Wrong Net (${classified.wrongNetwork.length})` },
            { id: 'spam', label: `Spam (${classified.spam.length})` },
            { id: 'unsupported', label: `Unsupported (${classified.unsupported.length})` },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && { borderBottomColor: T.primary }]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab.id ? T.text : T.textMuted, fontFamily: activeTab === tab.id ? Fonts.bold : Fonts.medium }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Action Header */}
        {(activeTab === 'tokens' || activeTab === 'nfts') && (
          <View style={styles.bulkRow}>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: T.surface }]} onPress={handleImportAll}>
              <Text style={[styles.bulkBtnText, { color: T.primary }]}>Import All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Asset Cards */}
        {classified[activeTab].length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={48} color={T.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: T.textMuted }]}>No assets found in this category.</Text>
          </View>
        ) : (
          classified[activeTab].map((asset: DiscoveredAsset) => (
            <View key={asset.id} style={[styles.assetCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              {/* Asset Badge / Info */}
              <View style={styles.assetHeader}>
                <View style={[styles.iconPlaceholder, { backgroundColor: T.primary + '18' }]}>
                  <Text style={[styles.iconPlaceholderText, { color: T.primary }]}>{asset.symbol.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.assetSym, { color: T.text }]}>{asset.symbol}</Text>
                  <Text style={[styles.assetNet, { color: T.textMuted }]}>{asset.network} • {asset.type.toUpperCase()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.assetBal, { color: T.text }]}>{asset.balance.toFixed(4)}</Text>
                </View>
              </View>

              {/* Warning Banner for Spam */}
              {asset.verificationStatus === 'danger' && (
                <View style={[styles.warningBanner, { backgroundColor: T.error + '12', borderColor: T.error }]}>
                  <Feather name="alert-triangle" size={16} color={T.error} />
                  <Text style={[styles.warningText, { color: T.error }]}>{asset.warningMessage || 'Spam Token detected'}</Text>
                </View>
              )}

              {/* Recovery Actions */}
              <View style={styles.cardActions}>
                {activeTab === 'wrongNetwork' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: T.primary }]}
                    onPress={async () => {
                      showToast(`Switching network to ${asset.network}...`, 'info');
                      await switchNetwork(asset.network);
                    }}
                  >
                    <Text style={styles.actionBtnText}>Switch Network</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: T.surfaceLow, borderWidth: 1, borderColor: T.border }]}
                      onPress={() => handleIgnore(asset)}
                    >
                      <Text style={[styles.actionBtnText, { color: T.text }]}>Ignore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: T.primary }]}
                      onPress={() => handleImport(asset)}
                    >
                      <Text style={styles.actionBtnText}>Import</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: T.success }]}
                      onPress={() => startRecovery(asset)}
                    >
                      <Text style={styles.actionBtnText}>Recover</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Recovery Modal */}
      <Modal visible={recoveryModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: T.background }]}>
            <Text style={[styles.modalTitle, { color: T.text }]}>Recover {selectedAsset?.symbol}</Text>
            <Text style={[styles.modalSub, { color: T.textMuted }]}>
              Enter the EVM destination address where you want to retrieve this asset.
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: T.surface, color: T.text, borderColor: T.border }]}
              placeholder="0x..."
              placeholderTextColor={T.textMuted}
              value={recoveryAddress}
              onChangeText={setRecoveryAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: T.surface }]}
                onPress={() => setRecoveryModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: T.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: T.primary }]}
                onPress={executeRecovery}
              >
                <Text style={styles.modalBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontFamily: Fonts.bold },
  scroll: { padding: 20 },
  dashboard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthLabel: { fontSize: 13, fontFamily: Fonts.medium },
  healthVal: { fontSize: 32, fontFamily: Fonts.bold, marginTop: 4 },
  healthCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  metric: { alignItems: 'center', flex: 1 },
  metricNum: { fontSize: 18, fontFamily: Fonts.bold },
  metricLabel: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 4 },
  tabContainer: {
    paddingBottom: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  tabText: { fontSize: 14 },
  bulkRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  bulkBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bulkBtnText: { fontSize: 13, fontFamily: Fonts.bold },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, fontFamily: Fonts.medium },
  assetCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderText: { fontSize: 16, fontFamily: Fonts.bold },
  assetSym: { fontSize: 16, fontFamily: Fonts.bold },
  assetNet: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  assetBal: { fontSize: 16, fontFamily: Fonts.bold },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },
  warningText: { fontSize: 12, fontFamily: Fonts.medium, flex: 1 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: { color: '#FFF', fontSize: 13, fontFamily: Fonts.bold },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    padding: 24,
    borderRadius: 24,
  },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 8 },
  modalSub: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 18, marginBottom: 20 },
  modalInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: Fonts.medium,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnText: { fontSize: 14, fontFamily: Fonts.bold },
});
