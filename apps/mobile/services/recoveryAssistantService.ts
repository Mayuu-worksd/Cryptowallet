import { ethers } from 'ethers';
import { RPC_URLS } from '../config';
import { ethereumService } from './ethereumService';

const isAddress = (ethers as any).isAddress ?? ethers.utils.isAddress;
const formatEther = (ethers as any).formatEther ?? ethers.utils.formatEther;
const JsonRpcProvider = (ethers as any).JsonRpcProvider ?? ethers.providers.JsonRpcProvider;

export type DiagnosticResult = {
  type: 'tx' | 'contract' | 'address' | 'invalid';
  networkFound?: string;
  isRecoverable: boolean;
  explanation: string;
  steps: string[];
  estimatedGas: string;
  estimatedTime: string;
  metadata?: {
    symbol?: string;
    balance?: string;
    targetAddress?: string;
  };
};

export const recoveryAssistantService = {
  async diagnoseInput(input: string, activeNetwork: string, userWalletAddress: string): Promise<DiagnosticResult> {
    const cleanInput = input.trim();
    if (!cleanInput) {
      return {
        type: 'invalid',
        isRecoverable: false,
        explanation: 'Input is empty. Please paste a valid transaction hash, contract address, or wallet address.',
        steps: [],
        estimatedGas: 'N/A',
        estimatedTime: 'N/A',
      };
    }

    // 1. Check if Address
    if (isAddress(cleanInput)) {
      // Is it a Contract or EOA (External Address)?
      const isContract = await this.checkIsContract(cleanInput, activeNetwork);
      if (isContract) {
        return this.diagnoseContract(cleanInput, activeNetwork, userWalletAddress);
      } else {
        return this.diagnoseEOA(cleanInput, userWalletAddress);
      }
    }

    // 2. Check if Transaction Hash (66 chars starting with 0x)
    const isTxHash = /^0x([A-Fa-f0-9]{64})$/.test(cleanInput);
    if (isTxHash) {
      return this.diagnoseTransaction(cleanInput, activeNetwork, userWalletAddress);
    }

    return {
      type: 'invalid',
      isRecoverable: false,
      explanation: 'Unrecognized format. Enter a 42-character hex address (0x...) or a 66-character transaction hash (0x...).',
      steps: [],
      estimatedGas: 'N/A',
      estimatedTime: 'N/A',
    };
  },

  async checkIsContract(address: string, network: string): Promise<boolean> {
    try {
      const rpc = RPC_URLS[network];
      if (!rpc) return false;
      const provider = new JsonRpcProvider(rpc);
      const code = await provider.getCode(address);
      return code !== '0x' && code !== '0x0';
    } catch {
      return false;
    }
  },

  async diagnoseEOA(address: string, userWalletAddress: string): Promise<DiagnosticResult> {
    const isSelf = address.toLowerCase() === userWalletAddress.toLowerCase();
    
    if (isSelf) {
      return {
        type: 'address',
        isRecoverable: true,
        explanation: 'This address is YOUR active EVM wallet address. If you sent funds to this address from another wallet, they should already be in your account.',
        steps: [
          'Verify if the token contract is supported or imported.',
          'Go to the Recovery Center and run "Auto Scan" to discover any hidden incoming assets.',
        ],
        estimatedGas: '0 ETH',
        estimatedTime: 'Instant',
      };
    }

    return {
      type: 'address',
      isRecoverable: true,
      explanation: 'This is an Externally Owned Account (EOA) address. If you accidentally transferred assets here and you own this private key, you can recover them by importing that mnemonic phrase.',
      steps: [
        'Import the seed phrase/private key of this destination address into a Web3 wallet (MetaMask, Coinbase Wallet).',
        'Ensure you have native funds (e.g. ETH) in that destination wallet to cover gas fees.',
        'Send the tokens back to your active wallet address.',
      ],
      estimatedGas: '0.0005 ETH',
      estimatedTime: '1-3 minutes',
    };
  },

  async diagnoseContract(address: string, network: string, userWalletAddress: string): Promise<DiagnosticResult> {
    try {
      const meta = await ethereumService.getCustomTokenMetadata(address, network);
      if (meta) {
        const bal = await ethereumService.getCustomTokenBalance(userWalletAddress, address, network);
        const hasBalance = bal > 0;
        
        return {
          type: 'contract',
          networkFound: network,
          isRecoverable: hasBalance,
          explanation: `This is a valid ERC20 Token Contract for the token symbol "${meta.symbol}" on ${network}. Your current balance is ${bal} ${meta.symbol}.`,
          steps: hasBalance ? [
            'Go to the Recovery Center.',
            `Locate "${meta.symbol}" under Recoverable Tokens.`,
            'Tap "Import" to add it to your Home Screen asset list.',
          ] : [
            `The contract is valid, but your active address currently holds 0 ${meta.symbol}.`,
            'Ensure you sent the assets to the correct address on the correct network.',
          ],
          estimatedGas: '0.0001 ETH',
          estimatedTime: 'Instant',
          metadata: {
            symbol: meta.symbol,
            balance: bal.toString(),
          }
        };
      }
    } catch {}

    return {
      type: 'contract',
      networkFound: network,
      isRecoverable: false,
      explanation: 'This is a smart contract address, but it does not conform to the standard ERC20 interface or does not exist on this network.',
      steps: [
        'Confirm if you are on the right network (e.g., Mainnet vs Sepolia).',
        'Verify the contract details on the block explorer (Etherscan).',
      ],
      estimatedGas: 'N/A',
      estimatedTime: 'N/A',
    };
  },

  async diagnoseTransaction(txHash: string, activeNetwork: string, userWalletAddress: string): Promise<DiagnosticResult> {
    // Loop through known network providers to find where the tx is
    let foundNetwork = '';
    let txReceipt: any = null;
    let txDetails: any = null;

    const networksToScan = ['Ethereum', 'Polygon', 'Arbitrum', 'Sepolia', 'BSC'];
    for (const net of networksToScan) {
      try {
        const rpc = RPC_URLS[net];
        if (!rpc) continue;
        const provider = new JsonRpcProvider(rpc);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          txReceipt = receipt;
          txDetails = await provider.getTransaction(txHash);
          foundNetwork = net;
          break;
        }
      } catch {}
    }

    if (!txReceipt || !txDetails) {
      return {
        type: 'tx',
        isRecoverable: false,
        explanation: 'Transaction hash was not found on any of the supported networks (Ethereum, Polygon, Arbitrum, BSC, Sepolia).',
        steps: [
          'Verify if the hash is correct.',
          'If the transaction was broadcasted recently, wait a few minutes and try again.',
        ],
        estimatedGas: 'N/A',
        estimatedTime: 'N/A',
      };
    }

    const isSuccess = txReceipt.status === 1;
    if (!isSuccess) {
      return {
        type: 'tx',
        networkFound: foundNetwork,
        isRecoverable: false,
        explanation: `Transaction was found on ${foundNetwork} but it FAILED. Failed transactions cannot be recovered as no assets were actually transferred.`,
        steps: [
          'Check the failure reason on the explorer.',
          'Retry the transfer with a higher gas fee or corrected inputs.',
        ],
        estimatedGas: 'N/A',
        estimatedTime: 'N/A',
      };
    }

    // Determine if ERC20 transfer or Native transfer
    const valueEth = parseFloat(formatEther(txDetails.value || 0));
    const isErc20 = txDetails.data !== '0x' && txDetails.data.length > 10;

    if (isErc20) {
      // Decode ERC20 transfer: transfer(address,uint256) -> signature is 0xa9059cbb
      const targetContract = txDetails.to;
      return {
        type: 'tx',
        networkFound: foundNetwork,
        isRecoverable: true,
        explanation: `Successful ERC20 token transfer detected on ${foundNetwork}. Token Contract: ${targetContract}.`,
        steps: [
          `Open the Recovery Center.`,
          `Switch your network to ${foundNetwork}.`,
          `Run "Auto Scan" to auto-discover and import the token associated with contract ${targetContract}.`,
        ],
        estimatedGas: '0.0003 ETH',
        estimatedTime: '30 seconds',
      };
    }

    // Native Transfer
    const isSelfRecipient = txDetails.to?.toLowerCase() === userWalletAddress.toLowerCase();
    if (isSelfRecipient) {
      return {
        type: 'tx',
        networkFound: foundNetwork,
        isRecoverable: true,
        explanation: `Successful Native transfer of ${valueEth} native coins on ${foundNetwork} sent to your address.`,
        steps: [
          `Switch your wallet network to ${foundNetwork}.`,
          `Your balance should automatically reflect the new deposit.`,
        ],
        estimatedGas: '0 ETH',
        estimatedTime: 'Instant',
      };
    }

    return {
      type: 'tx',
      networkFound: foundNetwork,
      isRecoverable: false,
      explanation: `Successful transaction found on ${foundNetwork}, but the recipient address (${txDetails.to}) is not your wallet address.`,
      steps: [
        'Confirm if you pasted the correct transaction hash.',
        'Ensure the sender transfered the assets to your specific address.',
      ],
      estimatedGas: 'N/A',
      estimatedTime: 'N/A',
    };
  }
};
