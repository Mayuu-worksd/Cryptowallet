import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { Theme, Fonts } from "../constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useWallet } from "../store/WalletContext";
import { haptics } from "../utils/haptics";

const SERVICES = [
  {
    category: "Popular",
    items: [
      {
        id: "Earn",
        label: "Earn",
        icon: "trending-up",
        route: "Earn",
        color: "#FFFFFF",
      },
      {
        id: "Credit",
        label: "Credit",
        icon: "dollar-sign",
        route: "Credit",
        color: "#FFFFFF",
      },
      {
        id: "P2P",
        label: "P2P",
        icon: "repeat",
        route: "P2PMarketplace",
        color: "#FFFFFF",
      },
    ],
  },
  {
    category: "Transaction",
    items: [
      {
        id: "Deposit",
        label: "Deposit",
        icon: "plus",
        route: "Receive",
        color: "#FFFFFF",
      },
      {
        id: "Swap",
        label: "Swap",
        icon: "zap",
        route: "Swap",
        color: "#FFFFFF",
      },
      {
        id: "Send",
        label: "Send",
        icon: "arrow-right",
        route: "Send",
        color: "#FFFFFF",
      },
      {
        id: "Scan",
        label: "Scan",
        icon: "maximize",
        route: "Scan",
        color: "#FFFFFF",
      },
      {
        id: "History",
        label: "History",
        icon: "clock",
        route: "History",
        color: "#FFFFFF",
      },
    ],
  },
  {
    category: "Card",
    items: [
      {
        id: "Card",
        label: "Virtual Card",
        icon: "credit-card",
        route: "Card",
        color: "#FFFFFF",
      },
    ],
  },
  {
    category: "Account & Settings",
    items: [
      {
        id: "Portfolio",
        label: "Portfolio",
        icon: "pie-chart",
        route: "Portfolio",
        color: "#FFFFFF",
      },
      {
        id: "Settings",
        label: "Settings",
        icon: "settings",
        route: "Settings",
        color: "#FFFFFF",
      },
      {
        id: "Support",
        label: "Support",
        icon: "help-circle",
        route: "Support",
        color: "#FFFFFF",
      },
    ],
  },
];

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const isDark = isDarkMode;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: isDark ? "#000000" : T.background },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Feather
            name="arrow-left"
            size={24}
            color={isDark ? "#FFFFFF" : T.text}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {SERVICES.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#FFFFFF" : T.text },
              ]}
            >
              {section.category}
            </Text>
            <View style={styles.grid}>
              {section.items.map((item, itemIdx) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={() => {
                    haptics.selection();
                    // Some routes might not exist, silently ignore for now or handle gracefully
                    if (item.route) {
                      try {
                        navigation.navigate(item.route);
                      } catch (e) {}
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: isDark ? "#1C1C1E" : "#F1F3F4" },
                    ]}
                  >
                    <Feather
                      name={item.icon as any}
                      size={24}
                      color={isDark ? "#FFFFFF" : "#000000"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.itemLabel,
                      { color: isDark ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    {item.label}
                  </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  gridItem: {
    width: "25%", // 4 items per row
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    textAlign: "center",
  },
});
