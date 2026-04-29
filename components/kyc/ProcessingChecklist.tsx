import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ItemState = 'waiting' | 'loading' | 'done' | 'error';

export interface ChecklistItem {
  label: string;
  state: ItemState;
}

interface Props {
  items: ChecklistItem[];
}

export default function ProcessingChecklist({ items }: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.container}>
      {items.map((item, i) => (
        <View key={i} style={s.row}>
          <View style={s.iconWrap}>
            {item.state === 'done' ? (
              <Feather name="check-circle" size={22} color="#00C853" />
            ) : item.state === 'error' ? (
              <Feather name="x-circle" size={22} color="#FF3B3B" />
            ) : item.state === 'loading' ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Feather name="loader" size={22} color="#FF3B3B" />
              </Animated.View>
            ) : (
              <Feather name="circle" size={22} color="#2E3036" />
            )}
          </View>
          <Text style={[
            s.label,
            item.state === 'done'    && { color: '#FFF' },
            item.state === 'loading' && { color: '#FFF' },
            item.state === 'error'   && { color: '#FF3B3B' },
            item.state === 'waiting' && { color: '#5C6068' },
          ]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 18, width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 28, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});
