import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
// Use dynamic imports to support serverless-compatible Chromium in production
import { getServerSupabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { generateQuoteHtml } from '../../../lib/quoteTemplate';
import { defaultComponents } from '@/lib/companyDetails';
import { GST_RATE } from '../../../data/priceList';
import { getUserSession, unauthorizedResponse } from '@/lib/authGuard';

export const runtime = 'nodejs';

/**
 * Resolves an image URL (remote HTTPS or local /public path) into an inlined base64 data URI.
 * Inlining as base64 ensures Chromium / Puppeteer renders the image synchronously and reliably
 * with zero network latency, zero CORS blocking, and zero broken image placeholders in generated PDFs.
 */
async function resolveImageAsBase64(imageUrl: string | null | undefined, fallbackPath?: string): Promise<string> {
  if (!imageUrl && !fallbackPath) return '';
  const url = (imageUrl && imageUrl.trim()) ? imageUrl.trim() : (fallbackPath || '');

  // 1. If already a data URI, return directly
  if (url.startsWith('data:image/')) {
    return url;
  }

  // 2. Remote URL (http:// or https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    } catch (fetchErr) {
      console.warn('[quote] Failed to fetch remote image:', url, fetchErr);
    }
  }

  // 3. Local file in /public folder
  const localFileName = url.startsWith('/') ? url.slice(1) : url;
  try {
    const filePath = path.join(process.cwd(), 'public', localFileName);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(localFileName).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    if (fallbackPath && fallbackPath !== url) {
      return resolveImageAsBase64(fallbackPath);
    }
  }

  return url;
}

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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL');
    if (!supabaseKey) missingEnv.push('SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY');
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

    // Query vendor's database profile to guarantee latest assets & custom identity
    const targetVendorId = (!session.isSuperAdmin && session.vendor_id)
      ? session.vendor_id
      : (quoteData.vendor_id || quoteData.companyDetails?.id || quoteData.companyDetails?.vendor_id);

    let dbVendor: any = null;
    if (targetVendorId) {
      try {
        const supabase = getServerSupabase();
        const { data: vData } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', targetVendorId)
          .maybeSingle();
        if (vData) dbVendor = vData;
      } catch (err) {
        console.warn('Could not query vendor profile for PDF assets:', err);
      }
    }

    // Merge database vendor profile into companyDetails for complete fidelity
    if (dbVendor) {
      quoteData.companyDetails = {
        id: dbVendor.id,
        name: dbVendor.name,
        tagline: dbVendor.tagline || quoteData.companyDetails?.tagline || '',
        gstin: dbVendor.gstin || quoteData.companyDetails?.gstin || '',
        headOffice: dbVendor.head_office || quoteData.companyDetails?.headOffice || '',
        registeredOffice: dbVendor.registered_office || quoteData.companyDetails?.registeredOffice || '',
        phone: dbVendor.phone || quoteData.companyDetails?.phone || '',
        email: dbVendor.email || quoteData.companyDetails?.email || '',
        bank: {
          name: dbVendor.bank_name || quoteData.companyDetails?.bank?.name || 'HDFC Bank',
          branch: dbVendor.bank_branch || quoteData.companyDetails?.bank?.branch || '',
          accountName: dbVendor.account_name || quoteData.companyDetails?.bank?.accountName || dbVendor.name,
          accountNumber: dbVendor.account_number || quoteData.companyDetails?.bank?.accountNumber || '',
          ifsc: dbVendor.ifsc || quoteData.companyDetails?.bank?.ifsc || '',
          upiId: dbVendor.upi_id || quoteData.companyDetails?.bank?.upiId || '',
        },
        logo: dbVendor.logo_url || quoteData.companyDetails?.logo,
        logo_url: dbVendor.logo_url || quoteData.companyDetails?.logo_url,
        signature: dbVendor.signature_url || dbVendor.stamp_url || quoteData.companyDetails?.signature,
        signature_url: dbVendor.signature_url || dbVendor.stamp_url || quoteData.companyDetails?.signature_url,
        stamp: dbVendor.stamp_url || dbVendor.signature_url || quoteData.companyDetails?.stamp,
        stamp_url: dbVendor.stamp_url || dbVendor.signature_url || quoteData.companyDetails?.stamp_url,
        qr_code_url: dbVendor.qr_code_url || quoteData.companyDetails?.qr_code_url,
        authorizedSignatory: dbVendor.authorized_signatory || quoteData.companyDetails?.authorizedSignatory || 'Authorized Signatory',
      };
    }

    // Resolve Logo (Vendor's custom uploaded logo or fallback to /logo.png)
    const rawLogo = dbVendor?.logo_url || quoteData.companyDetails?.logo_url || quoteData.companyDetails?.logo || '/logo.png';
    const logoUrl = await resolveImageAsBase64(rawLogo, '/logo.png');

    // Resolve Stamp & Signature (Vendor's custom merged upload or fallback to /signature.png)
    const rawSig = dbVendor?.signature_url || 
                   dbVendor?.stamp_url || 
                   quoteData.companyDetails?.signature_url || 
                   quoteData.companyDetails?.signature || 
                   quoteData.companyDetails?.stamp_url || 
                   quoteData.companyDetails?.stamp || 
                   '/signature.png';
    const signatureUrl = await resolveImageAsBase64(rawSig, '/signature.png');

    // Resolve Payment QR Code (Vendor's custom uploaded QR or fallback to /payment.png)
    const rawQr = dbVendor?.qr_code_url || quoteData.companyDetails?.qr_code_url || '/payment.png';
    const qrCodeUrl = await resolveImageAsBase64(rawQr, '/payment.png');

    const upiPa = quoteData.companyDetails?.bank?.upiId || quoteData.companyDetails?.upi_id || dbVendor?.upi_id || '';
    const upiPn = encodeURIComponent(quoteData.companyDetails?.name || dbVendor?.name || 'Solar Quotation');
    const upiLink = upiPa ? `upi://pay?pa=${upiPa}&pn=${upiPn}&am=${grandTotal}&cu=INR` : '';

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
      await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 15000 });
      await page.emulateMediaType('screen');
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' }
      });
    } finally {
      try { await browser.close(); } catch { }
    }

    const vendorId = targetVendorId || quoteData.vendor_id || quoteData.companyDetails?.id || 'a0000000-0000-0000-0000-000000000001';
    const supabase = getServerSupabase();
    
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

    let pdfUrlForWhatsApp = urlData.publicUrl;
    try {
      const { data: signed, error: signError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 24 * 60 * 60); // 24 hours validity
      if (signed?.signedUrl && !signError) {
        pdfUrlForWhatsApp = signed.signedUrl;
        console.log('Using signed URL for WhatsApp delivery');
      }
    } catch (signErr) {
      console.warn('Signed URL generation error, using public URL:', signErr);
    }

    if (!quoteData.skipWhatsApp) {
      try {
        await sendWhatsAppMessage(quoteData.customerInfo.phone, pdfUrlForWhatsApp);
      } catch (waErr: any) {
        console.warn('DoubleTick WhatsApp automated delivery failed (falling back to direct wa.me):', waErr?.message);
      }
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
    if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnv.push('SUPABASE_URL');
    if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_KEY');
    if (!process.env.SUPABASE_BUCKET) missingEnv.push('SUPABASE_BUCKET');
    if (!process.env.DOUBLETICK_API_KEY) missingEnv.push('DOUBLETICK_API_KEY');
    if (!process.env.DOUBLETICK_SENDER_PHONE) missingEnv.push('DOUBLETICK_SENDER_PHONE');
    const ok = missingEnv.length === 0;
    return NextResponse.json({ ok, missingEnv });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, message: (e as Error)?.message || 'Health check failed' }, { status: 500 });
  }
}