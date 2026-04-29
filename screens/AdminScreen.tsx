import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Update this to your deployed admin URL (or local dev URL)
const ADMIN_URL = 'http://localhost:3001';

export default function AdminScreen({ navigation }: any) {
  const open = () => Linking.openURL(ADMIN_URL);

  return (
    <View style={s.root}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
        <Feather name="arrow-left" size={20} color="#f0f0f2" />
      </TouchableOpacity>

      <View style={s.iconWrap}>
        <Feather name="shield" size={36} color="#EC2629" />
      </View>

      <Text style={s.title}>Admin Panel</Text>
      <Text style={s.sub}>The admin panel runs as a standalone web app.</Text>

      <TouchableOpacity style={s.btn} onPress={open} activeOpacity={0.85}>
        <Feather name="external-link" size={16} color="#FFF" />
        <Text style={s.btnText}>Open Admin Panel</Text>
      </TouchableOpacity>

      <Text style={s.url}>{ADMIN_URL}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0d0d0f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  back:    { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1e', alignItems: 'center', justifyContent: 'center' },
  iconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EC262918', borderWidth: 1, borderColor: '#EC262930', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title:   { fontSize: 24, fontWeight: '900', color: '#f0f0f2' },
  sub:     { fontSize: 14, color: '#6b6b78', textAlign: 'center', lineHeight: 21 },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 32, borderRadius: 18, backgroundColor: '#EC2629', shadowColor: '#EC2629', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginTop: 8 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  url:     { fontSize: 12, color: '#3a3a42', marginTop: 4 },
});
