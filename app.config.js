module.exports = {
  expo: {
    name: "CryptoWallet",
    slug: "CryptoWallet",
    version: "1.0.0",
    orientation: "default",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    sdkVersion: "54.0.0",
    jsEngine: "hermes",
    fastRefresh: true,
    updates: {
      url: "https://u.expo.dev/cde8eb79-39ce-4b25-83f1-3b3410e7bcb4",
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: "ON_LOAD",
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#101114",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.karthick.cryptowallet",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "CryptoWallet uses the camera to scan QR codes and record face verification video.",
        NSPhotoLibraryUsageDescription: "CryptoWallet may access your photo library for QR code images.",
        NSMicrophoneUsageDescription: "CryptoWallet needs microphone access to record face verification video.",
        NSFaceIDUsageDescription: "CryptoWallet uses Face ID to secure your wallet access.",
      },
    },
    android: {
      package: "com.karthick.cryptowallet",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#101114",
      },
      edgeToEdgeEnabled: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-updates",
      ["expo-system-ui", { backgroundColor: "#101114" }],
      "expo-secure-store",
      "expo-font",
      [
        "expo-camera",
        {
          cameraPermission: "Allow CryptoWallet to use the camera for QR scanning and face verification.",
          microphonePermission: "Allow CryptoWallet to use the microphone for face verification video recording.",
          recordAudioAndroid: true,
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#FF3B3B",
          sounds: [],
        },
      ],
    ],
    owner: "safnah03",
    extra: {
      eas: {
        projectId: "cde8eb79-39ce-4b25-83f1-3b3410e7bcb4",
      },
    },
  },
};
