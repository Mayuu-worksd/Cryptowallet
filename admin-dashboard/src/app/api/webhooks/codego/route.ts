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
              await supabase
                .from('transactions')
                .upsert({
                  wallet_address: vccCard.wallet_address,
                  card_id: vccCard.id,
                  type: 'card_spend',
                  token: tx.currency || 'USD',
                  amount: tx.amount || 0,
                  usd_value: tx.amount || 0,
                  status: tx.status === 'approved' ? 'success' : tx.status === 'declined' ? 'failed' : 'pending',
                  reference_id: tx.id,
                  label: tx.merchantName || 'Card Transaction',
                  description: tx.description || null,
                  created_at: tx.createdAt || new Date().toISOString(),
                }, { onConflict: 'reference_id' });
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
