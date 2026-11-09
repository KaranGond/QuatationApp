import { supabase } from './supabase';

/**
 * Helper to sync the auth cookie with the latest access token
 */
function syncCookie(token: string | null) {
    if (typeof document === 'undefined') return;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    if (token) {
        // Long-lived 1-year (365 days) persistent session cookie
        document.cookie = `sb-access-token=${token}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
    } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
    }
}

/**
 * Inspects localStorage for Supabase access tokens when memory session is pending or offline
 */
function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        // 1. Inspect all localStorage keys for Supabase auth payloads
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.access_token) return parsed.access_token;
                    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
                    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
                }
            }
        }

        // 2. Direct storage keys fallback
        const directKeys = ['sb-access-token', 'supabase.auth.token', 'supabase.auth.token_v2'];
        for (const k of directKeys) {
            const val = localStorage.getItem(k);
            if (val) {
                try {
                    const p = JSON.parse(val);
                    if (p?.access_token) return p.access_token;
                } catch {
                    if (val.startsWith('eyJ')) return val.trim();
                }
            }
        }

        // 3. Document cookie fallback
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
            if (match && match[1]) {
                const cToken = decodeURIComponent(match[1]).trim().replace(/^"|"$/g, '');
                if (cToken.startsWith('eyJ')) return cToken;
            }
        }
    } catch {
        // Ignore JSON or access error
    }
    return null;
}

/**
 * Retrieves a valid, unexpired Supabase access token.
 * Proactively refreshes the session if expired or close to expiring,
 * but resiliently preserves existing token or stored token if refresh cannot reach network.
 */
async function getValidAccessToken(): Promise<string | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const now = Math.floor(Date.now() / 1000);

        // If session exists and has validity, use it
        if (session?.access_token && session.expires_at && session.expires_at > now + 60) {
            syncCookie(session.access_token);
            return session.access_token;
        }

        // If session exists but is expired or near expiry, attempt refresh
        if (session) {
            try {
                const { data: refreshed, error } = await supabase.auth.refreshSession();
                if (!error && refreshed.session?.access_token) {
                    syncCookie(refreshed.session.access_token);
                    return refreshed.session.access_token;
                }
            } catch {
                // Ignore transient network errors during refresh
            }

            // Fallback: return existing session token rather than null
            if (session.access_token) {
                syncCookie(session.access_token);
                return session.access_token;
            }
        }

        const stored = getStoredToken();
        if (stored) {
            syncCookie(stored);
            return stored;
        }

        return null;
    } catch (err) {
        console.warn('[apiFetch] Could not resolve session:', err);
        const stored = getStoredToken();
        if (stored) syncCookie(stored);
        return stored;
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
