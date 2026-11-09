import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatWhatsAppPhoneNumber,
    buildQuoteWhatsAppMessage,
    buildWhatsAppLink,
} from '../src/lib/whatsappShare.ts';

test('WhatsApp Phone Number Formatting', async (t) => {
    await t.test('formats 10-digit Indian numbers with 91 prefix', () => {
        assert.equal(formatWhatsAppPhoneNumber('9876543210'), '919876543210');
        assert.equal(formatWhatsAppPhoneNumber('9005770466'), '919005770466');
    });

    await t.test('preserves 12-digit numbers already having 91 prefix', () => {
        assert.equal(formatWhatsAppPhoneNumber('919876543210'), '919876543210');
        assert.equal(formatWhatsAppPhoneNumber('+91 98765 43210'), '919876543210');
    });

    await t.test('strips leading 0 from 11-digit numbers', () => {
        assert.equal(formatWhatsAppPhoneNumber('09876543210'), '919876543210');
    });

    await t.test('handles empty or special character inputs', () => {
        assert.equal(formatWhatsAppPhoneNumber(''), '');
        assert.equal(formatWhatsAppPhoneNumber('+91-900-577-0466'), '919005770466');
    });
});

test('WhatsApp Message Builder - Standard Rooftop Quote', async (t) => {
    await t.test('includes customer name, quote number, capacity, amount and PDF link without asterisks or emojis', () => {
        const msg = buildQuoteWhatsAppMessage({
            customerName: 'Krishna Rai',
            customerPhone: '89606962028',
            quoteNumber: 'KSS-2026-0042',
            quoteDate: '09-Nov-2026',
            systemCapacityKw: 5,
            systemType: 'On-grid',
            panelBrand: 'Adani Solar',
            panelWattage: 550,
            totalAmount: 260000,
            centralSubsidy: 78000,
            stateSubsidy: 30000,
            pdfUrl: 'https://storage.supabase.co/quotes/KSS-0042.pdf',
            vendorName: 'Karan Solar Shop',
            vendorSignatory: 'Karan Gond',
            vendorPhone: '+91 9005770466',
        });

        // Strict assertion: zero asterisks (*)
        assert.equal(msg.includes('*'), false, 'Message should not contain asterisks (*) symbols');
        // Strict assertion: professional greeting without markdown
        assert.match(msg, /Dear Krishna Rai,/);
        assert.match(msg, /Quotation No: KSS-2026-0042/);
        assert.match(msg, /Capacity: 5 kW \(On-grid\)/);
        assert.match(msg, /Solar Panels: Adani Solar 550Wp/);
        assert.match(msg, /Total System Amount: ₹2,60,000\/-/);
        assert.match(msg, /Govt Subsidy \(DBT\): ₹1,08,000\/-/);
        assert.match(msg, /Net Investment: ₹1,52,000\/-/);
        assert.match(msg, /https:\/\/storage\.supabase\.co\/quotes\/KSS-0042\.pdf/);
        assert.match(msg, /Sincerely,\nKaran Solar Shop\nKaran Gond\nPhone: \+91 9005770466/);
    });
});

test('WhatsApp Direct wa.me URL Generation', async (t) => {
    await t.test('generates valid wa.me link with encoded text', () => {
        const url = buildWhatsAppLink('9876543210', 'Hello Solar Quote');
        assert.ok(url.startsWith('https://wa.me/919876543210?text=Hello%20Solar%20Quote'));
    });
});

