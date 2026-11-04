import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { gstConfig, calculateSavings } from '@/lib/companyDetails';
import { getAuthenticatedUser } from '@/lib/authGuard';

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get single quotation
export async function GET(request: Request, context: RouteContext) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const { id } = await context.params;
        const supabase = getServerSupabase();

        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// PUT - Update quotation
export async function PUT(request: Request, context: RouteContext) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const { id } = await context.params;
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
            form_data, // NEW: full form state for round-trip editing
        } = body;

        // Recalculate GST and totals
        const effectiveGstRate = gst_rate || gstConfig.compositeRate;
        const baseAmount = base_price || 0;
        const gst_amount = +(baseAmount * (effectiveGstRate / 100)).toFixed(2);
        const total_amount = +(baseAmount + gst_amount).toFixed(2);

        // Calculate savings data
        const savings = calculateSavings(
            capacity_kw || 0,
            total_amount,
            central_subsidy,
            state_subsidy
        );

        const supabase = getServerSupabase();

        // Build update object — only include fields that are provided
        const updateData: any = {
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
        };

        // Only update pdf_url if provided
        if (pdf_url !== undefined) {
            updateData.pdf_url = pdf_url;
        }

        // Store form_data if provided
        if (form_data !== undefined) {
            updateData.form_data = form_data;
        }

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
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const { id } = await context.params;
        const supabase = getServerSupabase();

        const { error } = await supabase
            .from('quotations')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
