import { promises as fs } from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { getServerSupabase } from './supabase';
import { generateQuoteHtml } from './quoteTemplate';
import { defaultComponents } from './companyDetails';
import { GST_RATE } from '../data/priceList';

/**
 * Resolves an image URL (Supabase Storage path/URL, remote HTTPS, or local /public path)
 * into an inlined base64 data URI.
 * Inlining as base64 ensures Chromium / Puppeteer renders the image synchronously and reliably
 * with zero network latency, zero CORS blocking, and zero broken image placeholders in generated PDFs.
 */
export async function resolveImageAsBase64(imageUrl: string | null | undefined, fallbackPath?: string): Promise<string> {
    if (!imageUrl && !fallbackPath) return '';
    const url = (imageUrl && imageUrl.trim()) ? imageUrl.trim() : (fallbackPath || '');
    if (!url) return '';

    // 1. If already a data URI, return directly
    if (url.startsWith('data:image/')) {
        return url;
    }

    // 2. Direct Supabase Storage download (bypasses Cloudflare CDN timeouts & DNS latency)
    if (url.includes('/storage/v1/object/public/') || url.includes('/storage/v1/object/sign/')) {
        try {
            const supabase = getServerSupabase();
            const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?#]+)\/(.+?)(?:\?|$)/);
            if (match) {
                const bucket = match[1];
                const storagePath = decodeURIComponent(match[2]);
                const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(storagePath);
                if (!dlErr && blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const ext = path.extname(storagePath).toLowerCase();
                    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
                    return `data:${mime};base64,${buffer.toString('base64')}`;
                }
            }
        } catch (storageErr) {
            console.warn('[pdfGenerator] Supabase storage direct download error, will attempt fetch fallback:', storageErr);
        }
    }

    // 3. Remote URL (http:// or https://)
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
            console.warn('[pdfGenerator] Failed to fetch remote image:', url, fetchErr);
        }
    }

    // 4. Local file in /public folder
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

    return '';
}

/**
 * Normalizes input data (from API request body or database quotations row)
 * into a complete, high-fidelity quote data payload with all vendor branding resolved.
 */
export async function prepareQuoteHtmlPayload(inputData: any): Promise<{ htmlContent: string; vendorId: string; nodeId: string; customerName: string; totals: any }> {
    const supabase = getServerSupabase();

    // 1. Resolve target vendor ID
    const vendorId = inputData.vendor_id || 
                     inputData.tenant_id || 
                     inputData.companyDetails?.id || 
                     inputData.companyDetails?.vendor_id || 
                     'a0000000-0000-0000-0000-000000000001';

    const isDemoKaran = vendorId === 'a0000000-0000-0000-0000-000000000001' || vendorId === 'karan-solar';

    // 2. Query vendor profile from database for accurate live branding
    let dbVendor: any = null;
    let nodeId = inputData.node_id || 'NODE-VNS-001';
    try {
        const { data: vData } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .maybeSingle();
        if (vData) {
            dbVendor = vData;
            if (vData.node_id) nodeId = vData.node_id;
        }
    } catch (err) {
        console.warn('[pdfGenerator] Vendor query error:', err);
    }

    // 3. Normalize Company / Vendor Details
    const rawVendor = dbVendor || inputData.vendor_snapshot || inputData.companyDetails || {};
    
    // Sanitize demo assets for third-party vendors
    let rawLogo = rawVendor.logo_url || inputData.companyDetails?.logo_url || inputData.companyDetails?.logo;
    let rawSig = rawVendor.signature_url || inputData.companyDetails?.signature_url || inputData.companyDetails?.signature;
    let rawStamp = rawVendor.stamp_url || inputData.companyDetails?.stamp_url || inputData.companyDetails?.stamp;
    let rawQr = rawVendor.qr_code_url || inputData.companyDetails?.qr_code_url;

    if (!isDemoKaran) {
        if (rawLogo === '/logo.png') rawLogo = null;
        if (rawSig === '/signature.png' || rawSig === '/stamp.png') rawSig = null;
        if (rawStamp === '/signature.png' || rawStamp === '/stamp.png') rawStamp = null;
        if (rawQr === '/payment.png') rawQr = null;
    }

    const companyDetails = {
        id: rawVendor.id || vendorId,
        name: rawVendor.name || inputData.companyDetails?.name || 'Solar Company',
        tagline: rawVendor.tagline || inputData.companyDetails?.tagline || 'CLEAN ENERGY | BRIGHTER TOMORROW',
        gstin: rawVendor.gstin || inputData.companyDetails?.gstin || '',
        headOffice: rawVendor.head_office || rawVendor.headOffice || inputData.companyDetails?.headOffice || '',
        registeredOffice: rawVendor.registered_office || rawVendor.registeredOffice || inputData.companyDetails?.registeredOffice || '',
        phone: rawVendor.phone || inputData.companyDetails?.phone || '',
        email: rawVendor.email || inputData.companyDetails?.email || '',
        authorizedSignatory: rawVendor.authorized_signatory || rawVendor.authorizedSignatory || inputData.salesperson || 'Authorized Signatory',
        bank: {
            name: rawVendor.bank_name || rawVendor.bank?.name || 'Bank',
            branch: rawVendor.bank_branch || rawVendor.bank?.branch || '',
            accountName: rawVendor.account_name || rawVendor.bank?.accountName || rawVendor.name || 'Account Holder',
            accountNumber: rawVendor.account_number || rawVendor.bank?.accountNumber || '',
            ifsc: rawVendor.ifsc || rawVendor.bank?.ifsc || '',
            upiId: rawVendor.upi_id || rawVendor.bank?.upiId || '',
        },
        logo_url: rawLogo,
        signature_url: rawSig,
        stamp_url: rawStamp,
        qr_code_url: rawQr,
    };

    // 4. Financials & Pricing Integrity (needed for dynamic QR code)
    const calc = inputData.calculations || {};
    const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);

    const basePrice = n(calc.basePrice || inputData.base_price || 0);
    const taxRate = typeof inputData.taxRate === 'number' ? inputData.taxRate : ((Number(inputData.gst_rate) || (GST_RATE * 100)) / 100);
    const gstAmount = n(calc.gstAmount || inputData.gst_amount || +(basePrice * taxRate).toFixed(2));
    const total = n(calc.total || inputData.total_amount || +(basePrice + gstAmount).toFixed(2));
    const discount = n(calc.discount || 0);
    const grandTotal = Math.max(0, +(total - discount).toFixed(2));
    const centralSubsidy = n(calc.centralSubsidy ?? inputData.central_subsidy ?? 0);
    const stateSubsidy = n(calc.stateSubsidy ?? inputData.state_subsidy ?? 0);
    const effectiveCost = n(calc.effectiveCost ?? Math.max(0, grandTotal - (centralSubsidy + stateSubsidy)));

    const calculations = {
        basePrice,
        extraCosts: n(calc.extraCosts || 0),
        gstAmount,
        total: grandTotal,
        grandTotal,
        centralSubsidy,
        stateSubsidy,
        effectiveCost,
    };

    // 5. Resolve Branding Images as Base64 Data URIs
    const logoUrl = await resolveImageAsBase64(companyDetails.logo_url, isDemoKaran ? '/logo.png' : undefined);
    const signatureUrl = await resolveImageAsBase64(companyDetails.signature_url, isDemoKaran ? '/signature.png' : undefined);
    const stampUrl = await resolveImageAsBase64(companyDetails.stamp_url, isDemoKaran ? '/stamp.png' : undefined);
    
    // Resolve Payment QR Code: Custom uploaded image -> dynamic UPI QR -> demo fallback
    let qrCodeUrl = await resolveImageAsBase64(companyDetails.qr_code_url, undefined);
    const upiPa = companyDetails.bank?.upiId || '';
    const upiPn = encodeURIComponent(companyDetails.name || 'Solar Quotation');
    const upiLink = upiPa ? `upi://pay?pa=${upiPa}&pn=${upiPn}&am=${grandTotal}&cu=INR` : '';

    if (!qrCodeUrl && upiLink) {
        try {
            qrCodeUrl = await QRCode.toDataURL(upiLink, {
                width: 200,
                margin: 1,
                color: { dark: '#0f172a', light: '#ffffff' }
            });
        } catch (qrErr) {
            console.warn('[pdfGenerator] Dynamic UPI QR generation failed:', qrErr);
        }
    }

    if (!qrCodeUrl && isDemoKaran) {
        qrCodeUrl = await resolveImageAsBase64('/payment.png');
    }

    // 6. Customer Details
    const customerInfo = inputData.customerInfo || {
        name: inputData.customer_name || 'Customer',
        phone: inputData.customer_phone || '',
        address: inputData.customer_address || '',
        email: inputData.customer_email || '',
    };

    // 7. Selected Product & System Details
    const selectedProduct = inputData.selectedProduct || {
        systemType: inputData.system_type_name || inputData.systemType || 'On-grid',
        capacity: inputData.capacity_kw || inputData.capacity || 3,
        phase: inputData.phase || 1,
        panelBrand: inputData.brand || inputData.panelBrand || 'Adani',
        panelWattage: inputData.panelWattage || 550,
        panelType: inputData.panelType || 'Mono Perc',
        panelWarranty: inputData.panelWarranty || '25 Years',
        inverterBrand: inputData.inverterBrand || 'Polycab',
        inverterWarranty: inputData.inverterWarranty || '5 Years',
        batteryWarranty: inputData.batteryWarranty || '5 Years',
    };

    // 8. Components & Terms
    const sysType = (selectedProduct.systemType || 'On-grid') as keyof typeof defaultComponents;
    const fallbackComps = defaultComponents[sysType] || defaultComponents['On-grid'];
    const components = inputData.components && inputData.components.length > 0 ? inputData.components : fallbackComps;
    const terms = inputData.terms || [];

    const quoteNumber = inputData.quote_number || inputData.quoteNumber || 'QUOTATION';
    const currentDate = inputData.quote_date || inputData.currentDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // 9. Generate Final HTML
    const htmlContent = generateQuoteHtml({
        ...inputData,
        customerInfo,
        selectedProduct,
        calculations,
        components,
        terms,
        companyDetails,
        logoUrl,
        signatureUrl,
        stampUrl,
        qrCodeUrl,
        upiLink,
        quoteNumber,
        currentDate,
        panelWarranty: selectedProduct.panelWarranty || '25 Years',
        inverterWarranty: selectedProduct.inverterWarranty || '5 Years',
        batteryWarranty: selectedProduct.batteryWarranty || '5 Years',
    });

    return {
        htmlContent,
        vendorId,
        nodeId,
        customerName: customerInfo.name,
        totals: calculations,
    };
}

/**
 * Launches Puppeteer / Chromium and prints the given HTML to an A4 PDF buffer.
 */
export async function renderHtmlToPdfBuffer(htmlContent: string): Promise<Buffer> {
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

    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 15000 });
        await page.emulateMediaType('screen');
        const pdfArrayBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '6mm', right: '8mm', bottom: '6mm', left: '8mm' }
        });
        return Buffer.from(pdfArrayBuffer);
    } finally {
        try { await browser.close(); } catch { }
    }
}

/**
 * High-level helper: Renders and uploads a quotation PDF to Supabase Storage,
 * returning the public URL, storage path, and raw PDF buffer.
 */
export async function generateAndUploadQuotePdf(quotePayload: any): Promise<{ pdfBuffer: Buffer; publicUrl: string; storagePath: string; totals: any }> {
    const { htmlContent, nodeId, customerName, totals } = await prepareQuoteHtmlPayload(quotePayload);
    const pdfBuffer = await renderHtmlToPdfBuffer(htmlContent);

    const supabase = getServerSupabase();
    const bucketName = process.env.SUPABASE_BUCKET || 'quotations';
    const cleanCust = String(customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '-');
    const storagePath = `tenants/${nodeId}/quotations/quotation-${cleanCust}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
        console.warn('[pdfGenerator] Supabase upload failed, falling back to local stream:', uploadError.message);
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    return {
        pdfBuffer,
        publicUrl: urlData?.publicUrl || '',
        storagePath,
        totals,
    };
}
