import { ethers } from 'ethers';
import { storageService } from './storageService';

export type WalletData = {
  address: string;
  privateKey: string;
  mnemonic: string;
};

export const walletService = {
  // Just generate a random mnemonic without saving anything
  generateMnemonic(): string {
    return ethers.Wallet.createRandom().mnemonic.phrase;
  },

  // Generate mnemonic + derive address for preview — does NOT save to storage
  generateWalletPreview(): { mnemonic: string; address: string } {
    const wallet = ethers.Wallet.createRandom();
    return { mnemonic: wallet.mnemonic.phrase, address: wallet.address };
  },

  // Create a brand new wallet with random mnemonic
  async createWallet(): Promise<WalletData> {
    const wallet = ethers.Wallet.createRandom();
    const data: WalletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };
    await storageService.saveWallet(data.privateKey, data.mnemonic, data.address);
    return data;
  },

  // Import wallet from 12/24 word seed phrase
  async importFromMnemonic(mnemonic: string): Promise<WalletData> {
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    try {
      const wallet = ethers.Wallet.fromMnemonic(normalized);
      const data: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: normalized,
      };
      await storageService.saveWallet(data.privateKey, data.mnemonic, data.address);
      return data;
    } catch (e) {
      throw new Error('Invalid or corrupted seed phrase. Ensure you entered exactly 12 or 24 valid backup words without typos.');
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
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
    return { address: wallet.address, privateKey: wallet.privateKey };
  },

  // Validate an Ethereum address
  isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  },

  async walletExists(): Promise<boolean> {
    return await storageService.hasWallet();
  },

  async deleteWallet(): Promise<void> {
    await storageService.clearWallet();
  },
};
