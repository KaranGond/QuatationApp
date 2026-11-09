import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuoteHtml } from '../src/lib/quoteTemplate.ts';

describe('Quotation HTML Asset & Branding Fidelity', () => {
  const baseMockData = {
    customerInfo: {
      name: 'Rohan Sharma',
      phone: '9876543210',
      address: 'Varanasi, UP'
    },
    selectedProduct: {
      systemType: 'On-grid',
      capacity: 3.3,
      phase: 1,
      panelBrand: 'Adani',
      panelWattage: 550,
      panelType: 'Mono Perc',
      panelWarranty: '25 Years',
      inverterBrand: 'Polycab 3.3kW',
      inverterWarranty: '5 Years'
    },
    calculations: {
      basePrice: 150000,
      extraCosts: 0,
      gstAmount: 20700,
      total: 170700,
      grandTotal: 170700,
      centralSubsidy: 78000,
      stateSubsidy: 30000,
      effectiveCost: 62700
    },
    components: [
      { name: 'Solar Panels', description: 'Adani 550Wp Mono Perc', quantity: '6 Nos', sort_order: 1 },
      { name: 'Solar Inverter', description: 'Polycab 3.3kW Grid-tied', quantity: '1 Set', sort_order: 2 }
    ],
    terms: ['Payment: 10% Advance', 'Delivery: 85% Before dispatch'],
    companyDetails: {
      name: 'Rajeev Solar shop',
      tagline: 'Leading Solar EPC & Engineering',
      gstin: '09AAECR1234F1Z5',
      headOffice: 'Sigra, Varanasi',
      phone: '9876543210',
      email: 'rajeev@gmail.com',
      authorizedSignatory: 'Rajeev Tripathi',
      bank: {
        name: 'HDFC Bank',
        branch: 'Sigra',
        accountName: 'RAJEEV SOLAR SHOP',
        accountNumber: '50200098765432',
        ifsc: 'HDFC0001234',
        upiId: 'rajeev@hdfcbank'
      }
    }
  };

  it('embeds custom vendor logo, signature, and payment QR in generated HTML', () => {
    const customLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const customSignature = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const customQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const html = generateQuoteHtml({
      ...baseMockData,
      logoUrl: customLogo,
      signatureUrl: customSignature,
      qrCodeUrl: customQr,
      quoteNumber: 'RSS/2026/001',
      currentDate: '10 Nov 2026'
    });

    // 1. Verify company name is prominent
    assert.match(html, /RAJEEV SOLAR SHOP/);
    assert.match(html, /09AAECR1234F1Z5/);

    // 2. Verify custom logo is in header
    assert.ok(html.includes(customLogo), 'Custom vendor logo must be embedded in the header');

    // 3. Verify custom signature is in signature section
    assert.ok(html.includes(customSignature), 'Custom stamp & signature must be embedded in the footer');
    assert.match(html, /Authorized Stamp & Signature/);

    // 4. Verify custom QR is in payment section
    assert.ok(html.includes(customQr), 'Custom payment barcode must be embedded in the bank section');
  });

  it('handles missing or fallback assets gracefully without throwing', () => {
    const html = generateQuoteHtml({
      ...baseMockData,
      logoUrl: '',
      signatureUrl: '',
      qrCodeUrl: '',
      quoteNumber: 'RSS/2026/002',
      currentDate: '10 Nov 2026'
    });

    assert.ok(html.length > 500, 'HTML must be generated even when images are empty');
    assert.match(html, /Authorized Stamp & Signature/);
  });
});
