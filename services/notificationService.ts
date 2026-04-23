import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async notifyReceived(coin: string, amount: string, usdValue: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💰 ${coin} Received!`,
        body: `You received ${amount} ${coin} (~$${usdValue})`,
        data: { type: 'received', coin },
        sound: true,
      },
      trigger: null,
    });
  },

  async notifyNews(title: string, source: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📰 ${source}`,
        body: title,
        data: { type: 'news' },
        sound: false,
      },
      trigger: null,
    });
  },

  async notifySwapComplete(sellToken: string, buyToken: string, buyAmount: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Swap Complete!',
        body: `Received ${buyAmount} ${buyToken} for your ${sellToken}`,
        data: { type: 'swap' },
        sound: true,
      },
      trigger: null,
    });
  },

  async notifySendComplete(coin: string, amount: string, toAddress: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📤 ${coin} Sent`,
        body: `${amount} ${coin} sent to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        data: { type: 'sent' },
        sound: true,
      },
      trigger: null,
    });
  },
};
