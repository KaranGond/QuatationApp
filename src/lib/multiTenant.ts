import { getServerSupabase } from './supabase';

const CITY_CODES: Record<string, string> = {
    varanasi: 'VNS',
    kashi: 'VNS',
    banaras: 'VNS',
    lucknow: 'LKO',
    delhi: 'DEL',
    noida: 'NOI',
    gurgaon: 'GGN',
    gurugram: 'GGN',
    kanpur: 'KNP',
    prayagraj: 'PRG',
    allahabad: 'PRG',
    gorakhpur: 'GKP',
    patna: 'PAT',
    ranchi: 'RNC',
    jaipur: 'JPR',
    mumbai: 'BOM',
    pune: 'PUN',
    kolkata: 'CCU',
    bangalore: 'BLR',
    bengaluru: 'BLR',
    hyderabad: 'HYD',
    chennai: 'MAA',
    ahmedabad: 'AMD',
    surat: 'SRT',
    indore: 'IDR',
    bhopal: 'BPL',
    agra: 'AGR',
    meerut: 'MRT',
    ayodhya: 'AYD',
};

/**
 * Generate a unique 2-4 letter quote prefix from company name
 * e.g. "Karan Solar Shop" -> "KSS", "Tata Solar Power" -> "TSP", "Sun Energy" -> "SNE"
 */
export function generateQuotePrefix(companyName: string): string {
    if (!companyName) return 'QT';
    const clean = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);

    if (words.length >= 3) {
        return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else if (words.length === 2) {
        return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
        return clean.slice(0, 3).toUpperCase();
    }
    return 'QT';
}

/**
 * Auto-generate a unique Node ID / Tenant Identifier
 * e.g. NODE-VNS-001, NODE-LKO-002, NODE-DEL-001
 */
export async function generateNodeId(companyName: string, location?: string): Promise<string> {
    const supabase = getServerSupabase();

    // 1. Determine region code
    let regionCode = '';
    const locText = (location || '').toLowerCase();
    for (const [city, code] of Object.entries(CITY_CODES)) {
        if (locText.includes(city)) {
            regionCode = code;
            break;
        }
    }

    if (!regionCode) {
        // Derive from company name initials or consonants
        const clean = companyName.replace(/[^a-zA-Z]/g, '').toUpperCase();
        regionCode = clean.slice(0, 3) || 'NOD';
    }

    const prefix = `NODE-${regionCode}`;

    // 2. Query database for existing node_ids matching this prefix to find highest sequence
    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('node_id')
            .like('node_id', `${prefix}-%`);

        let maxSeq = 0;
        if (!error && data && data.length > 0) {
            for (const row of data) {
                if (row.node_id) {
                    const parts = row.node_id.split('-');
                    const num = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(num) && num > maxSeq) {
                        maxSeq = num;
                    }
                }
            }
        }

        const nextSeq = String(maxSeq + 1).padStart(3, '0');
        return `${prefix}-${nextSeq}`;
    } catch {
        return `${prefix}-001`;
    }
}

/**
 * Atomically generates the next sequential quotation number for a tenant
 * Format: {PREFIX}-{YEAR}-{SEQUENCE:04d} (e.g. KSS-2026-0001, SUN-2026-0002)
 */
export async function getNextTenantQuoteNumber(tenantId: string): Promise<string> {
    const supabase = getServerSupabase();
    const currentYear = new Date().getFullYear();

    // 1. Primary: Use atomic Supabase RPC function (runs in Postgres transaction)
    try {
        const { data, error } = await supabase.rpc('get_next_quote_number', { p_tenant_id: tenantId });
        if (!error && data) {
            return data as string;
        }
        if (error) {
            console.warn('Supabase RPC get_next_quote_number error, falling back:', error.message);
        }
    } catch (rpcErr) {
        console.warn('Supabase RPC exception:', rpcErr);
    }

    // 2. Direct Postgres fallback if databaseUrl is configured
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        try {
            // @ts-expect-error - pg is optional at runtime
            const { Client } = await import('pg');
            const client = new Client({
                connectionString: databaseUrl,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 3000,
            });
            await client.connect();
            const res = await client.query('SELECT get_next_quote_number($1) as quote_number', [tenantId]);
            await client.end();
            if (res.rows[0]?.quote_number) {
                return res.rows[0].quote_number;
            }
        } catch (pgErr) {
            console.warn('Postgres connection fallback failed:', pgErr);
        }
    }

    // 3. Last-resort fallback: Fetch prefix and count existing quotations
    try {
        const { data: vendor } = await supabase
            .from('vendors')
            .select('quote_prefix')
            .eq('id', tenantId)
            .single();

        const prefix = vendor?.quote_prefix || 'QT';

        const { count } = await supabase
            .from('quotations')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);

        const nextSeq = String((count || 0) + 1).padStart(4, '0');
        return `${prefix}-${currentYear}-${nextSeq}`;
    } catch {
        const rnd = Math.floor(1000 + Math.random() * 9000);
        return `QT-${currentYear}-${rnd}`;
    }
}

/**
 * Get sandboxed tenant storage path for assets or quotations
 */
export function getTenantStoragePath(
    nodeId: string,
    type: 'logo' | 'stamp' | 'signature' | 'qr' | 'quotation',
    filename: string
): string {
    const cleanNodeId = (nodeId || 'demo-node').replace(/[^a-zA-Z0-9_-]/g, '');
    if (type === 'quotation') {
        return `tenants/${cleanNodeId}/quotations/${filename}`;
    }
    return `tenants/${cleanNodeId}/branding/${type}-${filename}`;
}
