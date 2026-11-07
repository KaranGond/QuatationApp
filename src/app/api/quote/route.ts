import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
// Use dynamic imports to support serverless-compatible Chromium in production
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { generateQuoteHtml } from '../../../lib/quoteTemplate';
import { defaultComponents } from '@/lib/companyDetails';
import { GST_RATE } from '../../../data/priceList';
import { getUserSession, unauthorizedResponse } from '@/lib/authGuard';

export const runtime = 'nodejs';

// Supabase client will be created lazily inside handlers after env validation

export async function POST(request: Request) {
  try {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();

    const quoteData = await request.json();

    if (!quoteData?.customerInfo?.name) {
      return NextResponse.json({ message: 'Customer name is required.' }, { status: 400 });
    }
    if (!quoteData?.skipWhatsApp && !quoteData?.customerInfo?.phone) {
      return NextResponse.json({ message: 'Customer phone is required for WhatsApp.' }, { status: 400 });
    }
    if (!quoteData?.selectedProduct) {
      return NextResponse.json({ message: 'Selected product is required.' }, { status: 400 });
    }

    // Env validation
    const missingEnv: string[] = [];
    if (!process.env.SUPABASE_URL) missingEnv.push('SUPABASE_URL');
    if (!process.env.SUPABASE_KEY) missingEnv.push('SUPABASE_KEY');
    if (!process.env.SUPABASE_BUCKET) missingEnv.push('SUPABASE_BUCKET');
    if (missingEnv.length) {
      return NextResponse.json({ message: `Missing environment variables: ${missingEnv.join(', ')}` }, { status: 500 });
    }

    // Server-side pricing recompute for integrity
    const calc = quoteData?.calculations || {};
    const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const basePrice = n(calc.basePrice);
    const marginPrice = n(calc.marginPrice);
    const wirePrice = n(calc.wirePrice);
    const heightPrice = n(calc.heightPrice);
    const outOfVnsPrice = n(calc.outOfVnsPrice);
    const subtotal = basePrice + marginPrice + wirePrice + heightPrice + outOfVnsPrice;
    const gstAmount = +(subtotal * (typeof quoteData?.taxRate === 'number' ? quoteData.taxRate : GST_RATE)).toFixed(2);
    const total = +(subtotal + gstAmount).toFixed(2);
    const discount = Math.max(0, n(calc.discount));
    const grandTotal = Math.max(0, +(total - discount).toFixed(2));

    // Attach components list to the PDF payload
    // Resolve absolute logo URL from public folder so Chromium can fetch it
    const origin = process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    let logoUrl = `${origin}/logo.png`;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      const logoBuffer = await fs.readFile(logoPath);
      logoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (logoError) {
      console.warn('Falling back to origin logo URL', logoError);
    }

    const upiPa = quoteData.companyDetails?.bank?.upiId || quoteData.companyDetails?.upi_id || '';
    const upiPn = encodeURIComponent(quoteData.companyDetails?.name || 'Solar Quotation');
    const upiLink = upiPa ? `upi://pay?pa=${upiPa}&pn=${upiPn}&am=${grandTotal}&cu=INR` : '';

    // Load Payment QR Code (custom vendor QR or fallback to static payment.png)
    let qrCodeUrl = quoteData.companyDetails?.qr_code_url || '';
    if (!qrCodeUrl) {
      try {
        const qrPath = path.join(process.cwd(), 'public', 'payment.png');
        const qrBuffer = await fs.readFile(qrPath);
        qrCodeUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
      } catch (qrError) {
        console.warn('payment.png not found', qrError);
      }
    }

    let signatureUrl = '';
    try {
      const sigPath = path.join(process.cwd(), 'public', 'signature.png');
      const sigBuffer = await fs.readFile(sigPath);
      signatureUrl = `data:image/png;base64,${sigBuffer.toString('base64')}`;
    } catch (sigError) {
      console.warn('Signature image not found', sigError);
    }

    const sysType = (quoteData.selectedProduct?.systemType || quoteData.systemType || 'On-grid') as keyof typeof defaultComponents;
    const fallbackComps = defaultComponents[sysType] || defaultComponents['On-grid'];

    const htmlContent = generateQuoteHtml({
      ...quoteData,
      components: quoteData.components || fallbackComps,
      logoUrl,
      signatureUrl,
      panelWarranty: quoteData.selectedProduct?.panelWarranty || "25 Years",
      inverterWarranty: quoteData.selectedProduct?.inverterWarranty || "5 Years",
      batteryWarranty: quoteData.selectedProduct?.batteryWarranty || "5 Years",
      // Pass frontend calculations directly, with fallback to computed values
      calculations: {
        ...quoteData.calculations,
        basePrice: quoteData.calculations?.subtotal || quoteData.calculations?.basePrice || subtotal,
        extraCosts: quoteData.calculations?.extraCosts || 0,
        gstAmount: quoteData.calculations?.gstAmount || gstAmount,
        total: quoteData.calculations?.total || quoteData.calculations?.grandTotal || grandTotal,
        grandTotal: quoteData.calculations?.grandTotal || grandTotal,
        centralSubsidy: quoteData.calculations?.centralSubsidy ?? 0,
        stateSubsidy: quoteData.calculations?.stateSubsidy ?? 0,
        effectiveCost: quoteData.calculations?.effectiveCost || 0
      },
      qrCodeUrl,
      upiLink,
    });

    // Launch Chromium appropriately for the environment
    let browser: any;
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chromium = require('@sparticuz/chromium-min');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const puppeteerCore = require('puppeteer-core');

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
        headless: chromium.headless,
      });
    } else {
      const { default: puppeteer } = await import('puppeteer');
      const customChrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(customChrome ? { executablePath: customChrome } : {}),
      });
    }
    let pdfBuffer: Buffer | Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('screen');
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' }
      });
    } finally {
      try { await browser.close(); } catch { }
    }

    const requestedVendorId = quoteData.vendor_id || quoteData.companyDetails?.id;
    const vendorId = (!session.isSuperAdmin && session.vendor_id)
      ? session.vendor_id
      : (requestedVendorId || 'a0000000-0000-0000-0000-000000000001');
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
    
    // Resolve tenant Node ID for sandboxed storage
    let nodeId = 'NODE-VNS-001';
    try {
      const { data: vRecord } = await supabase.from('vendors').select('node_id').eq('id', vendorId).single();
      if (vRecord?.node_id) nodeId = vRecord.node_id;
    } catch {
      // Default node
    }

    const cleanCust = (quoteData.customerInfo.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = `tenants/${nodeId}/quotations/quotation-${cleanCust}-${Date.now()}.pdf`;
    const bucketName = process.env.SUPABASE_BUCKET!;

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    // Wait for Supabase storage propagation before generating URLs
    await new Promise(r => setTimeout(r, 2000));

    // Always use a signed URL for WhatsApp delivery.
    // Public URLs can have CDN propagation delays causing DoubleTick to fail
    // when it tries to download the PDF asynchronously.
    let pdfUrlForWhatsApp = urlData.publicUrl;
    try {
      const { data: signed, error: signError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 24 * 60 * 60); // 24 hours validity
      if (signed?.signedUrl && !signError) {
        pdfUrlForWhatsApp = signed.signedUrl;
        console.log('Using signed URL for WhatsApp delivery');
      } else {
        console.warn('Signed URL failed, falling back to public URL:', signError?.message);
      }
    } catch (signErr) {
      console.warn('Signed URL generation error, using public URL:', signErr);
    }

    // Verify the URL is accessible before sending to WhatsApp
    try {
      const verifyRes = await fetch(pdfUrlForWhatsApp, { method: 'HEAD' });
      if (!verifyRes.ok) {
        console.warn(`PDF URL verification failed (${verifyRes.status}), retrying...`);
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch(pdfUrlForWhatsApp, { method: 'HEAD' });
        if (!retryRes.ok) {
          console.error(`PDF URL still not accessible after retry: ${retryRes.status}`);
        }
      }
    } catch (verifyErr) {
      console.warn('PDF URL verification error (may still work):', verifyErr);
    }

    if (!quoteData.skipWhatsApp) {
      await sendWhatsAppMessage(quoteData.customerInfo.phone, pdfUrlForWhatsApp);
    }

    return NextResponse.json({ message: 'Quotation sent successfully!', url: urlData.publicUrl, totals: { subtotal, gstAmount, total, discount, grandTotal } });

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: (error as any).message || 'Server error occurred.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const missingEnv: string[] = [];
    if (!process.env.SUPABASE_URL) missingEnv.push('SUPABASE_URL');
    if (!process.env.SUPABASE_KEY) missingEnv.push('SUPABASE_KEY');
    if (!process.env.SUPABASE_BUCKET) missingEnv.push('SUPABASE_BUCKET');
    if (!process.env.DOUBLETICK_API_KEY) missingEnv.push('DOUBLETICK_API_KEY');
    if (!process.env.DOUBLETICK_SENDER_PHONE) missingEnv.push('DOUBLETICK_SENDER_PHONE');
    const ok = missingEnv.length === 0;
    return NextResponse.json({ ok, missingEnv });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, message: (e as Error)?.message || 'Health check failed' }, { status: 500 });
  }
}