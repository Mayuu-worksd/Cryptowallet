// Web shim for @react-native-async-storage/async-storage
// Uses localStorage on web to avoid the hooks bundling error

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch (_e) {}
  },
  async removeItem(key: string): Promise<void> {
    try { localStorage.removeItem(key); } catch (_e) {}
  },
  async multiRemove(keys: string[]): Promise<void> {
    try { keys.forEach(k => localStorage.removeItem(k)); } catch (_e) {}
  },
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try { return keys.map(k => [k, localStorage.getItem(k)]); } catch { return []; }
  },
  async clear(): Promise<void> {
    try { localStorage.clear(); } catch (_e) {}
  },
};

export default AsyncStorage;
export const useAsyncStorage = () => AsyncStorage;
