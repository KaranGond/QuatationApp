import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/authGuard';

// GET - List all products (optionally filter by system_type)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const systemTypeId = searchParams.get('system_type_id');
        const activeOnly = searchParams.get('active') !== 'false';

        const supabase = getServerSupabase();
        let query = supabase
            .from('products')
            .select('*, system_types(name)')
            .order('capacity_kw', { ascending: true });

        if (systemTypeId) {
            query = query.eq('system_type_id', systemTypeId);
        }

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message, data: [] }, { status: 500 });
    }
}

// POST - Create new product
export async function POST(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { system_type_id, name, brand, capacity_kw, phase, base_price, gst_rate } = body;

        if (!name || !base_price) {
            return NextResponse.json({ success: false, message: 'Name and base_price are required' }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('products')
            .insert([{
                system_type_id,
                name,
                brand: brand || null,
                capacity_kw: capacity_kw || null,
                phase: phase || 1,
                base_price,
                gst_rate: gst_rate || 8.9,
                is_active: true,
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
