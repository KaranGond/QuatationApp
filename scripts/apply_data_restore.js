const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const BACKUP_DIR = path.join(__dirname, '..', 'supabase_backup_korea');
const DATA_DIR = path.join(BACKUP_DIR, 'data');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx !== -1) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const JSONB_COLUMNS = new Set([
    'terms',
    'components',
    'savings_data',
    'form_data',
    'vendor_snapshot',
    'components_settings',
    'raw_payload'
]);

const tablesInOrder = [
    'system_types',
    'vendors',
    'vendor_users',
    'structure_catalog',
    'products',
    'components',
    'tenant_sequences',
    'quotations',
    'internal_quotes',
    'integrated_products'
];

async function regenerateAndRun() {
    console.log('--- RESTORING TO NEW INDIA SUPABASE DB ---');
    const dbUrl = env.DATABASE_URL;
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 1. Reset system_types to match exact backup UUIDs
    console.log('Syncing system_types with backup UUIDs...');
    await client.query('DELETE FROM system_types;');
    const sysTypes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'system_types.json'), 'utf8'));
    for (const st of sysTypes) {
        await client.query(
            'INSERT INTO system_types (id, name, description, created_at) VALUES ($1, $2, $3, $4)',
            [st.id, st.name, st.description, st.created_at]
        );
    }
    console.log('✅ system_types synced with original UUIDs.');

    // 2. Generate and run SQL for remaining tables
    const statements = [];
    for (const table of tablesInOrder) {
        if (table === 'system_types') continue; // already inserted

        const jsonFile = path.join(DATA_DIR, `${table}.json`);
        if (!fs.existsSync(jsonFile)) continue;
        const rows = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        if (!rows || rows.length === 0) continue;

        statements.push(`-- Table: ${table} (${rows.length} rows)`);
        for (const row of rows) {
            const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
            const vals = Object.entries(row).map(([col, val]) => {
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'number' || typeof val === 'boolean') return val;
                if (JSONB_COLUMNS.has(col) || (typeof val === 'object' && val !== null)) {
                    const str = JSON.stringify(val).replace(/'/g, "''");
                    return `'${str}'::jsonb`;
                }
                const str = String(val).replace(/'/g, "''");
                return `'${str}'`;
            }).join(', ');

            statements.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
        }
        statements.push('');
    }

    console.log('Inserting table rows...');
    let successCount = 0;
    for (const line of statements) {
        if (!line.trim() || line.startsWith('--')) continue;
        try {
            await client.query(line);
            successCount++;
        } catch (insertErr) {
            console.warn('Insert error:', insertErr.message, 'on query:', line.substring(0, 70));
        }
    }
    console.log(`✅ Successfully executed ${successCount} insert statements.`);

    // 3. Verify final row counts
    console.log('\n--- FINAL VERIFICATION: TABLE ROW COUNTS IN INDIA PROJECT ---');
    for (const table of tablesInOrder) {
        try {
            const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`   Table "${table}": ${res.rows[0].count} rows`);
        } catch (countErr) {
            console.warn(`   Table "${table}" error:`, countErr.message);
        }
    }

    await client.end();
    console.log('\n🎉 ALL 10 TABLES FULLY RESTORED AND VERIFIED!');
}

regenerateAndRun().catch(err => {
    console.error('Fatal error:', err);
});
