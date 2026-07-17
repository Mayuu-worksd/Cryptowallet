import * as ScreenCapture from 'expo-screen-capture';
import { Platform, AppState } from 'react-native';

class ScreenSecurityManager {
  private activeLocks = new Set<string>();
  private timeoutId: any = null;

  constructor() {
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          this.apply();
        }
      });
    }
  }

  getActiveLocks() {
    return Array.from(this.activeLocks);
  }

  acquire(key: string) {
    this.activeLocks.add(key);
    this.scheduleApply();
  }

  release(key: string) {
    this.activeLocks.delete(key);
    this.scheduleApply();
  }

  private scheduleApply() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    // We run immediately if we are enabling security to make sure it's instant.
    // We defer if we are disabling security to avoid race conditions during screen transitions.
    if (this.activeLocks.size > 0) {
      this.apply();
    } else {
      this.timeoutId = setTimeout(() => {
        this.apply();
      }, 100);
    }
  }

  private async apply() {
    if (Platform.OS === 'web') return;
    try {
      if (this.activeLocks.size > 0) {
        await ScreenCapture.preventScreenCaptureAsync();
      } else {
        await ScreenCapture.allowScreenCaptureAsync();
      }
    } catch (e) {
      console.warn('Failed to apply screen security:', e);
    }
  }
}

export const screenSecurityManager = new ScreenSecurityManager();

const NON_SENSITIVE_SCREENS = ['Landing', 'Onboarding', 'Splash'];

let registeredNavRef: any = null;

export function registerNavigationRef(ref: any) {
  registeredNavRef = ref;
}

export function updateScreenSecurity(forceSecure: boolean = false) {
  if (forceSecure) {
    screenSecurityManager.acquire('pin-screen');
    return;
  } else {
    screenSecurityManager.release('pin-screen');
  }

  const routeName = registeredNavRef?.isReady() ? registeredNavRef.getCurrentRoute()?.name : null;
  
  if (routeName) {
    if (!NON_SENSITIVE_SCREENS.includes(routeName)) {
      screenSecurityManager.acquire(`route-${routeName}`);
    } else {
      screenSecurityManager.release(`route-${routeName}`);
    }

    // Release any route locks that are NOT the current route
    for (const lock of screenSecurityManager.getActiveLocks()) {
      if (lock.startsWith('route-') && lock !== `route-${routeName}`) {
        screenSecurityManager.release(lock);
      }
    }
  }
}
