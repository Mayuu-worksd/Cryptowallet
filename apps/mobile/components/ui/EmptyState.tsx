import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  icon?: FeatherIconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  T: any; // theme colors
};

export default memo(function EmptyState({ icon = 'inbox', title, subtitle, actionLabel, onAction, T }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
        <Feather name={icon} size={30} color={T.textMuted} />
      </View>
      <Text style={[styles.title, { color: T.text }]}>{title}</Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: T.textMuted }]}>{subtitle}</Text>
      )}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: T.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, gap: 12 },
  iconBox:   { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:     { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  actionBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  actionText:{ color: '#FFF', fontSize: 14, fontWeight: '700' },
});
