import React, { useEffect, useState } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../store/WalletContext';
import { cardVariantService, VCCCardVariant } from '../services/supabaseService';
import { CurrencyText } from '../components/CurrencyText';

export default function VCCVariantScreen({ navigation }: any) {
  const { isDarkMode, formatFiat, fiatCurrency } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const insets = useSafeAreaInsets();
  const [variants, setVariants] = useState<VCCCardVariant[]>([]);
  const [selected, setSelected] = useState<VCCCardVariant | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    cardVariantService.getVariants()
      .then(v => setVariants(v))
      .catch(e => setError(e?.message ?? 'Failed to load card options.'))
      .finally(() => setLoading(false));
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    cardVariantService.getVariants()
      .then(v => setVariants(v))
      .catch(e => setError(e?.message ?? 'Failed to load card options.'))
      .finally(() => setLoading(false));
  };

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { borderBottomColor: T.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Choose Your Card</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={[s.loadingText, { color: T.textMuted }]}>Syncing card tier catalog...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={40} color={T.error} />
          <Text style={[s.errorText, { color: T.error }]}>{error}</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: T.primary }]} onPress={handleRetry}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.subtitle, { color: T.textMuted }]}>
            Select the cryptocurrency smart debit card that matches your transaction profile. Changes are live and sync instantly with our backend.
          </Text>

          {variants.map(v => {
            const isSelected = selected?.id === v.id;
            
            // Build dynamic colors for gradient card background
            const colors = v.gradient_colors && v.gradient_colors.length >= 2
              ? v.gradient_colors
              : [v.card_color_hex || v.color_hex || T.primary, v.color_hex || T.primary];

            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  s.card, 
                  { 
                    backgroundColor: T.surface,
                    borderColor: isSelected ? T.primary : T.border,
                    borderWidth: isSelected ? 2 : 1
                  }
                ]}
                onPress={() => setSelected(v)}
                activeOpacity={0.85}
              >
                {/* Dynamic Gradient Header */}
                <LinearGradient
                  colors={colors as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.cardHeader}
                >
                  <View style={s.cardInfoContainer}>
                    <Text style={s.cardVariantName}>{v.variant_name}</Text>
                    <Text style={s.cardNetwork}>{v.network}</Text>
                  </View>
                  <View style={s.networkBadge}>
                    <Feather name="credit-card" size={20} color="#FFF" />
                  </View>
                </LinearGradient>

                {/* Card body */}
                <View style={s.cardBody}>
                  {/* Channels Indicator */}
                  <View style={s.channelContainer}>
                    {v.is_physical && (
                      <View style={[s.channelBadge, { backgroundColor: T.success + '15', borderColor: T.success }]}>
                        <Text style={[s.channelText, { color: T.success }]}>PHYSICAL</Text>
                      </View>
                    )}
                    {v.is_virtual && (
                      <View style={[s.channelBadge, { backgroundColor: T.primary + '15', borderColor: T.primary }]}>
                        <Text style={[s.channelText, { color: T.primary }]}>VIRTUAL</Text>
                      </View>
                    )}
                  </View>

                  {/* 3-Column Fees and Limits Row */}
                  <View style={s.feeRow}>
                    <View style={s.feeItem}>
                      <Text style={[s.feeLabel, { color: T.textDim }]}>Annual Fee</Text>
                      <Text style={[s.feeValue, { color: T.text }]}>
                        {v.annual_fee_usd === 0 ? 'Free' : <CurrencyText amount={v.annual_fee_usd} code={fiatCurrency} />}
                      </Text>
                    </View>
                    <View style={[s.feeDivider, { backgroundColor: T.border }]} />
                    <View style={s.feeItem}>
                      <Text style={[s.feeLabel, { color: T.textDim }]}>Tx Limit</Text>
                      <Text style={[s.feeValue, { color: T.text }]}><CurrencyText amount={v.transaction_limit_usd} code={fiatCurrency} /></Text>
                    </View>
                    <View style={[s.feeDivider, { backgroundColor: T.border }]} />
                    <View style={s.feeItem}>
                      <Text style={[s.feeLabel, { color: T.textDim }]}>Tx Fee</Text>
                      <Text style={[s.feeValue, { color: T.text }]}>{(v.fee_rate ?? 1.50).toFixed(2)}%</Text>
                    </View>
                  </View>

                  {/* Settlement Currencies list */}
                  <View style={[s.currenciesRow, { borderBottomColor: T.border + '15' }]}>
                    <Text style={[s.feeLabel, { color: T.textDim }]}>SETTLEMENT</Text>
                    <View style={s.currencyPillContainer}>
                      {(v.currency_support || ['BTC', 'ETH', 'USDT', 'USDC']).map(coin => (
                        <View key={coin} style={[s.currencyPill, { backgroundColor: T.border + '10', borderColor: T.border }]}>
                          <Text style={[s.currencyText, { color: T.text }]}>{coin}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Features list */}
                  <View style={s.featuresList}>
                    {v.features.map((f, i) => (
                      <View key={i} style={s.featureRow}>
                        <Feather name="check-circle" size={14} color={T.success} />
                        <Text style={[s.featureText, { color: T.textMuted }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {isSelected && (
                  <View style={[s.selectedBadge, { backgroundColor: T.primary }]}>
                    <Feather name="check" size={14} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[s.continueBtn, { backgroundColor: T.primary }, !selected && { opacity: 0.4 }]}
            disabled={!selected}
            onPress={() => navigation.navigate('VCCPreview', { variant: selected })}
            activeOpacity={0.85}
          >
            <Text style={s.continueBtnText}>Select This Card</Text>
            <Feather name="arrow-right" size={18} color="#FFF" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 20 },
  subtitle: { fontSize: 13, marginBottom: 24, lineHeight: 18, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  errorText: { fontSize: 14, textAlign: 'center', fontWeight: '700' },
  retryBtn: { height: 52, paddingHorizontal: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  card: {
    borderRadius: 24, 
    marginBottom: 20, 
    overflow: 'hidden', 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfoContainer: { flex: 1, paddingRight: 10 },
  cardVariantName: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  cardNetwork: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '800', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 },
  networkBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 20 },
  channelContainer: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  channelBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  channelText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 16 },
  feeItem: { flex: 1, alignItems: 'center' },
  feeLabel: { fontSize: 9, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  feeValue: { fontSize: 16, fontWeight: '900' },
  feeDivider: { width: 1, height: 28, opacity: 0.5 },
  currenciesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 16 },
  currencyPillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  currencyPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  currencyText: { fontSize: 9, fontWeight: '800' },
  featuresList: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontWeight: '600' },
  selectedBadge: { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 60, borderRadius: 20, marginTop: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});

