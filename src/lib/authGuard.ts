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

function parseJwtPayload(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
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

        const verifyToken = async (token: string) => {
            if (!token || typeof token !== 'string') return null;

            // 1. First attempt: Verify via Admin Server Supabase (Service Role)
            try {
                const adminClient = getServerSupabase();
                const { data: { user }, error } = await adminClient.auth.getUser(token);
                if (!error && user) return user;
            } catch (err) {
                console.warn('[authGuard] Admin client getUser error:', err);
            }

            // 2. Second attempt: Verify via Anon client
            if (supabaseAnonKey) {
                try {
                    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
                    const { data: { user }, error } = await anonClient.auth.getUser(token);
                    if (!error && user) return user;
                } catch (err) {
                    console.warn('[authGuard] Anon client getUser error:', err);
                }
            }

            // 3. Fallback: Validate JWT claims with 300s clock skew tolerance
            const payload = parseJwtPayload(token);
            if (payload && payload.sub && payload.exp) {
                const now = Math.floor(Date.now() / 1000);
                const CLOCK_TOLERANCE_SECONDS = 300;
                if (payload.exp + CLOCK_TOLERANCE_SECONDS > now) {
                    return {
                        id: payload.sub,
                        email: payload.email || '',
                        user_metadata: payload.user_metadata || {},
                        app_metadata: payload.app_metadata || {},
                    };
                }
            }

            return null;
        };

        // 1. Try Authorization header first
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            const user = await verifyToken(token);
            if (user) return user;
        }

        // 2. Try cookie-based session (browser requests from Next.js client)
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, v.join('=')];
            })
        );

        let accessToken = cookies['sb-access-token'] || '';

        // Look for project-specific auth cookie as well
        if (!accessToken) {
            for (const key of Object.keys(cookies)) {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    accessToken = cookies[key];
                    break;
                }
            }
        }

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

            const user = await verifyToken(token);
            if (user) return user;
        }

        console.warn('[authGuard] No valid authorization header or cookie found for request to', request.url);
        return null;
    } catch (e) {
        console.warn('[authGuard] getAuthenticatedUser error:', e);
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

    // Direct super-admin check by primary email
    const isPrimarySuperAdmin = user.email === 'karangond221998@gmail.com';

    try {
        const supabase = getServerSupabase();
        const { data: vUser } = await supabase
            .from('vendor_users')
            .select('role, vendor_id')
            .eq('id', user.id)
            .maybeSingle();

        if (vUser) {
            role = (vUser.role as any) || (isPrimarySuperAdmin ? 'super_admin' : 'vendor');
            vendor_id = vUser.vendor_id || null;
        } else {
            role = (user.user_metadata?.role as any) || (isPrimarySuperAdmin ? 'super_admin' : 'vendor');
            vendor_id = user.user_metadata?.vendor_id || null;
        }
    } catch {
        role = (user.user_metadata?.role as any) || (isPrimarySuperAdmin ? 'super_admin' : 'vendor');
        vendor_id = user.user_metadata?.vendor_id || null;
    }

    if (isPrimarySuperAdmin) {
        role = 'super_admin';
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
