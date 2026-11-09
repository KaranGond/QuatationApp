// src/lib/quoteTemplate.ts - Professional quotation PDF template fitting strictly onto a single A4 page

import { companyDetails as defaultCompanyDetails } from './companyDetails.ts';

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const generateQuoteHtml = (data: any): string => {
  const { customerInfo, selectedProduct, calculations, components = [], terms = [], logoUrl, signatureUrl, stampUrl, qrCodeUrl, upiLink } = data;
  const company = data.companyDetails || defaultCompanyDetails;

  // Safe number extraction
  const n = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const basePrice = n(calculations?.basePrice) || n(calculations?.subtotal);
  const extraCosts = n(calculations?.extraCosts);
  const gstAmount = n(calculations?.gstAmount);
  const total = n(calculations?.total) || n(calculations?.grandTotal);
  const centralSubsidy = n(calculations?.centralSubsidy);
  const stateSubsidy = n(calculations?.stateSubsidy);
  const effectiveCost = n(calculations?.effectiveCost);
  const gstRate = n(data?.taxRate) * 100 || 8.9;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN').format(Math.round(val));
  const currentDate = data.quote_date || data.currentDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const rawQuoteNumber = data.quoteNumber || data.quote_number || `${company.quote_prefix || company.quotePrefix || 'KSS'}-${(customerInfo?.name || 'X').charAt(0).toUpperCase()}${Date.now().toString().slice(-6)}`;
  const quoteNumber = escapeHtml(rawQuoteNumber);

  // System info
  const systemSize = selectedProduct?.capacity || 0;
  const phase = selectedProduct?.phase === 1 ? 'Single Phase' : 'Three Phase';
  const panelBrand = escapeHtml(selectedProduct?.panelBrand || '');
  const panelWattage = escapeHtml(selectedProduct?.panelWattage || '');
  const panelType = escapeHtml(selectedProduct?.panelType || '');
  const inverterBrand = escapeHtml(selectedProduct?.inverterBrand || '');
  const systemType = escapeHtml(selectedProduct?.systemType || 'On-grid');
  const panelWarranty = escapeHtml(data.panelWarranty || selectedProduct?.panelWarranty || '25 Years');
  const inverterWarranty = escapeHtml(data.inverterWarranty || selectedProduct?.inverterWarranty || '5 Years');
  const batteryWarranty = escapeHtml(data.batteryWarranty || selectedProduct?.batteryWarranty || '5 Years');

  const customerName = escapeHtml(customerInfo?.name || '________________');
  const customerAddress = escapeHtml(customerInfo?.address || '');
  const customerPhone = escapeHtml(customerInfo?.phone || '');

  const companyName = escapeHtml(company.name || '');
  const companyTagline = escapeHtml(company.tagline || '');
  const companyGstin = escapeHtml(company.gstin || '');
  const companyHeadOffice = escapeHtml(company.headOffice || company.head_office || '');
  const companyPhone = escapeHtml(company.phone || '');
  const companyEmail = escapeHtml(company.email || '');

  const bankAccountName = escapeHtml(company.bank?.accountName || company.account_name || company.name || '');
  const bankAccountNumber = escapeHtml(company.bank?.accountNumber || company.account_number || '');
  const bankIfsc = escapeHtml(company.bank?.ifsc || company.ifsc || '');
  const bankName = escapeHtml(company.bank?.name || company.bank_name || '');
  const bankBranch = escapeHtml(company.bank?.branch || company.bank_branch || '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} - Quotation ${quoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      font-size: 9.5px;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      width: 100%;
      max-width: 194mm;
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 2px solid #1e3a5f;
    }
    .logo-section { display: flex; align-items: center; gap: 10px; }
    .logo { max-height: 52px; max-width: 170px; width: auto; height: auto; object-fit: contain; display: block; }
    .company-name { font-size: 17px; font-weight: 900; color: #1e3a5f; letter-spacing: -0.3px; line-height: 1.1; }
    .company-tagline { font-size: 8px; font-weight: 600; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .company-info { font-size: 8px; color: #64748b; margin-top: 2px; line-height: 1.35; }
    .gstin { color: #1d4ed8; font-weight: 700; }
    
    .quote-badge { background: #eab308; color: white; padding: 4px 12px; font-size: 12px; font-weight: 900; border-radius: 4px; text-transform: uppercase; letter-spacing: 1.5px; }
    .quote-info { text-align: right; margin-top: 4px; font-size: 9px; color: #64748b; }
    .quote-number { font-size: 8.5px; color: #94a3b8; }
    
    /* Grid Layouts */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
    
    /* Info Boxes */
    .info-box { background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .info-title { font-weight: 800; color: #1e3a5f; font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 4px; }
    .customer-name { font-weight: 900; color: #1e40af; font-size: 13px; margin-bottom: 2px; }
    .customer-detail { color: #475569; font-size: 9px; margin-bottom: 1px; }
    .system-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 1.5px; }
    .system-row strong { color: #1e293b; }
    
    /* Components Table */
    .table-container { border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
    th { background: #f1f5f9; color: #1e3a5f; font-weight: 700; padding: 4px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th:first-child { width: 35px; text-align: center; }
    th:last-child { text-align: right; width: 65px; }
    td { padding: 3px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .td-center { text-align: center; }
    .td-right { text-align: right; font-weight: 700; }
    .highlight-row td { font-weight: 700; color: #1e293b; }
    .highlight-row td:nth-child(3) { color: #1e40af; font-style: italic; }
    .highlight-row td:last-child { color: #1e40af; }
    
    /* Subsidy Box */
    .subsidy-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 8px; border-radius: 6px; margin-bottom: 4px; }
    .subsidy-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px solid #bbf7d0; }
    .subsidy-total { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; color: #166534; padding-top: 3px; text-transform: uppercase; }
    
    /* Bank Details */
    .bank-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 8px; border-radius: 6px; font-size: 8px; }
    .bank-row { margin: 1.5px 0; }
    
    /* Investment Summary */
    .investment-box { background: #f8fafc; border: 1px solid #bfdbfe; padding: 6px 8px; border-radius: 6px; }
    .price-row { display: flex; justify-content: space-between; font-size: 8.5px; padding: 1.5px 0; color: #64748b; }
    .price-row.extra { color: #d97706; }
    .price-row.border { border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 3px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; color: #1e3a5f; padding-top: 3px; }
    .total-row span:last-child { color: #1e40af; }
    
    .effective-box { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 5px; text-align: center; margin-top: 4px; }
    .effective-label { font-size: 7.5px; color: #1e40af; text-transform: uppercase; font-weight: 900; letter-spacing: 0.8px; margin-bottom: 2px; }
    .effective-value { font-size: 17px; font-weight: 900; color: #16a34a; }
    
    /* Terms */
    .terms-section { border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; }
    .terms-title { font-weight: 900; color: #1e293b; text-transform: uppercase; font-size: 8px; letter-spacing: 0.8px; margin-bottom: 2px; }
    .terms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 16px; }
    .term-item { font-size: 8px; color: #64748b; padding-left: 10px; position: relative; line-height: 1.3; }
    .term-item::before { content: "•"; position: absolute; left: 0; color: #94a3b8; }
    
    /* Signature */
    .signature-section { display: flex; justify-content: space-between; margin-top: 6px; padding: 0 10px; align-items: flex-end; }
    .sig-box { text-align: center; }
    .sig-box.right { text-align: right; }
    .sig-line { width: 130px; height: 1px; background: #cbd5e1; margin: 0 auto 3px; }
    .sig-box.right .sig-line { margin: 0 0 3px auto; }
    .sig-label { font-size: 7.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .for-company { font-size: 10px; font-weight: 900; color: #1e3a5f; margin-bottom: 2px; text-decoration: underline; text-decoration-color: #eab308; text-underline-offset: 3px; }
    
    @page {
      size: A4 portrait;
      margin: 6mm 8mm 6mm 8mm;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ''}
        <div>
          <div class="company-name">${companyName.toUpperCase()}</div>
          ${companyTagline ? `<div class="company-tagline">${companyTagline}</div>` : ''}
          <div class="company-info">
            ${companyGstin ? `<div class="gstin">GSTIN: ${companyGstin}</div>` : ''}
            ${companyHeadOffice ? `<div><strong>HO:</strong> ${companyHeadOffice}</div>` : ''}
            <div>${companyPhone ? `<strong>Contact:</strong> ${companyPhone}` : ''}${companyPhone && companyEmail ? ' | ' : ''}${companyEmail ? `<strong>Email:</strong> ${companyEmail}` : ''}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="quote-badge">Quotation</div>
        <div class="quote-info">
          <strong>Date:</strong> ${currentDate}
          <div class="quote-number">Quote No: ${quoteNumber}</div>
        </div>
      </div>
    </div>
    
    <!-- Customer & System Overview -->
    <div class="grid-2">
      <div class="info-box">
        <div class="info-title">Customer Details</div>
        <div class="customer-name">${customerName}</div>
        ${customerAddress ? `<div class="customer-detail" style="font-style: italic;">${customerAddress}</div>` : ''}
        ${customerPhone ? `<div class="customer-detail">Mo No: ${customerPhone}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-title">System Overview</div>
        <div class="system-row"><span>System Size:</span> <strong>${systemSize} KW (${phase})</strong></div>
        <div class="system-row"><span>Modules:</span> <strong>${panelBrand} ${panelWattage ? `${panelWattage}Wp` : ''} ${panelType ? `(${panelType})` : ''}</strong></div>
        <div class="system-row" style="color: #475569;"><span>Module Warranty:</span> <strong>${panelWarranty}</strong></div>
        <div class="system-row"><span>Inverter:</span> <strong>${inverterBrand}</strong></div>
        <div class="system-row" style="color: #475569;"><span>Inverter Warranty:</span> <strong>${inverterWarranty}</strong></div>
        ${(systemType === 'Hybrid' || systemType === 'Off-grid') ? `<div class="system-row" style="color: #475569;"><span>Battery Warranty:</span> <strong>${batteryWarranty}</strong></div>` : ''}
        <div class="system-row"><span>Type:</span> <strong>${systemType}</strong></div>
      </div>
    </div>
    
    <!-- Components Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">S.N</th>
            <th style="width: 25%;">Components</th>
            <th>Description</th>
            <th style="width: 10%; text-align: center;">Quantity</th>
            <th style="width: 15%; text-align: center;">Make</th>
          </tr>
        </thead>
        <tbody>
          ${components.map((comp: any, i: number) => `
            <tr class="${i < 2 ? 'highlight-row' : ''}">
              <td class="td-center">${i + 1}</td>
              <td style="font-weight: 700;">${escapeHtml(comp.name || '')}</td>
              <td>${escapeHtml(comp.description || '')}</td>
              <td class="td-center">${escapeHtml(comp.quantity || '')}</td>
              <td class="td-center" style="font-weight: 700; color: #1e40af;">${escapeHtml(comp.make || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pricing & Subsidy -->
    <div class="grid-2">
      <div>
        ${(centralSubsidy + stateSubsidy) > 0 ? `
        <div class="subsidy-box">
          <div class="info-title" style="color: #166534;">PM Surya Ghar Subsidy</div>
          <div class="system-row" style="border-bottom: 1px solid #bbf7d0;"><span>Central Subsidy:</span> <strong>₹ ${formatCurrency(centralSubsidy)}/-</strong></div>
          <div class="system-row" style="border-bottom: 1px solid #bbf7d0;"><span>State Subsidy:</span> <strong>₹ ${formatCurrency(stateSubsidy)}/-</strong></div>
          <div class="system-row" style="color: #166534; font-size: 11px; margin-top: 2px;"><span>Total Benefit:</span> <span style="font-weight: 900;">₹ ${formatCurrency(centralSubsidy + stateSubsidy)}/-</span></div>
        </div>
        ` : ''}
        
        <div class="bank-box" style="${(centralSubsidy + stateSubsidy) === 0 ? 'margin-top: 0;' : ''}">
          <div class="info-title">Bank Details</div>
          <p style="margin: 2px 0;"><strong>A/c Name:</strong> ${bankAccountName}</p>
          <p style="margin: 2px 0;"><strong>A/c No:</strong> ${bankAccountNumber} | <strong>IFSC:</strong> ${bankIfsc}</p>
          <p style="margin: 2px 0;"><strong>Bank:</strong> ${bankName}${bankBranch ? `, ${bankBranch}` : ''}</p>
          ${company.bank?.upiId ? `<p style="margin: 2px 0; color: #1d4ed8;"><strong>UPI ID:</strong> ${escapeHtml(company.bank.upiId)}</p>` : ''}
          
          ${qrCodeUrl ? `
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; gap: 8px;">
              <a href="${upiLink}" style="text-decoration: none;">
                  <img src="${qrCodeUrl}" alt="Payment QR" style="width: 55px; height: 55px; mix-blend-mode: multiply; display: block;" />
              </a>
              <div style="font-size: 7.5px; color: #64748b;">
                <div style="font-weight: 700; color: #1e3a5f;">Scan to Pay</div>
                <div>Scan with PhonePe, GPay, Paytm, or BHIM</div>
              </div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="investment-box">
        <div class="info-title">Investment Summary</div>
        <div class="system-row"><span>Base Price:</span> <span>₹ ${formatCurrency(basePrice - extraCosts)}</span></div>
        ${extraCosts > 0 ? `<div class="system-row" style="color: #d97706;"><span>+ Extra Costs:</span> <span>₹ ${formatCurrency(extraCosts)}</span></div>` : ''}
        <div class="system-row" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 3px;"><span>GST (@ ${gstRate}%):</span> <span>₹ ${formatCurrency(gstAmount)}</span></div>
        <div class="system-row" style="font-size: 13px; font-weight: 900; color: #1e3a5f; padding-top: 3px;"><span style="font-size: 9px; text-transform: uppercase;">Total Amount:</span> <span style="color: #1e40af;">₹ ${formatCurrency(total)}</span></div>
        <div class="effective-box">
          <div class="effective-label">${(centralSubsidy + stateSubsidy) > 0 ? 'Effective Cost After Subsidy' : 'Effective Cost'}</div>
          <div class="effective-value">₹ ${formatCurrency(effectiveCost)}*</div>
        </div>
      </div>
    </div>

    <!-- Savings & Financial Breakdown Table -->
    <div class="table-container" style="border: none; margin-bottom: 6px;">
      <div class="info-title">Breakdown of Savings & Financials</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">S.No</th>
            <th>Content</th>
            <th style="text-align: right;">Amount / Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="td-center">1</td>
            <td>Proposed Solar Plant Size</td>
            <td class="td-right">${systemSize} KW</td>
          </tr>
          <tr>
            <td class="td-center">2</td>
            <td>Annual Units Generation (approx.)</td>
            <td class="td-right">${n(data.savings?.annualUnits) || 0} Units</td>
          </tr>
          <tr>
            <td class="td-center">3</td>
            <td>Average Grid Electricity Rate</td>
            <td class="td-right">Rs. 6.5 / Unit</td>
          </tr>
          <tr>
            <td class="td-center">4</td>
            <td><strong>Annual Savings</strong></td>
            <td class="td-right" style="color: #166534; font-size: 10px;">Rs. ${formatCurrency(n(data.savings?.annualSavings))}</td>
          </tr>
          <tr style="background-color: #f0fdf4;">
            <td class="td-center">5</td>
            <td><strong>Subsidy Applicable</strong> (Central + State Government)</td>
            <td class="td-right" style="color: #166534; font-weight: 800;">₹ ${formatCurrency(centralSubsidy + stateSubsidy)}</td>
          </tr>
          <tr>
            <td class="td-center">6</td>
            <td><strong>Return on Investment (ROI)</strong></td>
            <td class="td-right" style="color: #ea580c; font-weight: 800;">${data.savings?.roiYears || 0} Years</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Terms -->
    <div class="terms-section">
      <div class="terms-title">Terms and Conditions</div>
      <div class="terms-grid">
        ${(terms.length > 0 ? terms : [
      'Payment: 10% Advance on structure installation.',
      'Delivery: 85% Before delivery of kit. 5% Post installation.',
      'Subsidy directly credited to customer bank account via DBT.',
      'Installation completed within 7-10 working days.',
      'Module Warranty: 25 Years. Inverter: 5 Years.',
      'Free Annual Maintenance for 1st year.'
    ]).slice(0, 6).map((term: string) => `<div class="term-item">${escapeHtml(term).replace(/^([^:]+):/, '<strong>$1:</strong>')}</div>`).join('')}
      </div>
    </div>
    
    <!-- Signature -->
    <div class="signature-section">
      <div class="sig-box">
        <div style="height: 40px;"></div>
        <div class="sig-line"></div>
        <div class="sig-label">Customer Signature</div>
      </div>
      <div class="sig-box right">
        <div class="for-company">For ${companyName}</div>
        ${stampUrl && signatureUrl && stampUrl !== signatureUrl ? `
          <div style="display: flex; align-items: flex-end; justify-content: flex-end; gap: 8px; margin-bottom: 2px;">
            <img src="${stampUrl}" style="max-height: 48px; max-width: 75px; object-fit: contain;" alt="Official Stamp" />
            <img src="${signatureUrl}" style="max-height: 48px; max-width: 95px; object-fit: contain;" alt="Authorized Signature" />
          </div>
        ` : (signatureUrl || stampUrl) ? `
          <img src="${signatureUrl || stampUrl}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 2px; display: block; margin-left: auto;" alt="Official Stamp & Signature" />
        ` : '<div style="height: 48px;"></div>'}
        <div class="sig-line"></div>
        <div class="sig-label">Authorized Stamp & Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
