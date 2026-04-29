import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Modal, TextInput, FlatList, Platform, Dimensions, SafeAreaView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳', currency: 'INR' },
  { name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { name: 'UAE', flag: '🇦🇪', currency: 'AED' },
  { name: 'Singapore', flag: '🇸🇬', currency: 'SGD' },
  { name: 'European Union', flag: '🇪🇺', currency: 'EUR' },
  { name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { name: 'Japan', flag: '🇯🇵', currency: 'JPY' },
  { name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { name: 'Switzerland', flag: '🇨🇭', currency: 'CHF' },
];

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
];

const CountryModal = ({ visible, onClose, onSelect, selectedCountry, T, isDarkMode }: any) => {
  const [search, setSearch] = useState('');
  const filtered = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.currency.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text }]}>Select Country</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: T.surfaceLow }]}>
              <Feather name="x" size={20} color={T.textDim} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <Feather name="search" size={18} color={T.textDim} />
            <TextInput
              style={[styles.searchInput, { color: T.text }]}
              placeholder="Search for a country..."
              placeholderTextColor={T.textDim}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.name}
            showsVerticalScrollIndicator={false}
            style={styles.countryList}
            renderItem={({ item }) => {
              const isSelected = selectedCountry?.name === item.name;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  style={[
                    styles.countryItem,
                    { backgroundColor: T.surfaceLow, borderColor: isSelected ? '#FF1E1E' : T.border },
                    isSelected && { backgroundColor: '#FF1E1E10' }
                  ]}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={[styles.countryName, { color: T.text }]}>{item.name}</Text>
                    <Text style={[styles.countryCurrency, { color: T.textDim }]}>{item.currency}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.countryCheck}>
                      <Feather name="check" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveBtnText}>SAVE SELECTION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const BottomNav = ({ activeTab, T }: { activeTab: string, T: any }) => (
  <View style={[styles.bottomNav, { backgroundColor: T.background, borderTopColor: T.border }]}>
    {[
      { name: 'wallet', icon: 'grid', label: 'WALLET' },
      { name: 'markets', icon: 'trending-up', label: 'MARKETS' },
      { name: 'exchange', icon: 'repeat', label: 'EXCHANGE' },
      { name: 'account', icon: 'user', label: 'ACCOUNT' },
    ].map(tab => (
      <View key={tab.name} style={styles.navItem}>
        <Feather 
          name={tab.icon as any} 
          size={20} 
          color={activeTab === tab.name ? '#FF1E1E' : T.textDim} 
        />
        <Text style={[styles.navLabel, { color: activeTab === tab.name ? '#FF1E1E' : T.textDim }]}>
          {tab.label}
        </Text>
      </View>
    ))}
  </View>
);

export default function AccountTypeScreen({ onSelect }: any) {
  const { setP2PPreferences, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  
  const [selectedType, setSelectedType] = useState<'personal' | 'business'>('personal');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [showCountryModal, setShowCountryModal] = useState(false);

  const handleContinue = async () => {
    await setP2PPreferences(country.name, currency.code);
    onSelect(selectedType);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity style={[styles.headerIcon, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerBrand, { color: T.text }]}>CRYPTOWALLET</Text>
        <TouchableOpacity style={[styles.headerIcon, { backgroundColor: T.surfaceLow }]}>
          <View style={styles.userDot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* STEP 01 */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>STEP 01</Text>
          <Text style={[styles.sectionTitle, { color: T.text }]}>Choose Account</Text>
          <Text style={[styles.sectionDesc, { color: T.textDim }]}>Select the environment tailored to your financial requirements.</Text>
          
          <TouchableOpacity 
            style={[styles.accountCard, { backgroundColor: T.surface, borderColor: selectedType === 'personal' ? '#FF1E1E' : T.border }]}
            onPress={() => setSelectedType('personal')}
            activeOpacity={0.8}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.accountIcon, { backgroundColor: T.surfaceLow }]}>
                <Feather name="user" size={20} color={selectedType === 'personal' ? '#FF1E1E' : T.textDim} />
              </View>
              <View style={[styles.badge, { backgroundColor: T.surfaceLow }]}>
                <Text style={[styles.badgeText, { color: T.textDim }]}>INDIVIDUAL</Text>
              </View>
            </View>
            
            <Text style={[styles.accountName, { color: T.text }]}>Personal</Text>
            <Text style={[styles.accountDesc, { color: T.textDim }]}>For individuals to manage, swap, and spend digital assets daily.</Text>
            
            <View style={[styles.divider, { backgroundColor: T.border }]} />
            
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={14} color="#FF1E1E" />
              <Text style={[styles.featureText, { color: T.text }]}>Instant P2P Transfers</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={14} color="#FF1E1E" />
              <Text style={[styles.featureText, { color: T.text }]}>Virtual Debit Card</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.accountCard, { backgroundColor: T.surface, borderColor: selectedType === 'business' ? '#FF1E1E' : T.border }]}
            onPress={() => setSelectedType('business')}
            activeOpacity={0.8}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.accountIcon, { backgroundColor: T.surfaceLow }]}>
                <Feather name="briefcase" size={20} color={selectedType === 'business' ? '#FF1E1E' : T.textDim} />
              </View>
              <View style={[styles.badge, { backgroundColor: T.surfaceLow }]}>
                <Text style={[styles.badgeText, { color: T.textDim }]}>ENTERPRISE</Text>
              </View>
            </View>
            
            <Text style={[styles.accountName, { color: T.text }]}>Business</Text>
            <Text style={[styles.accountDesc, { color: T.textDim }]}>High-volume liquidity and corporate settlement for merchants.</Text>
            
            <View style={[styles.divider, { backgroundColor: T.border }]} />
            
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={14} color="#FF1E1E" />
              <Text style={[styles.featureText, { color: T.text }]}>Merchant QR Integration</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={14} color="#FF1E1E" />
              <Text style={[styles.featureText, { color: T.text }]}>Multi-Currency Liquidity</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* STEP 02 */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>STEP 02</Text>
          <Text style={[styles.sectionTitle, { color: T.text }]}>Location</Text>
          <Text style={[styles.sectionDesc, { color: T.textDim }]}>Specify your primary operating jurisdiction.</Text>

          <TouchableOpacity 
            style={[styles.locationCard, { backgroundColor: T.surface, borderColor: T.border }]} 
            activeOpacity={0.7}
            onPress={() => setShowCountryModal(true)}
          >
            <View style={[styles.locationIcon, { backgroundColor: T.surfaceLow }]}>
              <Text style={styles.flagIcon}>{country.flag}</Text>
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabelSmall, { color: T.textDim }]}>REGION</Text>
              <Text style={[styles.locationValue, { color: T.text }]}>{country.name}</Text>
            </View>
            <View style={styles.selectorArrows}>
              <Feather name="chevron-up" size={12} color={T.textDim} />
              <Feather name="chevron-down" size={12} color={T.textDim} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.locationCard, { backgroundColor: T.surface, borderColor: T.border }]} 
            activeOpacity={0.7}
            onPress={() => setShowCountryModal(true)}
          >
            <View style={[styles.locationIcon, { backgroundColor: T.surfaceLow }]}>
               <Feather name="dollar-sign" size={20} color={T.text} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabelSmall, { color: T.textDim }]}>SETTLEMENT</Text>
              <Text style={[styles.locationValue, { color: T.text }]}>{currency.code} - {currency.name}</Text>
            </View>
            <View style={styles.selectorArrows}>
              <Feather name="chevron-up" size={12} color={T.textDim} />
              <Feather name="chevron-down" size={12} color={T.textDim} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>COMPLETE SETUP</Text>
        </TouchableOpacity>

        <Text style={[styles.securityNotice, { color: T.textDim }]}>SECURE BANK-GRADE ENCRYPTION ENABLED</Text>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav activeTab="account" T={T} />

      <CountryModal 
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        onSelect={(c: any) => {
          setCountry(c);
          const related = CURRENCIES.find(cur => cur.code === c.currency);
          if (related) setCurrency(related);
        }}
        selectedCountry={country}
        T={T}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF1E1E',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  stepLabel: {
    color: '#FF1E1E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  accountCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  accountName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  accountDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  flagIcon: {
    fontSize: 20,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabelSmall: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  selectorArrows: {
    alignItems: 'center',
    gap: 4,
  },
  continueBtn: {
    backgroundColor: '#FF1E1E',
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  continueBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  securityNotice: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 84,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 24,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '700',
  },
  countryList: {
    marginBottom: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 17,
    fontWeight: '900',
  },
  countryCurrency: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  countryCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#FF1E1E',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

