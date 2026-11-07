import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { defaultTerms } from '@/lib/companyDetails';
import { getUserSession, unauthorizedResponse, forbiddenResponse } from '@/lib/authGuard';

// GET - List all system types
export async function GET() {
    try {
        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('system_types')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch {
        // If table doesn't exist, return defaults
        const defaultTypes = [
            { id: 'on-grid', name: 'On-grid', description: 'Grid-tied solar systems connected to utility grid' },
            { id: 'off-grid', name: 'Off-grid', description: 'Standalone systems with battery storage' },
            { id: 'hybrid', name: 'Hybrid', description: 'Combined grid-tied and battery backup systems' },
            { id: 'vfd-drive', name: 'VFD/Drive', description: 'Solar pump drives and VFD systems' },
        ];
        return NextResponse.json({ success: true, data: defaultTypes, fromDefaults: true });
    }
}

// POST - Create new system type (super_admin only)
export async function POST(request: Request) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();
        if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can create system types');

        const body = await request.json();
        const { name, description } = body;

        if (!name) {
            return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('system_types')
            .insert([{
                name,
                description,
                default_terms: defaultTerms[name as keyof typeof defaultTerms] || [],
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as any).message }, { status: 500 });
    }
}
