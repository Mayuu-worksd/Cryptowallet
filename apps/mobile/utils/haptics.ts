import { Platform } from 'react-native';

let Haptics: any = null;

// expo-haptics only works on native — import lazily so web doesn't crash
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch (_e) {}
}

export const haptics = {
  /** Light tap — button press, selection */
  selection() {
    try { Haptics?.selectionAsync?.(); } catch (_e) {}
  },
  /** Success action — send complete, swap done */
  success() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType?.Success); } catch (_e) {}
  },
  /** Error — failed tx, validation error */
  error() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType?.Error); } catch (_e) {}
  },
  /** Warning — mainnet alert, destructive action */
  warning() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType?.Warning); } catch (_e) {}
  },
  /** Heavy impact — delete wallet, confirm destructive */
  heavy() {
    try { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy); } catch (_e) {}
  },
};
