import { Platform, AppState, AppStateStatus } from 'react-native';
import { storageService } from './storageService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cryptowallet-dun.vercel.app';

// Generate session ID on app launch
const SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let currentScreen = 'Home';
let currentWallet = '';
let currentUid: number | undefined;
let heartbeatInterval: any = null;
let isStarted = false;

async function sendTelemetry(action: 'hit' | 'heartbeat' | 'leave' = 'hit', screenName?: string) {
  try {
    const deviceId = await storageService.getOrCreateDeviceId();
    const activeScreen = screenName || currentScreen;
    
    // Non-blocking fetch
    fetch(`${API_BASE_URL}/api/public/traffic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
        device_id: deviceId,
        wallet_address: currentWallet || undefined,
        user_uid: currentUid || undefined,
        platform: Platform.OS,
        device_model: `${Platform.OS === 'ios' ? 'Apple Device' : 'Android Device'} (${Platform.Version})`,
        app_version: '1.0.0',
        screen_name: activeScreen,
        action,
      }),
    }).catch(() => {
      // Completely silent on network hiccups — zero UI interruption
    });
  } catch {
    // Silent
  }
}

export const telemetryService = {
  /**
   * Initializes the traffic monitor & session heartbeat
   */
  start(walletAddress?: string, userUid?: number | string) {
    if (walletAddress) currentWallet = walletAddress;
    if (userUid) currentUid = typeof userUid === 'string' ? parseInt(userUid, 10) : userUid;

    if (!isStarted) {
      isStarted = true;
      // Send initial app launch hit
      sendTelemetry('hit', 'Home');

      // Setup 40s heartbeat while app is open
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        sendTelemetry('heartbeat');
      }, 40000);

      // Listen for app foreground / background
      AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          sendTelemetry('heartbeat');
        } else if (nextState === 'background') {
          sendTelemetry('leave');
        }
      });
    }
  },

  /**
   * Updates user info when logged in or restored
   */
  updateUser(walletAddress?: string, userUid?: number | string) {
    if (walletAddress) currentWallet = walletAddress;
    if (userUid) currentUid = typeof userUid === 'string' ? parseInt(userUid, 10) : userUid;
    sendTelemetry('heartbeat');
  },

  /**
   * Logs a screen visit hit
   */
  logScreen(screenName: string) {
    currentScreen = screenName;
    sendTelemetry('hit', screenName);
  },
};
