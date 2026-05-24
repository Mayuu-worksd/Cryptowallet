/**
 * tronService.ts
 * TRON blockchain — mainnet + Nile testnet
 * Derives T*** addresses from the same BIP-39 mnemonic using TRON's derivation path.
 * Uses TronGrid REST API (no heavy SDK needed).
 *
 * TRON derivation path: m/44'/195'/0'/0/0
 * Address format: Base58Check starting with 'T'
 */

import { ethers } from 'ethers';

// ─── Base58Check (TRON address encoding) ─────────────────────────────────────
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  let result = '';
  const base = BigInt(58);
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)] + result;
    num = num / base;
  }
  for (const byte of bytes) {
    if (byte === 0) result = '1' + result;
    else break;
  }
  return result;
}

function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base58 character: ' + char);
    num = num * 58n + BigInt(idx);
  }
  // Convert to hex, pad to 50 hex chars (25 bytes)
  let hex = num.toString(16);
  // Count leading '1's → leading zero bytes
  let leadingZeros = 0;
  for (const c of str) {
    if (c === '1') leadingZeros++;
    else break;
  }
  // Pad to even length
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const bytes = new Uint8Array(leadingZeros + hex.length / 2);
  for (let i = 0; i < hex.length / 2; i++) {
    bytes[leadingZeros + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── Pure JS SHA-256 (no crypto.subtle — React Native compatible) ────────────
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];

function sha256Sync(data: Uint8Array): Uint8Array {
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a;
  let h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const len = data.length;
  const bitLen = len * 8;
  const padLen = ((len + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen - 4, bitLen & 0xffffffff, false);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  const w = new Uint32Array(64);
  for (let i = 0; i < padLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = (w[j-15]>>>7|w[j-15]<<25)^(w[j-15]>>>18|w[j-15]<<14)^(w[j-15]>>>3);
      const s1 = (w[j-2]>>>17|w[j-2]<<15)^(w[j-2]>>>19|w[j-2]<<13)^(w[j-2]>>>10);
      w[j] = (w[j-16]+s0+w[j-7]+s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let j = 0; j < 64; j++) {
      const S1 = (e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7);
      const ch = (e&f)^(~e&g);
      const temp1 = (h+S1+ch+K[j]+w[j]) >>> 0;
      const S0 = (a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10);
      const maj = (a&b)^(a&c)^(b&c);
      const temp2 = (S0+maj) >>> 0;
      [h,g,f,e,d,c,b,a] = [g,f,e,(d+temp1)>>>0,c,b,a,(temp1+temp2)>>>0];
    }
    h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
    h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i) => odv.setUint32(i*4, v, false));
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── TRON address from private key ───────────────────────────────────────────
async function tronAddressFromPrivateKey(privateKey: string): Promise<string> {
  const signingKey = new ethers.SigningKey(privateKey);
  // Get uncompressed public key (65 bytes, 0x04 prefix)
  const uncompressedHex = ethers.SigningKey.computePublicKey(signingKey.publicKey, false);
  // Drop '0x04' prefix → 64 bytes of raw public key
  const pubKeyHex = uncompressedHex.slice(4);
  // Keccak256 of the 64-byte public key
  const keccakHash = ethers.keccak256('0x' + pubKeyHex);
  // Take last 20 bytes (40 hex chars), prepend 0x41 (TRON mainnet prefix)
  const addressHex = '41' + keccakHash.slice(-40);
  const addressBytes = hexToBytes(addressHex);
  // Double SHA256 checksum
  const hash1 = sha256Sync(addressBytes);
  const hash2 = sha256Sync(hash1);
  const checksum = hash2.slice(0, 4);
  // Base58Check encode
  const full = new Uint8Array([...addressBytes, ...checksum]);
  return base58Encode(full);
}

// ─── Convert TRON Base58 address → 21-byte hex (with 0x41 prefix) ────────────
export function tronAddressToHex(base58Address: string): string {
  try {
    const decoded = base58Decode(base58Address); // 25 bytes: 21 addr + 4 checksum
    // Return first 21 bytes as hex (42 hex chars)
    return bytesToHex(decoded.slice(0, 21));
  } catch {
    return '';
  }
}

// ─── TRON token contracts ─────────────────────────────────────────────────────
export const TRON_TOKENS: Record<string, Record<string, string>> = {
  USDT: {
    TRON:        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // mainnet TRC20 USDT
    'TRON Nile': 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',  // Nile testnet USDT
  },
  USDC: {
    TRON:        'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',  // mainnet TRC20 USDC
    'TRON Nile': '',
  },
};

export const TRON_EXPLORER: Record<string, string> = {
  TRON:        'https://tronscan.org/#/transaction/',
  'TRON Nile': 'https://nile.tronscan.org/#/transaction/',
};

export const TRON_ADDRESS_EXPLORER: Record<string, string> = {
  TRON:        'https://tronscan.org/#/address/',
  'TRON Nile': 'https://nile.tronscan.org/#/address/',
};

export const TRON_FAUCETS: Record<string, string[]> = {
  'TRON Nile': [
    'https://nile.tronscan.org/#/faucet',
    'https://nile.trongrid.io',
  ],
};

// ─── Derive TRON address from mnemonic ───────────────────────────────────────
export async function deriveTronAddress(mnemonic: string): Promise<{
  address: string;
  privateKey: string;
}> {
  // TRON uses BIP44 path m/44'/195'/0'/0/0
  const hdNode = ethers.HDNodeWallet.fromPhrase(
    mnemonic.trim().toLowerCase(),
    undefined,
    "m/44'/195'/0'/0/0"
  );
  const tronAddr = await tronAddressFromPrivateKey(hdNode.privateKey);
  return {
    address:    tronAddr,
    privateKey: hdNode.privateKey,
  };
}

// ─── TRON transaction type ────────────────────────────────────────────────────
export type TronTx = {
  txID:        string;
  timestamp:   number;
  blockNumber: number;
  from:        string;
  to:          string;
  amount:      number;   // in TRX
  type:        'sent' | 'received';
  status:      'success' | 'failed';
  token:       string;   // 'TRX' or token symbol
};

// ─── TRON service ─────────────────────────────────────────────────────────────
export const tronService = {

  getBaseUrl(network: string): string {
    return network === 'TRON' ? 'https://api.trongrid.io' : 'https://nile.trongrid.io';
  },

  async getTRXBalance(tronAddress: string, network: string): Promise<number> {
    const base = this.getBaseUrl(network);
    try {
      const res  = await fetch(`${base}/v1/accounts/${tronAddress}`, {
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      const sun  = json?.data?.[0]?.balance ?? 0;
      return sun / 1_000_000;
    } catch {
      return 0;
    }
  },

  async getAllBalances(tronAddress: string, network: string): Promise<{
    TRX: number; USDT: number; USDC: number;
  }> {
    const base = this.getBaseUrl(network);
    try {
      const res  = await fetch(`${base}/v1/accounts/${tronAddress}`, {
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      const account = json?.data?.[0];

      if (!account) return { TRX: 0, USDT: 0, USDC: 0 };

      const trx = (account.balance ?? 0) / 1_000_000;

      const usdtContract = TRON_TOKENS.USDT[network] ?? '';
      const usdcContract = TRON_TOKENS.USDC[network] ?? '';
      let usdt = 0;
      let usdc = 0;

      const trc20: any[] = account.trc20 ?? [];
      for (const t of trc20) {
        for (const [addr, bal] of Object.entries(t)) {
          if (usdtContract && addr === usdtContract) {
            usdt = parseInt(String(bal), 10) / 1_000_000;
          }
          if (usdcContract && addr === usdcContract) {
            usdc = parseInt(String(bal), 10) / 1_000_000;
          }
        }
      }

      return { TRX: trx, USDT: usdt, USDC: usdc };
    } catch {
      return { TRX: 0, USDT: 0, USDC: 0 };
    }
  },

  // ─── Fetch TRON transaction history ────────────────────────────────────────
  async getTransactions(tronAddress: string, network: string, limit = 50): Promise<TronTx[]> {
    const base = this.getBaseUrl(network);
    try {
      const res = await fetch(
        `${base}/v1/accounts/${tronAddress}/transactions?limit=${limit}&only_confirmed=true`,
        { headers: { 'Accept': 'application/json' } }
      );
      const json = await res.json();
      const rawTxs: any[] = json?.data ?? [];

      const result: TronTx[] = [];

      for (const tx of rawTxs) {
        try {
          const contract = tx?.raw_data?.contract?.[0];
          if (!contract) continue;

          const type = contract.type;

          // Only handle TRX transfers (TransferContract)
          if (type === 'TransferContract') {
            const value = contract.parameter?.value ?? {};
            const fromHex = value.owner_address ?? '';
            const toHex   = value.to_address ?? '';
            const amount  = (value.amount ?? 0) / 1_000_000;

            if (amount <= 0) continue;

            const fromAddr = hexToTronAddress(fromHex);
            const toAddr   = hexToTronAddress(toHex);
            const isSent   = fromAddr.toLowerCase() === tronAddress.toLowerCase();

            const ret = tx?.ret?.[0];
            const status: 'success' | 'failed' = ret?.contractRet === 'SUCCESS' ? 'success' : 'failed';

            result.push({
              txID:        tx.txID,
              timestamp:   tx.block_timestamp ?? 0,
              blockNumber: tx.blockNumber ?? 0,
              from:        fromAddr,
              to:          toAddr,
              amount,
              type:        isSent ? 'sent' : 'received',
              status,
              token:       'TRX',
            });
          }
        } catch {
          // skip malformed tx
        }
      }

      return result;
    } catch {
      return [];
    }
  },

  // ─── Estimate TRON bandwidth/energy fee (flat estimate) ────────────────────
  estimateFee(_network: string): number {
    // Standard TRX transfer costs ~0.1 TRX in bandwidth
    // If bandwidth is exhausted, ~1 TRX in energy
    return 1.0; // conservative estimate in TRX
  },

  // ─── Send TRX (native) ─────────────────────────────────────────────────────
  async sendTRX(params: {
    privateKey: string;
    toAddress:  string;
    amount:     number; // in TRX
    network:    string;
  }): Promise<{ txHash: string; success: boolean; error?: string }> {
    const base = this.getBaseUrl(params.network);
    try {
      // 1. Derive owner address from private key
      const ownerTronAddr = await tronAddressFromPrivateKey(params.privateKey);
      const ownerHex      = tronAddressToHex(ownerTronAddr);
      const toHex         = tronAddressToHex(params.toAddress);

      if (!ownerHex || !toHex) {
        throw new Error('Invalid address encoding');
      }

      // 2. Create transaction
      const createRes = await fetch(`${base}/wallet/createtransaction`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_address:    toHex,
          owner_address: ownerHex,
          amount:        Math.floor(params.amount * 1_000_000), // TRX → SUN
        }),
      });
      const tx = await createRes.json();
      if (!tx.txID) throw new Error(tx.Error ?? tx.message ?? 'Failed to create transaction');

      // 3. Sign
      const signed = signTronTx(tx, params.privateKey);

      // 4. Broadcast
      const broadcastRes = await fetch(`${base}/wallet/broadcasttransaction`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signed),
      });
      const result = await broadcastRes.json();
      if (!result.result) throw new Error(result.message ?? 'Broadcast failed');

      return { txHash: tx.txID, success: true };
    } catch (e: any) {
      return { txHash: '', success: false, error: e?.message ?? 'TRON send failed' };
    }
  },

  getExplorerUrl(txHash: string, network: string): string {
    return `${TRON_EXPLORER[network] ?? TRON_EXPLORER.TRON}${txHash}`;
  },

  getAddressExplorerUrl(address: string, network: string): string {
    return `${TRON_ADDRESS_EXPLORER[network] ?? TRON_ADDRESS_EXPLORER.TRON}${address}`;
  },

  getFaucetUrls(network: string): string[] {
    return TRON_FAUCETS[network] ?? [];
  },

  isValidTronAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a hex address (with or without 0x41 prefix) to TRON Base58Check address.
 * Used when parsing raw transaction data from TronGrid.
 */
function hexToTronAddress(hexAddr: string): string {
  try {
    // Normalize: remove 0x prefix if present, ensure it starts with 41
    let clean = hexAddr.startsWith('0x') ? hexAddr.slice(2) : hexAddr;
    if (clean.length === 40) clean = '41' + clean; // add TRON prefix if missing
    if (clean.length !== 42) return hexAddr;        // unexpected length, return as-is

    const addressBytes = hexToBytes(clean);
    const hash1    = sha256Sync(addressBytes);
    const hash2    = sha256Sync(hash1);
    const checksum = hash2.slice(0, 4);
    const full     = new Uint8Array([...addressBytes, ...checksum]);
    return base58Encode(full);
  } catch {
    return hexAddr;
  }
}

/**
 * Sign a TRON transaction.
 * TRON expects the signature as: r (32 bytes) + s (32 bytes) + v (1 byte, value 0 or 1).
 * Note: TRON uses v = 0 or 1, NOT Ethereum's 27/28.
 */
function signTronTx(tx: any, privateKey: string): any {
  const txID      = tx.txID; // hex string without 0x
  const signingKey = new ethers.SigningKey(privateKey);
  const msgBytes  = hexToBytes(txID);
  const sig       = signingKey.sign(msgBytes);

  // r and s are 32-byte hex strings (with 0x prefix from ethers)
  const r = sig.r.slice(2).padStart(64, '0');
  const s = sig.s.slice(2).padStart(64, '0');
  // TRON v: 0 or 1 (not 27/28)
  const v = sig.v === 27 ? '00' : '01';

  const signature = r + s + v;
  return { ...tx, signature: [signature] };
}
