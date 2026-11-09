const { createClient } = require('@supabase/supabase-js');

async function testVendorsQuery() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const supabase = createClient(url, key);

  console.log('Testing vendors query with quotations relationship alias...');

  const { data, error } = await supabase
    .from('vendors')
    .select('*, quotations:quotations!quotations_vendor_id_fkey(count), vendor_users(id, email, role, full_name)')
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Vendors query failed:', error);
    process.exit(1);
  }

  console.log(`✅ Vendors query succeeded! Found ${data.length} vendors:`);
  for (const v of data) {
    console.log(`- ${v.name} (${v.node_id}): ${v.quotations?.[0]?.count || 0} quotations, ${v.vendor_users?.length || 0} users`);
  }
}

testVendorsQuery().catch(console.error);
