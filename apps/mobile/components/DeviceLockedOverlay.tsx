import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useWallet } from "../store/WalletContext";
import { Theme, Fonts } from "../constants";
import { profileService } from "../services/supabaseService";

export default function DeviceLockedOverlay() {
  const { isSuspended, setIsSuspended, walletAddress, deleteWallet } = useWallet() as any;
  const [checking, setChecking] = useState(false);

  // Animation values for pulsing shield glow
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isSuspended) return;

    const pulseAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.35,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.8,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [isSuspended]);

  if (!isSuspended) return null;

  const handleRecheck = async () => {
    if (!walletAddress) return;
    setChecking(true);
    try {
      const profile = await profileService.get(walletAddress);
      if (profile && !profile.is_suspended) {
        setIsSuspended(false);
        Alert.alert("Success", "Node suspension lifted. Welcome back!");
      } else {
        Alert.alert("Access Locked", "This wallet node is still suspended by the network administrator.");
      }
    } catch (e: any) {
      Alert.alert("Verification Failed", "Could not verify connection to the registry nodes. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "Are you sure you want to disconnect this wallet from this device? All local data will be reset. You will need your 12-word seed phrase to restore it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect Wallet",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWallet();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to disconnect wallet.");
            }
          },
        },
      ]
    );
  };

  const formatAddr = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Pulsing Lock Icon */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                transform: [{ scale: glowScale }],
                opacity: glowOpacity,
              },
            ]}
          />
          <View style={styles.iconWrapper}>
            <Feather name="shield" size={42} color="#FF3B30" />
            <View style={styles.miniLock}>
              <Feather name="lock" size={14} color="#FFF" />
            </View>
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.title}>NODE INTERFACE LOCKED</Text>

        {/* Body Text */}
        <Text style={styles.description}>
          Access to this device and wallet node has been suspended by the network administrator. All transaction signatures, P2P exchanges, and card integrations are currently locked.
        </Text>

        {/* Node Mapped Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>MAPPED WALLET NODE</Text>
          <Text style={styles.infoAddress}>{formatAddr(walletAddress)}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleRecheck}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.verifyButtonText}>RE-VERIFY NODE STATUS</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={14} color="#A1A5AB" style={styles.btnIcon} />
            <Text style={styles.disconnectButtonText}>DISCONNECT WALLET</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 12, 0.97)",
    zIndex: 999999,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1C1B1B",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  glowRing: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 59, 48, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  miniLock: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1C1B1B",
  },
  title: {
    color: "#FFF",
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    color: "#A1A5AB",
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
  },
  infoBox: {
    width: "100%",
    backgroundColor: "#201F1F",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  infoLabel: {
    color: "#FF3B30",
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoAddress: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: Fonts.medium,
    letterSpacing: 0.5,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  verifyButton: {
    width: "100%",
    backgroundColor: "#FF3B30",
    borderRadius: 16,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  verifyButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
  },
  disconnectButton: {
    width: "100%",
    borderRadius: 16,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  disconnectButtonText: {
    color: "#A1A5AB",
    fontSize: 12,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  btnIcon: {
    marginRight: 8,
  },
});
