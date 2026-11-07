import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from './supabase';

export interface UserSession {
    user: any;
    id: string;
    email: string;
    role: 'super_admin' | 'vendor' | 'salesperson';
    vendor_id: string | null;
    isSuperAdmin: boolean;
}

/**
 * Validates the caller's Supabase JWT from the Authorization header
 * or from the sb-access-token cookie. Returns the authenticated user
 * or null if unauthenticated.
 */
export async function getAuthenticatedUser(request: Request) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || '';

        // Create a client with the anon key (NOT service role) so we can
        // verify the user's JWT without elevating privileges.
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // 1. Try Authorization header first
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) return user;
        }

        // 2. Try cookie-based session (browser requests from Next.js client)
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, v.join('=')];
            })
        );

        const accessToken =
            cookies['sb-access-token'] ||
            cookies[`sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`] ||
            '';

        if (accessToken) {
            let token = accessToken;
            try {
                const parsed = JSON.parse(decodeURIComponent(accessToken));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    token = parsed[0];
                } else if (parsed.access_token) {
                    token = parsed.access_token;
                }
            } catch {
                // Raw token string
            }

            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) return user;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Retrieves full verified user session including validated role and tenant vendor_id.
 */
export async function getUserSession(request: Request): Promise<UserSession | null> {
    const user = await getAuthenticatedUser(request);
    if (!user) return null;

    let role: 'super_admin' | 'vendor' | 'salesperson' = 'vendor';
    let vendor_id: string | null = null;

    try {
        const supabase = getServerSupabase();
        const { data: vUser } = await supabase
            .from('vendor_users')
            .select('role, vendor_id')
            .eq('id', user.id)
            .maybeSingle();

        if (vUser) {
            role = (vUser.role as any) || 'vendor';
            vendor_id = vUser.vendor_id || null;
        } else {
            role = (user.user_metadata?.role as any) || 'vendor';
            vendor_id = user.user_metadata?.vendor_id || null;
        }
    } catch {
        role = (user.user_metadata?.role as any) || 'vendor';
        vendor_id = user.user_metadata?.vendor_id || null;
    }

    return {
        user,
        id: user.id,
        email: user.email || '',
        role,
        vendor_id,
        isSuperAdmin: role === 'super_admin',
    };
}

/**
 * Returns a 401 JSON response for unauthenticated requests.
 */
export function unauthorizedResponse(message = 'Authentication required') {
    return NextResponse.json(
        { success: false, message },
        { status: 401 }
    );
}

/**
 * Returns a 403 JSON response for unauthorized requests.
 */
export function forbiddenResponse(message = 'Access denied: insufficient permissions') {
    return NextResponse.json(
        { success: false, message },
        { status: 403 }
    );
}
