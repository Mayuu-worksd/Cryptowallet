/**
 * ProviderManager.ts
 *
 * Registry and configuration-driven manager for financial/card providers.
 * Loads the active provider based on CARD_PROVIDER environment variable,
 * validates its credentials, and exposes the unified provider instance.
 *
 * Changing the active provider requires zero code changes — only updating
 * CARD_PROVIDER in environment configuration.
 */

import type { CardProvider } from './CardProvider';
import type { FinancialProvider } from './FinancialProvider';
import { ProviderNotConfiguredException } from './exceptions';
import { ProviderLogger } from './logger';

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
        ProviderLogger.warn(providerName, 'checkCredentials', `Missing config key "${specificKey}" or "${genericKey}"`);
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
        ProviderLogger.warn('System', 'loadProvider', `Unknown CARD_PROVIDER="${providerName}". Falling back to Codego.`);
        instance = new CodegoProvider();
      }
    }

    ProviderLogger.info(
      instance.name,
      'loadProvider',
      `Active provider initialized successfully: ${instance.name}`
    );

    this.activeProviderInstance = instance;
    return instance;
  }

  /**
   * Returns the currently configured provider name from environment variable.
   */
  public getActiveProviderName(): string {
    return (process.env.CARD_PROVIDER || 'codego').toLowerCase();
  }

  /**
   * Returns a list of all registered provider names available for configuration.
   */
  public listAvailableProviders(): string[] {
    return [
      'codego',
      'kripicard',
      'striga',
      'rain',
      'pintopay',
      'kulipa',
      'future',
    ];
  }

  /**
   * Validates if the active provider configuration and credentials are ready for use.
   */
  public async validateConfiguration(): Promise<{
    provider: string;
    configured: boolean;
    healthy?: boolean;
    error?: string;
  }> {
    const providerName = this.getActiveProviderName();
    try {
      const provider = this.loadProvider();
      const health = await provider.healthCheck().catch((err) => ({
        status: 'unhealthy' as const,
        error: err.message || String(err),
      }));

      return {
        provider: providerName,
        configured: true,
        healthy: health.status === 'healthy',
        error: health.error,
      };
    } catch (err: any) {
      return {
        provider: providerName,
        configured: false,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Reset the active provider singleton (mostly for testing / provider switching).
   */
  public reset(): void {
    ProviderLogger.info('System', 'reset', 'Active provider singleton reset.');
    this.activeProviderInstance = null;
  }
}

export const ProviderManager = new ProviderManagerRegistry();

/**
 * Primary helper mapping to ProviderManager for backward compatibility.
 * Route handlers call getCardProvider() without needing to know which provider is active.
 */
export function getCardProvider(): UnifiedProvider {
  return ProviderManager.loadProvider();
}

/**
 * Reset helper mapping to ProviderManager.
 */
export function resetCardProvider(): void {
  ProviderManager.reset();
}
