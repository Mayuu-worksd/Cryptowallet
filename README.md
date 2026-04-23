# CryptoWallet

A non-custodial Ethereum wallet built with React Native (Expo) and ethers.js. Supports real on-chain transactions on Ethereum, Polygon, and Arbitrum mainnet, plus Sepolia testnet. Includes a virtual card system, live market data, token swaps via 0x Protocol, and a full transaction history with on-chain verification.

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-blue?style=flat-square)
![Built with Expo](https://img.shields.io/badge/Built%20with-Expo%20SDK%2054-000020?style=flat-square&logo=expo)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)
![ethers.js](https://img.shields.io/badge/Web3-ethers.js%20v5-purple?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="./assets/screenshots/onboarding.png" width="160" /><br/><b>Onboarding</b></td>
      <td align="center"><img src="./assets/screenshots/home-dashboard.png" width="160" /><br/><b>Dashboard</b></td>
      <td align="center"><img src="./assets/screenshots/send.png" width="160" /><br/><b>Send</b></td>
      <td align="center"><img src="./assets/screenshots/receive-qr.png" width="160" /><br/><b>Receive</b></td>
      <td align="center"><img src="./assets/screenshots/swap.png" width="160" /><br/><b>Swap</b></td>
    </tr>
  </table>
</div>

---

## What This App Does

- **Create or import a wallet** using a standard BIP39 12-word seed phrase
- **Send ETH** on mainnet with real gas estimation, confirmation modal, and on-chain broadcast
- **Receive crypto** via QR code — supports Ethereum, Polygon, Arbitrum, BNB Chain, Sepolia
- **Swap tokens** using the 0x Protocol DEX aggregator (Ethereum, Polygon, Arbitrum)
- **Virtual card** — top up with ETH or USDT, simulate card payments, freeze/unfreeze
- **Live prices** from CoinGecko refreshed every 30 seconds
- **Price charts** per coin with 1D / 7D / 1M / 3M / 1Y ranges
- **Transaction history** merged from local state + on-chain Etherscan data
- **PIN lock** with SHA-256 hashing, per-device salt, and escalating lockout tiers
- **Dark and light mode** with full theme support across all screens
- **Network switching** — Sepolia testnet, Ethereum, Polygon, Arbitrum with mainnet warnings

---

## APIs Used

| API | Purpose | Base URL | Key Required |
|---|---|---|---|
| **Alchemy** | Ethereum RPC node — balance, gas estimation, send transactions | `https://eth-sepolia.g.alchemy.com/v2/` | Yes — `EXPO_PUBLIC_ALCHEMY_KEY` |
| **CoinGecko Prices** | Live crypto prices with 24h change for ETH, BTC, USDT, SOL, MATIC, BNB | `https://api.coingecko.com/api/v3/simple/price` | No — free tier |
| **CoinGecko Charts** | Historical price data for coin charts (1D to 1Y) | `https://api.coingecko.com/api/v3/coins/{id}/market_chart` | No — free tier |
| **CoinGecko News** | Latest crypto news feed | `https://api.coingecko.com/api/v3/news` | No — free tier |
| **0x Swap API** | DEX aggregator — token swap quotes and execution | `https://api.0x.org/swap/v1/` | Optional — `EXPO_PUBLIC_ZRX_API_KEY` |
| **Etherscan API** | On-chain transaction history per wallet address | `https://api.etherscan.io/api` | Optional — `EXPO_PUBLIC_ETHERSCAN_KEY` |
| **RSS2JSON** | Fallback news feed (CoinTelegraph, Bitcoinist RSS) | `https://api.rss2json.com/v1/api.json` | No — free tier |

### Fallback behaviour

- If CoinGecko prices fail → app uses last known prices, shows error banner with retry
- If 0x API fails → swap quote shows price estimate only, Confirm button is disabled until live quote loads
- If Etherscan fails → local transaction history still shown, chain history shows retry banner
- If news fails → static fallback news items shown

### Networks and RPC endpoints

| Network | Type | Alchemy RPC | Public Fallback |
|---|---|---|---|
| Sepolia | Testnet | `eth-sepolia.g.alchemy.com/v2/{KEY}` | `rpc.sepolia.org` |
| Ethereum | Mainnet | `eth-mainnet.g.alchemy.com/v2/{KEY}` | `cloudflare-eth.com` |
| Polygon | Mainnet | `polygon-mainnet.g.alchemy.com/v2/{KEY}` | `polygon-rpc.com` |
| Arbitrum | Mainnet | `arb-mainnet.g.alchemy.com/v2/{KEY}` | `arb1.arbitrum.io/rpc` |

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Core mobile framework |
| Expo SDK | 54 | Build tooling, native modules |
| ethers.js | 5.8.0 | Ethereum wallet, signing, RPC |
| expo-secure-store | 15.x | OS-level encrypted key storage (Keychain / Keystore) |
| React Navigation | 7.x | Stack + bottom tab navigation |
| expo-camera | 17.x | QR code scanning |
| react-native-qrcode-svg | 6.x | QR code generation for receive screen |
| react-native-svg | 15.x | Price chart rendering |
| expo-linear-gradient | 15.x | UI gradients |
| expo-clipboard | 8.x | Address and seed phrase copy |
| AsyncStorage | 2.x | Non-sensitive local persistence |
| TypeScript | 5.9 | Type safety throughout |

---

## Project Structure

```
CryptoWallet/
├── assets/                  # App icons, splash, screenshots
├── components/
│   ├── card/                # CardPreview, CreateCardFlow, EditCardSheet, NoCardState
│   ├── AnimatedPressable.tsx
│   ├── Toast.tsx
│   └── WebLayout.tsx        # Desktop web sidebar layout
├── constants/
│   └── index.ts             # Theme tokens, coin metadata, network config
├── screens/
│   ├── HomeScreen.tsx       # Dashboard — balance, assets, market, news
│   ├── SendScreen.tsx       # Send ETH with gas estimation + confirmation modal
│   ├── ReceiveScreen.tsx    # QR code generation per network
│   ├── SwapScreen.tsx       # Token swap via 0x Protocol
│   ├── CardScreen.tsx       # Virtual card — top up, freeze, transactions
│   ├── PortfolioScreen.tsx  # Full asset list with 24h change
│   ├── HistoryScreen.tsx    # Transaction history — local + on-chain merged
│   ├── CoinChartScreen.tsx  # Per-coin price chart with range selector
│   ├── SettingsScreen.tsx   # Network, PIN, theme, seed phrase, rename
│   ├── SupportScreen.tsx    # FAQ + contact
│   ├── ScanScreen.tsx       # QR scanner with torch + gallery
│   ├── PinScreen.tsx        # 6-digit PIN setup and verify with lockout
│   ├── CreateWalletScreen.tsx  # 4-step wallet creation with phrase verification
│   ├── ImportWalletScreen.tsx  # Import from seed phrase
│   ├── LandingScreen.tsx    # Welcome screen (mobile + web)
│   ├── OnboardingScreen.tsx # First-launch 4-slide onboarding
│   └── SplashScreen.tsx     # Animated splash
├── services/
│   ├── ethereumService.ts   # RPC calls — balance, gas, send ETH, USDT balance
│   ├── walletService.ts     # Wallet creation, import, BIP39 derivation
│   ├── storageService.ts    # Secure key storage abstraction (mobile + web)
│   ├── marketService.ts     # CoinGecko prices + news with fallbacks
│   ├── swapService.ts       # 0x Protocol quote + swap execution
│   ├── etherscanService.ts  # On-chain transaction history
│   └── pinService.ts        # PIN hash, salt, lockout tiers
├── store/
│   ├── WalletContext.tsx    # Global state — wallet, balances, card, market
│   └── PinSetupContext.ts   # PIN setup trigger context
├── utils/
│   └── AsyncStorageWeb.ts   # localStorage shim for web platform
├── config.ts                # RPC URL builder from env keys
├── App.tsx                  # Root — navigation, PIN gate, splash, onboarding
├── app.json                 # Expo config — bundle IDs, permissions, plugins
└── eas.json                 # EAS Build profiles — dev, preview, production
```

---

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- [Expo Go](https://expo.dev/go) installed on your phone (iOS or Android)

### 1. Clone the repo

```bash
git clone https://github.com/0xMayurrr/CryptoWallet.git
cd CryptoWallet
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Set up environment variables

A `.env` file is already included in this repo for developer testing. It contains working API keys for all services:

```env
EXPO_PUBLIC_ALCHEMY_KEY=YUIpvCTh5H7SkHPWFKiGe
EXPO_PUBLIC_WEB_SALT=cw_w3b_s4lt_2024
EXPO_PUBLIC_ETHERSCAN_KEY=2TJN7KQXJDKDNR9YP9WXNNHSJU3GTP2QRB
EXPO_PUBLIC_ZRX_API_KEY=8222598d-7404-46d6-994d-82d85d45ef89
```

| Key | Service | Purpose |
|---|---|---|
| `EXPO_PUBLIC_ALCHEMY_KEY` | [Alchemy](https://www.alchemy.com) | Ethereum RPC — balance, gas, send transactions |
| `EXPO_PUBLIC_ETHERSCAN_KEY` | [Etherscan](https://etherscan.io/apis) | On-chain transaction history |
| `EXPO_PUBLIC_ZRX_API_KEY` | [0x Protocol](https://0x.org) | Token swap quotes and execution |
| `EXPO_PUBLIC_WEB_SALT` | Internal | Web localStorage obfuscation salt |

> These keys are included for testing purposes only. For production, replace with your own keys.

### 4. Start the development server

```bash
npx expo start
```

Scan the QR code with:
- **Android** — Expo Go app
- **iPhone** — Camera app (opens Expo Go automatically)

---

## Testing on iOS Without a Mac

You do not need a Mac or Apple Developer account to test on iPhone.

1. Install **Expo Go** from the App Store on the iPhone
2. Run `npx expo start` on your Windows machine
3. Make sure the iPhone and your PC are on the **same Wi-Fi network**
4. Scan the QR code shown in the terminal with the iPhone camera
5. The app opens instantly in Expo Go — no build, no Apple ID needed

---

## Building the APK (Android)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account
eas login

# Build a preview APK (no store submission needed)
eas build -p android --profile preview
```

The APK download link appears in your Expo dashboard when the build finishes. Share it directly for testing.

## Building for iOS (TestFlight)

```bash
eas build -p ios --profile production
```

This requires an Apple Developer account ($99/year). The build runs in the cloud — no Mac needed.

---

## Security Model

| Layer | Mobile (iOS/Android) | Web |
|---|---|---|
| Private key storage | `expo-secure-store` → OS Keychain / Keystore (AES-256) | XOR + base64 in localStorage (obfuscation only — not safe for real funds) |
| Seed phrase storage | Same as above | Same as above |
| PIN storage | SHA-256 + per-device random salt via `crypto.subtle` | Same |
| Screenshots | Blocked via `FLAG_SECURE` (Android) | N/A |
| Key never leaves device | Yes — signing happens locally | Yes |

**Important:** The web version is not safe for real mainnet funds. Use the mobile app (Android APK or iOS via Expo Go / TestFlight) for any real transactions.

### PIN lockout tiers

| Failed attempts | Lockout duration |
|---|---|
| 5 | 30 seconds |
| 10 | 1 minute |
| 15+ | 5 minutes |

---

## What Was Built (Internship / Project Summary)

This project was built from scratch as a full-stack mobile Web3 application. Here is a summary of everything implemented:

### Wallet Core
- BIP39 seed phrase generation using `ethers.Wallet.createRandom()`
- 4-step wallet creation flow: info → display phrase → tap-to-verify phrase order → save
- Import wallet from existing 12/24-word seed phrase with validation
- Private key and mnemonic stored in OS secure enclave via `expo-secure-store`
- Wallet deletion with full state and storage cleanup

### Blockchain Integration
- Real ETH balance fetching via Alchemy RPC
- Real USDT ERC-20 balance fetching with correct contract addresses per network
- Real ETH send with live gas estimation (`estimateGas` + `getFeeData` for EIP-1559)
- Balance check against live RPC before send (not stale state)
- Transaction broadcast and confirmation wait (`tx.wait(1)`)
- Network switching between Sepolia, Ethereum, Polygon, Arbitrum with mainnet alert

### Token Swap
- 0x Protocol integration for ETH, USDT, USDC, WBTC, MATIC, LINK, UNI
- Live quote fetching with 700ms debounce
- ERC-20 allowance check and approval before swap
- Fallback price estimate when 0x API unavailable — Confirm button disabled until real quote loads
- Slippage set to 1%

### Market Data
- CoinGecko price polling every 30 seconds
- Per-coin historical chart data (1D, 7D, 1M, 3M, 1Y) with SVG sparkline
- News feed from CoinGecko → RSS2JSON fallback → static fallback
- Price error banner with tap-to-retry

### Virtual Card
- Card creation flow with holder name and design selection
- Card details (number, expiry, CVV) persisted to AsyncStorage
- Card carousel with multiple design themes
- Top-up from ETH or USDT balance with live conversion rate
- Freeze / unfreeze toggle
- Card transaction history

### Transaction History
- Local transactions (send, receive, card top-up, card spend, swap)
- On-chain transactions fetched from Etherscan API
- Deduplication by txHash when merging local + on-chain
- Filter by type (All, Sent, Received, Card, Swap)
- Search by address, coin, or tx hash
- Transaction detail modal with Etherscan explorer link

### Security
- 6-digit PIN with SHA-256 + per-device random salt
- Escalating lockout tiers (30s → 1min → 5min)
- Lockout persists across app restarts
- `FLAG_SECURE` on Android prevents screenshots
- SSRF protection on all external fetch calls via URL allowlists
- Input validation on all addresses and amounts before any RPC call

### UI/UX
- Full dark and light mode with consistent theme tokens
- Animated splash screen (3.5s with fade out)
- 4-slide onboarding shown once on first launch
- Skeleton loading states on home dashboard and transaction history
- Toast notification system for all user actions
- Animated tab bar with center action button (Receive / Scan QR)
- Confirmation modals for all destructive or financial actions
- Pull-to-refresh on home dashboard

---

## Known Limitations

- BTC and SOL prices are shown in market data but balances are always 0 — these chains are not supported (different blockchains from Ethereum)
- The virtual card is a simulation — it does not connect to a real card network
- Web version is not safe for real funds (localStorage key storage)
- QR code gallery import shows a message to use camera — image QR decoding is not implemented

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — see `LICENSE` for details.

---

<p align="center">Built by <a href="https://github.com/0xMayurrr">0xMayurrr</a></p>
