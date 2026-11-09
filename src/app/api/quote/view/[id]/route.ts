import { getServerSupabase } from '@/lib/supabase';
import { generateAndUploadQuotePdf } from '@/lib/pdfGenerator';

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/**
 * Public Branded PDF Proxy Route
 * Masks the underlying Supabase BaaS URL, database keys, and storage paths.
 * Allows customers to view their official quotation directly under your own domain:
 * e.g. https://yourdomain.com/api/quote/view/SUN-2026-0001
 * 
 * Auto-Recovery Guarantee:
 * If a quotation exists in the database but the PDF was never generated or was lost,
 * this route dynamically generates the PDF on the fly using the vendor's actual assets,
 * uploads it to storage, updates the quotation record, and streams the document inline.
 */
export async function GET(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) {
            return new Response('Quotation reference is required', { status: 400 });
        }

        const supabase = getServerSupabase();

        // 1. Resolve quotation from database by UUID or quote_number
        let query = supabase
            .from('quotations')
            .select('*, vendors(*)');

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUUID) {
            query = query.eq('id', id);
        } else {
            query = query.eq('quote_number', id);
        }

        let { data: quote } = await query.maybeSingle();

        // 2. Fallback: match by file name pattern if not matched by ID or quote_number
        if (!quote) {
            const { data: byUrl } = await supabase
                .from('quotations')
                .select('*, vendors(*)')
                .ilike('pdf_url', `%${id}%`)
                .maybeSingle();

            if (byUrl) {
                quote = byUrl;
            }
        }

        if (!quote) {
            return new Response('Quotation document not found or link has expired.', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        const quoteNumber = quote.quote_number || id;
        const bucketName = process.env.SUPABASE_BUCKET || 'quotations';
        let pdfBuffer: ArrayBuffer | null = null;

        // 3. Attempt direct download via storage path if known
        let storagePath = quote.pdf_storage_path;
        if (!storagePath && quote.pdf_url) {
            const match = quote.pdf_url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?.*)?$/);
            if (match && match[1]) {
                storagePath = decodeURIComponent(match[1]);
            }
        }

        if (storagePath) {
            try {
                const { data: blob, error: downloadErr } = await supabase.storage
                    .from(bucketName)
                    .download(storagePath);
                if (!downloadErr && blob) {
                    pdfBuffer = await blob.arrayBuffer();
                }
            } catch (dlErr) {
                console.warn('[quote-view] Storage download error:', dlErr);
            }
        }

        // 4. Fallback fetch via public URL
        if (!pdfBuffer && quote.pdf_url) {
            try {
                const fileRes = await fetch(quote.pdf_url);
                if (fileRes.ok) {
                    pdfBuffer = await fileRes.arrayBuffer();
                }
            } catch (fetchErr) {
                console.warn('[quote-view] Public URL fetch error:', fetchErr);
            }
        }

        // 5. AUTO-RECOVERY: If PDF is still missing, generate it on-the-fly from the quotation record
        if (!pdfBuffer) {
            try {
                console.log(`[quote-view] Auto-generating missing PDF for quote ${quoteNumber}...`);
                const payload = {
                    ...(quote.form_data || {}),
                    customerInfo: quote.form_data?.customerInfo || {
                        name: quote.customer_name,
                        phone: quote.customer_phone || '',
                        address: quote.customer_address || '',
                        email: quote.customer_email || '',
                    },
                    selectedProduct: quote.form_data?.selectedProduct || {
                        systemType: quote.system_type_name || quote.form_data?.selectedSystemType || 'On-grid',
                        capacity: quote.capacity_kw || quote.form_data?.capacityKw || 3,
                        phase: quote.phase || quote.form_data?.phase || 1,
                        panelBrand: quote.brand || quote.form_data?.panelBrand || 'Solar Panel',
                    },
                    calculations: quote.form_data?.calculations || {
                        basePrice: quote.base_price,
                        gstAmount: quote.gst_amount,
                        total: quote.total_amount,
                        grandTotal: quote.total_amount,
                        centralSubsidy: quote.central_subsidy || 0,
                        stateSubsidy: quote.state_subsidy || 0,
                    },
                    components: quote.components && quote.components.length > 0 ? quote.components : (quote.form_data?.components || []),
                    terms: quote.terms && quote.terms.length > 0 ? quote.terms : (quote.form_data?.terms || []),
                    quote_number: quoteNumber,
                    quote_date: quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined,
                    vendor_id: quote.vendor_id || quote.tenant_id,
                    vendor_snapshot: quote.vendor_snapshot,
                };

                const generated = await generateAndUploadQuotePdf(payload);
                if (generated.pdfBuffer) {
                    pdfBuffer = generated.pdfBuffer.buffer as ArrayBuffer;

                    // Persist newly generated PDF paths to database in background
                    supabase
                        .from('quotations')
                        .update({
                            pdf_url: generated.publicUrl,
                            pdf_storage_path: generated.storagePath,
                        })
                        .eq('id', quote.id)
                        .then(({ error: updateErr }) => {
                            if (updateErr) console.warn('[quote-view] Failed to update quote record with generated PDF URL:', updateErr.message);
                            else console.log(`[quote-view] Successfully saved auto-generated PDF for quote ${quoteNumber}`);
                        });
                }
            } catch (genErr: any) {
                console.error('[quote-view] Auto-generation failed:', genErr);
            }
        }

        if (!pdfBuffer) {
            return new Response('Could not retrieve or render quotation document.', {
                status: 502,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        // 6. Stream PDF to client with inline disposition and clean branded filename
        const cleanFilename = `Quotation-${String(quoteNumber).replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${cleanFilename}"`,
                'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            },
        });
    } catch (err: any) {
        console.error('Error proxying quotation PDF:', err);
        return new Response('Internal error retrieving quotation document.', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}
