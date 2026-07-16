import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Theme, Fonts, COIN_META, COIN_COLORS } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
  Animated, Modal, StatusBar, Image, Pressable
} from 'react-native';
import { Feather, MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { ethereumService } from '../services/ethereumService';
import Toast from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../utils/haptics';
import TransactionLoader from '../components/ui/TransactionLoader';
import { tronService } from '../services/tronService';
import { storageService } from '../services/storageService';
import { CurrencyText } from '../components/CurrencyText';
import { recipientService, RecipientInfo, RecentRecipient } from '../services/supabaseService';
import * as Clipboard from 'expo-clipboard';

// ── Fallback Network Configurations ──
const FALLBACK_NETWORKS = [
  { network_name: 'Ethereum (ERC20)', symbol: 'ETH', is_active: true, is_mainnet: true, min_deposit: '0.005 ETH', estimated_arrival: '3 minutes', warning_text: 'Only send ETH/USDT/USDC/INRX via ERC20.', supported_assets: ['ETH', 'USDT', 'USDC', 'INRX'] },
  { network_name: 'BNB Smart Chain', symbol: 'BNB', is_active: true, is_mainnet: true, min_deposit: '0.01 BNB', estimated_arrival: '3 seconds', warning_text: 'Only send BNB/USDT/USDC via BSC.', supported_assets: ['BNB', 'USDT', 'USDC'] },
  { network_name: 'TRON (TRC20)', symbol: 'TRX', is_active: true, is_mainnet: true, min_deposit: '10 TRX', estimated_arrival: '1 minute', warning_text: 'Only send TRX/USDT/USDC/INRX via TRC20.', supported_assets: ['TRX', 'USDT', 'USDC', 'INRX'] },
  { network_name: 'Polygon Network', symbol: 'MATIC', is_active: true, is_mainnet: true, min_deposit: '5 MATIC', estimated_arrival: '2 minutes', warning_text: 'Only send MATIC/USDT/USDC/INRX via Polygon.', supported_assets: ['MATIC', 'USDT', 'USDC', 'INRX'] },
  { network_name: 'Arbitrum One', symbol: 'ETH', is_active: true, is_mainnet: true, min_deposit: '0.002 ETH', estimated_arrival: '30 seconds', warning_text: 'Only send ETH/USDT/USDC via Arbitrum.', supported_assets: ['ETH', 'USDT', 'USDC'] },
  { network_name: 'Sepolia Testnet', symbol: 'ETH', is_active: true, is_mainnet: false, min_deposit: '0.001 ETH', estimated_arrival: '15 seconds', warning_text: 'Only send Sepolia ETH/USDT/USDC/INRX.', supported_assets: ['ETH', 'USDT', 'USDC', 'INRX'] },
  { network_name: 'Bitcoin Network', symbol: 'BTC', is_active: true, is_mainnet: true, min_deposit: '0.0002 BTC', estimated_arrival: '10-60 minutes', warning_text: 'Only send Bitcoin (BTC) to this address.', supported_assets: ['BTC'] },
  { network_name: 'Solana Network', symbol: 'SOL', is_active: true, is_mainnet: true, min_deposit: '0.05 SOL', estimated_arrival: '10 seconds', warning_text: 'Only send SOL/USDT/USDC via Solana.', supported_assets: ['SOL', 'USDT', 'USDC'] },
  { network_name: 'TON Network', symbol: 'TON', is_active: true, is_mainnet: true, min_deposit: '0.5 TON', estimated_arrival: '1 minute', warning_text: 'Only send TON to this address.', supported_assets: ['TON'] },
  { network_name: 'Sui Network', symbol: 'SUI', is_active: true, is_mainnet: true, min_deposit: '0.1 SUI', estimated_arrival: '5 seconds', warning_text: 'Only send SUI to this address.', supported_assets: ['SUI'] },
  { network_name: 'Ripple Ledger', symbol: 'XRP', is_active: true, is_mainnet: true, min_deposit: '1 XRP', estimated_arrival: '10 seconds', warning_text: 'Only send XRP to this address.', supported_assets: ['XRP'] },
];

const ASSET_LIST = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'TRX', name: 'TRON' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'INRX', name: 'e-Rupee Stablecoin' },
];

const CoinIcon = memo(({ symbol, size = 24 }: { symbol: string; size?: number }) => {
  const meta  = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = useState(false);
  if (meta && !failed) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

// ── Lookup method tabs ──
type LookupMethod = 'uid' | 'email' | 'wallet';
const LOOKUP_TABS: { key: LookupMethod; label: string; icon: string; placeholder: string; keyboard: 'default' | 'email-address' | 'numeric' }[] = [
  { key: 'uid',    label: 'UID',    icon: 'hash',       placeholder: 'Enter 10-digit UID',      keyboard: 'numeric' },
  { key: 'email',  label: 'Email',  icon: 'mail',       placeholder: 'Enter email address',      keyboard: 'email-address' },
  { key: 'wallet', label: 'Wallet', icon: 'link',       placeholder: '0x... or T... address',    keyboard: 'default' },
];

// ── Transfer Steps ──
type TransferStep = 'asset' | 'network' | 'recipient' | 'amount' | 'review' | 'success';

export default function SendScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { 
    ethBalance, sendETH, isDarkMode, walletAddress, tronAddress, 
    balances, addTx, refreshBalance,
    applySwapBalances, formatFiat, fiatCurrency, fiatSymbol, adminNetworks
  } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const styles = React.useMemo(() => makeStyles(T), [T]);

  const scannedAddr = route?.params?.scannedAddress ?? '';
  const scannedUid  = route?.params?.scannedUid ?? null;

  // ── Guided Multi-step state ──
  const [step, setStep] = useState<TransferStep>(route?.params?.symbol ? 'network' : 'asset');
  const [selectedAsset, setSelectedAsset] = useState<string>(route?.params?.symbol ?? 'USDT');
  const [selectedNetworkObj, setSelectedNetworkObj] = useState<any | null>(null);

  const [lookupMethod, setLookupMethod] = useState<LookupMethod>(scannedAddr ? 'wallet' : 'uid');
  const [searchInput, setSearchInput] = useState(scannedAddr || (scannedUid ? String(scannedUid) : ''));
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [recents, setRecents] = useState<RecentRecipient[]>([]);

  // ── Amount / Send state ──
  const [address, setAddress]         = useState(scannedAddr);
  const [amount, setAmount]             = useState('');
  const [estimating, setEstimating]     = useState(false);
  const [amountError, setAmountError]   = useState('');
  const [gasEth, setGasEth]             = useState('');
  const [sending, setSending]           = useState(false);
  const [sendStatus, setSendStatus]     = useState('');
  const [toast, setToast]               = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // ── Success state ──
  const [txHash, setTxHash]             = useState('');
  const [txTimestamp, setTxTimestamp]   = useState('');

  const btnScale   = useRef(new Animated.Value(1)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const sendingRef = useRef(false);

  const shakeError = () => {
    haptics.error();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // ── Load recent recipients ──
  useEffect(() => {
    const senderAddr = walletAddress || tronAddress;
    if (senderAddr) {
      recipientService.getRecents(senderAddr).then(setRecents).catch(() => {});
    }
  }, [walletAddress, tronAddress]);

  // ── Auto-search scanned details ──
  useEffect(() => {
    if (scannedAddr && step === 'recipient') {
      setLookupMethod('wallet');
      setSearchInput(scannedAddr);
      handleSearch(scannedAddr, 'wallet');
    }
  }, [scannedAddr, step]);

  useEffect(() => {
    if (scannedUid && step === 'recipient') {
      setLookupMethod('uid');
      setSearchInput(String(scannedUid));
      handleSearch(String(scannedUid), 'uid');
    }
  }, [scannedUid, step]);

  const activeNets = adminNetworks && adminNetworks.length > 0 ? adminNetworks : FALLBACK_NETWORKS;
  const compatibleNets = activeNets.filter((n: any) => n.is_active && n.supported_assets && n.supported_assets.includes(selectedAsset));

  const coinPrice    = prices[selectedAsset]?.usd ?? (selectedAsset === 'ETH' ? 3500 : (selectedAsset === 'BTC' ? 65000 : 1));
  const parsedAmount = parseFloat(amount) || 0;
  const gasEthNum    = parseFloat(gasEth) || 0;
  const totalDeducted = (parsedAmount + gasEthNum).toFixed(6);
  const availBal     = selectedAsset === 'ETH' ? (parseFloat(ethBalance) || 0) : (balances[selectedAsset] ?? 0);
  const fiatAmountNum = parsedAmount * coinPrice;
  const fiatGasNum    = gasEthNum * coinPrice;
  const fiatTotalNum  = (parsedAmount + gasEthNum) * coinPrice;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  // ── Recipient Search ──
  const handleSearch = async (input?: string, method?: LookupMethod) => {
    const q = (input ?? searchInput).trim();
    const m = method ?? lookupMethod;
    if (!q) { setSearchError('Enter a search value'); return; }

    setSearching(true);
    setSearchError('');
    setRecipient(null);
    haptics.selection();

    try {
      let result: RecipientInfo;
      if (m === 'uid') {
        const uid = parseInt(q, 10);
        if (isNaN(uid) || q.length < 5) { setSearchError('Enter a valid UID (numeric)'); setSearching(false); return; }
        result = await recipientService.lookupByUid(uid);
      } else if (m === 'email') {
        if (!q.includes('@')) { setSearchError('Enter a valid email address'); setSearching(false); return; }
        result = await recipientService.lookupByEmail(q);
      } else {
        result = await recipientService.lookupByWallet(q);
      }

      if (!result.found) {
        setSearchError('Recipient not found. Check the details and try again.');
        haptics.error();
      } else {
        // Self-send check
        const recipientAddr = result.wallet_address?.toLowerCase();
        const recipientTron = result.tron_address?.toLowerCase();
        const myAddr = walletAddress?.toLowerCase();
        const myTron = tronAddress?.toLowerCase();
        if ((recipientAddr && recipientAddr === myAddr) || (recipientTron && recipientTron === myTron)) {
          setSearchError('You cannot send funds to yourself.');
          haptics.error();
          setSearching(false);
          return;
        }
        setRecipient(result);
        
        // Resolve the transfer address based on network
        const netName = (selectedNetworkObj?.network_name || '').toUpperCase();
        const targetAddr = (netName.includes('TRON') || selectedNetworkObj?.symbol === 'TRX')
          ? (result.tron_address || result.wallet_address || '')
          : (result.wallet_address || '');
        setAddress(targetAddr);
        haptics.success();
      }
    } catch (e) {
      setSearchError('Search failed. Please try again.');
      haptics.error();
    }
    setSearching(false);
  };

  // ── Select a recent recipient ──
  const selectRecent = (r: RecentRecipient) => {
    const netName = (selectedNetworkObj?.network_name || '').toUpperCase();
    const targetAddr = (netName.includes('TRON') || selectedNetworkObj?.symbol === 'TRX')
      ? (r.tron_address || r.recipient_wallet || '')
      : (r.recipient_wallet || '');
    setAddress(targetAddr);
    setRecipient({
      found: true,
      wallet_address: r.recipient_wallet,
      tron_address: r.tron_address,
      wallet_name: r.wallet_name || r.recipient_name || 'Unknown',
      user_uid: r.recipient_uid,
      account_type: r.account_type,
    });
    setSearchError('');
    haptics.selection();
  };

  // ── Amount Validation ──
  const validateAmount = useCallback((val: string, currentGasEth?: string) => {
    if (!val) { setAmountError(''); return; }
    const p = parseFloat(val);
    if (isNaN(p) || p <= 0) { setAmountError('Enter a valid amount'); return; }
    if (p > availBal)        { setAmountError(`Exceeds balance (${availBal.toFixed(6)} ${selectedAsset})`); return; }
    const gas = parseFloat(currentGasEth ?? gasEth) || 0.0005;
    if (selectedAsset === 'ETH' || selectedAsset === 'TRX') {
      if (p + gas > availBal) { 
        setAmountError(`Insufficient for gas. Max: ${Math.max(0, availBal - gas).toFixed(6)} ${selectedAsset}`); 
        return; 
      }
    }
    setAmountError('');
  }, [availBal, gasEth, selectedAsset]);

  // ── Gas estimation ──
  useEffect(() => {
    if (!address || !amount || !parsedAmount || step !== 'amount') {
      setGasEth('');
      return;
    }
    if (selectedAsset === 'ETH') {
      const t = setTimeout(async () => {
        setEstimating(true);
        try {
          const { gasCostEth } = await ethereumService.estimateGas(walletAddress, address, amount, selectedNetworkObj?.network_name || 'Sepolia');
          setGasEth(gasCostEth);
          validateAmount(amount, gasCostEth);
        } catch (_e) {
          setGasEth('0.000042');
          validateAmount(amount, '0.000042');
        } finally {
          setEstimating(false);
        }
      }, 600);
      return () => clearTimeout(t);
    }
    if (selectedAsset === 'TRX') {
      const flatFee = tronService.estimateFee(selectedNetworkObj?.network_name || 'TRON Nile').toFixed(6);
      setGasEth(flatFee);
      validateAmount(amount, flatFee);
      return;
    }
    
    // Fallback static flat fees for other tokens
    let flatFee = '0.0005';
    const netName = (selectedNetworkObj?.network_name || '').toUpperCase();
    if (selectedAsset === 'USDT' || selectedAsset === 'USDC') {
      flatFee = (netName.includes('TRON') || selectedNetworkObj?.symbol === 'TRX') ? '2.0' : '0.001';
    } else if (selectedAsset === 'BTC') {
      flatFee = '0.0001';
    } else if (selectedAsset === 'SOL') {
      flatFee = '0.00005';
    } else if (selectedAsset === 'BNB') {
      flatFee = '0.0002';
    } else if (selectedAsset === 'XRP') {
      flatFee = '0.02';
    } else if (selectedAsset === 'TON') {
      flatFee = '0.005';
    } else if (selectedAsset === 'SUI') {
      flatFee = '0.001';
    }
    setGasEth(flatFee);
    validateAmount(amount, flatFee);
  }, [address, amount, walletAddress, selectedNetworkObj, selectedAsset, step]);

  // ── Review button ──
  const handleReview = () => {
    let err = false;
    if (!amount || parsedAmount <= 0) { 
      setAmountError('Enter a valid amount'); 
      err = true; 
    } else if (parsedAmount > availBal) { 
      setAmountError('Insufficient balance'); 
      err = true; 
    } else if ((selectedAsset === 'ETH' || selectedAsset === 'TRX') && parsedAmount + (gasEthNum || 0.0005) > availBal) { 
      setAmountError(`Insufficient for gas. Max sendable: ${Math.max(0, availBal - (gasEthNum || 0.0005)).toFixed(6)} ${selectedAsset}`); 
      err = true; 
    }

    if (err) { shakeError(); return; }
    haptics.selection();
    setStep('review');
  };

  // ── Confirm & Send ──
  const handleConfirmSend = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendStatus('Signing transaction...');

    const netName = selectedNetworkObj?.network_name || 'Sepolia';
    const isMainnet = selectedNetworkObj?.is_mainnet ?? false;

    if (isMainnet && (selectedAsset === 'ETH' || selectedAsset === 'TRX')) {
      // Prompt user or handle mainnet warnings inside execution if needed
    }

    setTimeout(() => setSendStatus('Broadcasting to network...'), 1200);
    setTimeout(() => setSendStatus('Waiting for confirmation...'), 3000);

    let result: { success: boolean; error?: string; hash?: string };

    if (selectedAsset === 'TRX') {
      const mnemonic = await storageService.getMnemonic();
      if (!mnemonic) {
        result = { success: false, error: 'Wallet not found' };
      } else {
        const { deriveTronAddress } = await import('../services/tronService');
        const tron = await deriveTronAddress(mnemonic);
        const tronResult = await tronService.sendTRX({
          privateKey: tron.privateKey,
          toAddress:  address,
          amount:     parsedAmount,
          network:    netName,
        });
        result = { success: tronResult.success, error: tronResult.error, hash: tronResult.txHash };
        if (tronResult.success) {
          addTx({
            type:     'sent',
            coin:     'TRX',
            amount:   parsedAmount.toFixed(6),
            usdValue: (parsedAmount * coinPrice).toFixed(2),
            address,
            status:   'success',
            txHash:   tronResult.txHash,
          });
          refreshBalance();
        }
      }
    } else if (selectedAsset === 'ETH') {
      result = await sendETH(address, amount);
    } else if (selectedAsset === 'SOL') {
      const mockHash = 'sol_mock_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      result = { success: true, hash: mockHash };
      addTx({ type: 'sent', coin: 'SOL', amount: parsedAmount.toFixed(6), usdValue: (parsedAmount * coinPrice).toFixed(2), address, status: 'success', txHash: mockHash });
      applySwapBalances('SOL', parsedAmount, 'SOL', 0);
      refreshBalance();
    } else if (['USDT', 'USDC', 'INRX'].includes(selectedAsset)) {
      const privateKey = await storageService.getPrivateKey();
      if (!privateKey) {
        result = { success: false, error: 'Wallet not found' };
      } else {
        const netName = selectedNetworkObj?.network_name || '';
        const isTronNet = netName.toUpperCase().includes('TRON') || selectedNetworkObj?.symbol === 'TRX';

        // ERC20 contract addresses per network
        const ERC20_CONTRACTS: Record<string, Record<string, string>> = {
          USDT: {
            'Ethereum (ERC20)': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            Ethereum:           '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            Polygon:            '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            'Polygon Network':  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            Arbitrum:           '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            'Arbitrum One':     '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            Sepolia:            '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
            'Sepolia Testnet':  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
            BSC:                '0x55d398326f99059fF775485246999027B3197955',
            'BNB Smart Chain':  '0x55d398326f99059fF775485246999027B3197955',
          },
          USDC: {
            'Ethereum (ERC20)': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            Ethereum:           '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            Polygon:            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            'Polygon Network':  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            Arbitrum:           '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            'Arbitrum One':     '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            Sepolia:            '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            'Sepolia Testnet':  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            BSC:                '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            'BNB Smart Chain':  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          },
          INRX: {
            'Ethereum (ERC20)': '0x51A5F24560547f587999c331788aC495D40d95ba',
            Ethereum:           '0x51A5F24560547f587999c331788aC495D40d95ba',
            Polygon:            '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
            'Polygon Network':  '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
            Sepolia:            '0x51A5F24560547f587999c331788aC495D40d95ba',
            'Sepolia Testnet':  '0x51A5F24560547f587999c331788aC495D40d95ba',
          },
        };

        // TRC20 contract addresses
        const TRC20_CONTRACTS: Record<string, string> = {
          USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
          INRX: 'TBykZRRzGm1M9QC7DWcC4QALLTSJF8mRAo',
        };

        if (isTronNet) {
          const contractAddr = TRC20_CONTRACTS[selectedAsset];
          if (!contractAddr) {
            result = { success: false, error: `${selectedAsset} not supported on TRON` };
          } else {
            const mnemonic = await storageService.getMnemonic();
            if (!mnemonic) { result = { success: false, error: 'Wallet not found' }; }
            else {
              const { deriveTronAddress } = await import('../services/tronService');
              const tron = await deriveTronAddress(mnemonic);
              const tronResult = await tronService.sendTRC20({
                privateKey:      tron.privateKey,
                toAddress:       address,
                amount:          parsedAmount,
                contractAddress: contractAddr,
                decimals:        6,
                network:         netName.includes('Nile') ? 'TRON Nile' : 'TRON',
              });
              result = { success: tronResult.success, error: tronResult.error, hash: tronResult.txHash };
              if (tronResult.success) {
                addTx({ type: 'sent', coin: selectedAsset, amount: parsedAmount.toFixed(6), usdValue: (parsedAmount * coinPrice).toFixed(2), address, status: 'success', txHash: tronResult.txHash });
                refreshBalance();
              }
            }
          }
        } else {
          // Map network display name to RPC key
          const NET_KEY_MAP: Record<string, string> = {
            'Ethereum (ERC20)': 'Ethereum',
            'Polygon Network':  'Polygon',
            'Arbitrum One':     'Arbitrum',
            'Sepolia Testnet':  'Sepolia',
            'BNB Smart Chain':  'BSC',
          };
          const rpcKey = NET_KEY_MAP[netName] ?? netName;
          const contractAddr = ERC20_CONTRACTS[selectedAsset]?.[netName] ?? ERC20_CONTRACTS[selectedAsset]?.[rpcKey];
          if (!contractAddr) {
            result = { success: false, error: `${selectedAsset} not supported on ${netName}` };
          } else {
            const erc20Result = await ethereumService.sendERC20(privateKey, address, amount, contractAddr, 6, rpcKey);
            result = erc20Result;
            if (erc20Result.success) {
              addTx({ type: 'sent', coin: selectedAsset, amount: parsedAmount.toFixed(6), usdValue: (parsedAmount * coinPrice).toFixed(2), address, status: 'success', txHash: erc20Result.hash });
              refreshBalance();
            }
          }
        }
      }
    } else if (selectedAsset === 'BNB') {
      // BNB on BSC — same EVM logic as ETH, just different network
      const privateKey = await storageService.getPrivateKey();
      if (!privateKey) {
        result = { success: false, error: 'Wallet not found' };
      } else {
        const NET_KEY_MAP: Record<string, string> = {
          'BNB Smart Chain': 'BSC',
          BSC:               'BSC',
          'BSC Testnet':     'BSC Testnet',
        };
        const rpcKey = NET_KEY_MAP[netName] ?? 'BSC';
        result = await ethereumService.sendETH(privateKey, address, amount, rpcKey);
        if (result.success) {
          addTx({ type: 'sent', coin: 'BNB', amount: parsedAmount.toFixed(6), usdValue: (parsedAmount * coinPrice).toFixed(2), address, status: 'success', txHash: result.hash });
          refreshBalance();
        }
      }
    } else {
      // BTC, XRP, TON, SUI — different blockchains, not yet integrated
      const mockHash = `${selectedAsset.toLowerCase()}_mock_` + Math.random().toString(36).substring(2, 11);
      result = { success: true, hash: mockHash };
      addTx({ type: 'sent', coin: selectedAsset, amount: parsedAmount.toFixed(6), usdValue: (parsedAmount * coinPrice).toFixed(2), address, status: 'success', txHash: mockHash });
      applySwapBalances(selectedAsset, parsedAmount, selectedAsset, 0);
      refreshBalance();
    }

    if (result.success) {
      setSendStatus('Transaction successful!');
      haptics.success();
      showToast(`${selectedAsset} sent successfully.`, 'success');

      // Save recent recipient
      const senderAddr = walletAddress || tronAddress || '';
      if (senderAddr && recipient) {
        recipientService.saveRecent(
          senderAddr,
          recipient.wallet_address || address,
          recipient.wallet_name,
          recipient.user_uid,
          lookupMethod,
        );
      }

      setTxHash(result.hash || 'N/A');
      setTxTimestamp(new Date().toLocaleString());

      setTimeout(() => {
        setSending(false);
        setSendStatus('');
        sendingRef.current = false;
        setStep('success');
      }, 1500);
    } else {
      setSending(false);
      setSendStatus('');
      sendingRef.current = false;
      
      haptics.error();
      let msg = result.error ?? 'Transfer failed. Please try again.';
      if (msg.includes('insufficient funds')) msg = 'Not enough funds to cover gas fees.';
      else if (msg.includes('nonce')) msg = 'Transaction conflict. Please try again.';
      showToast(msg, 'error');
    }
  };

  const handleBack = () => {
    if (step === 'success') {
      navigation.goBack();
    } else if (step === 'review') {
      setStep('amount');
    } else if (step === 'amount') {
      setStep('recipient');
    } else if (step === 'recipient') {
      setStep('network');
    } else if (step === 'network') {
      // If route symbol pre-selected, go back to screen
      if (route?.params?.symbol) {
        navigation.goBack();
      } else {
        setStep('asset');
      }
    } else {
      navigation.goBack();
    }
  };

  const kycBadge = (status: string | null | undefined) => {
    if (status === 'verified') return { label: 'KYC Verified', color: T.success, icon: 'check-circle' as const };
    if (status === 'pending' || status === 'under_review') return { label: 'KYC Pending', color: T.pending, icon: 'clock' as const };
    return { label: 'Not Verified', color: T.textDim, icon: 'alert-circle' as const };
  };

  const isTokenSupported = ['ETH', 'TRX', 'SOL', 'USDT', 'USDC'].includes(selectedAsset);
  const canReview = !amountError && !!address && !!amount && parsedAmount > 0;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: T.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} isDarkMode={isDarkMode} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      <TransactionLoader visible={sending} title="Sending Transaction" subtitle={sendStatus || 'Broadcasting to network...'} isDarkMode={isDarkMode} type="send" />

      {/* Header */}
      {step !== 'success' && (
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Feather name="chevron-left" size={28} color={T.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'asset' ? 'SELECT ASSET' :
             step === 'network' ? 'SELECT NETWORK' :
             step === 'recipient' ? 'RECIPIENT' :
             step === 'amount' ? 'AMOUNT' : 'REVIEW'}
          </Text>
          <TouchableOpacity style={styles.qrBtn} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
            <Ionicons name="qr-code-outline" size={22} color={T.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Step Indicator */}
      {step !== 'success' && (
        <View style={styles.stepIndicatorContainer}>
          {['asset', 'network', 'recipient', 'amount', 'review'].map((s, idx) => {
            const steps = ['asset', 'network', 'recipient', 'amount', 'review'];
            const currentIdx = steps.indexOf(step);
            const active = step === s;
            const completed = currentIdx > idx;
            return (
              <React.Fragment key={s}>
                <View style={[styles.stepDot, active && styles.stepDotActive, completed && styles.stepDotCompleted]} />
                {idx < 4 && (
                  <View style={[styles.stepLine, currentIdx > idx && styles.stepLineCompleted]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* ── STEP 1: SELECT ASSET ── */}
      {step === 'asset' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: T.text }]}>Send Asset</Text>
            <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Choose the cryptocurrency asset you want to transfer.</Text>
          </View>

          <View style={styles.assetsContainer}>
            {ASSET_LIST.map(asset => {
              const tokenBal = asset.symbol === 'ETH' ? (parseFloat(ethBalance) || 0) : (balances[asset.symbol] ?? 0);
              const priceVal = prices[asset.symbol]?.usd ?? (asset.symbol === 'ETH' ? 3500 : (asset.symbol === 'BTC' ? 65000 : 1));
              return (
                <TouchableOpacity
                  key={asset.symbol}
                  style={[styles.assetRow, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => {
                    setSelectedAsset(asset.symbol);
                    setStep('network');
                  }}
                  activeOpacity={0.7}
                >
                  <CoinIcon symbol={asset.symbol} size={36} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.assetRowSymbol, { color: T.text }]}>{asset.symbol}</Text>
                    <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>{asset.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: T.text, fontFamily: Fonts.bold, fontSize: 14 }}>{tokenBal.toFixed(4)}</Text>
                    <CurrencyText amount={tokenBal * priceVal} code={fiatCurrency} style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.medium }} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── STEP 2: SELECT NETWORK ── */}
      {step === 'network' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Active Asset Banner */}
          <TouchableOpacity style={[styles.summaryBar, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => setStep('asset')} activeOpacity={0.7}>
            <CoinIcon symbol={selectedAsset} size={22} />
            <Text style={[styles.summaryBarText, { color: T.text }]}>Selected Asset: {selectedAsset}</Text>
            <View style={[styles.changeChip, { backgroundColor: T.primary + '15' }]}>
              <Text style={{ color: T.primary, fontSize: 10, fontFamily: Fonts.bold }}>Change</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: T.text }]}>Select Network</Text>
            <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Choose the target blockchain ledger. Ensure the recipient wallet supports it.</Text>
          </View>

          <View style={styles.networksContainer}>
            {compatibleNets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="alert-triangle" size={24} color={T.primary} />
                <Text style={{ color: T.text, fontSize: 15, fontFamily: Fonts.bold, marginTop: 10 }}>No Network Configured</Text>
                <Text style={{ color: T.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 }}>This asset has no active networks available.</Text>
              </View>
            ) : (
              compatibleNets.map(net => (
                <TouchableOpacity
                  key={net.id || net.network_name}
                  style={[styles.networkRow, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => {
                    setSelectedNetworkObj(net);
                    setStep('recipient');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.networkRowLeft}>
                    <View style={[styles.networkIcon, { backgroundColor: T.primary + '12' }]}>
                      <Feather name="layers" size={16} color={T.primary} />
                    </View>
                    <View style={{ marginLeft: 14 }}>
                      <Text style={[styles.networkRowName, { color: T.text }]}>{net.network_name}</Text>
                      <Text style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 }}>Arrival: {net.estimated_arrival || '3 minutes'}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={T.textDim} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ── STEP 3: ENTER RECIPIENT ── */}
      {step === 'recipient' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Active Asset & Network Banner */}
          <TouchableOpacity style={[styles.summaryBar, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => setStep('network')} activeOpacity={0.7}>
            <CoinIcon symbol={selectedAsset} size={22} />
            <Text style={[styles.summaryBarText, { color: T.text }]}>{selectedAsset} on {selectedNetworkObj?.network_name}</Text>
            <View style={[styles.changeChip, { backgroundColor: T.primary + '15' }]}>
              <Text style={{ color: T.primary, fontSize: 10, fontFamily: Fonts.bold }}>Change</Text>
            </View>
          </TouchableOpacity>

          {/* Method Tabs */}
          <View style={styles.methodTabsContainer}>
            {LOOKUP_TABS.map(tab => {
              const active = lookupMethod === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.methodTab,
                    active && [styles.methodTabActive, { borderColor: T.primary }],
                    !active && { backgroundColor: T.surfaceLow, borderColor: 'transparent' },
                  ]}
                  onPress={() => {
                    setLookupMethod(tab.key);
                    setSearchInput('');
                    setSearchError('');
                    setRecipient(null);
                    haptics.selection();
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name={tab.icon as any} size={14} color={active ? T.primary : T.textDim} />
                  <Text style={[styles.methodTabText, { color: active ? T.primary : T.textDim }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.methodTab, { backgroundColor: T.surfaceLow, borderColor: 'transparent', opacity: 0.5 }]}
              onPress={() => showToast('Phone lookup is coming in a future release.', 'info')}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={14} color={T.textDim} />
              <Text style={[styles.methodTabText, { color: T.textDim }]}>Phone</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchSection}>
            <Text style={styles.searchLabel}>
              {lookupMethod === 'uid' ? 'ENTER RECIPIENT UID' :
               lookupMethod === 'email' ? 'ENTER RECIPIENT EMAIL' : 'ENTER WALLET ADDRESS'}
            </Text>
            <View style={[styles.searchInputBox, searchError ? styles.inputError : null, { backgroundColor: T.surface }]}>
              <Feather
                name={LOOKUP_TABS.find(t => t.key === lookupMethod)!.icon as any}
                size={18}
                color={T.textDim}
                style={{ marginRight: 12 }}
              />
              <TextInput
                style={[styles.searchInputText, { color: T.text }]}
                placeholder={LOOKUP_TABS.find(t => t.key === lookupMethod)!.placeholder}
                placeholderTextColor={T.textDim}
                value={searchInput}
                onChangeText={val => { setSearchInput(val); setSearchError(''); setRecipient(null); }}
                keyboardType={LOOKUP_TABS.find(t => t.key === lookupMethod)!.keyboard}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => handleSearch()}
              />
              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchInput(''); setRecipient(null); setSearchError(''); }}>
                  <Feather name="x-circle" size={18} color={T.textDim} />
                </TouchableOpacity>
              )}
            </View>
            {!!searchError && <Text style={styles.errorLabel}>{searchError}</Text>}

            {/* Search Button */}
            <TouchableOpacity
              style={[styles.searchBtn, !searchInput.trim() && { opacity: 0.5 }]}
              onPress={() => handleSearch()}
              disabled={!searchInput.trim() || searching}
              activeOpacity={0.7}
            >
              {searching ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <LinearGradient
                  colors={[T.primary, '#D32F2F']}
                  style={styles.searchBtnGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Feather name="search" size={18} color="#FFF" />
                  <Text style={styles.searchBtnText}>FIND RECIPIENT</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>

          {/* Recipient Details Card */}
          {recipient?.found && (
            <View style={[styles.recipientCard, { backgroundColor: T.surface, borderColor: T.success + '40' }]}>
              <View style={styles.recipientCardHeader}>
                <View style={[styles.recipientAvatar, { backgroundColor: T.primary }]}>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800' }}>
                    {(recipient.wallet_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recipientName, { color: T.text }]}>{recipient.wallet_name || 'Unknown User'}</Text>
                  {recipient.user_uid && (
                    <View style={[styles.uidPill, { backgroundColor: '#F59E0B15' }]}>
                      <Feather name="hash" size={9} color="#F59E0B" />
                      <Text style={{ color: '#F59E0B', fontSize: 10, fontFamily: Fonts.bold }}>UID: {recipient.user_uid}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.foundBadge, { backgroundColor: T.success + '15' }]}>
                  <Feather name="check-circle" size={12} color={T.success} />
                  <Text style={{ color: T.success, fontSize: 11, fontFamily: Fonts.bold }}>Found</Text>
                </View>
              </View>

              {/* Chips */}
              <View style={styles.recipientChipsRow}>
                {(() => {
                  const badge = kycBadge(recipient.kyc_status);
                  return (
                    <View style={[styles.recipientChip, { backgroundColor: badge.color + '15' }]}>
                      <Feather name={badge.icon} size={11} color={badge.color} />
                      <Text style={[styles.recipientChipText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  );
                })()}
                <View style={[styles.recipientChip, { backgroundColor: (recipient.account_type === 'business' ? T.primary : T.success) + '15' }]}>
                  <Feather name={recipient.account_type === 'business' ? 'briefcase' : 'user'} size={11} color={recipient.account_type === 'business' ? T.primary : T.success} />
                  <Text style={[styles.recipientChipText, { color: recipient.account_type === 'business' ? T.primary : T.success }]}>
                    {recipient.account_type === 'business' ? 'Merchant' : 'Personal'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.confirmRecipientBtn} onPress={() => setStep('amount')} activeOpacity={0.8}>
                <LinearGradient
                  colors={[T.primary, '#D32F2F']}
                  style={styles.confirmRecipientGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmRecipientText}>CONTINUE TO AMOUNT</Text>
                  <Feather name="arrow-right" size={16} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Recents */}
          {recents.length > 0 && !recipient?.found && (
            <View style={styles.recentsSection}>
              <Text style={styles.recentsTitle}>RECENT RECIPIENTS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {recents.map((r, i) => (
                  <TouchableOpacity
                    key={`${r.recipient_wallet}-${i}`}
                    style={[styles.recentItem, { backgroundColor: T.surface, borderColor: T.border }]}
                    onPress={() => selectRecent(r)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.recentAvatar, { backgroundColor: T.primary + '20' }]}>
                      <Text style={{ color: T.primary, fontSize: 13, fontWeight: '800' }}>
                        {(r.wallet_name || r.recipient_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.recentName, { color: T.text }]} numberOfLines={1}>
                      {r.wallet_name || r.recipient_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.recentMethod, { color: T.textDim }]}>via {r.method}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── STEP 4: ENTER AMOUNT ── */}
      {step === 'amount' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Recipient summary bar */}
          <TouchableOpacity style={[styles.summaryBar, { backgroundColor: T.surface, borderColor: T.border }]} onPress={() => setStep('recipient')} activeOpacity={0.7}>
            <View style={[styles.recipientAvatarSmall, { backgroundColor: T.primary }]}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                {(recipient?.wallet_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.summaryBarText, { color: T.text }]}>To: {recipient?.wallet_name} ({address.slice(0,6)}...{address.slice(-4)})</Text>
            <View style={[styles.changeChip, { backgroundColor: T.primary + '15' }]}>
              <Text style={{ color: T.primary, fontSize: 10, fontFamily: Fonts.bold }}>Change</Text>
            </View>
          </TouchableOpacity>

          {/* Balance Display */}
          <View style={styles.balanceContainer}>
            <View style={styles.balanceBadge}>
              <View style={styles.balanceDot} />
              <Text style={styles.balanceTitle}>Available Balance</Text>
            </View>
            <Text style={[styles.balanceAmount, { color: T.text }]}>{availBal.toFixed(6)} {selectedAsset}</Text>
            <CurrencyText amount={availBal * coinPrice} code={fiatCurrency} style={styles.balanceUsd} />
          </View>

          {/* Amount input */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.sectionLabel, { color: T.textDim }]}>AMOUNT TO SEND</Text>
              <TouchableOpacity
                onPress={() => {
                  const gasBuf = gasEth ? parseFloat(gasEth) : 0.0005;
                  const maxAmt = selectedAsset === 'ETH' || selectedAsset === 'TRX' ? Math.max(0, availBal - gasBuf) : availBal;
                  if (maxAmt > 0) {
                    const s = maxAmt.toFixed(6);
                    setAmount(s);
                    validateAmount(s, gasEth || '0.0005');
                  }
                }}
              >
                <Text style={styles.maxText}>USE MAX</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.amountInputBox, amountError ? styles.inputError : null, { backgroundColor: T.surface }]}>
              <View style={styles.amountDisplay}>
                <TextInput
                  style={[styles.amountField, { color: T.text }]}
                  placeholder="0.00"
                  placeholderTextColor={T.textDim}
                  value={amount}
                  onChangeText={val => { setAmount(val); validateAmount(val, gasEth); }}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.ethBrand}>{selectedAsset}</Text>
              </View>
              <View style={[styles.usdPreviewContainer, { borderTopColor: T.border }]}>
                <CurrencyText amount={parsedAmount * coinPrice} code={fiatCurrency} style={styles.usdPreviewText} />
              </View>
            </View>
            {!!amountError && <Text style={styles.errorLabel}>{amountError}</Text>}
          </View>

          {/* Fee details */}
          <View style={[styles.gasSection, { backgroundColor: T.surfaceLow }]}>
            <View style={styles.gasHeader}>
              <View style={[styles.gasIconBox, { backgroundColor: T.primary + '18' }]}>
                <MaterialIcons name="local-gas-station" size={16} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gasTitle, { color: T.text }]}>Transaction Parameters</Text>
                <Text style={{ color: T.textDim, fontSize: 11, fontWeight: '500', marginTop: 1 }}>Estimated blockchain fees & transfer duration</Text>
              </View>
            </View>

            <View style={styles.gasRow}>
              <Text style={[styles.gasLabel, { color: T.textDim }]}>Network Fee</Text>
              {estimating ? (
                <ActivityIndicator size="small" color={T.primary} />
              ) : (
                <Text style={[styles.gasValue, { color: T.text }]}>
                  {gasEth ? `${parseFloat(gasEth).toFixed(6)} ${selectedAsset} (${fiatSymbol} ${formatFiat(fiatGasNum)})` : '—'}
                </Text>
              )}
            </View>
            <View style={styles.gasRow}>
              <Text style={[styles.gasLabel, { color: T.textDim }]}>Est. Arrival Time</Text>
              <Text style={[styles.gasValue, { color: T.text }]}>{selectedNetworkObj?.estimated_arrival || '3 minutes'}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── STEP 5: REVIEW TRANSACTION ── */}
      {step === 'review' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: T.text }]}>Review Transaction</Text>
            <Text style={[styles.heroSubTitle, { color: T.textDim }]}>Double check all details. Sent transactions cannot be reversed.</Text>
          </View>

          <View style={[styles.reviewCard, { backgroundColor: T.surfaceLow }]}>
            <View style={[styles.reviewRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.reviewLabel, { color: T.textDim }]}>Asset to Send</Text>
              <View style={styles.reviewValueRow}>
                <CoinIcon symbol={selectedAsset} size={18} />
                <Text style={[styles.reviewValue, { color: T.text, marginLeft: 6 }]}>{selectedAsset}</Text>
              </View>
            </View>

            <View style={[styles.reviewRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.reviewLabel, { color: T.textDim }]}>Blockchain Network</Text>
              <Text style={[styles.reviewValue, { color: T.text }]}>{selectedNetworkObj?.network_name}</Text>
            </View>

            <View style={[styles.reviewRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.reviewLabel, { color: T.textDim }]}>Recipient</Text>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={[styles.reviewValue, { color: T.text }]} numberOfLines={1}>
                  {recipient?.wallet_name || 'Unknown'}
                </Text>
                <Text style={{ color: T.textDim, fontSize: 10, fontFamily: Fonts.bold, marginTop: 2 }}>
                  {address.slice(0, 8)}...{address.slice(-8)}
                </Text>
              </View>
            </View>

            <View style={[styles.reviewRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.reviewLabel, { color: T.textDim }]}>Amount</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.reviewValue, { color: T.text }]}>{parsedAmount.toFixed(6)} {selectedAsset}</Text>
                <CurrencyText amount={fiatAmountNum} code={fiatCurrency} style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.bold, marginTop: 2 }} />
              </View>
            </View>

            <View style={[styles.reviewRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.reviewLabel, { color: T.textDim }]}>Network Fee</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.reviewValue, { color: T.text }]}>{gasEth ? `${parseFloat(gasEth).toFixed(6)} ${selectedAsset}` : '—'}</Text>
                {gasEth && (
                  <CurrencyText amount={fiatGasNum} code={fiatCurrency} style={{ color: T.textDim, fontSize: 11, fontFamily: Fonts.bold, marginTop: 2 }} />
                )}
              </View>
            </View>

            <View style={styles.reviewTotalRow}>
              <Text style={[styles.reviewTotalLabel, { color: T.text }]}>Total Deducted</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.reviewTotalValue, { color: T.primary }]}>{totalDeducted} {selectedAsset}</Text>
                <CurrencyText amount={fiatTotalNum} code={fiatCurrency} style={styles.reviewTotalSub} />
              </View>
            </View>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity style={[styles.confirmBtn, { marginTop: 24 }]} onPress={handleConfirmSend} activeOpacity={0.8}>
            <LinearGradient
              colors={[T.primary, '#D32F2F']}
              style={styles.confirmBtnGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Feather name="shield" size={18} color="#FFF" />
              <Text style={styles.confirmBtnText}>CONFIRM & SEND NOW</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── STEP 6: SUCCESS SCREEN ── */}
      {step === 'success' && (
        <View style={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <LinearGradient
              colors={['#00C853', '#009624']}
              style={styles.successIconCircle}
            >
              <Feather name="check" size={48} color="#FFF" />
            </LinearGradient>
          </View>

          <Text style={[styles.successTitle, { color: T.text }]}>Transfer Successful!</Text>
          <Text style={[styles.successSubtitle, { color: T.textDim }]}>Your transaction has been broadcast to the blockchain.</Text>

          <View style={[styles.successDetailsCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={[styles.successDetailRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.successDetailLabel, { color: T.textDim }]}>Asset Sent</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CoinIcon symbol={selectedAsset} size={16} />
                <Text style={[styles.successDetailValue, { color: T.text, marginLeft: 6 }]}>
                  {parsedAmount.toFixed(6)} {selectedAsset}
                </Text>
              </View>
            </View>

            <View style={[styles.successDetailRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.successDetailLabel, { color: T.textDim }]}>Network Used</Text>
              <Text style={[styles.successDetailValue, { color: T.text }]}>{selectedNetworkObj?.network_name}</Text>
            </View>

            <View style={[styles.successDetailRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.successDetailLabel, { color: T.textDim }]}>Recipient</Text>
              <Text style={[styles.successDetailValue, { color: T.text }]} numberOfLines={1}>
                {recipient?.wallet_name || 'Unknown'}
              </Text>
            </View>

            <View style={[styles.successDetailRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.successDetailLabel, { color: T.textDim }]}>Timestamp</Text>
              <Text style={[styles.successDetailValue, { color: T.text }]}>{txTimestamp}</Text>
            </View>

            <View style={styles.successDetailRow}>
              <Text style={[styles.successDetailLabel, { color: T.textDim }]}>Transaction Hash</Text>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', maxWidth: 180 }}
                onPress={async () => {
                  await Clipboard.setStringAsync(txHash);
                  showToast('Transaction hash copied!', 'success');
                }}
              >
                <Text style={[styles.successDetailValue, { color: T.primary, marginRight: 4 }]} numberOfLines={1}>
                  {txHash}
                </Text>
                <Feather name="copy" size={12} color={T.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.successDoneBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <LinearGradient
              colors={[T.primary, '#D32F2F']}
              style={styles.successDoneGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.successDoneText}>BACK TO WALLET</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Bars for steps 1-4 */}
      {step !== 'success' && step !== 'review' && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16, backgroundColor: T.background }]}>
          {step === 'asset' && (
            <View style={styles.actionCenterText}>
              <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>Step 1 of 5 · Select token to send</Text>
            </View>
          )}
          {step === 'network' && (
            <View style={styles.actionCenterText}>
              <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>Step 2 of 5 · Select network</Text>
            </View>
          )}
          {step === 'recipient' && (
            <View style={styles.actionCenterText}>
              <Text style={{ color: T.textDim, fontSize: 12, fontFamily: Fonts.medium }}>
                {recipient?.found ? 'Recipient Selected · Click Continue' : 'Step 3 of 5 · Lookup Recipient'}
              </Text>
            </View>
          )}
          {step === 'amount' && (
            <TouchableOpacity
              style={[styles.mainBtn, !canReview && styles.btnDisabled]}
              onPress={handleReview}
              disabled={!canReview}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canReview ? [T.primary, '#D32F2F'] : ['#2A2B31', '#2A2B31']}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.btnText}>{canReview ? 'REVIEW TRANSACTION' : 'ENTER DETAILS'}</Text>
                {canReview && <Feather name="arrow-right" size={18} color="#FFF" />}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: T.background,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: T.text, fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 2, textTransform: 'uppercase' },
  qrBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.surfaceLow, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingBottom: 160 },

  heroSection: { marginTop: 12, marginBottom: 20 },
  heroTitle: { fontSize: 28, fontFamily: Fonts.extraBold, letterSpacing: -1, marginBottom: 6 },
  heroSubTitle: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium },

  // Step Indicators
  stepIndicatorContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 12, paddingHorizontal: 32
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  stepDotActive: { backgroundColor: T.primary, width: 10, height: 10, borderRadius: 5 },
  stepDotCompleted: { backgroundColor: T.success },
  stepLine: { flex: 1, height: 2, backgroundColor: T.border },
  stepLineCompleted: { backgroundColor: T.success },

  // Summary bar
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
    borderWidth: 1, gap: 10, marginBottom: 12
  },
  summaryBarText: { flex: 1, fontSize: 13, fontFamily: Fonts.bold },
  changeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },

  // Assets list
  assetsContainer: { gap: 10, marginBottom: 30 },
  assetRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1
  },
  assetRowSymbol: { fontSize: 16, fontFamily: Fonts.extraBold },

  // Networks list
  networksContainer: { gap: 10, marginBottom: 30 },
  networkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 18, borderWidth: 1
  },
  networkRowLeft: { flexDirection: 'row', alignItems: 'center' },
  networkIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  networkRowName: { fontSize: 15, fontFamily: Fonts.bold },

  // Empty container
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },

  // Method Tabs
  methodTabsContainer: { flexDirection: 'row', gap: 6, marginBottom: 20, marginTop: 8 },
  methodTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5,
  },
  methodTabActive: { backgroundColor: T.primary + '10' },
  methodTabText: { fontSize: 11, fontFamily: Fonts.bold },

  // Search section
  searchSection: { marginBottom: 20 },
  searchLabel: { color: T.textDim, fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1.5, marginBottom: 10 },
  searchInputBox: {
    height: 58, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: T.border,
  },
  searchInputText: { flex: 1, fontSize: 14, fontFamily: Fonts.semiBold },
  searchBtn: { marginTop: 14, height: 52, borderRadius: 26, overflow: 'hidden' },
  searchBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  searchBtnText: { color: '#FFF', fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  errorLabel: { color: T.primary, fontSize: 12, fontFamily: Fonts.semiBold, marginTop: 8, marginLeft: 4 },

  // Recipient details
  recipientCard: {
    borderRadius: 24, padding: 20, borderWidth: 1.5, marginBottom: 24,
  },
  recipientCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recipientAvatarSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recipientName: { fontSize: 16, fontFamily: Fonts.extraBold, marginBottom: 3 },
  uidPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  foundBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  recipientChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  recipientChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  recipientChipText: { fontSize: 11, fontFamily: Fonts.bold },
  confirmRecipientBtn: { height: 52, borderRadius: 26, overflow: 'hidden' },
  confirmRecipientGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmRecipientText: { color: '#FFF', fontSize: 12, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },

  // Recents
  recentsSection: { marginTop: 8, marginBottom: 24 },
  recentsTitle: { color: T.textDim, fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1.5, marginBottom: 12 },
  recentItem: {
    width: 80, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 18, borderWidth: 1,
  },
  recentAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  recentName: { fontSize: 11, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 2 },
  recentMethod: { fontSize: 9, fontFamily: Fonts.medium },

  // Balance
  balanceContainer: { marginTop: 8, marginBottom: 24 },
  balanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  balanceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C853' },
  balanceTitle: { color: T.textDim, fontSize: 12, fontFamily: Fonts.bold },
  balanceAmount: { fontSize: 32, fontFamily: Fonts.extraBold, letterSpacing: -1 },
  balanceUsd: { color: T.textDim, fontSize: 14, fontFamily: Fonts.semiBold, marginTop: 2 },

  // Amount inputs
  section: { marginBottom: 24 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  maxText: { color: T.primary, fontSize: 12, fontFamily: Fonts.extraBold },
  amountInputBox: { 
    borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.border
  },
  amountDisplay: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 8 },
  amountField: { fontSize: 30, fontFamily: Fonts.extraBold, minWidth: 120, padding: 0 },
  ethBrand: { color: T.textDim, fontSize: 14, fontFamily: Fonts.extraBold, marginBottom: 6 },
  usdPreviewContainer: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10 },
  usdPreviewText: { color: T.textDim, fontSize: 14, fontFamily: Fonts.semiBold },
  inputError: { borderColor: T.primary + '80' },

  // Gas details
  gasSection: { borderRadius: 24, padding: 18 },
  gasHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  gasIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gasTitle: { fontSize: 13, fontFamily: Fonts.bold },
  gasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  gasLabel: { fontSize: 12, fontFamily: Fonts.semiBold },
  gasValue: { fontSize: 12, fontFamily: Fonts.bold },

  // Review screen
  reviewCard: { borderRadius: 24, padding: 20, gap: 16 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 13, fontFamily: Fonts.bold },
  reviewValue: { fontSize: 13, fontFamily: Fonts.extraBold },
  reviewValueRow: { flexDirection: 'row', alignItems: 'center' },
  reviewTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  reviewTotalLabel: { fontSize: 14, fontFamily: Fonts.extraBold },
  reviewTotalValue: { fontSize: 18, fontFamily: Fonts.extraBold },
  reviewTotalSub: { color: T.textDim, fontSize: 12, fontFamily: Fonts.bold, marginTop: 2 },
  confirmBtn: { height: 56, borderRadius: 28, overflow: 'hidden' },
  confirmBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#FFF', fontSize: 13, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },

  // Success Screen
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  successIconWrapper: { marginBottom: 20 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontFamily: Fonts.extraBold, marginBottom: 6 },
  successSubtitle: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', paddingHorizontal: 20, marginBottom: 24 },
  successDetailsCard: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 18, gap: 14, marginBottom: 28 },
  successDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  successDetailLabel: { fontSize: 12, fontFamily: Fonts.bold },
  successDetailValue: { fontSize: 12, fontFamily: Fonts.extraBold },
  successDoneBtn: { width: '100%', height: 56, borderRadius: 28, overflow: 'hidden' },
  successDoneGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successDoneText: { color: '#FFF', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 1 },

  // Actions
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16 },
  actionCenterText: { height: 56, alignItems: 'center', justifyContent: 'center' },
  mainBtn: { height: 56, borderRadius: 28, overflow: 'hidden' },
  btnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 14, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
});
