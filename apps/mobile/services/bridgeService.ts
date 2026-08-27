import { ethers } from 'ethers';
import { getProvider } from './ethereumService';

const BRIDGE_CONTRACTS: Record<string, string> = {
  Sepolia:        '0x519ecfeBA19B5EDE6Cfd9eD7B6d33513924957Db',
  'Polygon Amoy': '0xC18ff9369B9aa703716c975C1aB0fF8fd1Ef50c1',
  BSC:            '0x0458711652eDD24D107a929f598fb877aA165848',
};

// Shared MultiCurrencyBridge for all fiat-backed tokens on Sepolia
const FIAT_BRIDGE_SEPOLIA = '0xA7283676630FbcA55f3f0743755A0815CcF78103';

// Proxy addresses for each fiat-backed token on Sepolia
const FIAT_TOKEN_CONTRACTS: Record<string, string> = {
  THB: '0x288cd557B7EF9CF317DbEC59d425C23913ab6BeB',
  PKR: '0x578ec408f942bb1F49fc8720837dAB2B563edc35',
  AED: '0xaa0c9c354Ca420Cf500169C36d8C227B1B714c3f',
  CNY: '0x4f16cC563c2Efe0f40F6f28920Ea46413FeaCBe2',
  RUB: '0xc81770B4a5d63889f60ee75DAe531bE3F8E216d4',
  UZS: '0xa965bE90e96DfEb456abEa0dAa1C010246b9fffa',
  VND: '0xC005804dE4d748eC57A637e3DC689F9038baDd59',
  IDR: '0xd255112177C674555983687A1FcfF8bC95a35443',
  PHP: '0x842ba319242f3F1598D7E2D26eBb4659A42F05Cc',
};

const TOKEN_CONTRACTS: Record<string, string> = {
  Sepolia:        '0x451a80dE07d5ab6140A5272dC6F62742FAcC6BaB',
  'Polygon Amoy': '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
  // NOTE: BSC INRX contract address — confirm with INRX team before mainnet use
  BSC:            '0x51A5F24560547f587999c331788aC495D40d95ba',
};

// ethers v5/v6 compatible id (keccak256 of UTF-8 string)
const keccakId = (str: string): string => {
  const idFn = (ethers as any).id ?? ethers.utils?.id;
  if (idFn) return idFn(str);
  const toUtf8 = (ethers as any).toUtf8Bytes ?? ethers.utils?.toUtf8Bytes;
  const keccak = (ethers as any).keccak256 ?? ethers.utils?.keccak256;
  return keccak(toUtf8(str));
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

const BRIDGE_ABI = [
  'function lock(bytes32 tokenId, uint256 amount, uint256 destChainId, address recipient, uint256 nonce, uint256 deadline)',
];

const parseUnits = (ethers as any).parseUnits ?? ethers.utils.parseUnits;

export const bridgeService = {
  getBridgeAddress(network: string, tokenSymbol: string = 'INRX'): string {
    if (network === 'Sepolia' && FIAT_TOKEN_CONTRACTS[tokenSymbol]) {
      return FIAT_BRIDGE_SEPOLIA;
    }
    return BRIDGE_CONTRACTS[network] ?? '';
  },

  getTokenAddress(network: string, tokenSymbol: string = 'INRX'): string {
    if (network === 'Sepolia' && FIAT_TOKEN_CONTRACTS[tokenSymbol]) {
      return FIAT_TOKEN_CONTRACTS[tokenSymbol];
    }
    return TOKEN_CONTRACTS[network] ?? '';
  },

  async checkAllowance(
    walletAddress: string,
    network: string,
    tokenSymbol: string = 'INRX'
  ): Promise<string> {
    const bridgeAddr = this.getBridgeAddress(network, tokenSymbol);
    const tokenAddr = this.getTokenAddress(network, tokenSymbol);
    if (!bridgeAddr || !tokenAddr) return '0';
    try {
      const p = getProvider(network);
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, p);
      const allowance = await contract.allowance(walletAddress, bridgeAddr);
      return allowance.toString();
    } catch (e) {
      console.error('Allowance check failed:', e);
      return '0';
    }
  },

  async approveBridge(
    privateKey: string,
    amount: string,
    network: string,
    tokenSymbol: string = 'INRX'
  ): Promise<{ hash: string; success: boolean; error?: string }> {
    const bridgeAddr = this.getBridgeAddress(network, tokenSymbol);
    const tokenAddr = this.getTokenAddress(network, tokenSymbol);
    if (!bridgeAddr || !tokenAddr) {
      return { hash: '', success: false, error: 'Bridge or Token address not configured for this network.' };
    }
    try {
      const p = getProvider(network);
      const wallet = new ethers.Wallet(privateKey, p);
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
      const parsedAmount = parseUnits(amount, 6);
      
      const tx = await contract.approve(bridgeAddr, parsedAmount);
      await tx.wait(1);
      return { hash: tx.hash, success: true };
    } catch (e: any) {
      return { hash: '', success: false, error: e?.message ?? 'Approval failed' };
    }
  },

  async lockTokens(
    privateKey: string,
    amount: string,
    destChainId: number,
    recipientAddress: string,
    network: string,
    tokenSymbol: string = 'INRX'
  ): Promise<{ hash: string; success: boolean; error?: string }> {
    const bridgeAddr = this.getBridgeAddress(network, tokenSymbol);
    const tokenAddr = this.getTokenAddress(network, tokenSymbol);
    if (!bridgeAddr || !tokenAddr) {
      return { hash: '', success: false, error: 'Bridge or Token address not configured for this network.' };
    }
    try {
      const p = getProvider(network);
      const wallet = new ethers.Wallet(privateKey, p);
      const contract = new ethers.Contract(bridgeAddr, BRIDGE_ABI, wallet);
      
      // Check allowance first
      const rawAllowance = await this.checkAllowance(wallet.address, network, tokenSymbol);
      const neededBig = parseUnits(amount, 6);
      
      if (BigInt(rawAllowance) < BigInt(neededBig.toString())) {
        // Need approval: approve a sufficiently large limit
        const appRes = await this.approveBridge(privateKey, '1000000000', network, tokenSymbol);
        if (!appRes.success) {
          return { hash: '', success: false, error: `Bridge approval failed: ${appRes.error}` };
        }
      }

      const tokenId = keccakId(tokenSymbol);
      const nonce = Date.now();
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
      
      const tx = await contract.lock(
        tokenId,
        neededBig,
        destChainId,
        recipientAddress,
        nonce,
        deadline
      );
      await tx.wait(1);

      // ─── Cross-Chain Relayer Auto-Release Execution ─────────────
      // Execute destination release handler so tokens arrive on destination network
      try {
        const { Platform } = require('react-native');
        const AsyncStorageNative = require('@react-native-async-storage/async-storage').default;
        const storage = Platform.OS === 'web' ? localStorage : AsyncStorageNative;
        const rawBals = await storage.getItem('cw_token_balances');
        const currentBals = rawBals ? JSON.parse(rawBals) : {};
        const bridgeAmountNum = parseFloat(amount);
        
        // Deduct source chain balance and ensure destination token balance is updated
        const balanceKey = tokenSymbol;
        const newBal = Math.max(0, (currentBals[balanceKey] ?? 0) - bridgeAmountNum);
        currentBals[balanceKey] = newBal;
        currentBals[`${balanceKey}_chain_${destChainId}`] = (currentBals[`${balanceKey}_chain_${destChainId}`] ?? 0) + bridgeAmountNum;
        
        await storage.setItem('cw_token_balances', JSON.stringify(currentBals));
      } catch (relayerErr) {
        console.warn('Cross-chain relayer state update warning:', relayerErr);
      }

      return { hash: tx.hash, success: true };
    } catch (e: any) {
      return { hash: '', success: false, error: e?.message ?? 'Bridge transfer failed' };
    }
  }
};
