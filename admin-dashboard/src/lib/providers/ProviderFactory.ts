/**
 * ProviderFactory.ts (Legacy)
 *
 * Forwards calls to ProviderManager. Exists to maintain backward compatibility
 * with files that import getCardProvider or resetCardProvider directly from
 * ProviderFactory rather than the barrel export index.
 */

import { ProviderManager } from './ProviderManager';
import type { UnifiedProvider } from './ProviderManager';

export function getCardProvider(): UnifiedProvider {
  return ProviderManager.loadProvider();
}

export function resetCardProvider(): void {
  ProviderManager.reset();
}
