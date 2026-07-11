/**
 * /api/webhooks/card-provider/route.ts
 *
 * Generic provider-independent webhook pipeline.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';
import crypto from 'crypto';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.KRIPICARD_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get('x-kripicard-signature') || req.headers.get('x-webhook-signature') || '';
      if (!sig || !verifySignature(rawBody, sig, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    const payload = JSON.parse(rawBody);
    const provider = getCardProvider();

    let parsedEvent: any;
    try {
      parsedEvent = provider.parseWebhook(payload);
    } catch (_e) {
      // parseWebhook not implemented — log raw and return ok
      await supabase.from('codego_webhooks_log').insert({
        event_type: payload?.event || payload?.type || 'raw',
        payload,
        processed: false,
      }).catch(() => {});
      return NextResponse.json({ success: true, note: 'logged_raw' });
    }

    // Log all events including unknown
    const { data: logEntry } = await supabase
      .from('codego_webhooks_log')
      .insert({ event_type: parsedEvent.category, payload, processed: false })
      .select('id')
      .single();

    if (parsedEvent.category === 'unknown') {
      // Still log it but don't process
      await supabase.from('codego_webhooks_log').update({ processed: true })
        .eq('id', logEntry?.id).catch(() => {});
      return NextResponse.json({ success: true, note: 'unhandled_event', event: parsedEvent.rawEvent });
    }

    try {
      switch (parsedEvent.category) {
        // ── Card lifecycle ──────────────────────────────────────────────────────
        case 'card.activated':
        case 'card.frozen':
        case 'card.unfrozen':
        case 'card.blocked': {
          if (parsedEvent.providerCardId && parsedEvent.newStatus) {
             await supabase
              .from('vcc_cards')
              .update({ codego_status: parsedEvent.providerStatus, card_status: parsedEvent.newStatus })
              .eq('codego_card_id', parsedEvent.providerCardId);
          }
          break;
        }

        case 'card.updated': {
          if (parsedEvent.providerCardId) {
            const updates: any = {};
            if (parsedEvent.newStatus) {
              updates.codego_status = parsedEvent.providerStatus;
              updates.card_status = parsedEvent.newStatus;
            }
            if (payload?.data && typeof payload.data.balance === 'number') {
              updates.balance = payload.data.balance;
            }
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('vcc_cards')
                .update(updates)
                .eq('codego_card_id', parsedEvent.providerCardId);
            }
          }
          break;
        }

        // ── KYC / Application approved ──────────────────────────────────────────
        case 'kyc.approved': {
          const userId = parsedEvent.providerCardholderId;
          if (userId) {
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
          const tx = parsedEvent.transactionData;
          if (tx && parsedEvent.providerCardId) {
            const { data: vccCard } = await supabase
              .from('vcc_cards')
              .select('wallet_address, id')
              .eq('codego_card_id', parsedEvent.providerCardId)
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

                  const priority = ['USDT', 'USDC', 'ETH', 'BNB', 'TRX'];
                  let remaining = spendAmountUSD;
                  const ETH_PRICE = 3500;

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
          const transferId = parsedEvent.providerTransferId;
          if (transferId) {
            await supabase
              .from('fiat_withdrawals')
              .update({ status: 'completed', codego_withdrawal_id: transferId })
              .eq('codego_withdrawal_id', transferId);
          }
          break;
        }

        case 'transfer.failed': {
          const transferId = parsedEvent.providerTransferId;
          if (transferId) {
            await supabase
              .from('fiat_withdrawals')
              .update({ status: 'failed' })
              .eq('codego_withdrawal_id', transferId);
          }
          break;
        }

        default:
          console.log('[Webhook] Unhandled event category:', parsedEvent.category);
      }

      if (logEntry?.id) {
        await supabase
          .from('codego_webhooks_log')
          .update({ processed: true })
          .eq('id', logEntry.id);
      }

      return NextResponse.json({ success: true, eventType: parsedEvent.category });

    } catch (processError: any) {
      console.error(`[Webhook] Error processing ${parsedEvent.category}:`, processError);
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
