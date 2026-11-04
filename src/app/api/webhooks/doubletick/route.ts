import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint receives Webhooks from DoubleTick
// Tracks full message lifecycle: enqueued → sent → delivered → read / failed
export async function POST(request: Request) {
  try {
    // 1. Webhook Secret Verification (if configured in environment)
    const expectedSecret = process.env.DOUBLETICK_WEBHOOK_SECRET;
    if (expectedSecret) {
      const authHeader = request.headers.get('authorization') || '';
      const secretHeader = request.headers.get('x-doubletick-secret') || '';
      const { searchParams } = new URL(request.url);
      const querySecret = searchParams.get('secret') || searchParams.get('token') || '';

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const isValid = token === expectedSecret || secretHeader === expectedSecret || querySecret === expectedSecret;

      if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized webhook access' }, { status: 401 });
      }
    }

    const payload = await request.json();

    if (payload.event === 'MESSAGE_STATUS_UPDATE') {
      const status = payload.data?.status?.toLowerCase() || '';
      let recipient = payload.data?.recipient || payload.data?.to || "";
      const errorReason = payload.data?.error?.message || payload.data?.errorReason || '';

      // Normalize phone number - strip country code for DB lookup
      if (recipient.startsWith('+91')) {
        recipient = recipient.substring(3);
      } else if (recipient.startsWith('91') && recipient.length === 12) {
        recipient = recipient.substring(2);
      }

      // Map DoubleTick status to our database status
      let dbStatus: string | null = null;
      switch (status) {
        case 'enqueued':
        case 'queued':
          dbStatus = 'Queued';
          break;
        case 'sent':
          dbStatus = 'Sent';
          break;
        case 'delivered':
          dbStatus = 'Delivered';
          break;
        case 'read':
          dbStatus = 'Read';
          break;
        case 'failed':
        case 'undeliverable':
          dbStatus = 'Failed Delivery';
          if (errorReason) {
            console.warn(`WhatsApp delivery failed: ${errorReason}`);
          }
          break;
        default:
          break;
      }

      // Update database with delivery status
      if (dbStatus && recipient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Find latest quotation by phone number (last 10 digits)
          const last10 = recipient.slice(-10);
          const { data: latestQuote, error: findError } = await supabase
            .from('quotations')
            .select('id')
            .or(`customer_phone.eq.${last10},customer_phone.eq.+91${last10},customer_phone.eq.91${last10}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (findError) {
            console.error("Failed to find quotation for phone:", findError.message);
          } else if (latestQuote?.id) {
            const { error: updateError } = await supabase
              .from('quotations')
              .update({ status: dbStatus })
              .eq('id', latestQuote.id);

            if (updateError) {
              console.error("Failed to update quotation status:", updateError.message);
            }
          }
        }
      }
    }

    // Always return 200 OK to acknowledge receipt of the webhook
    return NextResponse.json({ received: true, timestamp: new Date().toISOString() }, { status: 200 });

  } catch (error: unknown) {
    console.error('Webhook processing error:', (error as Error)?.message || error);
    // Still return 200 to prevent DoubleTick from retrying continuously on malformed payload
    return NextResponse.json({ error: 'Failed to process webhook', received: true }, { status: 200 });
  }
}

// Support GET for webhook verification (some providers require this)
export async function GET() {
  return NextResponse.json({
    status: 'active',
    webhook: 'doubletick',
    timestamp: new Date().toISOString()
  });
}
