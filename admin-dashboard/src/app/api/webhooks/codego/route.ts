import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Maps Codego card status to internal vcc_cards.card_status values
function mapCodegoStatus(s: string): 'pending' | 'active' | 'frozen' | 'blocked' {
  switch (s?.toLowerCase()) {
    case 'active': case 'activated': return 'active';
    case 'locked': case 'frozen': return 'frozen';
    case 'canceled': case 'cancelled': case 'blocked': return 'blocked';
    default: return 'pending';
  }
}

// FIX: Extract cardId from multiple possible payload shapes
function extractCardId(payload: any): string | null {
  return payload?.data?.cardId
    || payload?.data?.id
    || payload?.cardId
    || payload?.id
    || null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const eventType: string = payload.type || payload.event_type || payload.eventType || '';

    if (!eventType) {
      return NextResponse.json({ error: 'Missing event_type in webhook payload' }, { status: 400 });
    }

    // 1. Log webhook for auditing
    const { data: logEntry, error: logError } = await supabase
      .from('codego_webhooks_log')
      .insert({
        event_type: eventType,
        payload,
        processed: false,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[Webhook] Failed to log:', logError.message);
    }

    const codegoCardId = extractCardId(payload);

    try {
      switch (eventType) {
        // ── Card lifecycle ──────────────────────────────────────────────────────
        case 'card.created':
        case 'card.activated': {
          if (codegoCardId) {
            await supabase
              .from('vcc_cards')
              .update({ codego_status: 'active', card_status: 'active' })
              .eq('codego_card_id', codegoCardId);
          }
          break;
        }

        // FIX: Codego sends 'locked' not 'frozen'
        case 'card.locked':
        case 'card.frozen': {
          if (codegoCardId) {
            await supabase
              .from('vcc_cards')
              .update({ codego_status: 'locked', card_status: 'frozen' })
              .eq('codego_card_id', codegoCardId);
          }
          break;
        }

        case 'card.unlocked':
        case 'card.unfrozen': {
          if (codegoCardId) {
            await supabase
              .from('vcc_cards')
              .update({ codego_status: 'active', card_status: 'active' })
              .eq('codego_card_id', codegoCardId);
          }
          break;
        }

        case 'card.canceled':
        case 'card.cancelled':
        case 'card.blocked': {
          if (codegoCardId) {
            await supabase
              .from('vcc_cards')
              .update({ codego_status: 'canceled', card_status: 'blocked' })
              .eq('codego_card_id', codegoCardId);
          }
          break;
        }

        case 'card.updated': {
          if (codegoCardId && payload.data) {
            const updates: any = {};
            if (payload.data.status) {
              updates.codego_status = payload.data.status;
              updates.card_status = mapCodegoStatus(payload.data.status);
            }
            if (typeof payload.data.balance === 'number') {
              updates.balance = payload.data.balance;
            }
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('vcc_cards')
                .update(updates)
                .eq('codego_card_id', codegoCardId);
            }
          }
          break;
        }

        // ── KYC / Application approved ──────────────────────────────────────────
        // Codego fires these when sandbox KYC completes
        case 'application.approved':
        case 'kyc.approved':
        case 'user.approved': {
          const userId =
            payload.data?.userId ||
            payload.data?.id ||
            payload.userId ||
            payload.id ||
            null;

          if (userId) {
            // Find matching kyc row by codego_cardholder_id
            const { data: kycRow } = await supabase
              .from('kyc')
              .select('wallet_address, status')
              .eq('codego_cardholder_id', userId)
              .maybeSingle();

            if (kycRow && kycRow.status !== 'verified') {
              const { error: kycUpdateError } = await supabase
                .from('kyc')
                .update({ status: 'verified', codego_application_status: 'approved' })
                .eq('codego_cardholder_id', userId);

              if (kycUpdateError) {
                console.error('[Webhook] Failed to auto-verify KYC:', kycUpdateError.message);
              } else {
                console.log('[Webhook] Auto-verified KYC for cardholder:', userId);
              }
            } else if (kycRow) {
              // Already verified — just sync codego_application_status
              await supabase
                .from('kyc')
                .update({ codego_application_status: 'approved' })
                .eq('codego_cardholder_id', userId);
            }
          }
          break;
        }

        // ── Transaction events ──────────────────────────────────────────────────
        case 'transaction.created':
        case 'transaction.updated': {
          const tx = payload.data;
          if (tx && codegoCardId) {
            // Find the wallet_address from vcc_cards
            const { data: vccCard } = await supabase
              .from('vcc_cards')
              .select('wallet_address, id')
              .eq('codego_card_id', codegoCardId)
              .maybeSingle();

            if (vccCard) {
              const rawAmount = tx.amount || 0;
              const isTopup = rawAmount > 0 || tx.type === 'topup';
              const isSpend = !isTopup;
              const spendAmountUSD = Math.abs(rawAmount);
              const txType = isTopup ? 'card_topup' : 'card_spend';

              await supabase
                .from('transactions')
                .upsert({
                  wallet_address: vccCard.wallet_address,
                  card_id: vccCard.id,
                  type: txType,
                  token: tx.currency || 'USD',
                  amount: spendAmountUSD,
                  usd_value: spendAmountUSD,
                  status: tx.status === 'approved' ? 'success' : tx.status === 'declined' ? 'failed' : 'pending',
                  reference_id: tx.id,
                  label: tx.merchantName || 'Card Transaction',
                  description: tx.description || null,
                  created_at: tx.createdAt || new Date().toISOString(),
                }, { onConflict: 'reference_id' });

              // Deduct spend from wallet token_balances in wallet_profiles
              // This keeps the mobile app's "Card Balance" (total crypto USD) in sync
              if (isSpend && spendAmountUSD > 0 && tx.status === 'approved') {
                const { data: profile } = await supabase
                  .from('wallet_profiles')
                  .select('token_balances')
                  .eq('wallet_address', vccCard.wallet_address)
                  .maybeSingle();

                if (profile?.token_balances) {
                  const balances: Record<string, number> = typeof profile.token_balances === 'string'
                    ? JSON.parse(profile.token_balances)
                    : { ...profile.token_balances };

                  // Deduct from USDT first, then USDC, then ETH (priority order)
                  const priority = ['USDT', 'USDC', 'ETH', 'BNB', 'TRX'];
                  let remaining = spendAmountUSD;
                  const ETH_PRICE = 3500; // fallback — good enough for sandbox

                  for (const token of priority) {
                    if (remaining <= 0) break;
                    const bal = balances[token] ?? 0;
                    if (bal <= 0) continue;
                    const tokenPrice = (token === 'ETH' || token === 'BNB') ? ETH_PRICE : 1;
                    const balUSD = bal * tokenPrice;
                    const deductUSD = Math.min(balUSD, remaining);
                    const deductToken = deductUSD / tokenPrice;
                    balances[token] = Math.max(0, bal - deductToken);
                    remaining -= deductUSD;
                  }

                  await supabase
                    .from('wallet_profiles')
                    .update({ token_balances: balances })
                    .eq('wallet_address', vccCard.wallet_address);
                }
              }
            }
          }
          break;
        }

        // ── Fiat / transfer events ──────────────────────────────────────────────
        case 'transfer.completed': {
          const transferId = payload.data?.id;
          if (transferId) {
            await supabase
              .from('fiat_withdrawals')
              .update({ status: 'completed', codego_withdrawal_id: transferId })
              .eq('codego_withdrawal_id', transferId);
          }
          break;
        }

        case 'transfer.failed': {
          const transferId = payload.data?.id;
          if (transferId) {
            await supabase
              .from('fiat_withdrawals')
              .update({ status: 'failed' })
              .eq('codego_withdrawal_id', transferId);
          }
          break;
        }

        default:
          console.log('[Webhook] Unhandled event type:', eventType);
      }

      // Mark as processed
      if (logEntry?.id) {
        await supabase
          .from('codego_webhooks_log')
          .update({ processed: true })
          .eq('id', logEntry.id);
      }

      return NextResponse.json({ success: true, eventType });

    } catch (processError: any) {
      console.error(`[Webhook] Error processing ${eventType}:`, processError);
      if (logEntry?.id) {
        await supabase
          .from('codego_webhooks_log')
          .update({ processed: false, error_message: processError.message })
          .eq('id', logEntry.id);
      }
      return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Webhook] Payload parsing error:', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
