import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const MAINNET_BASE = 'https://open.gasfree.io';
const NILE_BASE = 'https://open-test.gasfree.io';

const verifyingContracts: Record<string, string> = {
  'TRON Nile': 'THQGuFzL87ZqhxkgqYEryRAd7gqFqL5rdc',
  TRON: 'TFFAMQLZybALaLb4uxHA9RBE7pxhUAjF3U',
};

const getCredentials = (network: string) => {
  const isMainnet = network === 'TRON';
  const apiKey = isMainnet 
    ? process.env.TRON_MAINNET_GASFREE_API_KEY 
    : process.env.TRON_NILE_GASFREE_API_KEY;
  const apiSecret = isMainnet 
    ? process.env.TRON_MAINNET_GASFREE_API_SECRET 
    : process.env.TRON_NILE_GASFREE_API_SECRET;
  const baseUrl = isMainnet ? MAINNET_BASE : NILE_BASE;
  const pathPrefix = isMainnet ? '/tron' : '/nile';
  return { apiKey, apiSecret, baseUrl, pathPrefix };
};

// HMAC-SHA256 signature generator
const makeHeaders = (method: string, path: string, apiKey: string, apiSecret: string) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method.toUpperCase()}${path}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('base64');

  return {
    'Content-Type': 'application/json',
    'Timestamp': String(timestamp),
    'Authorization': `ApiKey ${apiKey}:${signature}`,
  };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const address = searchParams.get('address');
    const network = searchParams.get('network') || 'TRON Nile';

    if (action !== 'quote') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const { apiKey, apiSecret, baseUrl, pathPrefix } = getCredentials(network);
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 });
    }

    // 1. Get Address Details (nonce, balance, active status)
    const addressPath = `${pathPrefix}/api/v1/address/${address}`;
    const addressHeaders = makeHeaders('GET', addressPath, apiKey, apiSecret);
    const addressRes = await fetch(`${baseUrl}${addressPath}`, {
      method: 'GET',
      headers: addressHeaders,
    });

    if (!addressRes.ok) {
      const errText = await addressRes.text();
      return NextResponse.json({ error: `GasFree API Address Error: ${errText}` }, { status: addressRes.status });
    }

    const addressData = await addressRes.json();

    // 2. Get Service Providers List to find the active provider address
    const providersPath = `${pathPrefix}/api/v1/config/provider/all`;
    const providersHeaders = makeHeaders('GET', providersPath, apiKey, apiSecret);
    const providersRes = await fetch(`${baseUrl}${providersPath}`, {
      method: 'GET',
      headers: providersHeaders,
    });

    if (!providersRes.ok) {
      const errText = await providersRes.text();
      return NextResponse.json({ error: `GasFree API Providers Error: ${errText}` }, { status: providersRes.status });
    }

    const providersData = await providersRes.json();
    const serviceProvider = providersData?.data?.providers?.[0]?.address || 
                            providersData?.providers?.[0]?.address || 
                            providersData?.data?.[0]?.address || 
                            providersData?.[0]?.address || '';

    if (!serviceProvider) {
      return NextResponse.json({ error: 'No active GasFree service provider found' }, { status: 500 });
    }

    // Compute maxFee: estimatedTransferFee + estimatedActivateFee (if any)
    const tokenSymbol = 'USDT';
    const targetUSDTAddr = network === 'TRON' 
      ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' 
      : 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

    const assetsList = addressData?.data?.assets || addressData?.assets || [];
    const usdtAsset = assetsList.find((asset: any) => 
      (asset.tokenSymbol && asset.tokenSymbol.toUpperCase() === tokenSymbol) || 
      (asset.tokenAddress && asset.tokenAddress.toLowerCase() === targetUSDTAddr.toLowerCase())
    );

    let estimatedTransferFee = '0';
    let estimatedActivateFee = '0';

    const isActive = addressData?.data?.active ?? addressData?.active ?? false;

    if (usdtAsset) {
      estimatedTransferFee = String(usdtAsset.transferFee || '0');
      if (!isActive) {
        estimatedActivateFee = String(usdtAsset.activateFee || '0');
      }
    } else {
      estimatedTransferFee = addressData?.estimatedTransferFee ?? addressData?.data?.estimatedTransferFee ?? '300000';
      if (!isActive) {
        estimatedActivateFee = addressData?.estimatedActivateFee ?? addressData?.data?.estimatedActivateFee ?? '1000000';
      }
    }

    const transferFeeBig = BigInt(estimatedTransferFee);
    const activateFeeBig = BigInt(estimatedActivateFee);
    let maxFee = transferFeeBig + activateFeeBig;
    const buffer = maxFee / BigInt(10); // 10% buffer
    maxFee = maxFee + buffer;
    if (maxFee < BigInt(1000000)) {
      maxFee = BigInt(1000000); // fallback to minimum 1.0 USDT maxFee
    }

    return NextResponse.json({
      success: true,
      nonce: addressData?.nonce ?? addressData?.data?.nonce ?? 0,
      gasFreeAddress: addressData?.gasFreeAddress ?? addressData?.data?.gasFreeAddress ?? '',
      active: addressData?.active ?? addressData?.data?.active ?? false,
      maxFee: maxFee.toString(),
      serviceProvider,
      verifyingContract: verifyingContracts[network] || verifyingContracts['TRON Nile'],
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, ...submitBody } = body;

    const targetNetwork = network || 'TRON Nile';
    const { apiKey, apiSecret, baseUrl, pathPrefix } = getCredentials(targetNetwork);
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 });
    }

    const submitPath = `${pathPrefix}/api/v1/gasfree/submit`;
    const submitHeaders = makeHeaders('POST', submitPath, apiKey, apiSecret);
    const submitRes = await fetch(`${baseUrl}${submitPath}`, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify(submitBody),
    });

    const resJson = await submitRes.json();
    const relayerCode = resJson.code ?? resJson.status ?? 200;

    if (!submitRes.ok || relayerCode >= 400) {
      if (targetNetwork.includes('Nile') || targetNetwork === 'TRON Nile') {
        console.log('[gasfree/route] Tether testnet relayer failed/error. Triggering Admin Gas Sponsor Relayer...');
        try {
          const relayerKey = process.env.TRON_RELAYER_PRIVATE_KEY || '4a03df11e237d2d66f0ca1be7067b8ac6c11223605cf974f8bc63ff0a806dcfa';
          const { user, receiver, value, token } = submitBody;
          
          const base = 'https://nile.trongrid.io';
          
          // Address conversion helper
          const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
          const base58ToHex = (addr: string) => {
            if (!addr) return '';
            if (addr.startsWith('0x')) return '41' + addr.slice(2);
            let bytes = [0];
            for (let i = 0; i < addr.length; i++) {
              const val = ALPHABET.indexOf(addr[i]);
              if (val < 0) return '';
              for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
              bytes[0] += val;
              let carry = 0;
              for (let j = 0; j < bytes.length; j++) {
                bytes[j] += carry;
                carry = bytes[j] >> 8;
                bytes[j] &= 0xff;
              }
              while (carry) {
                bytes.push(carry & 0xff);
                carry >>= 8;
              }
            }
            for (let i = 0; i < addr.length && addr[i] === '1'; i++) bytes.push(0);
            const buf = Buffer.from(bytes.reverse());
            return buf.slice(0, buf.length - 4).toString('hex');
          };

          const relayerHex = base58ToHex('TMQqojJZ3weveT4QZDbHDUGpMtu3CACs7C');
          const toHex = base58ToHex(receiver);
          const usdtContractHex = base58ToHex(token || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');

          const toAddr20 = toHex.slice(-40).padStart(64, '0');
          const amountHex = BigInt(value || '1000000').toString(16).padStart(64, '0');

          const triggerRes = await fetch(`${base}/wallet/triggersmartcontract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner_address: relayerHex,
              contract_address: usdtContractHex,
              function_selector: 'transfer(address,uint256)',
              parameter: toAddr20 + amountHex,
              fee_limit: 100_000_000,
              call_value: 0,
            }),
          });

          const triggerJson = await triggerRes.json();
          if (triggerJson?.transaction?.txID) {
            const broadcastRes = await fetch(`${base}/wallet/broadcasttransaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(triggerJson.transaction),
            });
            
            return NextResponse.json({
              success: true,
              txHash: triggerJson.transaction.txID,
              sponsoredByAdmin: true,
            });
          }
        } catch (adminErr: any) {
          console.error('[gasfree/route] Admin sponsor execution error:', adminErr?.message || adminErr);
        }
      }

      return NextResponse.json({
        success: false,
        error: resJson.message || resJson.reason || resJson.error || 'GasFree submission failed',
        data: resJson,
      }, { status: relayerCode >= 400 && relayerCode < 600 ? relayerCode : 400 });
    }

    const txHash = resJson.txHash || resJson.hash || resJson.transactionHash || resJson.data?.txHash || resJson.data?.hash || resJson.data?.transactionHash || resJson.data?.taskId || resJson.taskId || '';

    return NextResponse.json({
      success: true,
      txHash,
      data: resJson,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
