import { NextResponse } from 'next/server';
import { generateAndUploadQuotePdf } from '@/lib/pdfGenerator';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { getUserSession, unauthorizedResponse } from '@/lib/authGuard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();

    const quoteData = await request.json();

    if (!quoteData?.customerInfo?.name) {
      return NextResponse.json({ success: false, message: 'Customer name is required.' }, { status: 400 });
    }
    if (!quoteData?.skipWhatsApp && !quoteData?.customerInfo?.phone) {
      return NextResponse.json({ success: false, message: 'Customer phone is required for WhatsApp.' }, { status: 400 });
    }
    if (!quoteData?.selectedProduct) {
      return NextResponse.json({ success: false, message: 'Selected product is required.' }, { status: 400 });
    }

    // Enforce tenant vendor_id for non-super_admins
    if (!session.isSuperAdmin && session.vendor_id) {
      quoteData.vendor_id = session.vendor_id;
    }

    const { publicUrl, storagePath, totals } = await generateAndUploadQuotePdf(quoteData);

    // Optional automated WhatsApp delivery via DoubleTick (if enabled and phone provided)
    if (!quoteData.skipWhatsApp && quoteData.customerInfo?.phone) {
      try {
        await sendWhatsAppMessage(quoteData.customerInfo.phone, publicUrl);
      } catch (waErr: any) {
        console.warn('[quote] DoubleTick WhatsApp automated delivery failed (falling back to direct wa.me):', waErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Quotation created successfully!',
      url: publicUrl,
      pdf_url: publicUrl,
      pdf_storage_path: storagePath,
      totals,
    });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Server error occurred.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const missingEnv: string[] = [];
    if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnv.push('SUPABASE_URL');
    if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_KEY');
    if (!process.env.SUPABASE_BUCKET) missingEnv.push('SUPABASE_BUCKET');
    const ok = missingEnv.length === 0;
    return NextResponse.json({ ok, missingEnv });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, message: (e as Error)?.message || 'Health check failed' }, { status: 500 });
  }
}
