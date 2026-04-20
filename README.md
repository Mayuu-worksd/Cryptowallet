# 🛡️ CryptoWallet
**Secure. Non-custodial. Institutional-grade mobile Ethereum management.**

![Platform: Android](https://img.shields.io/badge/Platform-Android-green?style=flat-square)
![Built with Expo](https://img.shields.io/badge/Built%20with-Expo-000020?style=flat-square&logo=expo)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## 📸 App Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="./assets/screenshots/onboarding.png" width="180" alt="Onboarding" /><br /><b>Onboarding</b></td>
      <td align="center"><img src="./assets/screenshots/home-dashboard.png" width="180" alt="Home Dashboard" /><br /><b>Dashboard</b></td>
      <td align="center"><img src="./assets/screenshots/send.png" width="180" alt="Send" /><br /><b>Send</b></td>
      <td align="center"><img src="./assets/screenshots/receive-qr.png" width="180" alt="Receive/QR" /><br /><b>Receive</b></td>
      <td align="center"><img src="./assets/screenshots/swap.png" width="180" alt="Swap" /><br /><b>Swap</b></td>
    </tr>
  </table>
</div>

---

##  Features

*   **Secure Key Management**: Seed phrase generation and encrypted local storage via iOS/Android Keychain.
*   **Intuitive Dashboard**: Portfolio overview with real-time balance tracking and glassmorphic UI cards.
*   **Effortless Transfers**: Send ETH and ERC-20 tokens with QR code scanning and gas estimaton.
*   **Instant Receiving**: Modern Receive screen with high-resolution QR codes and one-tap address copying.
*   **Live Market Data**: Real-time coin price charts powered by optimized WebSocket streams.
*   **Token Exchange**: Seamless in-app token swap functionality with liquidity analysis.
*   **High Performance**: Silky-smooth animations powered by React Native Reanimated.

---

## 🔌 APIs Used

| API | Purpose | Endpoint | Key Required |
| :--- | :--- | :--- | :--- |
| **Alchemy RPC** | Ethereum node provider for all blockchain interactions (balance, gas, transactions) | `https://eth-sepolia.g.alchemy.com/v2/{KEY}` | ✅ Yes — `EXPO_PUBLIC_ALCHEMY_KEY` |
| **CoinGecko API** | Live crypto prices (ETH, BTC, USDT, SOL, MATIC) with 24h change | `https://api.coingecko.com/api/v3/simple/price` | ❌ Free, no key |
| **CoinGecko News** | Latest crypto news feed | `https://api.coingecko.com/api/v3/news` | ❌ Free, no key |
| **0x Swap API** | DEX aggregator for token swaps (Ethereum, Polygon, Arbitrum) | `https://api.0x.org/swap/v1/` | ❌ Free, no key |
| **RSS2JSON** | Fallback news feed from CoinTelegraph & Bitcoinist RSS | `https://api.rss2json.com/v1/api.json` | ❌ Free, no key |

### 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_ALCHEMY_KEY=your_alchemy_key_here
EXPO_PUBLIC_WEB_SALT=your_salt_here
```

Get your free Alchemy API key at [alchemy.com](https://www.alchemy.com) — supports Sepolia testnet, Ethereum, Polygon, and Arbitrum mainnet.

### 🌐 RPC Networks Supported

| Network | Type | RPC (with Alchemy) | RPC (fallback) |
| :--- | :--- | :--- | :--- |
| Sepolia | Testnet | `eth-sepolia.g.alchemy.com` | `rpc.sepolia.org` |
| Ethereum | Mainnet | `eth-mainnet.g.alchemy.com` | `cloudflare-eth.com` |
| Polygon | Mainnet | `polygon-mainnet.g.alchemy.com` | `polygon-rpc.com` |
| Arbitrum | Mainnet | `arb-mainnet.g.alchemy.com` | `arb1.arbitrum.io/rpc` |

---

## 🛠️ Tech Stack

| Library | Purpose |
| :--- | :--- |
| **ethers.js v5** | Secure Ethereum node interactions and cryptography |
| **expo-secure-store** | AES-256 encryption for private keys and sensitive data |
| **React Navigation** | Flexible stack and tab navigation architecture |
| **react-native-reanimated** | Fluid, 60fps micro-interactions and transitions |
| **WebSocket (ws)** | Low-latency live price feeds for market data |
| **expo-camera** | Native QR code scanning and camera integration |
| **TypeScript** | Type-safe development and improved code maintainability |

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or newer)
*   npm or yarn
*   Expo Go app installed on your physical device

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/0xMayurrr/CryptoWallet.git
    cd CryptoWallet
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    EXPO_PUBLIC_ALCHEMY_KEY=your_alchemy_key_here
    EXPO_PUBLIC_WEB_SALT=your_salt_here
    ```
    Get your free Alchemy key at [alchemy.com](https://www.alchemy.com)

4.  **Start Development**
    ```bash
    npx expo start
    ```

---

## 📦 Building the APK

To generate a production-ready Android APK using EAS Build:

1.  **Install EAS CLI**
    ```bash
    npm install -g eas-cli
    ```

2.  **Login to Expo**
    ```bash
    eas login
    ```

3.  **Build Android APK**
    ```bash
    eas build -p android --profile production
    ```

---

## 📂 Project Structure

```text
src/
├── assets/          # Static assets (images, icons, fonts)
├── components/      # Reusable UI components and animated wrappers
├── constants/       # Theme tokens, API endpoints, and configuration
├── screens/         # Main application screens (Home, Swap, Send, Recieve)
├── services/        # Business logic, Web3 interactions, and WebSocket handlers
├── store/           # Global state management and Context providers
└── utils/           # Helper functions, formatting, and validation
```

---

## 🛡️ Security

CryptoWallet is built on the principle of **Your Keys, Your Crypto**. 

*   **Seed Phrases**: Generated locally on-device. They are never transmitted over the network or stored in plaintext.
*   **Encrypted Storage**: All private keys and seeds are stored using `expo-secure-store`, which leverages Android Keystore and iOS Keychain.
*   **PIN Authentication**: Local PIN protection ensures that even if a device is unlocked, the wallet remains secure.

---

## 🤝 Contributing

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🙏 Acknowledgements

*   [ethers.js](https://docs.ethers.org/v5/)
*   [Expo Team](https://expo.dev/)
*   [OpenZeppelin](https://openzeppelin.com/)
*   [React Native Community](https://reactnative.dev/)

<p align="center">Made with ❤️ by 0xMayurrr</p>
