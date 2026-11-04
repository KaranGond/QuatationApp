import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { gstConfig, calculateSavings, getSubsidyForCapacity } from '@/lib/companyDetails';
import { getNextTenantQuoteNumber } from '@/lib/multiTenant';
import { getAuthenticatedUser } from '@/lib/authGuard';

// GET - List quotations with multi-tenant filtering
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        let vendorId = searchParams.get('vendor_id');

        const authUser = await getAuthenticatedUser(request);
        const supabase = getServerSupabase();

        // If authenticated as a vendor or salesperson, enforce their tenant_id
        if (authUser) {
            const { data: vUser } = await supabase
                .from('vendor_users')
                .select('vendor_id, role')
                .eq('id', authUser.id)
                .single();

            if (vUser && vUser.role !== 'super_admin' && vUser.vendor_id) {
                vendorId = vUser.vendor_id; // Restrict strictly to tenant
            }
        }

        let query = supabase
            .from('quotations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        if (vendorId) {
            query = query.or(`vendor_id.eq.${vendorId},tenant_id.eq.${vendorId}`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message, data: [] }, { status: 500 });
    }
}

// POST - Create new quotation with atomic tenant sequence number
export async function POST(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const {
            vendor_id,
            customer_name,
            customer_phone,
            customer_address,
            customer_email,
            system_type_id,
            system_type_name,
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
            pdf_url,
            pdf_storage_path,
            status,
            form_data,
        } = body;

        if (!customer_name) {
            return NextResponse.json({ success: false, message: 'Customer name is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // Resolve vendor details and node_id
        const targetVendorId = vendor_id || 'a0000000-0000-0000-0000-000000000001';
        let vendorNodeId = 'NODE-VNS-001';
        let vendorSnapshot: any = null;

        const { data: vendorData } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', targetVendorId)
            .single();

        if (vendorData) {
            vendorNodeId = vendorData.node_id || 'NODE-VNS-001';
            vendorSnapshot = {
                name: vendorData.name,
                node_id: vendorData.node_id,
                tagline: vendorData.tagline,
                phone: vendorData.phone,
                email: vendorData.email,
                head_office: vendorData.head_office,
                registered_office: vendorData.registered_office,
                gstin: vendorData.gstin,
                bank_name: vendorData.bank_name,
                bank_branch: vendorData.bank_branch,
                account_name: vendorData.account_name,
                account_number: vendorData.account_number,
                ifsc: vendorData.ifsc,
                upi_id: vendorData.upi_id,
                logo_url: vendorData.logo_url,
                stamp_url: vendorData.stamp_url,
                signature_url: vendorData.signature_url,
                qr_code_url: vendorData.qr_code_url,
                authorized_signatory: vendorData.authorized_signatory,
            };
        }

        // Generate isolated, atomic quotation sequence number for this tenant
        const quote_number = await getNextTenantQuoteNumber(targetVendorId);

        // Calculate GST and totals
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

        // Resolve system_type_id if not provided but name is available
        let effectiveSystemTypeId = system_type_id;
        if (!effectiveSystemTypeId && system_type_name) {
            const { data: typeData } = await supabase
                .from('system_types')
                .select('id')
                .eq('name', system_type_name)
                .single();

            if (typeData) {
                effectiveSystemTypeId = typeData.id;
            }
        }

        const { data, error } = await supabase
            .from('quotations')
            .insert([{
                tenant_id: targetVendorId,
                vendor_id: targetVendorId,
                node_id: vendorNodeId,
                quote_number,
                customer_name,
                customer_phone: customer_phone || null,
                customer_address: customer_address || null,
                customer_email: customer_email || null,
                system_type_id: effectiveSystemTypeId || null,
                capacity_kw: capacity_kw || null,
                phase: phase || 1,
                brand: brand || null,
                base_price: baseAmount,
                gst_rate: effectiveGstRate,
                gst_amount,
                total_amount,
                central_subsidy: central_subsidy !== undefined ? Number(central_subsidy) : (capacity_kw ? getSubsidyForCapacity(capacity_kw).central : 0),
                state_subsidy: state_subsidy !== undefined ? Number(state_subsidy) : (capacity_kw ? getSubsidyForCapacity(capacity_kw).state : 0),
                terms: terms || null,
                components: components || null,
                savings_data: savings,
                salesperson: salesperson || null,
                status: status || 'draft',
                pdf_url: pdf_url || null,
                pdf_storage_path: pdf_storage_path || null,
                vendor_snapshot: vendorSnapshot,
                form_data: form_data || null,
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
