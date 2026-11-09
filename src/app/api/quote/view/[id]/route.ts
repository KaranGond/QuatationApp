import { getServerSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/**
 * Public Branded PDF Proxy Route
 * Masks the underlying Supabase BaaS URL, database keys, and storage paths.
 * Allows customers to view their official quotation directly under your own domain:
 * e.g. https://yourdomain.com/api/quote/view/KSS-2026-0001
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
            .select('id, quote_number, customer_name, pdf_url, pdf_storage_path');

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUUID) {
            query = query.eq('id', id);
        } else {
            query = query.eq('quote_number', id);
        }

        const { data: quote } = await query.maybeSingle();

        // 2. Fallback: if not found by exact ID/quote_number, try matching by file name pattern
        let resolvedPdfUrl = quote?.pdf_url;
        let quoteNumber = quote?.quote_number || id;

        if (!resolvedPdfUrl) {
            const { data: byUrl } = await supabase
                .from('quotations')
                .select('id, quote_number, pdf_url')
                .ilike('pdf_url', `%${id}%`)
                .maybeSingle();

            if (byUrl?.pdf_url) {
                resolvedPdfUrl = byUrl.pdf_url;
                quoteNumber = byUrl.quote_number || quoteNumber;
            }
        }

        if (!resolvedPdfUrl) {
            return new Response('Quotation document not found or link has expired.', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        // 3. Fetch PDF bytes on server (bypassing public exposure of storage bucket)
        let pdfBuffer: ArrayBuffer | null = null;
        const bucketName = process.env.SUPABASE_BUCKET || 'quotations';

        if (quote?.pdf_storage_path) {
            const { data: blob, error: downloadErr } = await supabase.storage
                .from(bucketName)
                .download(quote.pdf_storage_path);
            if (!downloadErr && blob) {
                pdfBuffer = await blob.arrayBuffer();
            }
        }

        if (!pdfBuffer && resolvedPdfUrl) {
            const fileRes = await fetch(resolvedPdfUrl);
            if (fileRes.ok) {
                pdfBuffer = await fileRes.arrayBuffer();
            }
        }

        if (!pdfBuffer) {
            return new Response('Could not retrieve quotation document from storage.', {
                status: 502,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        // 4. Stream PDF to customer with inline disposition and branded filename
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
