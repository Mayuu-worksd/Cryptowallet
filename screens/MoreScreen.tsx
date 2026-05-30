import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Theme, Fonts } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { haptics } from '../utils/haptics';

const SERVICES = [
  {
    category: 'Finance',
    items: [
      { id: 'Earn', label: 'Earn Yield', icon: 'trending-up', route: 'Earn', color: '#10B981' },
      { id: 'Credit', label: 'Crypto Loan', icon: 'dollar-sign', route: 'Credit', color: '#3B82F6' },
      { id: 'Card', label: 'Virtual Card', icon: 'credit-card', route: 'Card', color: '#8B5CF6' },
    ]
  },
  {
    category: 'Wallet & Assets',
    items: [
      { id: 'Assets', label: 'My Assets', icon: 'pie-chart', route: 'Assets', color: '#F59E0B' },
      { id: 'Phrase', label: 'Phrase Recovery', icon: 'key', route: 'RecoverySettings', color: '#EF4444' }, // Assuming RecoverySettings handles phrase backup
    ]
  },
  {
    category: 'Account & Security',
    items: [
      { id: 'KYC', label: 'Identity Verification', icon: 'shield', route: 'KYCStatus', color: '#06B6D4' },
      { id: 'Settings', label: 'Settings', icon: 'settings', route: 'Settings', color: '#6B7280' },
      { id: 'Support', label: 'Help & Support', icon: 'help-circle', route: 'Support', color: '#14B8A6' },
    ]
  }
];

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => { haptics.selection(); navigation.goBack(); }}
          style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
        >
          <Feather name="chevron-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Services</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {SERVICES.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>{section.category}</Text>
            <View style={[styles.grid, { backgroundColor: T.surface, borderColor: T.border }]}>
              {section.items.map((item, itemIdx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.gridItem, itemIdx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
                  onPress={() => {
                    haptics.selection();
                    navigation.navigate(item.route);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                      <Feather name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={[styles.itemLabel, { color: T.text }]}>{item.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={T.textDim} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
    marginBottom: 12,
    marginLeft: 4,
  },
  grid: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});
