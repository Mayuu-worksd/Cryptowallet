import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform, Pressable
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CardTransaction } from '../../store/WalletContext';

type Props = {
  visible: boolean;
  transaction: CardTransaction | null;
  onClose: () => void;
};

export default function TransactionDetailsSheet({ visible, transaction, onClose }: Props) {
  if (!transaction) return null;

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const amountDisplay = transaction.currencyUsed 
    ? `${transaction.amount.toFixed(2)} ${transaction.currencyUsed}` 
    : `$${transaction.amount.toFixed(2)}`;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={{ width: 34 }} />
            <Text style={styles.headerTitle}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            <View style={styles.amountHeader}>
              <Text style={styles.merchantNameLarge}>{transaction.label}</Text>
              <Text style={styles.amountLarge}>{amountDisplay}</Text>
              <View style={styles.statusBadge}>
                <Feather name="check-circle" size={14} color="#26A17B" />
                <Text style={styles.statusText}>Completed</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <DetailRow label="Merchant Name" value={transaction.label} />
              <DetailRow label="Date" value={formatDate(transaction.timestamp)} />
              <DetailRow label="Transaction ID" value={transaction.id} />
              <DetailRow label="Merchant Category" value={transaction.merchantCategory || 'Retail'} />
              <DetailRow label="Country" value={transaction.country || 'USA'} />
              <DetailRow label="Card Used" value={transaction.cardUsed || '•••• 5407'} />
            </View>

            <Text style={styles.sectionTitle}>Settlement Details</Text>
            <View style={styles.detailsCard}>
              <DetailRow label="Currency Used" value={transaction.currencyUsed || 'USD'} />
              {transaction.exchangeRate && (
                <DetailRow label="Exchange Rate" value={transaction.exchangeRate.toString()} />
              )}
              
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Settlement Breakdown</Text>
                {transaction.settlementBreakdown && Object.keys(transaction.settlementBreakdown).length > 0 ? (
                  Object.entries(transaction.settlementBreakdown).map(([coin, val]) => (
                    <View key={coin} style={styles.breakdownRow}>
                      <Text style={styles.breakdownCoin}>{coin}</Text>
                      <Text style={styles.breakdownAmount}>${val.toFixed(2)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.breakdownEmpty}>
                    {transaction.coin ? `${transaction.coin}: ${amountDisplay}` : 'No breakdown available'}
                  </Text>
                )}
              </View>
            </View>

          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#101114',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 550 : undefined,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1c1b1b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 10 },
  
  amountHeader: {
    alignItems: 'center',
    marginVertical: 24,
  },
  merchantNameLarge: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    fontWeight: '600',
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 161, 123, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    color: '#26A17B',
    fontSize: 13,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  detailsCard: {
    backgroundColor: '#1C1B1E',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },

  breakdownSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  breakdownTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownCoin: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  breakdownAmount: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '700',
  },
  breakdownEmpty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
});
