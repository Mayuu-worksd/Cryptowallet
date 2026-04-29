import React from 'react';
import { NavigationContainer, useNavigation, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, Platform, useWindowDimensions, Animated, TouchableOpacity, StyleSheet, ScrollView, AppState, Modal, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { useMemo, useCallback } = React;

import { Theme } from './constants';

const navigationRef = createNavigationContainerRef<any>();

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null };
  static getDerivedStateFromError(e: any) { return { error: e?.message ?? String(e) }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#101114', padding: 32, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 36 }}>⚠️</Text>
          </View>
          <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>Something went wrong</Text>
          <Text style={{ color: '#A1A5AB', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            The app ran into an unexpected problem. Please restart the app. If this keeps happening, contact support.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: Theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 }}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

import { WalletProvider, useWallet } from './store/WalletContext';
import { PinSetupContext } from './store/PinSetupContext';
import { notificationService } from './services/notificationService';

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
import KYCFormScreen      from './screens/KYCFormScreen';
import KYCUploadScreen    from './screens/KYCUploadScreen';
import KYCStatusScreen    from './screens/KYCStatusScreen';
import KYCIntroScreen     from './screens/KYCIntroScreen';
import KYCDocumentScreen  from './screens/KYCDocumentScreen';
import KYCScanScreen      from './screens/KYCScanScreen';
import KYCLivenessScreen  from './screens/KYCLivenessScreen';
import KYCSelfieModeScreen from './screens/KYCSelfieModeScreen';
import KYCVideoLivenessScreen from './screens/KYCVideoLivenessScreen';
import KYCCodeSelfieScreen from './screens/KYCCodeSelfieScreen';
import KYCProcessingScreen from './screens/KYCProcessingScreen';
import KYCResultScreen    from './screens/KYCResultScreen';
import VCCVariantScreen    from './screens/VCCVariantScreen';
import VCCPreviewScreen    from './screens/VCCPreviewScreen';
import VCCPhysicalScreen   from './screens/VCCPhysicalScreen';
import VCCProcessingScreen from './screens/VCCProcessingScreen';
import VCCSuccessScreen    from './screens/VCCSuccessScreen';
import ApplyPhysicalCardScreen from './screens/ApplyPhysicalCardScreen';
import AdminScreen            from './screens/AdminScreen';
import BusinessKYCFormScreen     from './screens/BusinessKYCFormScreen';
import BusinessKYCDocumentScreen from './screens/BusinessKYCDocumentScreen';
import BusinessKYCResultScreen   from './screens/BusinessKYCResultScreen';
import MerchantDashboardScreen   from './screens/MerchantDashboardScreen';
import MerchantQRScreen          from './screens/MerchantQRScreen';
import P2PMarketplaceScreen      from './screens/P2PMarketplaceScreen';
import P2POrderDetailScreen      from './screens/P2POrderDetailScreen';
import SplashScreen       from './screens/SplashScreen';
import PinScreen from './screens/PinScreen';
import { hasPinSetup } from './services/pinService';
import CoinChartScreen    from './screens/CoinChartScreen';
import OnboardingScreen, { shouldShowOnboarding } from './screens/OnboardingScreen';
import AccountTypeScreen from './screens/AccountTypeScreen';
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
  const { accountType } = useWallet();
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

  const go = (screen: string) => { closeMenu(); setTimeout(() => navigation.navigate(screen), 200); };
  const handlePress = () => showMenu ? closeMenu() : openMenu();
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const personalItems = [
    { icon: 'arrow-down-left', label: 'Receive',   sub: 'Receive assets from other wallets', screen: 'Receive' },
    { icon: 'maximize',        label: 'Scan QR',   sub: 'Scan to send or connect',           screen: 'Scan' },
    { icon: 'users',           label: 'P2P Trade', sub: 'Trade directly with others',        screen: 'P2PMarketplace' },
  ];

  const merchantItems = [
    { icon: 'grid',      label: 'QR Generator',    sub: 'Generate payment QR code',   screen: 'MerchantQR' },
    { icon: 'repeat',    label: 'P2P Marketplace', sub: 'Buy & sell crypto P2P',      screen: 'P2PMarketplace' },
    { icon: 'file-text', label: 'My Orders',       sub: 'View all your P2P orders',   screen: 'MyP2POrders' },
    { icon: 'briefcase', label: 'Business Profile',sub: 'Edit your business details', screen: 'BusinessKYCForm' },
  ];

  const menuItems = accountType === 'business' ? merchantItems : personalItems;

  return (
    <View style={tabStyles.centerBtnWrap}>
      <Modal transparent visible={showMenu} animationType="fade">
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={closeMenu} />

          <Animated.View style={[
            tabStyles.metaMaskMenu,
            { backgroundColor: TC.surface, opacity: menuAnim, transform: [{ translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [50, 0] }) }] }
          ]}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: TC.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {accountType === 'business' ? 'Merchant Actions' : 'Quick Actions'}
              </Text>
            </View>
            {menuItems.map(item => (
              <TouchableOpacity key={item.screen} style={tabStyles.mmRow} onPress={() => go(item.screen)}>
                <View style={[tabStyles.mmIconCircle, { backgroundColor: TC.primary + '15' }]}>
                  <Feather name={item.icon as any} size={18} color={TC.primary} />
                </View>
                <View style={tabStyles.mmTextWrap}>
                  <Text style={[tabStyles.mmTitle, { color: TC.text }]}>{item.label}</Text>
                  <Text style={[tabStyles.mmSub, { color: TC.textMuted }]}>{item.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={TC.textMuted} />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Modal Overlay Close Button */}
          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 24 : 14, left: 0, right: 0, alignItems: 'center' }}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <TouchableOpacity style={tabStyles.centerBtn} onPress={closeMenu} activeOpacity={1}>
                <View style={[tabStyles.centerBtnRing, { borderColor: TC.primary + '50' }]}>
                  <Animated.View style={[tabStyles.centerBtnInner, { backgroundColor: TC.primary, transform: [{ rotate }] }]}>
                    <Feather name="plus" size={28} color="#FFF" />
                  </Animated.View>
                </View>
              </TouchableOpacity>
            </Animated.View>
            <Text style={[tabStyles.centerLabel, { color: TC.primary }]}>Actions</Text>
          </View>
        </View>
      </Modal>

      {/* Main tab bar button */}
      <View style={{ opacity: showMenu ? 0 : 1, alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity style={tabStyles.centerBtn} onPress={handlePress} activeOpacity={1}>
            <View style={[tabStyles.centerBtnRing, { borderColor: TC.primary + '50' }]}>
              <Animated.View style={[tabStyles.centerBtnInner, { backgroundColor: TC.primary, transform: [{ rotate }] }]}>
                <Feather name="plus" size={28} color="#FFF" />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </Animated.View>
        <Text style={[tabStyles.centerLabel, { color: TC.textMuted }]}>Actions</Text>
      </View>
    </View>
  );
}

function Tabs() {
  const { isDarkMode, accountType } = useWallet();
  const TC = isDarkMode ? Theme.colors : Theme.lightColors;

  const tabBarStyle = useMemo(() => ({
    backgroundColor: TC.surface,
    borderTopColor: TC.border,
    borderTopWidth: 1,
    height: 96,
    paddingBottom: 20,
    paddingTop: 10,
  }), [TC.surface, TC.border]);

  const screenOptions = useCallback(() => ({
    headerShown: false,
    tabBarStyle,
    tabBarActiveTintColor: TC.primary,
    tabBarInactiveTintColor: TC.textMuted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 4 },
    tabBarBackground: () => (
      <View style={{ flex: 1, backgroundColor: TC.surface, borderTopWidth: 1, borderTopColor: TC.border }} />
    ),
  }), [tabBarStyle, TC.primary, TC.textMuted, TC.surface, TC.border]);

  if (accountType === 'business') {
    return (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Home" component={HomeScreen} options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, focused }) => <TabIcon name="layers" color={color} focused={focused} />,
        }} />
        <Tab.Screen name="P2P" component={P2PMarketplaceScreen} options={{
          tabBarLabel: 'P2P',
          tabBarIcon: ({ color, focused }) => <TabIcon name="repeat" color={color} focused={focused} />,
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
        <Tab.Screen name="Merchant" component={MerchantDashboardScreen} options={{
          tabBarLabel: 'Merchant',
          tabBarIcon: ({ color, focused }) => <TabIcon name="briefcase" color={color} focused={focused} />,
        }} />
        <Tab.Screen name="Profile" component={SettingsScreen} options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} />,
        }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} options={{
        tabBarLabel: 'Wallet',
        tabBarIcon: ({ color, focused }) => <TabIcon name="layers" color={color} focused={focused} />,
      }} />
      <Tab.Screen name="P2P" component={P2PMarketplaceScreen} options={{
        tabBarLabel: 'P2P',
        tabBarIcon: ({ color, focused }) => <TabIcon name="repeat" color={color} focused={focused} />,
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
    borderColor: Theme.colors.primary + '50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
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
  metaMaskMenu: {
    position: 'absolute',
    bottom: 120, // Sit above the tab bar & center button
    left: 16,
    right: 16,
    borderRadius: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  mmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  mmIcon: {
    width: 24,
    textAlign: 'center',
  },
  mmIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmTextWrap: {
    flex: 1,
  },
  mmTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  mmSub: {
    fontSize: 13,
    fontWeight: '500',
  },
});

function MobileNavigator() {
  const { hasWallet, isLoadingWallet, accountType, accountTypeSet, setAccountType } = useWallet();
  const [pinState, setPinState] = React.useState<'checking' | 'setup' | 'verify' | 'unlocked'>('checking');
  // Prevent AccountTypeScreen from flashing on reload before AsyncStorage loads
  const [accountTypeChecked, setAccountTypeChecked] = React.useState(false);

  const triggerPinSetup = React.useCallback(() => setPinState('setup'), []);

  React.useEffect(() => {
    // Check AsyncStorage directly so we don't flash AccountTypeScreen on reload
    AsyncStorage.getItem('cw_account_type').then(saved => {
      setAccountTypeChecked(true);
    }).catch(() => setAccountTypeChecked(true));
  }, []);

  React.useEffect(() => {
    if (isLoadingWallet) return;

    if (!hasWallet) {
      setPinState('unlocked');
      return;
    }

    const timer = setTimeout(() => {
      if (pinState === 'checking') setPinState('unlocked');
    }, 2000);

    hasPinSetup().then(has => {
      clearTimeout(timer);
      setPinState(has ? 'verify' : 'unlocked');
    });
    return () => clearTimeout(timer);
  }, [isLoadingWallet, hasWallet]);

  const handlePinSetupSuccess = React.useCallback(() => setPinState('unlocked'), []);
  const handlePinSetupCancel  = React.useCallback(() => setPinState('unlocked'), []);

  // Auto-lock after 5 minutes in background
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        bgTimeRef.current = Date.now();
      } else if (state === 'active') {
        const elapsed = Date.now() - bgTimeRef.current;
        if (elapsed > 5 * 60 * 1000 && pinState === 'unlocked') {
          hasPinSetup().then(has => { if (has) setPinState('verify'); });
        }
      }
    });
    return () => sub.remove();
  }, [pinState]);

  const bgTimeRef = React.useRef<number>(0);

  if (isLoadingWallet || pinState === 'checking' || !accountTypeChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  // Show AccountTypeScreen if the user hasn't set their preferences (Account Type / Country)
  // This applies to both newly created and imported wallets.
  if (!accountTypeSet) {
    return (
      <AccountTypeScreen
        onSelect={async (type: 'personal' | 'business') => { await setAccountType(type); }}
      />
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
      <Stack.Navigator screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'android' ? 'slide_from_right' : 'ios_from_right',
        animationDuration: Platform.OS === 'android' ? 200 : 250,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: { backgroundColor: '#101114' },
      }}>
        {!hasWallet ? (
          <>
            <Stack.Screen name="Landing"      component={LandingScreen} />
            <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
            <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
            <Stack.Screen name="Admin"        component={AdminScreen} options={{ gestureEnabled: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"      component={Tabs} />
            <Stack.Screen name="Send"      component={SendScreen}      />
            <Stack.Screen name="Receive"   component={ReceiveScreen}   />
            <Stack.Screen name="Swap"      component={SwapScreen}      />
            <Stack.Screen name="History"   component={HistoryScreen}   />
            <Stack.Screen name="Portfolio" component={PortfolioScreen} />
            <Stack.Screen name="Settings"  component={SettingsScreen}  />
            <Stack.Screen name="Profile"   component={SettingsScreen}  />
            <Stack.Screen name="Support"   component={SupportScreen}   />
            <Stack.Screen name="Scan"      component={ScanScreen}      options={{ contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="CoinChart"  component={CoinChartScreen} />
            <Stack.Screen name="Card"        component={CardScreen} />
            <Stack.Screen name="KYCForm"       component={KYCFormScreen} />
            <Stack.Screen name="KYCUpload"     component={KYCUploadScreen} />
            <Stack.Screen name="KYCStatus"     component={KYCStatusScreen} />
            <Stack.Screen name="KYCIntro"      component={KYCIntroScreen} />
            <Stack.Screen name="KYCDocument"   component={KYCDocumentScreen} />
            <Stack.Screen name="KYCScan"       component={KYCScanScreen} options={{ contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="KYCLiveness"   component={KYCLivenessScreen} options={{ contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="KYCSelfieMode" component={KYCSelfieModeScreen} />
            <Stack.Screen name="KYCVideoLiveness" component={KYCVideoLivenessScreen} options={{ contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="KYCCodeSelfie" component={KYCCodeSelfieScreen} />
            <Stack.Screen name="KYCProcessing" component={KYCProcessingScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="KYCResult"     component={KYCResultScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="VCCVariant"    component={VCCVariantScreen} />
            <Stack.Screen name="VCCPreview"    component={VCCPreviewScreen} />
            <Stack.Screen name="VCCPhysical"   component={VCCPhysicalScreen} />
            <Stack.Screen name="VCCProcessing" component={VCCProcessingScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="VCCSuccess"    component={VCCSuccessScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="ApplyPhysicalCard" component={ApplyPhysicalCardScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="BusinessKYCForm"     component={BusinessKYCFormScreen} />
            <Stack.Screen name="BusinessKYCDocument" component={BusinessKYCDocumentScreen} />
            <Stack.Screen name="BusinessKYCResult"   component={BusinessKYCResultScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="MerchantDashboard"   component={MerchantDashboardScreen} />
            <Stack.Screen name="MerchantQR"          component={MerchantQRScreen} />
            <Stack.Screen name="P2PMarketplace"      component={P2PMarketplaceScreen} />
            <Stack.Screen name="P2POrderDetail"      component={P2POrderDetailScreen} />
            <Stack.Screen name="MyP2POrders"         component={P2PMarketplaceScreen} />
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
      case 'KYCForm':       return <KYCFormScreen navigation={nav} />;
      case 'KYCUpload':     return <KYCUploadScreen navigation={nav} />;
      case 'KYCStatus':     return <KYCStatusScreen navigation={nav} />;
      case 'KYCIntro':      return <KYCIntroScreen navigation={nav} />;
      case 'KYCDocument':   return <KYCDocumentScreen navigation={nav} route={{}} />;
      case 'KYCScan':       return <KYCScanScreen navigation={nav} route={{}} />;
      case 'KYCLiveness':   return <KYCLivenessScreen navigation={nav} route={{}} />;
      case 'KYCSelfieMode': return <KYCSelfieModeScreen navigation={nav} route={{}} />;
      case 'KYCVideoLiveness': return <KYCVideoLivenessScreen navigation={nav} route={{}} />;
      case 'KYCCodeSelfie': return <KYCCodeSelfieScreen navigation={nav} route={{}} />;
      case 'KYCProcessing': return <KYCProcessingScreen navigation={nav} route={{}} />;
      case 'KYCResult':     return <KYCResultScreen navigation={nav} />;
      case 'VCCVariant':    return <VCCVariantScreen navigation={nav} />;
      case 'VCCPreview':    return <VCCPreviewScreen navigation={nav} route={{}} />;
      case 'VCCPhysical':   return <VCCPhysicalScreen navigation={nav} route={{}} />;
      case 'VCCProcessing': return <VCCProcessingScreen navigation={nav} route={{}} />;
      case 'VCCSuccess':    return <VCCSuccessScreen navigation={nav} route={{}} />;
      case 'ApplyPhysicalCard': return <ApplyPhysicalCardScreen navigation={nav} />;
      case 'Admin':         return <AdminScreen navigation={nav} />;
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
    notificationService.requestPermissions();
  }, []);

  if (showOnboarding === null) {
    // Wait for onboarding check before rendering anything
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#101114' }}>
        <View style={{ flex: 1, backgroundColor: T.background }} />
      </GestureHandlerRootView>
    );
  }

  if (Platform.OS === 'web' && isDesktop) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#101114' }}>
        <WalletProvider><WebApp /></WalletProvider>
      </GestureHandlerRootView>
    );
  }

  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#101114' }}>
        <WalletProvider>
          <OnboardingScreen onFinish={() => setShowOnboarding(false)} />
        </WalletProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#101114' }}>
      <WalletProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={{ ...DefaultTheme, dark: true, colors: { ...DefaultTheme.colors, primary: Theme.colors.primary, background: Theme.colors.background, card: Theme.colors.background, text: Theme.colors.text, border: Theme.colors.border, notification: Theme.colors.primary } }}
          onStateChange={async (state) => {
            if (state) {
              await AsyncStorage.setItem('cw_nav_state', JSON.stringify(state)).catch(() => {});
            }
          }}
        >
          <MobileNavigator />
        </NavigationContainer>
      </WalletProvider>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
