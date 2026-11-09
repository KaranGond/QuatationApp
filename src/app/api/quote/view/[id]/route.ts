import { getServerSupabase } from '@/lib/supabase';
import { generateAndUploadQuotePdf, prepareQuoteHtmlPayload } from '@/lib/pdfGenerator';

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

/**
 * Public Branded PDF & Document Proxy Route
 * Masks the underlying Supabase BaaS URL, database keys, and storage paths.
 * Allows customers and vendors to view their official quotation directly under your own domain:
 * e.g. https://yourdomain.com/api/quote/view/SUN-2026-0001
 * 
 * Features:
 * - ?download=1 : Directly downloads the generated official PDF file.
 * - ?pdf=1      : Streams the raw PDF inline with Content-Disposition inline.
 * - default     : Returns a responsive document viewer featuring "Download PDF" and "Print"
 *                 buttons along with a high-fidelity single-page quotation preview.
 * - Anti-Cache  : Uses no-cache, no-store headers so edits are always reflected immediately.
 */
export async function GET(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) {
            return new Response('Quotation reference is required', { status: 400 });
        }

        const url = new URL(request.url);
        const isDownload = url.searchParams.get('download') === '1' || url.searchParams.get('download') === 'true';
        const isRawPdf = url.searchParams.get('pdf') === '1' || url.searchParams.get('pdf') === 'true';
        const acceptHeader = request.headers.get('accept') || '';
        const wantsPdf = isRawPdf || (acceptHeader.includes('application/pdf') && !acceptHeader.includes('text/html'));

        const supabase = getServerSupabase();

        // 1. Resolve quotation from database by UUID or quote_number
        let query = supabase
            .from('quotations')
            .select('*, vendors:vendors!quotations_vendor_id_fkey(*)');

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUUID) {
            query = query.eq('id', id);
        } else {
            query = query.eq('quote_number', id);
        }

        let { data: quote } = await query.maybeSingle();

        // 2. Resilient Fallback 1: Query without join if relationship error occurred
        if (!quote) {
            let simpleQuery = supabase.from('quotations').select('*');
            if (isUUID) {
                simpleQuery = simpleQuery.eq('id', id);
            } else {
                simpleQuery = simpleQuery.eq('quote_number', id);
            }
            const { data: simpleQuote } = await simpleQuery.maybeSingle();
            if (simpleQuote) {
                quote = simpleQuote;
            }
        }

        // 3. Resilient Fallback 2: Match by file name pattern if not matched by ID or quote_number
        if (!quote) {
            const { data: byUrl } = await supabase
                .from('quotations')
                .select('*')
                .ilike('pdf_url', `%${id}%`)
                .maybeSingle();

            if (byUrl) {
                quote = byUrl;
            }
        }

        if (!quote) {
            return new Response('Quotation document not found or link has expired.', {
                status: 404,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                },
            });
        }

        const quoteNumber = quote.quote_number || id;
        const bucketName = process.env.SUPABASE_BUCKET || 'quotations';
        const cleanFilename = `Quotation-${String(quoteNumber).replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;

        // Build standard quote payload from record
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
            vendor_snapshot: quote.vendor_snapshot || quote.vendors,
        };

        // If the client requested binary PDF download or raw PDF stream
        if (isDownload || wantsPdf) {
            let pdfBuffer: ArrayBuffer | null = null;
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

            // Fallback fetch via public URL
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

            // Auto-recovery / dynamic generation if PDF is missing
            if (!pdfBuffer) {
                try {
                    const generated = await generateAndUploadQuotePdf(payload);
                    if (generated.pdfBuffer) {
                        pdfBuffer = generated.pdfBuffer.buffer as ArrayBuffer;
                        supabase
                            .from('quotations')
                            .update({
                                pdf_url: generated.publicUrl,
                                pdf_storage_path: generated.storagePath,
                            })
                            .eq('id', quote.id)
                            .then();
                    }
                } catch (genErr) {
                    console.error('[quote-view] PDF generation failed:', genErr);
                }
            }

            if (!pdfBuffer) {
                return new Response('Could not retrieve or render quotation PDF.', {
                    status: 502,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                });
            }

            const disposition = isDownload ? 'attachment' : 'inline';
            return new Response(pdfBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `${disposition}; filename="${cleanFilename}"`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            });
        }

        // 3. Default: Render Rich HTML Viewer with Download and Print buttons
        const { htmlContent } = await prepareQuoteHtmlPayload(payload);

        // Auto-generate PDF in background if it's missing, so subsequent Download click is instant
        if (!quote.pdf_storage_path) {
            generateAndUploadQuotePdf(payload)
                .then(res => {
                    if (res?.publicUrl) {
                        supabase.from('quotations').update({
                            pdf_url: res.publicUrl,
                            pdf_storage_path: res.storagePath,
                        }).eq('id', quote.id).then();
                    }
                })
                .catch(() => {});
        }

        // Inject the fixed action topbar & container styling into the quotation HTML
        const viewerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation ${quoteNumber} - ${quote.customer_name || 'Customer'}</title>
  <style>
    /* 1. Template CSS Styles (Ensures 100% fidelity with PDF design) */
    ${extractStyle(htmlContent)}

    /* 2. Viewer Wrapper & Navigation Overrides */
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #0f172a !important;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
      min-height: 100vh;
    }
    .viewer-navbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      color: #f8fafc;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .viewer-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .viewer-badge {
      background: #0284c7;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .viewer-title {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .viewer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-download {
      background: #16a34a;
      color: #ffffff !important;
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.4);
    }
    .btn-download:hover {
      background: #15803d;
      transform: translateY(-1px);
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
    }
    .btn-print:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .viewer-content {
      padding: 24px 12px 48px 12px;
      display: flex;
      justify-content: center;
      background: #0f172a;
    }
    .viewer-sheet-frame {
      background: #ffffff;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      border-radius: 4px;
      width: 100%;
      max-width: 210mm;
      padding: 6mm 8mm;
      box-sizing: border-box;
      color: #1e293b;
      font-size: 9.5px;
      line-height: 1.4;
    }
    .viewer-sheet-frame .page {
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    @media (max-width: 640px) {
      .viewer-navbar {
        padding: 8px 10px;
      }
      .viewer-title {
        display: none;
      }
      .btn-action {
        font-size: 11px;
        padding: 6px 11px;
      }
      .viewer-content {
        padding: 8px 4px 24px 4px;
      }
      .viewer-sheet-frame {
        padding: 4mm 4mm;
        border-radius: 0;
      }
    }
    @media print {
      .viewer-navbar {
        display: none !important;
      }
      body {
        background: #ffffff !important;
      }
      .viewer-content {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
      }
      .viewer-sheet-frame {
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        padding: 0 !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <!-- Sticky Toolbar -->
  <header class="viewer-navbar">
    <div class="viewer-info">
      <span class="viewer-badge">${quoteNumber}</span>
      <span class="viewer-title">${escapeHtml(quote.customer_name || 'Customer')}</span>
    </div>
    <div class="viewer-actions">
      <a href="?download=1" download="${cleanFilename}" class="btn-action btn-download" title="Download official PDF file">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download PDF
      </a>
      <button onclick="window.print()" class="btn-action btn-print" title="Print document">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print
      </button>
    </div>
  </header>

  <!-- Document Sheet -->
  <main class="viewer-content">
    <div class="viewer-sheet-frame">
      ${extractBody(htmlContent)}
    </div>
  </main>
</body>
</html>
        `;

        return new Response(viewerHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (err: any) {
        console.error('Error in quotation document viewer:', err);
        return new Response('Internal error retrieving quotation document.', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

function extractStyle(fullHtml: string): string {
    const matches = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (!matches) return '';
    return matches.map(tag => tag.replace(/<\/?style[^>]*>/gi, '')).join('\n');
}

function extractBody(fullHtml: string): string {
    const match = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1] : fullHtml;
}

function escapeHtml(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
