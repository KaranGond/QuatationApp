import { createClient } from '@supabase/supabase-js';

// Ensure Node defaults to IPv4 first to prevent 10s connection hangs on dual-stack networks
if (typeof window === 'undefined') {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const dns = require('dns');
        if (typeof dns?.setDefaultResultOrder === 'function') {
            dns.setDefaultResultOrder('ipv4first');
        }
    } catch {
        // Ignore if environment does not support node:dns
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Server-side client with service role key
export const getServerSupabase = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
    return createClient(url, key);
};

