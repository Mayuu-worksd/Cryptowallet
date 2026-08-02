import { supabase } from '@/lib/supabase';
import { getCardProviderByName } from './ProviderManager';
import type { UnifiedProvider } from './ProviderManager';

/**
 * Dynamically resolves the provider for an existing card by querying the database.
 * First checks `provider_cards`, then falls back to `vcc_cards`.
 */
export async function getCardProviderForCard(cardId: string): Promise<UnifiedProvider> {
  // 1. Check newer provider_cards table
  const { data: providerCard } = await supabase
    .from('provider_cards')
    .select('provider_name')
    .eq('provider_card_id', cardId)
    .maybeSingle();

  if (providerCard?.provider_name) {
    return getCardProviderByName(providerCard.provider_name);
  }

  // 2. Fallback to legacy vcc_cards table
  const { data: vccCard } = await supabase
    .from('vcc_cards')
    .select('provider_name')
    .eq('codego_card_id', cardId)
    .maybeSingle();

  if (vccCard?.provider_name) {
    return getCardProviderByName(vccCard.provider_name);
  }

  // 3. If no provider found (perhaps it's a very old Codego card before the column existed)
  // Default to what we expect it to be, or generic 'codego' for legacy cards.
  console.warn(`getCardProviderForCard: Provider not found in DB for card ${cardId}. Falling back to default.`);
  return getCardProviderByName(process.env.DEFAULT_ISSUANCE_PROVIDER || process.env.CARD_PROVIDER || 'codego');
}
