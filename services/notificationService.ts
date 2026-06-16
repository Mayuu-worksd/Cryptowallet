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
    if (isExpoGo) return;
    const content = {
      title: `💰 ${coin} Received!`,
      body: `You received ${amount} ${coin} (~$${usdValue})`,
      data: { type: 'received', coin },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'received' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyNews(title: string, source: string) {
    if (isExpoGo) return;
    const content = {
      title: `📰 ${source}`,
      body: title,
      data: { type: 'news' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'news' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifySwapComplete(sellToken: string, buyToken: string, buyAmount: string) {
    if (isExpoGo) return;
    const content = {
      title: '✅ Swap Complete!',
      body: `Received ${buyAmount} ${buyToken} for your ${sellToken}`,
      data: { type: 'swap' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'swap' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifySendComplete(coin: string, amount: string, toAddress: string) {
    if (isExpoGo) return;
    const content = {
      title: `📤 ${coin} Sent`,
      body: `${amount} ${coin} sent to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
      data: { type: 'sent' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'sent' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCurrencyPreferenceUpdated(newCurrency: string) {
    if (isExpoGo) return;
    const content = {
      title: '💱 Currency Preference Updated',
      body: `Your default display currency has been updated to ${newCurrency}.`,
      data: { type: 'settings' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'settings' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCardFrozen(last4: string) {
    if (isExpoGo) return;
    const content = {
      title: '❄️ Card Frozen',
      body: `Your card ending in ${last4} has been frozen. You will not be able to make purchases until it is unfrozen.`,
      data: { type: 'card', last4 },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCardUnfrozen(last4: string) {
    if (isExpoGo) return;
    const content = {
      title: '🔥 Card Unfrozen',
      body: `Your card ending in ${last4} is now active and ready for use.`,
      data: { type: 'card', last4 },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCardPaymentSuccess(merchant: string, amount: string, currency: string) {
    if (isExpoGo) return;
    const content = {
      title: '🛍️ Payment Successful',
      body: `You paid ${currency} ${amount} at ${merchant}.`,
      data: { type: 'card_transaction' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card_transaction' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCardPaymentFailed(merchant: string, amount: string, currency: string, reason: string) {
    if (isExpoGo) return;
    const content = {
      title: '❌ Payment Declined',
      body: `Your payment of ${currency} ${amount} at ${merchant} was declined. Reason: ${reason}.`,
      data: { type: 'card_transaction' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card_transaction' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyMultiAssetSettlement(assets: string[]) {
    if (isExpoGo) return;
    const content = {
      title: '🔄 Multi-Asset Settlement',
      body: `Your recent card payment was settled across multiple assets: ${assets.join(', ')}.`,
      data: { type: 'history' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'history' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCommissionApplied(feeAmount: string, asset: string) {
    if (isExpoGo) return;
    const content = {
      title: '📉 Commission Fee Applied',
      body: `A processing fee of ${feeAmount} ${asset} was applied to your recent transaction.`,
      data: { type: 'history' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'history' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyCardCurrencySettingsUpdated(currencies: string[]) {
    if (isExpoGo) return;
    const content = {
      title: '⚙️ Card Funding Updated',
      body: `Your card is now funded by: ${currencies.join(', ')}.`,
      data: { type: 'card' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifySettlementPriorityUpdated(priorityList: string[]) {
    if (isExpoGo) return;
    const content = {
      title: '⚡ Settlement Priority Updated',
      body: `Card settlement priority updated to: ${priorityList.join(' > ')}.`,
      data: { type: 'card' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'card' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyAppUpdateAvailable(version: string) {
    if (isExpoGo) return;
    const content = {
      title: '🚀 New Update Available',
      body: `Version ${version} is ready to install! Tap here to restart and update.`,
      data: { type: 'update' },
      sound: true,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'update' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },

  async notifyAppUpdatedSuccessfully(version: string) {
    if (isExpoGo) return;
    const content = {
      title: '✨ App Updated Successfully',
      body: `You are now running version ${version}. Enjoy the latest features!`,
      data: { type: 'settings' },
      sound: false,
    };
    DeviceEventEmitter.emit('onNewNotification', { ...content, type: 'settings' });
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  },
};
