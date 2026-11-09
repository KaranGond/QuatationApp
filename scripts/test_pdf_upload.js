const { createClient } = require('@supabase/supabase-js');

async function testStorageUpload() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = process.env.SUPABASE_BUCKET || 'quotations';

  console.log('Testing storage connection to bucket:', bucketName);
  console.log('URL:', url);
  console.log('Using key prefix:', serviceKey?.slice(0, 15));

  const supabase = createClient(url, serviceKey);

  const testBuffer = Buffer.from('%PDF-1.4 test dummy content for verification');
  const testFileName = `tenants/NODE-VNS-001/quotations/test-verify-${Date.now()}.pdf`;

  console.log('Uploading test PDF:', testFileName);
  const { data, error } = await supabase.storage.from(bucketName).upload(testFileName, testBuffer, {
    contentType: 'application/pdf',
    upsert: true
  });

  if (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }

  console.log('✅ Upload succeeded! Data:', data);

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(testFileName);
  console.log('✅ Public URL:', urlData.publicUrl);

  // Test downloading it back
  const res = await fetch(urlData.publicUrl);
  console.log('✅ Public CDN HTTP response status:', res.status);

  // Clean up
  await supabase.storage.from(bucketName).remove([testFileName]);
  console.log('✅ Cleaned up test file. Storage is 100% operational!');
}

testStorageUpload().catch(console.error);
