/**
 * ProviderManager.ts
 *
 * Registry and manager for financial/card providers.
 * Loads the active provider based on CARD_PROVIDER environment variable,
 * validates its credentials, and exposes the unified provider instance.
 */

import type { CardProvider } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';
import { ProviderNotConfiguredException } from './exceptions';

// Import all provider adapters
import { CodegoProvider } from './CodegoProvider';
import { KripiCardProvider } from './KripiCardProvider';
import { RainProvider } from './RainProvider';
import { StrigaProvider } from './StrigaProvider';
import { PintoPayProvider } from './PintoPayProvider';
import { KulipaProvider } from './KulipaProvider';
import { FutureProvider } from './FutureProvider';

export type UnifiedProvider = CardProvider & FinancialProvider;

class ProviderManagerRegistry {
  private activeProviderInstance: UnifiedProvider | null = null;

  /**
   * Helper to check environment variables for a provider.
   * Checks provider-specific keys first, then generic fallback keys.
   */
  private checkCredentials(
    providerName: string,
    specificKeys: string[],
    genericKeys: string[]
  ): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (let i = 0; i < specificKeys.length; i++) {
      const specificKey = specificKeys[i];
      const genericKey = genericKeys[i];
      
      const val = process.env[specificKey] || process.env[genericKey];
      if (!val) {
        throw new ProviderNotConfiguredException(providerName, specificKey);
      }
      resolved[genericKey] = val;
    }

    return resolved;
  }

  /**
   * Resolves and validates credentials, instantiating the requested provider.
   */
  public loadProvider(): UnifiedProvider {
    if (this.activeProviderInstance) {
      return this.activeProviderInstance;
    }

    const providerName = (process.env.CARD_PROVIDER || 'codego').toLowerCase();
    let instance: UnifiedProvider;

    switch (providerName) {
      case 'codego': {
        // Codego has sandbox fallbacks, but we validate keys if present
        this.checkCredentials(
          'codego',
          ['CODEGO_API_KEY', 'CODEGO_API_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new CodegoProvider();
        break;
      }

      case 'kripicard': {
        this.checkCredentials(
          'kripicard',
          ['KRIPICARD_API_KEY', 'KRIPICARD_BASE_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new KripiCardProvider();
        break;
      }

      case 'striga': {
        this.checkCredentials(
          'striga',
          ['STRIGA_API_KEY', 'STRIGA_BASE_URL', 'STRIGA_CLIENT_ID', 'STRIGA_CLIENT_SECRET'],
          ['API_KEY', 'BASE_URL', 'CLIENT_ID', 'CLIENT_SECRET']
        );
        instance = new StrigaProvider();
        break;
      }

      case 'rain': {
        this.checkCredentials(
          'rain',
          ['RAIN_API_KEY', 'RAIN_BASE_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new RainProvider();
        break;
      }

      case 'pintopay': {
        this.checkCredentials(
          'pintopay',
          ['PINTOPAY_API_KEY', 'PINTOPAY_BASE_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new PintoPayProvider();
        break;
      }

      case 'kulipa': {
        this.checkCredentials(
          'kulipa',
          ['KULIPA_API_KEY', 'KULIPA_BASE_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new KulipaProvider();
        break;
      }

      case 'future': {
        this.checkCredentials(
          'future',
          ['FUTURE_API_KEY', 'FUTURE_BASE_URL'],
          ['API_KEY', 'BASE_URL']
        );
        instance = new FutureProvider();
        break;
      }

      default: {
        console.warn(`[ProviderManager] Unknown CARD_PROVIDER="${providerName}". Falling back to Codego.`);
        instance = new CodegoProvider();
      }
    }

    console.log(`[ProviderManager] Successfully instantiated provider: ${instance.name}`);
    this.activeProviderInstance = instance;
    return instance;
  }

  /**
   * Reset the active provider singleton (mostly for testing / provider switching).
   */
  public reset(): void {
    this.activeProviderInstance = null;
  }
}

export const ProviderManager = new ProviderManagerRegistry();

/**
 * Legacy getCardProvider function mapping to ProviderManager for backward compatibility.
 * This guarantees zero changes are needed in existing routes/pages.
 */
export function getCardProvider(): UnifiedProvider {
  return ProviderManager.loadProvider();
}

/**
 * Legacy resetCardProvider mapping.
 */
export function resetCardProvider(): void {
  ProviderManager.reset();
}
