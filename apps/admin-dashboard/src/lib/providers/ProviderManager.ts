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
  private providerInstances: Map<string, UnifiedProvider> = new Map();

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
   * Resolves and validates credentials, instantiating the requested provider by name.
   */
  public getProviderByName(providerName: string): UnifiedProvider {
    const normalizedName = (providerName || 'kripicard').toLowerCase();

    if (this.providerInstances.has(normalizedName)) {
      return this.providerInstances.get(normalizedName)!;
    }

    let instance: UnifiedProvider;

    switch (normalizedName) {
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
        ProviderLogger.warn('System', 'getProviderByName', `Unknown provider="${normalizedName}". Falling back to KripiCard.`);
        instance = new KripiCardProvider();
      }
    }

    ProviderLogger.info(
      instance.name,
      'getProviderByName',
      `Provider initialized successfully: ${instance.name}`
    );

    this.providerInstances.set(normalizedName, instance);
    return instance;
  }

  /**
   * Returns the primary issuance provider for new cards.
   */
  public getIssuanceProvider(): UnifiedProvider {
    return this.getProviderByName(this.getActiveProviderName());
  }

  /**
   * Legacy method maintained for backward compatibility.
   */
  public loadProvider(): UnifiedProvider {
    return this.getIssuanceProvider();
  }

  /**
   * Returns the currently configured default issuance provider name.
   */
  public getActiveProviderName(): string {
    return (process.env.DEFAULT_ISSUANCE_PROVIDER || process.env.CARD_PROVIDER || 'kripicard').toLowerCase();
  }

  /**
   * Returns a list of all registered provider names available for configuration.
   */
  public listAvailableProviders(): string[] {
    return [
      'kripicard',
      'codego',
      'striga',
      'rain',
      'pintopay',
      'kulipa',
      'future',
    ];
  }

  /**
   * Validates if the default issuance provider is correctly configured.
   */
  public async validateConfiguration(): Promise<{
    provider: string;
    configured: boolean;
    healthy?: boolean;
    error?: string;
  }> {
    const providerName = this.getActiveProviderName();
    try {
      const provider = this.getIssuanceProvider();
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
   * Reset all instantiated providers.
   */
  public reset(): void {
    ProviderLogger.info('System', 'reset', 'Provider instances cleared.');
    this.providerInstances.clear();
  }
}

export const ProviderManager = new ProviderManagerRegistry();

/**
 * Gets the default provider for new issuances.
 */
export function getCardProvider(): UnifiedProvider {
  return ProviderManager.getIssuanceProvider();
}

/**
 * Gets a specific provider instance by name.
 */
export function getCardProviderByName(name: string): UnifiedProvider {
  return ProviderManager.getProviderByName(name);
}

/**
 * Reset helper mapping to ProviderManager.
 */
export function resetCardProvider(): void {
  ProviderManager.reset();
}
