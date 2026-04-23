# CryptoWallet

A non-custodial Ethereum wallet built with React Native (Expo) and ethers.js. Supports real on-chain transactions on Ethereum, Polygon, and Arbitrum mainnet, plus Sepolia testnet. Includes a virtual card system, live market data, token swaps via 0x Protocol, and a full transaction history with on-chain verification.

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-blue?style=flat-square)
![Built with Expo](https://img.shields.io/badge/Built%20with-Expo%20SDK%2054-000020?style=flat-square&logo=expo)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)
![ethers.js](https://img.shields.io/badge/Web3-ethers.js%20v5-purple?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Quick Test — No Setup Required

### Android APK (Fastest)
1. Download the APK directly from the [EAS Build Dashboard](https://expo.dev/accounts/kooo455/projects/CryptoWallet/builds)
2. Open the APK on your Android phone
3. If prompted, allow **"Install from unknown sources"**
4. Install and open — no Expo Go needed

### iOS (iPhone) — Expo Go
1. Install **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779)
2. Clone the repo and run `npx expo start` (see setup below)
3. Scan the QR code with your iPhone camera
4. App opens instantly — no Apple Developer account needed

> **Note:** Push notifications are disabled in Expo Go. All other features work fully.

---

## What This App Does

- **Create or import a wallet** using a standard BIP39 12/24-word seed phrase
- **Send ETH** on mainnet with real gas estimation, confirmation modal, and on-chain broadcast
- **Receive crypto** via QR code — supports Ethereum, Polygon, Arbitrum, Sepolia
- **Swap tokens** using 0x Protocol DEX aggregator (mainnet) + Uniswap V3 (Sepolia testnet)
- **Virtual card** — top up with ETH/USDC/USDT/DAI, freeze/unfreeze, full spend history
- **Live prices** from CoinGecko — ETH, BTC, SOL, MATIC, BNB, USDC, USDT, DAI
- **Price charts** per coin with 1D / 7D / 1M / 3M / 1Y ranges
- **Transaction history** merged from local state + on-chain Etherscan data
- **PIN lock** with SHA-256 hashing, per-device salt, and escalating lockout tiers
- **Dark and light mode** with full theme support across all screens
- **Network switching** — Sepolia testnet, Ethereum, Polygon, Arbitrum with mainnet warnings

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Expo Go on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### 1. Clone the repo

```bash
git clone https://github.com/Mayuu-worksd/Cryptowallet.git
cd Cryptowallet
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
EXPO_PUBLIC_ALCHEMY_KEY=your_alchemy_key
EXPO_PUBLIC_WEB_SALT=cw_w3b_s4lt_2024
EXPO_PUBLIC_ETHERSCAN_KEY=your_etherscan_key
EXPO_PUBLIC_ZRX_API_KEY=your_zrx_api_key
```

| Key | Service | Get it free at |
|---|---|---|
| `EXPO_PUBLIC_ALCHEMY_KEY` | Ethereum RPC | [alchemy.com](https://alchemy.com) |
| `EXPO_PUBLIC_ETHERSCAN_KEY` | Transaction history | [etherscan.io/apis](https://etherscan.io/apis) |
| `EXPO_PUBLIC_ZRX_API_KEY` | Token swaps | [0x.org](https://0x.org) |

> Contact **wickb5825@gmail.com** to get the test API keys directly.

### 4. Start the development server

```bash
npx expo start --clear
```

---

## Testing on Android

### Option A — Expo Go (Quick)
1. Install [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) on your Android phone
2. Run `npx expo start --clear` on your PC
3. Make sure phone and PC are on the **same Wi-Fi**
4. Scan the QR code shown in the terminal

### Option B — Direct APK Install (Recommended)
1. Download APK from [EAS Dashboard](https://expo.dev/accounts/kooo455/projects/CryptoWallet/builds)
2. Transfer to phone and install
3. No Expo Go needed — works as a standalone app

---

## Testing on iOS (iPhone)

You do **not** need a Mac or Apple Developer account.

### Option A — Expo Go (Easiest)
1. Install **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779)
2. Run `npx expo start --clear` on your PC
3. Make sure iPhone and PC are on the **same Wi-Fi network**
4. Open iPhone Camera → scan the QR code in the terminal
5. App opens in Expo Go instantly

### Option B — TestFlight (Full Native Build)
Requires Apple Developer account ($99/year):
```bash
eas build --platform ios --profile production
eas submit --platform ios
```
Then invite testers via TestFlight in App Store Connect.

> For iOS testing without a Mac, **Option A (Expo Go) is the recommended approach.**

---

## Building the APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
eas build --platform android --profile preview
```

APK download link appears in your [Expo dashboard](https://expo.dev/accounts/kooo455/projects/CryptoWallet/builds) when done (~10-15 mins).

---

## APIs Used

| API | Purpose | Key Required |
|---|---|---|
| **Alchemy** | Ethereum RPC — balance, gas, send | Yes |
| **CoinGecko** | Live prices, charts, news | No (free tier) |
| **0x Protocol** | Token swap quotes + execution | Optional |
| **Etherscan V2** | On-chain transaction history | Optional |
| **RSS2JSON** | Fallback crypto news feed | No |

### Fallback Behaviour
- CoinGecko fails → last known prices shown, error banner with retry
- 0x API fails → price estimate shown, Confirm button disabled until live quote loads
- Etherscan fails → local transaction history still shown
- News fails → static fallback news shown

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Core mobile framework |
| Expo SDK | 54 | Build tooling, native modules |
| ethers.js | 5.7.2 | Ethereum wallet, signing, RPC |
| expo-secure-store | 15.x | OS-level encrypted key storage |
| React Navigation | 6.x | Stack + bottom tab navigation |
| expo-camera | 17.x | QR code scanning |
| react-native-reanimated | 4.x | Animations |
| react-native-gesture-handler | 2.x | Gesture support |
| AsyncStorage | 2.x | Non-sensitive local persistence |
| TypeScript | 5.9 | Type safety throughout |

---

## Project Structure

```
CryptoWallet/
├── assets/                  # App icons, splash, screenshots
├── components/              # Reusable UI components
├── constants/               # Theme tokens, coin metadata, network config
├── screens/                 # All app screens
│   ├── HomeScreen.tsx       # Dashboard — balance, assets, market, news
│   ├── SendScreen.tsx       # Send ETH with gas estimation
│   ├── ReceiveScreen.tsx    # QR code generation
│   ├── SwapScreen.tsx       # Token swap via 0x Protocol
│   ├── CardScreen.tsx       # Virtual card — top up, freeze, transactions
│   ├── PortfolioScreen.tsx  # Full asset list with 24h change
│   ├── HistoryScreen.tsx    # Transaction history
│   ├── CoinChartScreen.tsx  # Per-coin price chart
│   ├── SettingsScreen.tsx   # Network, PIN, theme, seed phrase
│   ├── ScanScreen.tsx       # QR scanner
│   ├── PinScreen.tsx        # PIN setup and verify
│   ├── CreateWalletScreen.tsx
│   ├── ImportWalletScreen.tsx
│   └── OnboardingScreen.tsx
├── services/                # All business logic
│   ├── ethereumService.ts   # RPC calls
│   ├── walletService.ts     # Wallet creation + import
│   ├── storageService.ts    # Secure key storage
│   ├── marketService.ts     # CoinGecko prices + news
│   ├── swapService.ts       # 0x Protocol swap
│   ├── balanceService.ts    # On-chain balance fetching
│   ├── etherscanService.ts  # Transaction history
│   └── pinService.ts        # PIN hash + lockout
├── store/
│   └── WalletContext.tsx    # Global state
├── config.ts                # RPC URL builder
├── App.tsx                  # Root navigation
├── app.json                 # Expo config
└── eas.json                 # EAS Build profiles
```

---

## Security Model

| Layer | Mobile | Web |
|---|---|---|
| Private key storage | `expo-secure-store` → OS Keychain/Keystore (AES-256) | XOR + base64 in localStorage |
| PIN storage | SHA-256 + per-device random salt | Same |
| Key never leaves device | ✅ Yes | ✅ Yes |
| SSRF protection | ✅ URL allowlist on all API calls | ✅ Same |

### PIN Lockout Tiers

| Failed Attempts | Lockout |
|---|---|
| 5 | 30 seconds |
| 10 | 1 minute |
| 15+ | 5 minutes |

---

## Known Limitations

- BTC and SOL balances are always 0 — different blockchains, not supported
- Virtual card is a simulation — not connected to a real card network
- Web version is not safe for real mainnet funds
- QR gallery import not implemented — use camera for scanning

---

## Contact

**Karthick Mayur**
📧 wickb5825@gmail.com
🐙 [github.com/Mayuu-worksd](https://github.com/Mayuu-worksd)

---

<p align="center">Built with ❤️ by <a href="https://github.com/Mayuu-worksd">Mayuu-worksd</a></p>
