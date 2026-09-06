import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Theme, Fonts } from '../constants';
import { useWallet } from '../store/WalletContext';
import { cmsService, CMSPageData } from '../services/cmsService';
import { haptics } from '../utils/haptics';

export default function CMSContentScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useWallet() as any;
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const slug = route?.params?.slug ?? 'terms';
  const defaultTitle = route?.params?.title ?? (slug === 'terms' ? 'Terms of Service' : (slug === 'privacy' ? 'Privacy Policy' : 'About Us'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<CMSPageData | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cmsService.getPage(slug);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setPage(res.data);
      } else {
        setError('Page content not available.');
      }
    } catch (e: any) {
      setError(e?.message || 'Network error occurred while fetching document.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Clean Markdown Renderer for Mobile Screen
  const renderFormattedContent = (rawText: string) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Horizontal Rule
      if (trimmed === '---' || trimmed === '***') {
        return <View key={idx} style={[styles.hr, { backgroundColor: T.border }]} />;
      }

      // H1 Header
      if (trimmed.startsWith('# ')) {
        return (
          <Text key={idx} style={[styles.h1, { color: T.text }]}>
            {trimmed.replace('# ', '')}
          </Text>
        );
      }

      // H2 Header
      if (trimmed.startsWith('## ')) {
        return (
          <Text key={idx} style={[styles.h2, { color: T.text }]}>
            {trimmed.replace('## ', '')}
          </Text>
        );
      }

      // H3 Header
      if (trimmed.startsWith('### ')) {
        return (
          <Text key={idx} style={[styles.h3, { color: T.text }]}>
            {trimmed.replace('### ', '')}
          </Text>
        );
      }

      // Bullet Point
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.slice(2);
        return (
          <View key={idx} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: T.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: T.text }]}>
              {parseBold(bulletText, T.text)}
            </Text>
          </View>
        );
      }

      // Empty line
      if (trimmed === '') {
        return <View key={idx} style={{ height: 10 }} />;
      }

      // Standard Paragraph
      return (
        <Text key={idx} style={[styles.paragraph, { color: T.text }]}>
          {parseBold(line, T.text)}
        </Text>
      );
    });
  };

  // Helper to parse **bold** text inside paragraph strings
  const parseBold = (textStr: string, textColor: string) => {
    const parts = textStr.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={{ fontFamily: Fonts.bold, color: textColor }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: T.surface, borderColor: T.border, paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            haptics.selection();
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>
          {page?.title || defaultTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={[styles.loadingText, { color: T.textMuted }]}>
            Fetching latest document...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={[styles.errorIconBox, { backgroundColor: T.error + '20' }]}>
            <Feather name="alert-triangle" size={32} color={T.error} />
          </View>
          <Text style={[styles.errorTitle, { color: T.text }]}>Unable to Load Document</Text>
          <Text style={[styles.errorSub, { color: T.textMuted }]}>{error}</Text>

          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: T.primary }]}
            onPress={() => {
              haptics.selection();
              fetchContent();
            }}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={16} color="#FFF" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {page?.updated_at && (
            <View style={[styles.updatedBadge, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="clock" size={12} color={T.textMuted} />
              <Text style={[styles.updatedText, { color: T.textMuted }]}>
                Last Updated: {new Date(page.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          )}

          <View style={styles.bodyWrap}>
            {renderFormattedContent(page?.content || '')}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 8,
  },
  errorIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
  },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  updatedText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  bodyWrap: {
    gap: 4,
  },
  h1: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 3,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    flex: 1,
  },
  hr: {
    height: 1,
    marginVertical: 16,
  },
});
