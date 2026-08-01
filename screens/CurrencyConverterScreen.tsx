import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable
} from "react-native";
import { Theme, Fonts } from "../constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useWallet } from "../store/WalletContext";
import { haptics } from "../utils/haptics";
// SUPPORTED_FIAT_CURRENCIES removed for dynamic loader

export default function CurrencyConverterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, setFiatCurrency, fiatRates, addTx, fetchBalance, walletAddress, network } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("INRX");
  const [toCurrency, setToCurrency] = useState("USD");
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"from" | "to">("from");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Dynamic Calculation
  const getRate = (code: string) => {
    if (code === 'INRX') return fiatRates['INR']?.rate ?? 83.5;
    return fiatRates[code]?.rate ?? 1.0;
  };
  
  const getSym = (code: string) => {
    if (code === 'INRX') return 'INRX';
    return fiatRates[code]?.symbol || code;
  };

  const parsedAmount = parseFloat(amount) || 0;
  const rateFrom = getRate(fromCurrency);
  const rateTo = getRate(toCurrency);
  const convertedAmount = parsedAmount * (rateTo / rateFrom);
  const unitRate = rateTo / rateFrom;

  const handleSwapCurrencies = () => {
    haptics.selection();
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const openSelector = (type: "from" | "to") => {
    haptics.selection();
    setModalType(type);
    setModalVisible(true);
  };

  const selectCurrency = (c: string) => {
    haptics.selection();
    if (modalType === "from") setFromCurrency(c);
    else setToCurrency(c);
    setModalVisible(false);
  };
  
  const handleConvert = async () => {
    if (parsedAmount <= 0) return;
    haptics.selection();
    setIsProcessing(true);
    
    // Simulate network delay for realism
    await new Promise((res) => setTimeout(res, 1500));
    
    // Record simulated transaction for the conversion
    addTx({
      type: 'swap',
      coin: toCurrency,
      amount: convertedAmount.toString(),
      usdValue: (convertedAmount / rateTo).toString(),
      address: 'Internal Conversion',
      status: 'success',
      isInternal: true,
      buyToken: toCurrency,
      buyAmount: convertedAmount.toString()
    });

    // Actually update their active fiat preference to the "To" currency to make it "real"
    if (toCurrency !== 'INRX') {
      await setFiatCurrency(toCurrency);
    } else {
      await setFiatCurrency('INR'); // INRX defaults to INR display
    }
    
    // Refresh balance to sync up db
    await fetchBalance(walletAddress, network);

    setIsProcessing(false);
    setIsSuccess(true);
    haptics.success();

    setTimeout(() => {
      navigation.goBack();
    }, 2000);
  };

  const availableCurrencies = [...Object.keys(fiatRates || {}), 'INRX'];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: isDarkMode ? "#000000" : T.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Convert Asset</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Main Card */}
        <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.border, shadowColor: T.text }]}>
          
          {/* FROM SECTION */}
          <View style={[styles.inputSection, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <View style={styles.inputHeader}>
              <Text style={[styles.inputLabel, { color: T.textMuted }]}>You Pay</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={T.textMuted + "80"}
                style={[styles.amountInput, { color: T.text }]}
              />
              <TouchableOpacity onPress={() => openSelector('from')} style={[styles.currencySelector, { borderColor: T.border, backgroundColor: T.surface }]}>
                <Text style={[styles.currencyCode, { color: T.text }]}>
                  {fromCurrency === 'INRX' ? '🇮🇳 INRX' : `${fiatRates[fromCurrency]?.flag || '🌐'} ${fromCurrency}`}
                </Text>
                <Feather name="chevron-down" size={16} color={T.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* SWAP BUTTON */}
          <View style={styles.swapBtnContainer}>
            <TouchableOpacity onPress={handleSwapCurrencies} style={[styles.swapBtn, { backgroundColor: T.primary, borderColor: T.border }]}>
              <Feather name="arrow-down" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {/* TO SECTION */}
          <View style={[styles.inputSection, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
            <View style={styles.inputHeader}>
              <Text style={[styles.inputLabel, { color: T.textMuted }]}>You Receive</Text>
            </View>
            <View style={styles.inputRow}>
              <Text style={[styles.amountInput, { color: parsedAmount > 0 ? T.primary : T.textMuted }]}>
                {convertedAmount > 0 ? convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "0.00"}
              </Text>
              <TouchableOpacity onPress={() => openSelector('to')} style={[styles.currencySelector, { borderColor: T.border, backgroundColor: T.surface }]}>
                <Text style={[styles.currencyCode, { color: T.text }]}>
                  {toCurrency === 'INRX' ? '🇮🇳 INRX' : `${fiatRates[toCurrency]?.flag || '🌐'} ${toCurrency}`}
                </Text>
                <Feather name="chevron-down" size={16} color={T.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* EXCHANGE RATE DETAILS */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Exchange Rate</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>
                1 {fromCurrency} = {unitRate.toFixed(4)} {toCurrency}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: T.textMuted }]}>Network Fee</Text>
              <Text style={[styles.detailValue, { color: T.text }]}>Free (0.00)</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM BUTTON */}
      <View style={[styles.bottomContainer, { borderTopColor: T.border, backgroundColor: isDarkMode ? "#000000" : T.background }]}>
        <TouchableOpacity
          onPress={handleConvert}
          disabled={isProcessing || isSuccess || parsedAmount <= 0}
          style={[
            styles.actionBtn,
            { backgroundColor: parsedAmount > 0 ? T.primary : T.surfaceLow, borderColor: T.border }
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator color="#000" />
          ) : isSuccess ? (
            <Feather name="check-circle" size={24} color="#000" />
          ) : (
            <Text style={[styles.actionBtnText, { color: parsedAmount > 0 ? "#000" : T.textMuted }]}>
              Convert Now
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* CURRENCY SELECTOR MODAL */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[styles.modalTitle, { color: T.text }]}>Select Currency</Text>
            <ScrollView style={{ width: "100%" }} showsVerticalScrollIndicator={false}>
              {availableCurrencies.map((c) => {
                const isSelected = modalType === "from" ? fromCurrency === c : toCurrency === c;
                const details = c === 'INRX' 
                  ? { flag: '🇮🇳', name: 'INRX Token', symbol: 'INRX' } 
                  : {
                      flag: fiatRates[c]?.flag || '🌐',
                      name: fiatRates[c]?.name || c,
                      symbol: fiatRates[c]?.symbol || c
                    };
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => selectCurrency(c)}
                    style={[
                      styles.modalItem,
                      { borderColor: isSelected ? T.primary : T.border, backgroundColor: isSelected ? T.primary + "15" : T.surfaceLow }
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{details.flag}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.modalItemCode, { color: T.text }]}>{c}</Text>
                      <Text style={[styles.modalItemName, { color: T.textMuted }]}>{details.name}</Text>
                    </View>
                    {isSelected && <Feather name="check" size={20} color={T.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "900", fontFamily: Fonts.extraBold, textTransform: "uppercase" },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 120 },
  card: { borderWidth: 3, borderRadius: 16, padding: 16, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  inputSection: { borderWidth: 2, borderRadius: 12, padding: 16 },
  inputHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  inputLabel: { fontSize: 12, fontWeight: "800", fontFamily: Fonts.medium, textTransform: "uppercase" },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "900", fontFamily: Fonts.extraBold },
  currencySelector: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  currencyCode: { fontSize: 14, fontWeight: "800", fontFamily: Fonts.medium },
  swapBtnContainer: { alignItems: "center", marginVertical: -16, zIndex: 10 },
  swapBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  detailsBox: { marginTop: 24, paddingHorizontal: 8, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { fontSize: 12, fontWeight: "700", fontFamily: Fonts.medium, textTransform: "uppercase" },
  detailValue: { fontSize: 12, fontWeight: "800", fontFamily: Fonts.medium },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, borderTopWidth: 2 },
  actionBtn: { height: 56, borderWidth: 3, borderRadius: 12, alignItems: "center", justifyContent: "center", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  actionBtnText: { fontSize: 16, fontWeight: "900", fontFamily: Fonts.extraBold, textTransform: "uppercase", letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxHeight: "70%", borderWidth: 3, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "900", fontFamily: Fonts.extraBold, textTransform: "uppercase", marginBottom: 16 },
  modalItem: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 2, borderRadius: 12, marginBottom: 12 },
  modalItemCode: { fontSize: 16, fontWeight: "900", fontFamily: Fonts.extraBold },
  modalItemName: { fontSize: 12, fontWeight: "700", fontFamily: Fonts.medium, marginTop: 4 },
});
