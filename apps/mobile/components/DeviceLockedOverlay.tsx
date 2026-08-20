import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Easing, Alert, Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../store/WalletContext";
import { Fonts } from "../constants";
import { profileService } from "../services/supabaseService";

const SUPPORT_EMAIL = "support@cryptowallet.app";

export default function DeviceLockedOverlay() {
  const wallet = useWallet() as any;
  const { isSuspended, walletAddress, deleteWallet } = wallet;
  const suspensionReason: string = wallet.suspensionReason || "";
  const setIsSuspended   = wallet.setIsSuspended;
  const setSuspensionReason = wallet.setSuspensionReason;

  const [checking, setChecking] = React.useState(false);
  const glowScale   = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isSuspended) return;
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale,   { toValue: 1.35, duration: 1800, easing: Easing.out(Easing.ease),    useNativeDriver: true }),
          Animated.timing(glowScale,   { toValue: 1.0,  duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.8,  duration: 1800, easing: Easing.out(Easing.ease),    useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.3,  duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isSuspended]);

  if (!isSuspended) return null;

  const handleRecheck = async () => {
    if (!walletAddress) return;
    setChecking(true);
    try {
      const profile = await profileService.get(walletAddress);
      if (profile && !profile.is_suspended) {
        await AsyncStorage.multiRemove(["cw_is_suspended", "cw_suspension_reason"]);
        setIsSuspended?.(false);
        setSuspensionReason?.("");
        Alert.alert("Access Restored", "Your wallet access has been reinstated.");
      } else {
        const reason = (profile as any)?.suspension_reason || suspensionReason || "";
        if (reason) {
          await AsyncStorage.setItem("cw_suspension_reason", reason);
          setSuspensionReason?.(reason);
        }
        Alert.alert("Still Suspended", "This wallet remains suspended. Contact support if you believe this is an error.");
      }
    } catch {
      // Offline — keep cached lock, do NOT unlock
      Alert.alert("Verification Failed", "Could not reach the server. Your wallet remains locked until connectivity is restored.");
    } finally {
      setChecking(false);
    }
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent("Wallet Suspension Appeal");
    const body = encodeURIComponent(
      `Wallet Address: ${walletAddress}\nSuspension Reason: ${suspensionReason || "Not specified"}\n\nPlease describe your issue:\n`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Contact Support", `Please email us at:\n${SUPPORT_EMAIL}`);
    });
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "This removes your wallet from this device. Your suspension status will be re-verified when you re-import. You need your 12-word seed phrase.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try { await deleteWallet(); } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to disconnect.");
            }
          },
        },
      ]
    );
  };

  const formatAddr = (addr: string) =>
    addr ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : "";

  const displayReason = suspensionReason || "Unauthorized access detected";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Pulsing shield icon */}
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.glowRing, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
          <View style={styles.iconWrapper}>
            <Feather name="shield" size={42} color="#FF3B30" />
            <View style={styles.miniLock}>
              <Feather name="lock" size={14} color="#FFF" />
            </View>
          </View>
        </View>

        <Text style={styles.title}>Wallet Access Suspended</Text>

        {/* Reason box */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>REASON</Text>
          <Text style={styles.reasonText}>{displayReason}</Text>
        </View>

        {/* Wallet address */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>WALLET ADDRESS</Text>
          <Text style={styles.infoAddress}>{formatAddr(walletAddress)}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.supportButton} onPress={handleContactSupport} activeOpacity={0.8}>
            <Feather name="mail" size={16} color="#FFF" style={styles.btnIcon} />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.verifyButton} onPress={handleRecheck} disabled={checking} activeOpacity={0.8}>
            {checking ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <>
                <Feather name="refresh-cw" size={14} color="#FF3B30" style={styles.btnIcon} />
                <Text style={styles.verifyButtonText}>Re-verify Status</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect} activeOpacity={0.8}>
            <Feather name="log-out" size={14} color="#A1A5AB" style={styles.btnIcon} />
            <Text style={styles.disconnectButtonText}>Disconnect Wallet</Text>
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
    width: "100%", maxWidth: 420, backgroundColor: "#1C1B1B",
    borderRadius: 24, borderWidth: 1, borderColor: "#2A2A2A",
    paddingHorizontal: 28, paddingVertical: 36, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  iconContainer: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  glowRing: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255, 59, 48, 0.15)", borderWidth: 1, borderColor: "rgba(255, 59, 48, 0.3)",
  },
  iconWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255, 59, 48, 0.08)", borderWidth: 1, borderColor: "rgba(255, 59, 48, 0.25)",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  miniLock: {
    position: "absolute", bottom: 20, right: 20, backgroundColor: "#FF3B30",
    width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#1C1B1B",
  },
  title: {
    color: "#FFF", fontSize: 20, fontFamily: Fonts.extraBold,
    letterSpacing: 0.5, textAlign: "center", marginBottom: 20,
  },
  reasonBox: {
    width: "100%", backgroundColor: "rgba(255,59,48,0.08)",
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,59,48,0.25)",
    padding: 14, alignItems: "center", marginBottom: 16,
  },
  reasonLabel: { color: "#FF3B30", fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1.2, marginBottom: 6 },
  reasonText: { color: "#FFF", fontSize: 13, fontFamily: Fonts.medium, textAlign: "center", lineHeight: 20 },
  infoBox: {
    width: "100%", backgroundColor: "#201F1F", borderRadius: 16,
    borderWidth: 1, borderColor: "#2A2A2A", padding: 14, alignItems: "center", marginBottom: 28,
  },
  infoLabel: { color: "#FF3B30", fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 6 },
  infoAddress: { color: "#FFF", fontSize: 13, fontFamily: Fonts.medium, letterSpacing: 0.5 },
  actions: { width: "100%", gap: 10 },
  supportButton: {
    width: "100%", backgroundColor: "#FF3B30", borderRadius: 16,
    height: 52, alignItems: "center", justifyContent: "center", flexDirection: "row",
  },
  supportButtonText: { color: "#FFF", fontSize: 14, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  verifyButton: {
    width: "100%", borderRadius: 16, height: 46, alignItems: "center",
    justifyContent: "center", flexDirection: "row",
    borderWidth: 1, borderColor: "rgba(255,59,48,0.4)",
  },
  verifyButtonText: { color: "#FF3B30", fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  disconnectButton: {
    width: "100%", borderRadius: 16, height: 44, alignItems: "center",
    justifyContent: "center", flexDirection: "row",
    borderWidth: 1, borderColor: "#2A2A2A",
  },
  disconnectButtonText: { color: "#A1A5AB", fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  btnIcon: { marginRight: 8 },
});
