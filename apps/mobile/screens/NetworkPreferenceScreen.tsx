import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../store/WalletContext";
import { Theme, Fonts } from "../constants";
import { NETWORK_INFO } from "../constants";

const { width } = Dimensions.get("window");

const NETWORKS = [
  {
    id: "TRON",
    name: "TRON",
    icon: "TRX",
    desc: "High-speed layer-1 for TRC20",
    type: "Mainnet",
    color: "#EF0027",
  },
  {
    id: "TRON Nile",
    name: "TRON Nile",
    icon: "TRX",
    desc: "TRON testnet network",
    type: "Testnet",
    color: "#FF6B6B",
  },
  {
    id: "Ethereum",
    name: "Ethereum",
    icon: "⟠",
    desc: "Secure mainnet",
    type: "Mainnet",
    color: "#627EEA",
  },
  {
    id: "Polygon",
    name: "Polygon",
    icon: "⬟",
    desc: "Fast Layer 2",
    type: "Mainnet",
    color: "#8247E5",
  },
  {
    id: "Arbitrum",
    name: "Arbitrum",
    icon: "◆",
    desc: "Optimistic rollup",
    type: "Mainnet",
    color: "#28A0F0",
  },
  {
    id: "Solana",
    name: "Solana",
    icon: "SOL",
    desc: "High-speed Solana",
    type: "Mainnet",
    color: "#9945FF",
  },
  {
    id: "Sepolia",
    name: "Sepolia",
    icon: "⟠",
    desc: "Ethereum testnet",
    type: "Testnet",
    color: "#FFC107",
  },
  {
    id: "Solana Devnet",
    name: "Solana Devnet",
    icon: "SOL",
    desc: "Solana testnet",
    type: "Testnet",
    color: "#14F195",
  },
];

export default function NetworkPreferenceScreen({
  onSelect,
}: {
  onSelect: (network: string) => void;
}) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();

  const [selectedNetwork, setSelectedNetwork] = useState("TRON");
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("cw_network_preference_set").then((val) => {
      setIsFirstTime(!val);
    });
  }, []);

  const handleContinue = async () => {
    await AsyncStorage.setItem("cw_network", selectedNetwork);
    await AsyncStorage.setItem("cw_network_preference_set", "true");
    onSelect(selectedNetwork);
  };

  const isTestnetSelected = NETWORK_INFO[selectedNetwork]?.type === "Testnet";

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.headerIcon}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Network</Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: T.text }]}>
          Default Network
        </Text>
        <Text style={[styles.pageDesc, { color: T.textDim }]}>
          Select your primary blockchain network. You can easily switch this
          later.
        </Text>

        <View style={styles.listContainer}>
          {NETWORKS.map((network, index) => {
            const isSelected = selectedNetwork === network.id;
            return (
              <TouchableOpacity
                key={network.id}
                style={[
                  styles.networkRow,
                  { backgroundColor: T.surfaceLow },
                  isSelected && {
                    backgroundColor: T.primary + "15",
                    borderColor: T.primary,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setSelectedNetwork(network.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: network.color + "20", overflow: 'hidden' },
                  ]}
                >
                  <Image 
                    source={{ uri: NETWORK_INFO[network.name]?.iconUrl }} 
                    style={{ width: 44, height: 44 }} 
                  />
                </View>

                <View style={styles.networkInfo}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.networkName, { color: T.text }]}>
                      {network.name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            network.type === "Testnet"
                              ? "#FFC10720"
                              : "#4CAF5020",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color:
                              network.type === "Testnet"
                                ? "#FFB300"
                                : "#4CAF50",
                          },
                        ]}
                      >
                        {network.type}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.networkDesc, { color: T.textDim }]}>
                    {network.desc}
                  </Text>
                </View>

                <View style={styles.radioWrapper}>
                  {isSelected ? (
                    <Feather name="check-circle" size={24} color={T.primary} />
                  ) : (
                    <View
                      style={[styles.radioEmpty, { borderColor: T.border }]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View
        style={[
          styles.bottomArea,
          { backgroundColor: T.background, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {isTestnetSelected && (
          <View
            style={[
              styles.warningBox,
              { backgroundColor: "#FFC10715", borderColor: "#FFC10750" },
            ]}
          >
            <Feather name="alert-triangle" size={16} color="#FFB300" />
            <Text style={[styles.warningText, { color: "#FFB300" }]}>
              Testnet mode enabled. No real funds.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: T.text }]}
          onPress={handleContinue}
        >
          <Text style={[styles.continueBtnText, { color: T.background }]}>
            Complete Setup
          </Text>
        </TouchableOpacity>
      </View>
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
  listContainer: {
    gap: 12,
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  networkIconText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  networkInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  networkName: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
  },
  networkDesc: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  radioWrapper: {
    marginLeft: 16,
  },
  radioEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  continueBtn: {
    height: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
});
