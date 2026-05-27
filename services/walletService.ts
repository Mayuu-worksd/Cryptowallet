import { ethers } from 'ethers';
import { storageService } from './storageService';
import { deriveTronAddress } from './tronService';

// ethers v5/v6 compatibility shims
const isAddress   = (ethers as any).isAddress   ?? ethers.utils.isAddress;
const fromMnemonic = (mnemonic: string) => {
  // v6: ethers.Wallet.fromPhrase  |  v5: ethers.Wallet.fromMnemonic
  if ((ethers.Wallet as any).fromPhrase) return (ethers.Wallet as any).fromPhrase(mnemonic);
  return (ethers.Wallet as any).fromMnemonic(mnemonic);
};
const hdNodeFromMnemonic = (mnemonic: string, path: string) => {
  // v6: ethers.HDNodeWallet.fromPhrase  |  v5: ethers.utils.HDNode.fromMnemonic
  if ((ethers as any).HDNodeWallet?.fromPhrase)
    return (ethers as any).HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  return ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path);
};

export type WalletData = {
  address: string;      // EVM address (0x...)
  tronAddress: string;  // TRON address (T...)
  privateKey: string;   // EVM private key
  tronPrivateKey: string;
  mnemonic: string;
};

export const walletService = {
  // Just generate a random mnemonic without saving anything
  generateMnemonic(): string {
    return ethers.Wallet.createRandom().mnemonic!.phrase;
  },

  generateWalletPreview(): { mnemonic: string; address: string } {
    const wallet = ethers.Wallet.createRandom();
    return { mnemonic: wallet.mnemonic!.phrase, address: wallet.address };
  },

  async createWallet(): Promise<WalletData> {
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic!.phrase;
    const tron = await deriveTronAddress(mnemonic);
    const data: WalletData = {
      address:        wallet.address,
      tronAddress:    tron.address,
      privateKey:     wallet.privateKey,
      tronPrivateKey: tron.privateKey,
      mnemonic,
    };
    await storageService.saveWallet(data.privateKey, data.mnemonic, data.address, data.tronAddress);
    return data;
  },

  // Import wallet from 12/24 word seed phrase
  async importFromMnemonic(mnemonic: string): Promise<WalletData> {
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = normalized.split(' ').length;
    try {
      const wallet = fromMnemonic(normalized);
      const tron   = await deriveTronAddress(normalized);
      return {
        address:        wallet.address,
        tronAddress:    tron.address,
        privateKey:     wallet.privateKey,
        tronPrivateKey: tron.privateKey,
        mnemonic:       normalized,
      };
    } catch (e: any) {
      throw new Error('Invalid seed phrase. Please check your words and try again.');
    }
  },

  // Load wallet from secure storage
  async loadWallet(): Promise<ethers.Wallet | null> {
    const privateKey = await storageService.getPrivateKey();
    if (!privateKey) return null;
    return new ethers.Wallet(privateKey);
  },

  // Derive a specific account index from a mnemonic
  deriveAccount(mnemonic: string, index: number): { address: string; privateKey: string } {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = hdNodeFromMnemonic(mnemonic, path);
    return { address: wallet.address, privateKey: wallet.privateKey };
  },

  // Validate an Ethereum address
  isValidAddress(address: string): boolean {
    return isAddress(address);
  },

  async walletExists(): Promise<boolean> {
    return await storageService.hasWallet();
  },

  /**
   * Diagnostic tool: Checks which words in a phrase are not in the BIP-39 wordlist.
   * Returns an array of invalid words.
   */
  getInvalidWords(mnemonic: string): string[] {
    const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const wordlist = ethers.wordlists.en;
    const invalid: string[] = [];
    for (const w of words) {
      try {
        if (wordlist.getWordIndex(w) === -1) invalid.push(w);
      } catch {
        invalid.push(w);
      }
    }
    return invalid;
  },

  async deleteWallet(): Promise<void> {
    await storageService.clearWallet();
  },
};
