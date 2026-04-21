import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, Platform, useWindowDimensions, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { WalletProvider, useWallet } from './store/WalletContext';
import { Theme } from './constants';
import { PinSetupContext } from './store/PinSetupContext';

import HomeScreen         from './screens/HomeScreen';
import SendScreen         from './screens/SendScreen';
import ReceiveScreen      from './screens/ReceiveScreen';
import SwapScreen         from './screens/SwapScreen';
import CardScreen         from './screens/CardScreen';
import PortfolioScreen    from './screens/PortfolioScreen';
import HistoryScreen      from './screens/HistoryScreen';
import SettingsScreen     from './screens/SettingsScreen';
import CreateWalletScreen from './screens/CreateWalletScreen';
import ImportWalletScreen from './screens/ImportWalletScreen';
import LandingScreen      from './screens/LandingScreen';
import SupportScreen      from './screens/SupportScreen';
import ScanScreen         from './screens/ScanScreen';
import SplashScreen       from './screens/SplashScreen';
import PinScreen from './screens/PinScreen';
import { hasPinSetup } from './services/pinService';
import CoinChartScreen    from './screens/CoinChartScreen';
import OnboardingScreen, { shouldShowOnboarding } from './screens/OnboardingScreen';
import WebLayout          from './components/WebLayout';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const T     = Theme.colors;


function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={name} size={22} color={color} />
    </Animated.View>
  );
}

function CenterQRButton({ TC }: { TC: any }) {
  const navigation = useNavigation<any>();
  const [showMenu, setShowMenu] = React.useState(false);
  const scale      = React.useRef(new Animated.Value(1)).current;
  const menuAnim   = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setShowMenu(true);
    Animated.parallel([
      Animated.spring(scale,      { toValue: 0.92, useNativeDriver: true, speed: 25, bounciness: 8 }),
      Animated.spring(menuAnim,   { toValue: 1,    useNativeDriver: true, speed: 18, bounciness: 10 }),
      Animated.spring(rotateAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start(() =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start()
    );
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.spring(menuAnim,   { toValue: 0, useNativeDriver: true, speed: 25, bounciness: 4 }),
      Animated.spring(rotateAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start(() => setShowMenu(false));
  };

  const handlePress = () => showMenu ? closeMenu() : openMenu();

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={tabStyles.centerBtnWrap}>
      {/* Mini menu */}
      {showMenu && (
        <Animated.View style={[
          tabStyles.miniMenu,
          { opacity: menuAnim, transform: [{ translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }] }
        ]}>
          <TouchableOpacity
            style={[tabStyles.miniBtn, { backgroundColor: TC.surface, borderColor: TC.border }]}
            onPress={() => { closeMenu(); setTimeout(() => navigation.navigate('Receive'), 200); }}
            activeOpacity={0.75}
          >
            <View style={[tabStyles.miniBtnIcon, { backgroundColor: TC.primary + '20' }]}>
              <Feather name="download" size={18} color={TC.primary} />
            </View>
            <Text style={[tabStyles.miniBtnText, { color: TC.text }]}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[tabStyles.miniBtn, { backgroundColor: TC.surface, borderColor: TC.border }]}
            onPress={() => { closeMenu(); setTimeout(() => navigation.navigate('Scan'), 200); }}
            activeOpacity={0.75}
          >
            <View style={[tabStyles.miniBtnIcon, { backgroundColor: TC.primary + '20' }]}>
              <Feather name="camera" size={18} color={TC.primary} />
            </View>
            <Text style={[tabStyles.miniBtnText, { color: TC.text }]}>Scan QR</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Main button */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={tabStyles.centerBtn}
          onPress={handlePress}
          activeOpacity={1}
        >
          {/* Outer ring */}
          <View style={tabStyles.centerBtnRing}>
            <Animated.View style={[tabStyles.centerBtnInner, { backgroundColor: TC.primary, transform: [{ rotate }] }]}>
              <Feather name="grid" size={28} color="#FFF" />
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>
      <Text style={[tabStyles.centerLabel, { color: showMenu ? TC.primary : TC.textMuted }]}>Scan</Text>
    </View>
  );
}

function Tabs() {
  const { isDarkMode } = useWallet();
  const TC = isDarkMode ? Theme.colors : Theme.lightColors;

  return (
    <Tab.Navigator
      key={isDarkMode ? 'dark' : 'light'}
      screenOptions={() => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TC.surface,
          borderTopColor: TC.border,
          borderTopWidth: 1,
          height: 96,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: TC.primary,
        tabBarInactiveTintColor: TC.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 4 },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: TC.surface, borderTopWidth: 1, borderTopColor: TC.border }} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
      }} />
      <Tab.Screen name="Card" component={CardScreen} options={{
        tabBarLabel: 'Card',
        tabBarIcon: ({ color, focused }) => <TabIcon name="credit-card" color={color} focused={focused} />,
      }} />
      <Tab.Screen
        name="QRCenter"
        component={HomeScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => <CenterQRButton TC={TC} />,
        }}
      />
      <Tab.Screen name="Assets" component={PortfolioScreen} options={{
        tabBarLabel: 'Assets',
        tabBarIcon: ({ color, focused }) => <TabIcon name="pie-chart" color={color} focused={focused} />,
      }} />
      <Tab.Screen name="Profile" component={SettingsScreen} options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} />,
      }} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  centerBtnWrap: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -36,
  },
  centerBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  centerBtnRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FF3B3B50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 18,
  },
  centerBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  miniMenu: {
    position: 'absolute',
    bottom: 92,
    alignItems: 'center',
    gap: 10,
    zIndex: 100,
    width: 160,
  },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 22,
    borderWidth: 1,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  miniBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: { fontSize: 14, fontWeight: '700' },
});

function MobileNavigator() {
  const { hasWallet, isLoadingWallet } = useWallet();
  const [pinState, setPinState] = React.useState<'checking' | 'setup' | 'verify' | 'unlocked'>('checking');

  // ✅ All hooks before any conditional returns
  const triggerPinSetup = React.useCallback(() => setPinState('setup'), []);

  React.useEffect(() => {
    if (isLoadingWallet) return;
    if (!hasWallet) { setPinState('unlocked'); return; }
    setPinState('checking');
    hasPinSetup().then(has => setPinState(has ? 'verify' : 'unlocked'));
  }, [isLoadingWallet, hasWallet]);

  // After PIN setup completes, re-check so pinEnabled badge updates in Settings
  const handlePinSetupSuccess = React.useCallback(() => {
    setPinState('unlocked');
  }, []);

  const handlePinSetupCancel = React.useCallback(() => {
    setPinState('unlocked');
  }, []);

  if (isLoadingWallet || pinState === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (pinState === 'verify') {
    return <PinScreen mode="verify" onSuccess={() => setPinState('unlocked')} />;
  }

  if (pinState === 'setup') {
    return (
      <PinScreen
        mode="setup"
        onSuccess={handlePinSetupSuccess}
        onCancel={handlePinSetupCancel}
      />
    );
  }

  return (
    <PinSetupContext.Provider value={triggerPinSetup}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!hasWallet ? (
          <>
            <Stack.Screen name="Landing"      component={LandingScreen} />
            <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
            <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"      component={Tabs} />
            <Stack.Screen name="Send"      component={SendScreen} />
            <Stack.Screen name="Receive"   component={ReceiveScreen} />
            <Stack.Screen name="Swap"      component={SwapScreen} />
            <Stack.Screen name="History"   component={HistoryScreen} />
            <Stack.Screen name="Portfolio" component={PortfolioScreen} />
            <Stack.Screen name="Settings"  component={SettingsScreen} />
            <Stack.Screen name="Profile"   component={SettingsScreen} />
            <Stack.Screen name="Support"   component={SupportScreen} />
            <Stack.Screen name="Scan"      component={ScanScreen} />
            <Stack.Screen name="CoinChart"  component={CoinChartScreen} />
            <Stack.Screen name="Card"        component={CardScreen} />
            <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
            <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
          </>
        )}
      </Stack.Navigator>
    </PinSetupContext.Provider>
  );
}

function WebApp() {
  const { hasWallet, isLoadingWallet, walletAddress, network } = useWallet();
  const [currentScreen, setCurrentScreen] = React.useState('Home');

  React.useEffect(() => {
    if (!isLoadingWallet) setCurrentScreen(hasWallet ? 'Home' : 'Landing');
  }, [isLoadingWallet, hasWallet]);

  React.useEffect(() => {
    if (hasWallet) setCurrentScreen('Home');
  }, [hasWallet]);

  const setScreen = React.useCallback((screen: string) => setCurrentScreen(screen), []);
  const nav = React.useMemo(() => ({
    navigate: setScreen,
    goBack: () => setCurrentScreen(cs => cs === 'ImportWallet' || cs === 'CreateWallet' ? 'Landing' : 'Home'),
    replace: setScreen,
  } as any), [setScreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':         return <HomeScreen navigation={nav} />;
      case 'Send':         return <SendScreen navigation={nav} />;
      case 'Receive':      return <ReceiveScreen navigation={nav} />;
      case 'Swap':         return <SwapScreen navigation={nav} />;
      case 'Card':         return <CardScreen navigation={nav} />;
      case 'Assets':
      case 'Portfolio':    return <PortfolioScreen navigation={nav} />;
      case 'History':      return <HistoryScreen navigation={nav} />;
      case 'Profile':
      case 'Settings':     return <SettingsScreen navigation={nav} />;
      case 'Support':      return <SupportScreen navigation={nav} />;
      case 'Scan':         return <ScanScreen navigation={nav} />;
      case 'CreateWallet': return <CreateWalletScreen navigation={nav} />;
      case 'ImportWallet': return <ImportWalletScreen navigation={nav} />;
      case 'Landing':      return <LandingScreen navigation={nav} />;
      default:             return <HomeScreen navigation={nav} />;
    }
  };

  if (isLoadingWallet) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!hasWallet) {
    const isLanding = currentScreen === 'Landing';
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: isLanding ? undefined : 480, height: '100%', flex: isLanding ? 1 : undefined }}>
          {renderScreen()}
        </View>
      </View>
    );
  }

  return (
    <WebLayout currentScreen={currentScreen} onNavigate={setCurrentScreen} walletAddress={walletAddress} network={network}>
      {renderScreen()}
    </WebLayout>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const [showSplash, setShowSplash]           = React.useState(true);
  const [showOnboarding, setShowOnboarding]   = React.useState<boolean | null>(null);

  React.useEffect(() => {
    shouldShowOnboarding().then(show => setShowOnboarding(show));
  }, []);

  if (showOnboarding === null) {
    // Wait for onboarding check before rendering anything
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: T.background }} />
      </GestureHandlerRootView>
    );
  }

  if (Platform.OS === 'web' && isDesktop) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <WalletProvider><WebApp /></WalletProvider>
      </GestureHandlerRootView>
    );
  }

  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <WalletProvider>
          <OnboardingScreen onFinish={() => setShowOnboarding(false)} />
        </WalletProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WalletProvider>
        <NavigationContainer>
          <MobileNavigator />
        </NavigationContainer>
      </WalletProvider>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </GestureHandlerRootView>
  );
}
