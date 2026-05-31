import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../store/WalletContext";
import { Theme, Fonts } from "../constants";
import NetworkPreferenceScreen from "./NetworkPreferenceScreen";

const { width } = Dimensions.get("window");

const COUNTRIES = [
  { name: "India", flag: "🇮🇳", currency: "INR" },
  { name: "United States", flag: "🇺🇸", currency: "USD" },
  { name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  { name: "UAE", flag: "🇦🇪", currency: "AED" },
  { name: "Singapore", flag: "🇸🇬", currency: "SGD" },
  { name: "European Union", flag: "🇪🇺", currency: "EUR" },
  { name: "Canada", flag: "🇨🇦", currency: "CAD" },
  { name: "Australia", flag: "🇦🇺", currency: "AUD" },
  { name: "Japan", flag: "🇯🇵", currency: "JPY" },
  { name: "Germany", flag: "🇩🇪", currency: "EUR" },
  { name: "France", flag: "🇫🇷", currency: "EUR" },
  { name: "Switzerland", flag: "🇨🇭", currency: "CHF" },
];

const CURRENCIES = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
];

const CountryModal = ({
  visible,
  onClose,
  onSelect,
  selectedCountry,
  T,
  isDarkMode,
}: any) => {
  const [search, setSearch] = useState("");
  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.currency.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? "#121212" : "#FFFFFF" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text }]}>
              Select Region
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: T.surfaceLow }]}
            >
              <Feather name="x" size={20} color={T.textDim} />
            </TouchableOpacity>
          </View>

          <View
            style={[styles.searchContainer, { backgroundColor: T.surfaceLow }]}
          >
            <Feather name="search" size={18} color={T.textDim} />
            <TextInput
              style={[styles.searchInput, { color: T.text }]}
              placeholder="Search country..."
              placeholderTextColor={T.textDim}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.name}
            showsVerticalScrollIndicator={false}
            style={styles.countryList}
            renderItem={({ item }) => {
              const isSelected = selectedCountry?.name === item.name;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  style={[
                    styles.countryItem,
                    {
                      backgroundColor: isSelected
                        ? T.primary + "15"
                        : T.surfaceLow,
                    },
                    isSelected && { borderColor: T.primary, borderWidth: 1 },
                  ]}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={[styles.countryName, { color: T.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.countryCurrency, { color: T.textDim }]}
                    >
                      {item.currency}
                    </Text>
                  </View>
                  {isSelected && (
                    <View
                      style={[
                        styles.countryCheck,
                        { backgroundColor: T.primary },
                      ]}
                    >
                      <Feather name="check" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: T.text }]}
            onPress={onClose}
          >
            <Text style={[styles.saveBtnText, { color: T.background }]}>
              Confirm Selection
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function AccountTypeScreen({ onSelect }: any) {
  const { setP2PPreferences, isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [selectedType, setSelectedType] = useState<"personal" | "business">(
    "personal",
  );
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showNetworkPref, setShowNetworkPref] = useState(false);

  const handleContinue = async () => {
    await setP2PPreferences(country.name, currency.code);
    setShowNetworkPref(true);
  };

  const handleNetworkSelected = async (network: string) => {
    await AsyncStorage.setItem("cw_network", network);
    await AsyncStorage.setItem("cw_network_preference_set", "true");
    onSelect(selectedType);
  };

  if (showNetworkPref) {
    return <NetworkPreferenceScreen onSelect={handleNetworkSelected} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.headerIcon}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Setup Account
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: T.text }]}>
          How will you use CryptoWallet?
        </Text>
        <Text style={[styles.pageDesc, { color: T.textDim }]}>
          Choose your account type to personalize your experience.
        </Text>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[
              styles.typeCard,
              { backgroundColor: T.surfaceLow },
              selectedType === "personal" && {
                backgroundColor: T.primary + "15",
                borderColor: T.primary,
                borderWidth: 1.5,
              },
            ]}
            onPress={() => setSelectedType("personal")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor:
                    selectedType === "personal" ? T.primary : T.surface,
                },
              ]}
            >
              <Feather
                name="user"
                size={24}
                color={selectedType === "personal" ? "#FFF" : T.text}
              />
            </View>
            <Text style={[styles.cardTitle, { color: T.text }]}>Personal</Text>
            <Text style={[styles.cardDesc, { color: T.textDim }]}>
              For everyday payments, swaps, and portfolio management.
            </Text>
            {selectedType === "personal" && (
              <View style={styles.checkIcon}>
                <Feather name="check-circle" size={20} color={T.primary} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeCard,
              { backgroundColor: T.surfaceLow },
              selectedType === "business" && {
                backgroundColor: T.primary + "15",
                borderColor: T.primary,
                borderWidth: 1.5,
              },
            ]}
            onPress={() => setSelectedType("business")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor:
                    selectedType === "business" ? T.primary : T.surface,
                },
              ]}
            >
              <Feather
                name="briefcase"
                size={24}
                color={selectedType === "business" ? "#FFF" : T.text}
              />
            </View>
            <Text style={[styles.cardTitle, { color: T.text }]}>Business</Text>
            <Text style={[styles.cardDesc, { color: T.textDim }]}>
              For merchants, APIs, and high-volume settlement.
            </Text>
            {selectedType === "business" && (
              <View style={styles.checkIcon}>
                <Feather name="check-circle" size={20} color={T.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={[styles.subTitle, { color: T.text }]}>
          Operating Region
        </Text>
        <Text style={[styles.subDesc, { color: T.textDim }]}>
          This sets your default fiat currency.
        </Text>

        <TouchableOpacity
          style={[styles.regionBtn, { backgroundColor: T.surfaceLow }]}
          activeOpacity={0.7}
          onPress={() => setShowCountryModal(true)}
        >
          <View style={styles.regionLeft}>
            <Text style={styles.flagIcon}>{country.flag}</Text>
            <View>
              <Text style={[styles.regionName, { color: T.text }]}>
                {country.name}
              </Text>
              <Text style={[styles.currencyName, { color: T.textDim }]}>
                {currency.code} - {currency.name}
              </Text>
            </View>
          </View>
          <Feather name="chevron-down" size={20} color={T.textDim} />
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View
        style={[
          styles.bottomArea,
          { backgroundColor: T.background, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: T.text }]}
          onPress={handleContinue}
        >
          <Text style={[styles.continueBtnText, { color: T.background }]}>
            Continue
          </Text>
          <Feather name="arrow-right" size={20} color={T.background} />
        </TouchableOpacity>
      </View>

      <CountryModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        onSelect={(c: any) => {
          setCountry(c);
          const related = CURRENCIES.find((cur) => cur.code === c.currency);
          if (related) setCurrency(related);
        }}
        selectedCountry={country}
        T={T}
        isDarkMode={isDarkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 8,
  },
  pageDesc: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    lineHeight: 24,
    marginBottom: 32,
  },
  cardsContainer: {
    gap: 16,
  },
  typeCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "transparent",
    position: "relative",
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    lineHeight: 22,
  },
  checkIcon: {
    position: "absolute",
    top: 24,
    right: 24,
  },
  divider: {
    height: 1,
    width: "100%",
    backgroundColor: "#33333330",
    marginVertical: 32,
  },
  subTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  subDesc: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    marginBottom: 20,
  },
  regionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 20,
  },
  regionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  flagIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  regionName: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  currencyName: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  continueBtn: {
    height: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: "85%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginLeft: 12,
  },
  countryList: {
    marginBottom: 16,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  countryCurrency: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  countryCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
});
