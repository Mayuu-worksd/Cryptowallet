/**
 * ProviderFactory.ts
 *
 * Returns the active CardProvider implementation based on the
 * CARD_PROVIDER environment variable.
 *
 * Current default: 'codego' (CodegoProvider)
 *
 * To switch providers in the future:
 *   1. Create XyzProvider.ts implementing CardProvider
 *   2. Import it here and add a case
 *   3. Set CARD_PROVIDER=xyz in .env
 *   Zero other changes needed.
 */

import type { CardProvider } from './CardProvider';
import { CodegoProvider } from './CodegoProvider';

/**
 * Singleton instance — created once per server process.
 * Next.js route handlers share this across requests.
 */
let _instance: CardProvider | null = null;

export function getCardProvider(): CardProvider {
  if (_instance) return _instance;

  const providerName = process.env.CARD_PROVIDER || 'codego';

  switch (providerName.toLowerCase()) {
    case 'codego':
      _instance = new CodegoProvider();
      break;

    // Future providers — uncomment and implement when ready:
    // case 'stripe':
    //   _instance = new StripeIssuingProvider();
    //   break;
    // case 'lithic':
    //   _instance = new LithicProvider();
    //   break;
    // case 'marqeta':
    //   _instance = new MarqetaProvider();
    //   break;

    default:
      console.warn(`[ProviderFactory] Unknown CARD_PROVIDER="${providerName}", falling back to Codego.`);
      _instance = new CodegoProvider();
  }

  console.log(`[ProviderFactory] Active card provider: ${_instance.name}`);
  return _instance;
}

/**
 * Reset the singleton — useful in tests so each test can set a fresh provider.
 */
export function resetCardProvider(): void {
  _instance = null;
}
