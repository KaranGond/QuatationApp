import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getUserSession, unauthorizedResponse, forbiddenResponse } from '@/lib/authGuard';

type RouteContext = { params: Promise<{ id: string }> };

// GET - Get single product
export async function GET(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const supabase = getServerSupabase();

        const { data, error } = await supabase
            .from('products')
            .select('*, system_types(name)')
            .eq('id', id)
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// PUT - Update product (super_admin only)
export async function PUT(request: Request, context: RouteContext) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();
        if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can update products');

        const { id } = await context.params;
        const body = await request.json();
        const { system_type_id, name, brand, capacity_kw, phase, base_price, gst_rate, is_active } = body;

        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('products')
            .update({
                system_type_id,
                name,
                brand,
                capacity_kw,
                phase,
                base_price,
                gst_rate,
                is_active,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// DELETE - Delete product (super_admin only)
export async function DELETE(request: Request, context: RouteContext) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();
        if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can delete products');

        const { id } = await context.params;
        const supabase = getServerSupabase();

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
