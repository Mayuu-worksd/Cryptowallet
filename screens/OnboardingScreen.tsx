import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  G,
  Polygon,
  Ellipse,
} from "react-native-svg";
import { useWallet } from "../store/WalletContext";
import { Theme, Fonts } from "../constants";

const AsyncStorage =
  Platform.OS === "web"
    ? {
        getItem: async (k: string) => {
          try {
            return localStorage.getItem(k);
          } catch (_e) {
            return null;
          }
        },
        setItem: async (k: string, v: string) => {
          try {
            localStorage.setItem(k, v);
          } catch (_e) {}
        },
      }
    : require("@react-native-async-storage/async-storage").default;

const { width: W, height: H } = Dimensions.get("window");
const ONBOARDING_KEY = "cw_onboarding_done";

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    return !done;
  } catch (_e) {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}

// Custom SVG Illustrations
const WalletIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#EC2629" stopOpacity="1" />
        <Stop offset="100%" stopColor="#9b181a" stopOpacity="1" />
      </SvgLinearGradient>
      <SvgLinearGradient id="coin1" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#B45309" />
      </SvgLinearGradient>
      <SvgLinearGradient id="coin2" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgLinearGradient>
    </Defs>
    {/* Floating Coins */}
    <Circle cx="40" cy="60" r="15" fill="url(#coin1)" />
    <Path d="M35 55 h10 v10 h-10 z" fill="#FFF" opacity="0.4" />

    <Circle cx="190" cy="180" r="20" fill="url(#coin2)" />
    <Circle cx="200" cy="50" r="10" fill="url(#coin1)" opacity="0.6" />

    {/* Wallet Base */}
    <Rect
      x="40"
      y="80"
      width="160"
      height="100"
      rx="20"
      fill="url(#walletGrad)"
    />
    <Rect
      x="40"
      y="80"
      width="160"
      height="40"
      rx="20"
      fill="#FFF"
      opacity="0.1"
    />
    <Path
      d="M40 100 h160 v60 a20 20 0 0 1 -20 20 h-120 a20 20 0 0 1 -20 -20 z"
      fill="url(#walletGrad)"
    />

    {/* Wallet Flap */}
    <Path
      d="M40 100 Q120 140 200 100 L200 120 Q120 160 40 120 Z"
      fill="#7a1214"
    />

    {/* Center Coin */}
    <Circle cx="120" cy="120" r="25" fill="#FFF" />
    <Circle cx="120" cy="120" r="20" fill="url(#coin1)" />
    <Path d="M115 110 h10 v20 h-10 z" fill="#FFF" />
  </Svg>
);

const SwapIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="swapLeft" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#6366F1" />
        <Stop offset="100%" stopColor="#4338CA" />
      </SvgLinearGradient>
      <SvgLinearGradient id="swapRight" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgLinearGradient>
      <SvgLinearGradient id="chart" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFF" stopOpacity="0.2" />
        <Stop offset="100%" stopColor="#FFF" stopOpacity="0" />
      </SvgLinearGradient>
    </Defs>
    {/* Chart Background */}
    <Path
      d="M20 180 L60 140 L100 160 L160 80 L220 120 L220 200 L20 200 Z"
      fill="url(#chart)"
    />
    <Path
      d="M20 180 L60 140 L100 160 L160 80 L220 120"
      stroke="#FFF"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.3"
    />

    {/* Left Coin */}
    <Circle cx="80" cy="120" r="40" fill="url(#swapLeft)" />
    <Path
      d="M65 120 l15 -15 l15 15 m-15 -15 v30"
      stroke="#FFF"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Right Coin */}
    <Circle cx="160" cy="120" r="40" fill="url(#swapRight)" />
    <Path
      d="M145 120 l15 15 l15 -15 m-15 15 v-30"
      stroke="#FFF"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Swap Arrows */}
    <Circle cx="120" cy="120" r="18" fill="#FFF" />
    <Path
      d="M110 115 h20 m-5 -5 l5 5 l-5 5 m5 5 h-20 m5 -5 l-5 5 l5 5"
      stroke="#EC2629"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SecurityIllustration = () => (
  <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
    <Defs>
      <SvgLinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#B45309" />
      </SvgLinearGradient>
      <SvgLinearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FFF" stopOpacity="0.8" />
        <Stop offset="100%" stopColor="#FFF" stopOpacity="0.2" />
      </SvgLinearGradient>
    </Defs>

    {/* Network Nodes */}
    <Path
      d="M120 40 L180 80 L180 160 L120 200 L60 160 L60 80 Z"
      stroke="#FFF"
      strokeWidth="2"
      strokeDasharray="6 6"
      opacity="0.3"
    />
    <Circle cx="120" cy="40" r="6" fill="url(#nodeGrad)" />
    <Circle cx="180" cy="80" r="6" fill="url(#nodeGrad)" />
    <Circle cx="180" cy="160" r="6" fill="url(#nodeGrad)" />
    <Circle cx="120" cy="200" r="6" fill="url(#nodeGrad)" />
    <Circle cx="60" cy="160" r="6" fill="url(#nodeGrad)" />
    <Circle cx="60" cy="80" r="6" fill="url(#nodeGrad)" />

    {/* Main Shield */}
    <Path
      d="M120 50 L170 70 V120 C170 160 120 190 120 190 C120 190 70 160 70 120 V70 L120 50 Z"
      fill="url(#shieldGrad)"
    />
    <Path
      d="M120 50 L170 70 V120 C170 160 120 190 120 190 V50 Z"
      fill="#FFF"
      opacity="0.15"
    />

    {/* Lock Inside */}
    <Rect x="105" y="110" width="30" height="24" rx="4" fill="#FFF" />
    <Path
      d="M110 110 V100 C110 90 130 90 130 100 V110"
      stroke="#FFF"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Circle cx="120" cy="122" r="3" fill="#B45309" />
    <Path
      d="M120 122 v6"
      stroke="#B45309"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

const SLIDES = [
  {
    id: 1,
    title: "Self-Custody\nMastered",
    body: "Your keys, your crypto. Total control over your digital assets with bank-grade encryption.",
    icon: "shield",
    color: "#FF1E1E",
  },
  {
    id: 2,
    title: "Global\nLiquidity",
    body: "Instantly swap between 50+ assets or trade directly via our decentralized P2P marketplace.",
    icon: "globe",
    color: "#3B82F6",
  },
  {
    id: 3,
    title: "Spend\nAnywhere",
    body: "Convert and spend your crypto globally with a sleek virtual debit card.",
    icon: "credit-card",
    color: "#10B981",
  },
];

interface Props {
  onFinish?: () => void;
  navigation?: any;
}

export default function OnboardingScreen({ onFinish, navigation }: Props) {
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  const isDark = isDarkMode;

  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (idx: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrent(idx);
    scrollRef.current?.scrollTo({ x: idx * W, animated: true });
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await markOnboardingDone();
    if (onFinish) onFinish();
    if (navigation) navigation.replace("Main");
  };

  const slide = SLIDES[current];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000000" : T.background },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Background glow based on current slide color */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glow, { backgroundColor: slide.color }]} />
      </View>

      {/* Skip */}
      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 16 }]}
        onPress={handleFinish}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.skipText, { color: isDark ? "#FFFFFF" : "#000000" }]}
        >
          Skip
        </Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            <Animated.View
              style={[
                styles.slideContent,
                { opacity: i === current ? fadeAnim : 0 },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: s.color + "15" },
                ]}
              >
                <Feather name={s.icon as any} size={64} color={s.color} />
              </View>

              <Text
                style={[
                  styles.title,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
              >
                {s.title}
              </Text>
              <Text
                style={[
                  styles.body,
                  { color: isDark ? "#FFFFFF80" : "#00000080" },
                ]}
              >
                {s.body}
              </Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Area */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.progressContainer}>
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === current
                        ? slide.color
                        : isDark
                          ? "#FFFFFF20"
                          : "#00000020",
                    width: i === current ? 32 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: isDark ? "#FFFFFF" : "#000000" },
          ]}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <Text
            style={[
              styles.nextBtnText,
              { color: isDark ? "#000000" : "#FFFFFF" },
            ]}
          >
            {current === SLIDES.length - 1 ? "Get Started" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow: {
    position: "absolute",
    top: -H * 0.2,
    left: -W * 0.2,
    width: W * 1.4,
    height: W * 1.4,
    borderRadius: W * 0.7,
    opacity: 0.15,
    ...(Platform.OS === "web" ? { filter: "blur(80px)" } : {}),
  },
  skipBtn: {
    position: "absolute",
    right: 24,
    zIndex: 10,
    padding: 12,
  },
  skipText: { fontSize: 16, fontFamily: Fonts.semiBold, opacity: 0.6 },

  slide: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  slideContent: { width: "100%", marginBottom: 60 },

  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },

  title: {
    fontSize: 48,
    fontFamily: Fonts.extraBold,
    letterSpacing: -1.5,
    lineHeight: 52,
    marginBottom: 20,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    fontFamily: Fonts.medium,
    paddingRight: 20,
  },

  bottom: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingHorizontal: 32,
  },
  progressContainer: {
    marginBottom: 32,
  },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { height: 8, borderRadius: 4 },

  nextBtn: {
    width: "100%",
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: { fontSize: 18, fontFamily: Fonts.extraBold },
});
