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
    if (!submitRes.ok) {
      return NextResponse.json({
        success: false,
        error: resJson.message || resJson.error || 'GasFree submission failed',
      }, { status: submitRes.status });
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
