import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { defaultComponents } from '@/lib/companyDetails';
import { getAuthenticatedUser } from '@/lib/authGuard';

// GET - List all components (optionally filter by system_type)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const systemTypeId = searchParams.get('system_type_id');
        const systemTypeName = searchParams.get('system_type');

        const supabase = getServerSupabase();
        let query = supabase
            .from('components')
            .select('*, system_types!inner(name)')
            .order('sort_order', { ascending: true });

        if (systemTypeId) {
            query = query.eq('system_type_id', systemTypeId);
        } else if (systemTypeName) {
            query = query.eq('system_types.name', systemTypeName);
        }

        const { data, error } = await query;

        if (error) {
            // If table doesn't exist, return defaults based on system type name
            if (systemTypeName && defaultComponents[systemTypeName as keyof typeof defaultComponents]) {
                return NextResponse.json({
                    success: true,
                    data: defaultComponents[systemTypeName as keyof typeof defaultComponents],
                    fromDefaults: true
                });
            }
            throw error;
        }

        // If no data from DB but system type name provided, use defaults
        if ((!data || data.length === 0) && systemTypeName) {
            const defaults = defaultComponents[systemTypeName as keyof typeof defaultComponents];
            if (defaults) {
                return NextResponse.json({ success: true, data: defaults, fromDefaults: true });
            }
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message, data: [] }, { status: 500 });
    }
}

// POST - Create new component
export async function POST(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { system_type_id, name, description, default_quantity, default_make, sort_order, is_default } = body;

        if (!name) {
            return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('components')
            .insert([{
                system_type_id,
                name,
                description: description || null,
                default_quantity: default_quantity || '1 NOS',
                default_make: default_make || 'Standard',
                sort_order: sort_order || 0,
                is_default: is_default ?? true,
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}

// PUT - Update component
export async function PUT(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, description, default_quantity, default_make, sort_order, is_default } = body;

        if (!id) {
            return NextResponse.json({ success: false, message: 'Component ID is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('components')
            .update({
                name,
                description,
                default_quantity,
                default_make,
                sort_order,
                is_default,
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

// DELETE - Delete component
export async function DELETE(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, message: 'Component ID is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { error } = await supabase
            .from('components')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
