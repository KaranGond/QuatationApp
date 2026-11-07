/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = '/Users/ratneshmishra/.gemini/antigravity-ide/brain/a359c681-8d5d-48c5-807a-bfb812701de0';

const auditResults = {
  timestamp: new Date().toISOString(),
  pages: [],
  apis: [],
  printAudit: [],
  brandingAudit: [],
  summary: { passed: 0, failed: 0 }
};

async function auditAPI(endpoint, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE_URL + endpoint, opts);
    let json = null;
    try { json = await res.json(); } catch (e) {}
    
    const isSuccess = res.status >= 200 && res.status < 300;
    const result = {
      endpoint,
      method,
      status: res.status,
      success: isSuccess,
      dataCount: json ? (Array.isArray(json.data) ? json.data.length : (json.data ? 1 : (Array.isArray(json) ? json.length : 'ok'))) : null
    };
    auditResults.apis.push(result);
    if (isSuccess) auditResults.summary.passed++;
    else auditResults.summary.failed++;
    console.log(`[API] ${method} ${endpoint} -> ${res.status} (Passed: ${isSuccess})`);
    return result;
  } catch (err) {
    auditResults.apis.push({ endpoint, method, status: 'ERROR', error: err.message, success: false });
    auditResults.summary.failed++;
    console.error(`[API] ${method} ${endpoint} -> ERROR:`, err.message);
  }
}

(async () => {
  console.log('=== STARTING COMPLETE FULL-PROJECT AUDIT ===\n');

  // 1. AUDIT BACKEND APIS
  console.log('--- 1. Testing Backend APIs ---');
  await auditAPI('/api/quotations');
  await auditAPI('/api/structure-catalog');
  await auditAPI('/api/components');
  await auditAPI('/api/components?system_type=On-grid');
  await auditAPI('/api/components?system_type=Off-grid');
  await auditAPI('/api/components?system_type=Hybrid');
  await auditAPI('/api/components?system_type=VFD%2FDrive');
  await auditAPI('/api/system-types');
  await auditAPI('/api/products');
  await auditAPI('/api/integrated-products');
  await auditAPI('/favicon.ico');
  await auditAPI('/icon.png');

  // 2. AUDIT FRONTEND PAGES WITH CHROMIUM
  console.log('\n--- 2. Testing Frontend Pages & UI Rendering ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pagesToTest = [
    { name: 'Quotation Builder (Home)', path: '/', selector: '.print-page' },
    { name: 'Quotation Builder (B2B Structure)', path: '/?tab=b2b', selector: '.print-page' },
    { name: 'Service / O&M Proposal', path: '/service', selector: '.print-page' },
    { name: 'Product Catalog', path: '/catalog', selector: 'body' },
    { name: 'Admin Dashboard', path: '/admin', selector: 'body' },
    { name: 'Admin Quotations', path: '/admin/quotations', selector: 'table, body' },
    { name: 'Admin Structure Catalog', path: '/admin/structure-catalog', selector: 'table' },
    { name: 'Admin Components', path: '/admin/components', selector: 'body' },
    { name: 'Admin Products', path: '/admin/products', selector: 'body' },
    { name: 'Admin Integrated Products', path: '/admin/integrated-products', selector: 'body' },
  ];

  for (const p of pagesToTest) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    try {
      await page.setViewport({ width: 1440, height: 1000 });
      const response = await page.goto(BASE_URL + p.path, { waitUntil: 'networkidle0', timeout: 15000 });
      const status = response ? response.status() : 'NO_RESPONSE';
      
      let elementFound = false;
      if (p.selector) {
        elementFound = !!(await page.$(p.selector));
      }

      // Filter out benign browser warnings from console errors
      const criticalErrors = consoleErrors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('Doubletick') && 
        !e.includes('deprecated')
      );

      const isPass = status === 200 && criticalErrors.length === 0 && elementFound;
      auditResults.pages.push({
        name: p.name,
        path: p.path,
        status,
        elementFound,
        criticalErrors,
        success: isPass
      });

      if (isPass) auditResults.summary.passed++;
      else auditResults.summary.failed++;

      console.log(`[PAGE] ${p.name} (${p.path}) -> HTTP ${status} | Element Found: ${elementFound} | Errors: ${criticalErrors.length} (Passed: ${isPass})`);
    } catch (err) {
      auditResults.pages.push({ name: p.name, path: p.path, status: 'EXCEPTION', error: err.message, success: false });
      auditResults.summary.failed++;
      console.error(`[PAGE] ${p.name} failed:`, err.message);
    } finally {
      await page.close();
    }
  }

  // 3. AUDIT A4 SINGLE-PAGE PRINTS ACROSS SYSTEM TYPES
  console.log('\n--- 3. Auditing A4 Single-Page Print Layouts ---');
  const printPage = await browser.newPage();
  await printPage.setViewport({ width: 1440, height: 1100 });

  const systemsToTest = ['On-grid', 'Off-grid', 'Hybrid', 'VFD%2FDrive', 'ApolloB2B'];
  for (const sys of systemsToTest) {
    const url = sys === 'ApolloB2B' ? `${BASE_URL}/?tab=b2b` : `${BASE_URL}/?system=${sys}`;
    await printPage.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await printPage.emulateMediaType('print');
    const pdf = await printPage.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
    });
    await printPage.emulateMediaType('screen');

    // Count pages in PDF buffer
    const pageMatches = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g);
    const count = pageMatches ? pageMatches.length : 1;
    const isSinglePage = count === 1;

    auditResults.printAudit.push({
      system: decodeURIComponent(sys),
      pageCount: count,
      success: isSinglePage
    });

    if (isSinglePage) auditResults.summary.passed++;
    else auditResults.summary.failed++;

    console.log(`[PRINT] ${decodeURIComponent(sys)} -> ${count} Page(s) (Passed: ${isSinglePage})`);
  }

  // Also test Service proposal print
  await printPage.goto(`${BASE_URL}/service`, { waitUntil: 'networkidle0' });
  await printPage.emulateMediaType('print');
  const srvPdf = await printPage.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
  });
  const srvPageMatches = srvPdf.toString('latin1').match(/\/Type\s*\/Page\b/g);
  const srvCount = srvPageMatches ? srvPageMatches.length : 1;
  const isSrvSingle = srvCount === 1;
  auditResults.printAudit.push({ system: 'Service Proposal', pageCount: srvCount, success: isSrvSingle });
  if (isSrvSingle) auditResults.summary.passed++;
  else auditResults.summary.failed++;
  console.log(`[PRINT] Service Proposal -> ${srvCount} Page(s) (Passed: ${isSrvSingle})`);

  await printPage.close();
  await browser.close();

  // Save audit report JSON
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'audit_results.json'),
    JSON.stringify(auditResults, null, 2)
  );

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total Checks Passed: ${auditResults.summary.passed}`);
  console.log(`Total Checks Failed: ${auditResults.summary.failed}`);
  console.log(`Report saved to: ${path.join(ARTIFACT_DIR, 'audit_results.json')}`);
})();
