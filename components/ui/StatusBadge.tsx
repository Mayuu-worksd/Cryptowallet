import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Status = 'completed' | 'pending' | 'failed';

type Props = {
  status: Status;
  T: any; // theme colors
};

export default memo(function StatusBadge({ status, T }: Props) {
  const color =
    status === 'completed' ? T.success :
    status === 'pending'   ? T.pending : T.error;

  const label =
    status === 'completed' ? 'Completed' :
    status === 'pending'   ? 'Pending'   : 'Failed';

  return (
    <View style={[styles.wrap, { backgroundColor: color + '18' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});
