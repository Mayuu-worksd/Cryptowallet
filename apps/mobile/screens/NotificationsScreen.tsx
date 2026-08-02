import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import { useNotifications, AppNotification } from '../store/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  const handlePress = (notif: AppNotification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    haptics.selection();
    
    // Deep linking routing logic
    if (notif.type === 'card' || notif.type === 'card_transaction') {
      navigation.navigate('Card');
    } else if (notif.type === 'history' || notif.type === 'received' || notif.type === 'sent' || notif.type === 'swap') {
      navigation.navigate('Portfolio'); // or History if accessible
    } else if (notif.type === 'settings' || notif.type === 'update') {
      navigation.navigate('Profile');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'received': return { name: 'arrow-down-left', color: T.success };
      case 'sent': return { name: 'arrow-up-right', color: T.textMuted };
      case 'swap': return { name: 'refresh-cw', color: T.primary };
      case 'card': return { name: 'credit-card', color: '#6366F1' };
      case 'card_transaction': return { name: 'shopping-bag', color: '#F59E0B' };
      case 'history': return { name: 'file-text', color: '#8B5CF6' };
      case 'settings': return { name: 'settings', color: T.textDim };
      case 'update': return { name: 'download-cloud', color: T.primary };
      case 'news': return { name: 'globe', color: '#10B981' };
      default: return { name: 'bell', color: T.text };
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: T.background }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>Notifications</Text>
        <TouchableOpacity style={s.clearBtn} onPress={() => {
          haptics.warning();
          clearNotifications();
        }}>
          <Feather name="trash-2" size={20} color={T.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.controlsRow}>
          <Text style={[s.countText, { color: T.textDim }]}>
            {notifications.length} {notifications.length === 1 ? 'Message' : 'Messages'}
          </Text>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity onPress={() => {
              haptics.success();
              markAllAsRead();
            }}>
              <Text style={[s.markAllText, { color: T.primary }]}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>

        {notifications.length === 0 ? (
          <View style={s.emptyState}>
            <View style={[s.emptyIcon, { backgroundColor: T.surface }]}>
              <Feather name="bell-off" size={40} color={T.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: T.text }]}>No notifications yet</Text>
            <Text style={[s.emptySub, { color: T.textDim }]}>
              When you make transactions, receive assets, or have updates, they will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((notif) => {
            const iconDef = getIcon(notif.type);
            return (
              <TouchableOpacity
                key={notif.id}
                style={[
                  s.notifCard,
                  { backgroundColor: notif.read ? T.background : T.surfaceLow, borderBottomColor: T.border }
                ]}
                onPress={() => handlePress(notif)}
                activeOpacity={0.7}
              >
                {!notif.read && <View style={[s.unreadDot, { backgroundColor: T.primary }]} />}
                <View style={[s.iconBox, { backgroundColor: iconDef.color + '15' }]}>
                  <Feather name={iconDef.name as any} size={20} color={iconDef.color} />
                </View>
                <View style={s.notifContent}>
                  <View style={s.titleRow}>
                    <Text style={[s.notifTitle, { color: T.text, fontWeight: notif.read ? '600' : '800' }]} numberOfLines={1}>
                      {notif.title}
                    </Text>
                    <Text style={[s.notifTime, { color: T.textDim }]}>
                      {formatDistanceToNow(notif.timestamp, { addSuffix: true }).replace('about ', '')}
                    </Text>
                  </View>
                  <Text style={[s.notifBody, { color: notif.read ? T.textMuted : T.textDim }]} numberOfLines={2}>
                    {notif.body}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: 24,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  notifContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  notifTime: {
    fontSize: 12,
  },
  notifBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
