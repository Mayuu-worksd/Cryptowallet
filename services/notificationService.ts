import * as Notifications from 'expo-notifications';
import { Platform, DeviceEventEmitter } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (_e) {}
}

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (_e) {
      return false;
    }
  },

  async notifyReceived(coin: string, amount: string, usdValue: string) {
    const content = {
      title: `💰 ${coin} Received!`,
      body: `You received ${amount} ${coin} (~$${usdValue})`,
      data: { type: 'received', coin },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'received' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyNews(title: string, source: string) {
    const content = {
      title: `📰 ${source}`,
      body: title,
      data: { type: 'news' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'news' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifySwapComplete(sellToken: string, buyToken: string, buyAmount: string) {
    const content = {
      title: '✅ Swap Complete!',
      body: `Received ${buyAmount} ${buyToken} for your ${sellToken}`,
      data: { type: 'swap' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'swap' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifySendComplete(coin: string, amount: string, toAddress: string) {
    const content = {
      title: `📤 ${coin} Sent`,
      body: `${amount} ${coin} sent to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
      data: { type: 'sent' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'sent' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCurrencyPreferenceUpdated(newCurrency: string) {
    const content = {
      title: '💱 Currency Preference Updated',
      body: `Your default display currency has been updated to ${newCurrency}.`,
      data: { type: 'settings' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'settings' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCardFrozen(last4: string) {
    const content = {
      title: '❄️ Card Frozen',
      body: `Your card ending in ${last4} has been frozen. You will not be able to make purchases until it is unfrozen.`,
      data: { type: 'card', last4 },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCardUnfrozen(last4: string) {
    const content = {
      title: '🔥 Card Unfrozen',
      body: `Your card ending in ${last4} is now active and ready for use.`,
      data: { type: 'card', last4 },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCardPaymentSuccess(merchant: string, amount: string, currency: string) {
    const content = {
      title: '🛍️ Payment Successful',
      body: `You paid ${currency} ${amount} at ${merchant}.`,
      data: { type: 'card_transaction' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card_transaction' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCardPaymentFailed(merchant: string, amount: string, currency: string, reason: string) {
    const content = {
      title: '❌ Payment Declined',
      body: `Your payment of ${currency} ${amount} at ${merchant} was declined. Reason: ${reason}.`,
      data: { type: 'card_transaction' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card_transaction' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyMultiAssetSettlement(assets: string[]) {
    const content = {
      title: '🔄 Multi-Asset Settlement',
      body: `Your recent card payment was settled across multiple assets: ${assets.join(', ')}.`,
      data: { type: 'history' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'history' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCommissionApplied(feeAmount: string, asset: string) {
    const content = {
      title: '📉 Commission Fee Applied',
      body: `A processing fee of ${feeAmount} ${asset} was applied to your recent transaction.`,
      data: { type: 'history' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'history' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyCardCurrencySettingsUpdated(currencies: string[]) {
    const content = {
      title: '⚙️ Card Funding Updated',
      body: `Your card is now funded by: ${currencies.join(', ')}.`,
      data: { type: 'card' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifySettlementPriorityUpdated(priorityList: string[]) {
    const content = {
      title: '⚡ Settlement Priority Updated',
      body: `Card settlement priority updated to: ${priorityList.join(' > ')}.`,
      data: { type: 'card' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyAppUpdateAvailable(version: string) {
    const content = {
      title: '🚀 New Update Available',
      body: `Version ${version} is ready to install! Tap here to restart and update.`,
      data: { type: 'update' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'update' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },

  async notifyAppUpdatedSuccessfully(version: string) {
    const content = {
      title: '✨ App Updated Successfully',
      body: `You are now running version ${version}. Enjoy the latest features!`,
      data: { type: 'settings' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'settings' });
    if (isExpoGo) return;
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch (_e) {}
  },
};
