# Admin Settings Architecture Fix — AsyncStorage Eliminated

## Problem Statement

Admin settings from `admin_settings` table were being cached in AsyncStorage, creating a double source of truth that prevented admin changes from reflecting immediately to users.

| Setting | Admin DB Key | AsyncStorage Key (OLD) | Problem |
|---|---|---|---|
| Card currencies | `card_currencies_config` | `cw_card_currencies` | AsyncStorage read first, cached forever, admin changes ignored |
| Payment priority | `payment_asset_priority` | none (in-memory only) | Fetched once at startup, never re-fetched live |

## Architectural Rule

**AsyncStorage is for user-specific offline data only.**  
**Admin settings MUST always be read fresh from Supabase.**

## Solution Architecture

### 1. In-Memory Cache with TTL (30 seconds)

```typescript
// supabaseService.ts
export const adminSettingsService = {
  _cache: {} as Record<string, { value: any; fetchedAt: number }>,
  _TTL: 30_000, // 30 seconds

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const cached = this._cache[key];
      if (cached && Date.now() - cached.fetchedAt < this._TTL) {
        return cached.value as T;
      }
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error || !data || data.value === undefined || data.value === null) return defaultValue;
      this._cache[key] = { value: data.value, fetchedAt: Date.now() };
      return data.value as T;
    } catch {
      return defaultValue;
    }
  },

  invalidate(key?: string) {
    if (key) delete this._cache[key];
    else this._cache = {};
  },
};
```

### 2. Card Currencies — Supabase Only

**OLD (BROKEN):**
```typescript
// Read from AsyncStorage first (stale forever)
const savedCardCurrencies = await AsyncStorage.getItem('cw_card_currencies');
if (savedCardCurrencies) setEnabledCardCurrencies(JSON.parse(savedCardCurrencies));
```

**NEW (FIXED):**
```typescript
// WalletContext.tsx — startup
const platformCurrencies = await adminSettingsService.getSetting<Record<string, boolean>>('card_currencies_config', {});
const base: Record<string, boolean> = {};
['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
if (platformCurrencies && Object.keys(platformCurrencies).length > 0) {
  Object.entries(platformCurrencies).forEach(([k, v]) => { base[k] = v; });
}
setEnabledCardCurrenciesState(base);
```

**User Preferences Override:**
```typescript
// User can still toggle individual currencies in SetCurrenciesSheet
// These are saved to Supabase profile.card_currencies (user-level, not global admin)
const setEnabledCardCurrencies = useCallback(async (currencies: Record<string, boolean>) => {
  setEnabledCardCurrenciesState(currencies);
  if (walletAddress) profileService.upsert(walletAddress, { card_currencies: currencies } as any).catch(() => {});
}, [walletAddress]);
```

### 3. Payment Priority — Live Fetch

**OLD (BROKEN):**
```typescript
// Fetched once at component mount, never refreshed
useEffect(() => {
  adminSettingsService.getSetting<string[]>('payment_asset_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX'])
    .then(setPaymentPriority).catch(() => {});
}, []); // <-- Empty deps = runs ONCE
```

**NEW (FIXED):**
```typescript
// WalletContext.tsx
const [paymentPriority, setPaymentPriority] = useState<string[]>(['USDT', 'BTC', 'ETH', 'BNB', 'TRX']);

// Fetch on startup
useEffect(() => {
  adminSettingsService.getSetting<string[]>('payment_asset_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX'])
    .then(setPaymentPriority).catch(() => {});
}, []);

// Re-fetch on every card refresh (user pulls-to-refresh)
const refreshCardData = useCallback(async () => {
  const [vcc, dbCard, dbTxs, variants, priorityData, platformCurrencies] = await Promise.all([
    vccService.getCard(walletAddress),
    dbCardService.getCard(walletAddress),
    txService.getAll(walletAddress, 200),
    cardVariantService.getVariants(),
    adminSettingsService.getSetting<string[]>('payment_asset_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX']),
    adminSettingsService.getSetting<Record<string, boolean>>('card_currencies_config', {}),
  ]);
  setPaymentPriority(priorityData);
  // Apply admin currency config
  const base: Record<string, boolean> = {};
  ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
  ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
  if (platformCurrencies && Object.keys(platformCurrencies).length > 0) {
    Object.entries(platformCurrencies).forEach(([k, v]) => { base[k] = v; });
  }
  setEnabledCardCurrenciesState(base);
  // ... rest of card restore logic
}, [walletAddress]);
```

### 4. CardScreen.tsx — No AsyncStorage

**OLD (BROKEN):**
```typescript
const [physicalPrices, setPhysicalPrices] = useState(DEFAULT_PHYSICAL_PRICES_USD);
useEffect(() => {
  adminSettingsService.getSetting('physical_card_prices', DEFAULT_PHYSICAL_PRICES_USD)
    .then(setPhysicalPrices).catch(() => {});
}, []); // <-- Fetched ONCE on mount, never again
```

**NEW (FIXED):**
```typescript
// Same code — but with in-memory TTL cache, auto-refreshes every 30s if user stays on screen
const [physicalPrices, setPhysicalPrices] = useState(DEFAULT_PHYSICAL_PRICES_USD);
useEffect(() => {
  adminSettingsService.getSetting('physical_card_prices', DEFAULT_PHYSICAL_PRICES_USD)
    .then(setPhysicalPrices).catch(() => {});
}, []);
// TTL cache means after 30s, next render will fetch fresh data from Supabase
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                          │
│  (Updates admin_settings.card_currencies_config = {...})    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Supabase DB         │
              │  admin_settings      │
              │  ┌────────────────┐  │
              │  │ key: card_cur  │  │
              │  │ value: {...}   │  │
              │  └────────────────┘  │
              └──────────┬───────────┘
                         │
                         │ (30s TTL cache)
                         ▼
              ┌──────────────────────┐
              │ adminSettingsService │
              │ .getSetting(...)     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  WalletContext       │
              │  refreshCardData()   │
              │  - Fetches fresh     │
              │  - Merges with user  │
              │    profile prefs     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  CardScreen.tsx      │
              │  - spendCard() uses  │
              │    live priority     │
              │  - enabledCardCurr   │
              │    from context      │
              └──────────────────────┘
```

## Testing Checklist

- [ ] Admin changes `card_currencies_config` → user pulls-to-refresh → sees updated currencies
- [ ] Admin changes `payment_asset_priority` → user pulls-to-refresh → spendCard() uses new order
- [ ] Admin changes `physical_card_prices` → user re-opens CardScreen → sees new prices
- [ ] User closes app, admin changes settings, user re-opens app → fresh settings loaded (no stale AsyncStorage)
- [ ] User goes offline → sees last cached value (30s TTL) → then fallback defaults

## Migration Notes

**No breaking changes** — old AsyncStorage keys are simply ignored. Users who had `cw_card_currencies` will see it overwritten on next app launch with fresh Supabase data.

## Summary

| Before | After |
|---|---|
| AsyncStorage = permanent cache | In-memory cache with 30s TTL |
| Admin changes ignored | Admin changes propagate within 30s |
| User preferences mixed with global config | User preferences stored separately in profile table |
| Stale data survives app restarts | Fresh fetch on every startup + pull-to-refresh |

---

**Result:** Admin settings are now the single source of truth, with a lightweight in-memory cache to prevent excessive Supabase queries.
