import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { gstConfig, calculateSavings } from '@/lib/companyDetails';
import { getUserSession, unauthorizedResponse, forbiddenResponse } from '@/lib/authGuard';

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get single quotation
export async function GET(request: Request, context: RouteContext) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();

        const { id } = await context.params;
        const supabase = getServerSupabase();

        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ success: false, message: 'Quotation not found' }, { status: 404 });
        }

        // Strict multi-tenant isolation
        if (!session.isSuperAdmin && session.vendor_id) {
            const quoteVendorId = data.vendor_id || data.tenant_id;
            if (quoteVendorId && quoteVendorId !== session.vendor_id) {
                return forbiddenResponse('You do not have permission to view this quotation');
            }
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// PUT - Update quotation
export async function PUT(request: Request, context: RouteContext) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();

        const { id } = await context.params;
        const supabase = getServerSupabase();

        // 1. Verify existence and tenant ownership
        const { data: existingQuote, error: fetchErr } = await supabase
            .from('quotations')
            .select('vendor_id, tenant_id')
            .eq('id', id)
            .single();

        if (fetchErr || !existingQuote) {
            return NextResponse.json({ success: false, message: 'Quotation not found' }, { status: 404 });
        }

        if (!session.isSuperAdmin && session.vendor_id) {
            const quoteVendorId = existingQuote.vendor_id || existingQuote.tenant_id;
            if (quoteVendorId && quoteVendorId !== session.vendor_id) {
                return forbiddenResponse('You do not have permission to modify this quotation');
            }
        }

        const body = await request.json();
        const {
            customer_name,
            customer_phone,
            customer_address,
            customer_email,
            system_type_id,
            capacity_kw,
            phase,
            brand,
            base_price,
            gst_rate,
            central_subsidy,
            state_subsidy,
            terms,
            components,
            salesperson,
            status,
            pdf_url,
            form_data,
        } = body;

        // Recalculate GST and totals for financial integrity
        const effectiveGstRate = gst_rate || gstConfig.compositeRate;
        const baseAmount = Number(base_price) || 0;
        const gst_amount = +(baseAmount * (effectiveGstRate / 100)).toFixed(2);
        const total_amount = +(baseAmount + gst_amount).toFixed(2);

        // Calculate savings data
        const savings = calculateSavings(
            capacity_kw || 0,
            total_amount,
            central_subsidy,
            state_subsidy
        );

        // Build update object
        const updateData: Record<string, any> = {
            customer_name,
            customer_phone,
            customer_address,
            customer_email,
            system_type_id,
            capacity_kw,
            phase,
            brand,
            base_price: baseAmount,
            gst_rate: effectiveGstRate,
            gst_amount,
            total_amount,
            central_subsidy,
            state_subsidy,
            terms,
            components,
            savings_data: savings,
            salesperson,
            status,
            updated_at: new Date().toISOString(),
        };

        if (pdf_url !== undefined) {
            updateData.pdf_url = pdf_url;
            updateData.pdf_storage_path = body.pdf_storage_path ?? (pdf_url ? undefined : null);
        }
        if (body.pdf_storage_path !== undefined) updateData.pdf_storage_path = body.pdf_storage_path;
        if (form_data !== undefined) updateData.form_data = form_data;

        const { data, error } = await supabase
            .from('quotations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// DELETE - Delete quotation
export async function DELETE(request: Request, context: RouteContext) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();

        const { id } = await context.params;
        const supabase = getServerSupabase();

        // 1. Verify existence and tenant ownership
        const { data: existingQuote, error: fetchErr } = await supabase
            .from('quotations')
            .select('vendor_id, tenant_id')
            .eq('id', id)
            .single();

        if (fetchErr || !existingQuote) {
            return NextResponse.json({ success: false, message: 'Quotation not found' }, { status: 404 });
        }

        if (!session.isSuperAdmin && session.vendor_id) {
            const quoteVendorId = existingQuote.vendor_id || existingQuote.tenant_id;
            if (quoteVendorId && quoteVendorId !== session.vendor_id) {
                return forbiddenResponse('You do not have permission to delete this quotation');
            }
        }

        const { error } = await supabase
            .from('quotations')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
