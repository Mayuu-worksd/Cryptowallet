import { ethers } from 'ethers';

const MAINNET_TOKENS: Record<string, Record<string, string>> = {
  Ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  Polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  },
  Arbitrum: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
};

const SEPOLIA_TOKENS: Record<string, string> = {
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  DAI:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
};

const DECIMALS: Record<string, number> = {
  ETH: 18, WETH: 18, DAI: 18, USDC: 6, USDT: 6,
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Checks current ERC-20 allowance and requests approval if needed.
 * Returns true when the spender has sufficient allowance.
 */
export async function checkAndRequestApproval({
  tokenSymbol,
  spenderAddress,
  amount,
  wallet,
  network,
  onStatus,
}: {
  tokenSymbol:    string;
  spenderAddress: string;
  amount:         string;
  wallet:         ethers.Wallet;
  network:        string;
  onStatus?:      (msg: string) => void;
}): Promise<boolean> {
  if (tokenSymbol === 'ETH') return true; // native — never needs approval

  const tokenAddress =
    network === 'Sepolia'
      ? SEPOLIA_TOKENS[tokenSymbol]
      : MAINNET_TOKENS[network]?.[tokenSymbol];

  if (!tokenAddress) throw new Error(`Token ${tokenSymbol} not found on ${network}`);

  const amtWei   = ethers.parseUnits(amount, DECIMALS[tokenSymbol] ?? 18);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

  const allowance: bigint = await contract.allowance(wallet.address, spenderAddress);
  if (allowance >= amtWei) return true;

  onStatus?.(`Approving ${tokenSymbol}...`);
  const tx = await contract.approve(spenderAddress, ethers.MaxUint256);
  onStatus?.('Waiting for approval confirmation...');
  await tx.wait();
  onStatus?.(`${tokenSymbol} approved!`);
  return true;
}
