import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const eventType = payload.type || payload.event_type;

    if (!eventType) {
      return NextResponse.json({ error: 'Missing event_type in webhook payload' }, { status: 400 });
    }

    // 1. Log the webhook for auditing and async processing
    const { data: logEntry, error: logError } = await supabase
      .from('codego_webhooks_log')
      .insert({
        event_type: eventType,
        payload: payload,
        processed: false
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log webhook:', logError);
    }

    // 2. Process webhook based on type
    try {
      switch (eventType) {
        case 'card.created':
        case 'card.activated':
          await supabase
            .from('vcc_cards')
            .update({ codego_status: 'active', status: 'active' })
            .eq('codego_card_id', payload.data.cardId);
          break;

        case 'card.frozen':
          await supabase
            .from('vcc_cards')
            .update({ codego_status: 'frozen', status: 'frozen' })
            .eq('codego_card_id', payload.data.cardId);
          break;

        case 'card.unfrozen':
          await supabase
            .from('vcc_cards')
            .update({ codego_status: 'active', status: 'active' })
            .eq('codego_card_id', payload.data.cardId);
          break;

        case 'transaction.created':
          // In a production app, insert this into vcc_transactions
          console.log(`Received transaction webhook for card ${payload.data.cardId}`);
          break;

        default:
          console.log('Unhandled Codego webhook event type:', eventType);
      }

      // Mark as processed
      if (logEntry) {
        await supabase
          .from('codego_webhooks_log')
          .update({ processed: true })
          .eq('id', logEntry.id);
      }

      return NextResponse.json({ success: true });
    } catch (processError: any) {
      console.error(`Error processing webhook ${eventType}:`, processError);
      
      if (logEntry) {
        await supabase
          .from('codego_webhooks_log')
          .update({ processed: false, error_message: processError.message })
          .eq('id', logEntry.id);
      }
      return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Webhook payload parsing error:', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
