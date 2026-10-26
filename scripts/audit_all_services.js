const SUPABASE_URL = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const VERCEL_URL = 'https://cryptowallet-dun.vercel.app';

const headersAnon = { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY };

async function runFullAudit() {
  const results = [];

  async function check(name, fn) {
    try {
      const res = await fn();
      results.push({ name, status: 'OK', details: res });
    } catch (e) {
      results.push({ name, status: 'FAILED', error: e.message });
    }
  }

  // 1. Supabase Tables
  const tables = [
    'networks',
    'token_contracts',
    'registered_devices',
    'wallet_profiles',
    'p2p_orders',
    'kyc',
    'business_kyc',
    'cards',
    'vcc_cards',
    'card_requests',
    'bank_accounts',
    'transactions',
    'backup_records',
    'p2p_chat',
    'cms_pages',
    'admin_settings'
  ];

  for (const t of tables) {
    await check('Supabase Table: ' + t, async () => {
      const res = await fetch(SUPABASE_URL + '/rest/v1/' + t + '?limit=1', { headers: headersAnon });
      if (!res.ok) {
        const text = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 100));
      }
      const data = await res.json();
      return 'Accessible (' + data.length + ' rows returned)';
    });
  }

  // 2. Blockchain RPCs
  await check('Sepolia RPC', async () => {
    const res = await fetch('https://ethereum-sepolia-rpc.publicnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
    });
    const d = await res.json();
    return 'Block #' + parseInt(d.result, 16);
  });

  await check('TRON Nile Grid RPC', async () => {
    const res = await fetch('https://nile.trongrid.io/wallet/getnowblock');
    const d = await res.json();
    return 'Block #' + (d.block_header?.raw_data?.number || 'ok');
  });

  // 3. Forex API
  await check('ExchangeRate API', async () => {
    const res = await fetch('https://v6.exchangerate-api.com/v6/375abf38fd553b2fd0bce01b/latest/USD');
    const d = await res.json();
    if (d.result !== 'success') throw new Error(d['error-type'] || 'Failed');
    return 'Live rate USD -> INR: ' + d.conversion_rates?.INR;
  });

  // 4. CoinGecko Price API
  await check('CoinGecko Prices', async () => {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tether,usd-coin,tron,bitcoin&vs_currencies=usd');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    return 'ETH: $' + d.ethereum?.usd + ', BTC: $' + d.bitcoin?.usd;
  });

  // 5. Vercel backend
  await check('Vercel API Root', async () => {
    const res = await fetch(VERCEL_URL);
    return 'HTTP ' + res.status;
  });

  await check('Vercel CMS Endpoint', async () => {
    const res = await fetch(VERCEL_URL + '/api/public/cms');
    const d = await res.text();
    return 'HTTP ' + res.status + ': ' + d.slice(0, 40);
  });

  // 6. Card Providers
  await check('Kripicard Host', async () => {
    const res = await fetch('https://home.kripicard.com/api/premium', { method: 'HEAD' });
    return 'HTTP ' + res.status;
  });

  await check('Codego Sandbox API', async () => {
    const res = await fetch('https://vcc-sandbox.codegotech.com/api/v1', { method: 'GET' });
    return 'HTTP ' + res.status;
  });

  console.log(JSON.stringify(results, null, 2));
}

runFullAudit();
