const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 1).trim();
        env[key] = val;
    }
});

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
const DATABASE_URL = env.DATABASE_URL;

console.log('--- SUPABASE BACKUP TOOL ---');
console.log('Project URL:', SUPABASE_URL);

const BACKUP_DIR = path.join(__dirname, '..', 'supabase_backup_korea');
const DATA_DIR = path.join(BACKUP_DIR, 'data');
const STORAGE_DIR = path.join(BACKUP_DIR, 'storage');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// 1. Backup .env.local
fs.copyFileSync(envPath, path.join(BACKUP_DIR, 'env.local.korea'));
console.log('✅ Backed up .env.local');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function runBackup() {
    // 2. Backup Auth Users
    console.log('\n--- 1. BACKING UP AUTH USERS ---');
    try {
        const { data: usersData, error: userError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (userError) {
            console.error('Error listing auth users:', userError.message);
        } else {
            const users = usersData?.users || [];
            fs.writeFileSync(path.join(BACKUP_DIR, 'auth_users.json'), JSON.stringify(users, null, 2));
            console.log(`✅ Saved ${users.length} auth user(s) to auth_users.json`);
            users.forEach(u => console.log(`   - [${u.id}] ${u.email} (Role: ${u.user_metadata?.role || 'default'})`));
        }
    } catch (err) {
        console.warn('Auth users backup warning:', err.message);
    }

    // 3. Backup Tables via Postgres and/or Supabase Client
    console.log('\n--- 2. BACKING UP DATABASE TABLES ---');
    let tableNames = [
        'vendors',
        'vendor_users',
        'system_types',
        'quotations',
        'components',
        'products',
        'structure_catalog',
        'internal_quotes',
        'integrated_products',
        'tenant_sequences'
    ];

    let pgClient = null;
    let fullSchemaDump = '';

    if (DATABASE_URL) {
        try {
            console.log('Connecting via PostgreSQL client for complete table discovery & schema dump...');
            pgClient = new Client({
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await pgClient.connect();
            console.log('✅ Connected to Postgres database directly!');

            // Find all tables in public schema
            const res = await pgClient.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            `);
            const dbTables = res.rows.map(r => r.table_name);
            console.log('Tables found in database:', dbTables.join(', '));
            tableNames = Array.from(new Set([...tableNames, ...dbTables]));

            // Dump DDL for functions and triggers if any
            const funcRes = await pgClient.query(`
                SELECT routine_name, routine_definition 
                FROM information_schema.routines 
                WHERE routine_schema = 'public';
            `);
            fs.writeFileSync(path.join(BACKUP_DIR, 'pg_routines.json'), JSON.stringify(funcRes.rows, null, 2));

        } catch (pgErr) {
            console.warn('Direct PG connection notice:', pgErr.message, '- falling back to Supabase REST client.');
        }
    }

    // Dump each table's data
    const tableDataMap = {};
    const sqlInsertStatements = [];

    for (const table of tableNames) {
        try {
            let rows = [];
            if (pgClient) {
                const res = await pgClient.query(`SELECT * FROM "${table}"`);
                rows = res.rows;
            } else {
                const { data, error } = await supabase.from(table).select('*');
                if (error) {
                    console.warn(`Could not read ${table}: ${error.message}`);
                    continue;
                }
                rows = data || [];
            }

            tableDataMap[table] = rows;
            fs.writeFileSync(path.join(DATA_DIR, `${table}.json`), JSON.stringify(rows, null, 2));
            console.log(`✅ Table "${table}": ${rows.length} rows saved to data/${table}.json`);

            // Generate SQL Inserts
            if (rows.length > 0) {
                sqlInsertStatements.push(`-- Table: ${table} (${rows.length} rows)`);
                for (const row of rows) {
                    const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
                    const vals = Object.values(row).map(val => {
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'number' || typeof val === 'boolean') return val;
                        if (typeof val === 'object') {
                            const str = JSON.stringify(val).replace(/'/g, "''");
                            return `'${str}'::jsonb`;
                        }
                        const str = String(val).replace(/'/g, "''");
                        return `'${str}'`;
                    }).join(', ');
                    sqlInsertStatements.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
                }
                sqlInsertStatements.push('');
            }
        } catch (err) {
            console.warn(`Error dumping table ${table}:`, err.message);
        }
    }

    if (pgClient) {
        await pgClient.end();
    }

    fs.writeFileSync(path.join(BACKUP_DIR, 'restore_data.sql'), sqlInsertStatements.join('\n'));
    console.log(`✅ Generated restore_data.sql with all row insert statements!`);

    // 4. Backup Storage Buckets & Files
    console.log('\n--- 3. BACKING UP SUPABASE STORAGE ---');
    try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
            console.error('Error listing storage buckets:', bucketError.message);
        } else {
            console.log('Buckets found:', buckets.map(b => b.name).join(', ') || 'None');
            fs.writeFileSync(path.join(BACKUP_DIR, 'storage_buckets.json'), JSON.stringify(buckets, null, 2));

            for (const bucket of buckets) {
                console.log(`Scanning bucket "${bucket.name}"...`);
                const bucketFolder = path.join(STORAGE_DIR, bucket.name);
                fs.mkdirSync(bucketFolder, { recursive: true });

                // Recursive file lister
                async function downloadFolder(prefix = '') {
                    const { data: items, error } = await supabase.storage.from(bucket.name).list(prefix, { limit: 1000 });
                    if (error || !items) return;

                    for (const item of items) {
                        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
                        if (item.id === null) {
                            // Subdirectory/folder
                            await downloadFolder(itemPath);
                        } else {
                            // File
                            try {
                                const { data: fileBlob, error: dlError } = await supabase.storage.from(bucket.name).download(itemPath);
                                if (fileBlob && !dlError) {
                                    const arrayBuffer = await fileBlob.arrayBuffer();
                                    const buffer = Buffer.from(arrayBuffer);
                                    const localPath = path.join(bucketFolder, itemPath);
                                    fs.mkdirSync(path.dirname(localPath), { recursive: true });
                                    fs.writeFileSync(localPath, buffer);
                                    console.log(`   ⬇️ Downloaded: ${bucket.name}/${itemPath} (${buffer.length} bytes)`);
                                }
                            } catch (dlErr) {
                                console.warn(`   ⚠️ Failed to download ${itemPath}:`, dlErr.message);
                            }
                        }
                    }
                }

                await downloadFolder();
            }
        }
    } catch (err) {
        console.warn('Storage backup warning:', err.message);
    }

    // 5. Generate Comprehensive Migration Readme
    const summary = `# 📦 Supabase Project Backup (South Korea Project: pqgodmdvkvvmwamsqzli)

Created at: ${new Date().toISOString()}

## Backup Inventory
- **Environment**: \`env.local.korea\`
- **Auth Users**: \`auth_users.json\`
- **Database Tables (JSON)**: \`data/*.json\`
- **Database SQL Inserts**: \`restore_data.sql\`
- **Storage Files**: \`storage/\`
- **Schema Reference**: \`../supabase_schema.sql\`

## How to Restore to New India (Mumbai) Supabase Project:
1. Create new Supabase project in India (\`ap-south-1\` / Mumbai).
2. Go to **SQL Editor** in your new project.
3. Paste and run \`supabase_schema.sql\` to create tables, functions, and sequences.
4. Paste and run \`supabase_backup_korea/restore_data.sql\` to restore all vendors, quotes, and catalog items.
5. Create Storage buckets (\`quotations\`, \`vendor-assets\` as public).
6. Upload any files from \`supabase_backup_korea/storage/\` into the matching buckets.
7. Update \`.env.local\` with the new project URL, Anon Key, Service Role Key, and Database URL.
`;
    fs.writeFileSync(path.join(BACKUP_DIR, 'README.md'), summary);
    console.log('\n=========================================');
    console.log('🎉 SUPABASE BACKUP COMPLETED SUCCESSFULLY!');
    console.log(`All backup files saved to: ${BACKUP_DIR}`);
    console.log('=========================================');
}

runBackup().catch(err => {
    console.error('Fatal backup error:', err);
    process.exit(1);
});

