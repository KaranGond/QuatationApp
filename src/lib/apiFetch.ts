import { supabase } from './supabase';

/**
 * Helper to sync the auth cookie with the latest access token
 */
function syncCookie(token: string | null) {
    if (typeof document === 'undefined') return;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    if (token) {
        document.cookie = `sb-access-token=${token}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
    } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
    }
}

/**
 * Retrieves a valid, unexpired Supabase access token.
 * Proactively refreshes the session if expired or close to expiring.
 */
async function getValidAccessToken(): Promise<string | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const now = Math.floor(Date.now() / 1000);

        // If session exists and has more than 60s of validity left, use it
        if (session?.access_token && session.expires_at && session.expires_at > now + 60) {
            return session.access_token;
        }

        // If session exists but is expired or near expiry, refresh it
        if (session) {
            const { data: refreshed, error } = await supabase.auth.refreshSession();
            if (!error && refreshed.session?.access_token) {
                syncCookie(refreshed.session.access_token);
                return refreshed.session.access_token;
            }
        }

        // Fallback: attempt a fresh session refresh using stored refresh token
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (!error && refreshed.session?.access_token) {
            syncCookie(refreshed.session.access_token);
            return refreshed.session.access_token;
        }

        return session?.access_token || null;
    } catch (err) {
        console.warn('[apiFetch] Could not resolve session:', err);
        return null;
    }
}

/**
 * Universal fetch wrapper that automatically attaches the Supabase session JWT
 * in the Authorization header for all API calls and auto-refreshes on 401s.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers || {});

    // Ensure cross-origin and cross-port cookies work
    const fetchInit: RequestInit = {
        credentials: 'include',
        ...init,
        headers,
    };

    // Attach Bearer token if not already provided
    if (!headers.has('Authorization')) {
        const token = await getValidAccessToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }

    let response = await fetch(input, fetchInit);

    // If server returned 401 Unauthorized, the token might have just expired on server.
    // Proactively refresh the session and retry the request once.
    if (response.status === 401) {
        try {
            const { data: refreshed, error } = await supabase.auth.refreshSession();
            if (!error && refreshed.session?.access_token) {
                syncCookie(refreshed.session.access_token);
                headers.set('Authorization', `Bearer ${refreshed.session.access_token}`);
                response = await fetch(input, fetchInit);
            }
        } catch {
            // Return original 401 response
        }
    }

    return response;
}
