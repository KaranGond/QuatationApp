const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx !== -1) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
const DATABASE_URL = env.DATABASE_URL;

const BACKUP_DIR = path.join(__dirname, '..', 'supabase_backup_korea');
const DATA_DIR = path.join(BACKUP_DIR, 'data');
const STORAGE_DIR = path.join(BACKUP_DIR, 'storage');

console.log('==================================================');
console.log('🔄 SUPABASE RESTORE TOOL (India Region Migration)');
console.log('Target Supabase URL:', SUPABASE_URL);
console.log('==================================================\n');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function restore() {
    // 1. Restore Auth Users
    console.log('--- STEP 1: RESTORING AUTH USERS ---');
    const authUsersFile = path.join(BACKUP_DIR, 'auth_users.json');
    if (fs.existsSync(authUsersFile)) {
        const users = JSON.parse(fs.readFileSync(authUsersFile, 'utf8'));
        console.log(`Found ${users.length} users to restore...`);
        for (const u of users) {
            try {
                // Restore user with exact same UUID and metadata
                const defaultPass = u.email === 'admin@karansolar.com' ? 'AdminPassword@123' : 'VendorPassword@123';
                const { data, error } = await supabase.auth.admin.createUser({
                    id: u.id,
                    email: u.email,
                    password: defaultPass,
                    email_confirm: true,
                    user_metadata: u.user_metadata || {},
                });
                if (error) {
                    if (error.message.includes('already exists')) {
                        console.log(`   ℹ️ User ${u.email} already exists`);
                    } else {
                        console.warn(`   ⚠️ User ${u.email} warning:`, error.message);
                    }
                } else {
                    console.log(`   ✅ Restored user: ${u.email} (id: ${u.id})`);
                }
            } catch (userErr) {
                console.warn(`   ⚠️ User ${u.email} exception:`, userErr.message);
            }
        }
    }

    // 2. Ensure Storage Buckets exist & upload files
    console.log('\n--- STEP 2: RESTORING STORAGE ASSETS ---');
    const bucketsFile = path.join(BACKUP_DIR, 'storage_buckets.json');
    if (fs.existsSync(bucketsFile)) {
        const buckets = JSON.parse(fs.readFileSync(bucketsFile, 'utf8'));
        for (const b of buckets) {
            try {
                await supabase.storage.createBucket(b.name, { public: true });
                console.log(`   ✅ Bucket "${b.name}" created or verified.`);
            } catch {
                // already exists
            }
        }
    }

    // Upload stored files
    if (fs.existsSync(STORAGE_DIR)) {
        function getFiles(dir, baseDir = '') {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const relPath = baseDir ? `${baseDir}/${file}` : file;
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(getFiles(fullPath, relPath));
                } else {
                    results.push({ fullPath, relPath });
                }
            });
            return results;
        }

        const bucketNames = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isDirectory());
        for (const bName of bucketNames) {
            const bDir = path.join(STORAGE_DIR, bName);
            const files = getFiles(bDir);
            for (const f of files) {
                try {
                    const fileContent = fs.readFileSync(f.fullPath);
                    const ext = path.extname(f.relPath).toLowerCase();
                    const mime = ext === '.png' ? 'image/png' : (ext === '.jpeg' || ext === '.jpg') ? 'image/jpeg' : 'application/octet-stream';
                    await supabase.storage.from(bName).upload(f.relPath, fileContent, {
                        contentType: mime,
                        upsert: true,
                    });
                    console.log(`   ⬆️ Uploaded asset: ${bName}/${f.relPath}`);
                } catch (upErr) {
                    console.warn(`   ⚠️ Upload warning for ${f.relPath}:`, upErr.message);
                }
            }
        }
    }

    // 3. Database Data Restore
    console.log('\n--- STEP 3: RESTORING DATABASE TABLES ---');
    if (DATABASE_URL) {
        try {
            console.log('Connecting via PostgreSQL to run restore_data.sql...');
            const pgClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
            await pgClient.connect();

            // Run schema first if present
            const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'supabase_schema.sql'), 'utf8');
            console.log('Applying schema (tables, functions, sequences)...');
            await pgClient.query(schemaSql);
            console.log('✅ Schema applied successfully!');

            // Run restore data SQL
            const restoreSql = fs.readFileSync(path.join(BACKUP_DIR, 'restore_data.sql'), 'utf8');
            console.log('Inserting restored rows...');
            await pgClient.query(restoreSql);
            console.log('✅ All table rows inserted successfully!');

            await pgClient.end();
        } catch (pgErr) {
            console.error('PostgreSQL restore error:', pgErr.message);
            console.log('➡️ You can manually run supabase_schema.sql and supabase_backup_korea/restore_data.sql in the Supabase SQL Editor.');
        }
    } else {
        console.log('➡️ DATABASE_URL not set. Please run supabase_schema.sql and supabase_backup_korea/restore_data.sql in Supabase SQL Editor.');
    }

    console.log('\n🎉 RESTORATION COMPLETED!');
}

restore().catch(err => {
    console.error('Fatal restore error:', err);
});

