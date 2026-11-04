import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/authGuard';

// POST - Batch save components for a system type
// Deletes existing components for the system type and inserts new ones
export async function POST(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { system_type, system_type_id, components } = body;

        if (!system_type || !components || !Array.isArray(components)) {
            return NextResponse.json(
                { success: false, message: 'system_type and components array are required' },
                { status: 400 }
            );
        }

        const supabase = getServerSupabase();

        // Resolve system_type_id if not provided
        let effectiveSystemTypeId = system_type_id;
        if (!effectiveSystemTypeId) {
            const { data: typeData } = await supabase
                .from('system_types')
                .select('id')
                .eq('name', system_type)
                .single();
            if (typeData) {
                effectiveSystemTypeId = typeData.id;
            }
        }

        if (!effectiveSystemTypeId) {
            return NextResponse.json(
                { success: false, message: `System type "${system_type}" not found in database` },
                { status: 404 }
            );
        }

        // Delete existing components for this system type
        const { error: deleteError } = await supabase
            .from('components')
            .delete()
            .eq('system_type_id', effectiveSystemTypeId);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            // If table doesn't exist, that's ok - we'll create records
            if (!deleteError.message.includes('does not exist')) {
                throw deleteError;
            }
        }

        // Insert new components
        const insertData = components.map((c: any, i: number) => ({
            system_type_id: effectiveSystemTypeId,
            name: c.name,
            description: c.description || null,
            default_quantity: c.default_quantity || '1 Nos',
            default_make: c.default_make || 'Standard',
            sort_order: c.sort_order ?? i,
            is_default: c.is_default ?? true,
        }));

        const { data, error: insertError } = await supabase
            .from('components')
            .insert(insertData)
            .select();

        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            data,
            message: `${data?.length || 0} components saved for ${system_type}`,
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: (error as any).message },
            { status: 500 }
        );
    }
}
