const { Client } = require('pg');

async function applyStoragePolicies() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('Connected to PostgreSQL for storage policies...');

    // 1. Ensure buckets exist and are public
    await client.query(`
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES 
            ('quotations', 'quotations', true, 20971520, NULL),
            ('vendor-assets', 'vendor-assets', true, 10485760, NULL)
        ON CONFLICT (id) DO UPDATE SET public = true;
    `);
    console.log('Buckets updated to public: true');

    // 2. Drop any conflicting old policies if present
    await client.query(`
        DROP POLICY IF EXISTS "Public Read on Public Buckets" ON storage.objects;
        DROP POLICY IF EXISTS "Allow All Service Role on Storage" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated uploads to quotations" ON storage.objects;
        DROP POLICY IF EXISTS "Allow anon and auth read on quotations" ON storage.objects;
    `);

    // 3. Create SELECT policy for public buckets
    await client.query(`
        CREATE POLICY "Public Read on Public Buckets"
        ON storage.objects FOR SELECT
        USING (bucket_id IN ('quotations', 'vendor-assets'));
    `);
    console.log('Created Public Read policy on storage.objects');

    // 4. Create INSERT policy for authenticated & anon so server / clients never get blocked
    await client.query(`
        CREATE POLICY "Allow authenticated uploads to quotations"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id IN ('quotations', 'vendor-assets'));
    `);
    console.log('Created Insert policy for quotations and vendor-assets');

    await client.query(`
        CREATE POLICY "Allow updates to quotations"
        ON storage.objects FOR UPDATE
        USING (bucket_id IN ('quotations', 'vendor-assets'));
    `);
    console.log('Created Update policy for quotations and vendor-assets');

    // Verify
    const res = await client.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;`);
    console.log('Active policies on storage.objects:', res.rows);

    await client.end();
    console.log('Storage policies applied successfully!');
}

applyStoragePolicies().catch(err => {
    console.error('Error applying storage policies:', err);
    process.exit(1);
});
