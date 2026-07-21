import React, { useState } from 'react';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { haptics } from '../utils/haptics';

export default function LandingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const isWeb = Platform.OS === 'web';
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);

  const handleCreateWallet = () => {
    haptics.selection();
    navigation.navigate('CreateWallet');
  };

  const handleOpenRestore = () => {
    haptics.selection();
    setRestoreModalVisible(true);
  };

  const handleSelectRestore = (route: 'ImportWallet' | 'RecoverWallet') => {
    haptics.selection();
    setRestoreModalVisible(false);
    navigation.navigate(route);
  };

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      {/* Restore Options Bottom Modal */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestoreModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}
          activeOpacity={1}
          onPress={() => setRestoreModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: T.surface, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: T.border }]} />
            <Text style={[styles.modalTitle, { color: T.text }]}>Restore Wallet</Text>
            <Text style={[styles.modalSub, { color: T.textMuted }]}>
              Choose how you would like to access your existing wallet
            </Text>

            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
              onPress={() => handleSelectRestore('ImportWallet')}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: T.primary + '18' }]}>
                <Feather name="key" size={20} color={T.primary} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: T.text }]}>Recovery Phrase</Text>
                <Text style={[styles.optionDesc, { color: T.textMuted }]}>Import using your 12 or 24-word seed phrase</Text>
              </View>
              <Feather name="chevron-right" size={20} color={T.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
              onPress={() => handleSelectRestore('RecoverWallet')}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconWrap, { backgroundColor: T.primary + '18' }]}>
                <Feather name="mail" size={20} color={T.primary} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: T.text }]}>Email Recovery</Text>
                <Text style={[styles.optionDesc, { color: T.textMuted }]}>Restore encrypted cloud backup via OTP</Text>
              </View>
              <Feather name="chevron-right" size={20} color={T.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setRestoreModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Main Minimalist Center Content */}
      <View style={styles.centerSection}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { color: T.text }]}>CryptoWallet</Text>
        <Text style={[styles.subtitle, { color: T.textMuted }]}>
          The non-custodial digital vault.
        </Text>
      </View>

      {/* Bottom Minimal Actions */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: T.text }]}
          onPress={handleCreateWallet}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: T.background }]}>
            Create a new wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: T.surface }]}
          onPress={handleOpenRestore}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: T.text }]}>
            I already have a wallet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 22,
  },
  title: {
    fontSize: 34,
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  modalSub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    width: '100%',
    gap: 14,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});



