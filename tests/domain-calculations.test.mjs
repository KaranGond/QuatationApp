import test from 'node:test';
import assert from 'node:assert/strict';

// Import domain logic
import { 
    getSubsidyForCapacity, 
    calculateSavings, 
    gstConfig,
    generateServiceRefNumber 
} from '../src/lib/companyDetails.ts';
import { generateQuotePrefix } from '../src/lib/multiTenant.ts';
import { generateQuoteHtml } from '../src/lib/quoteTemplate.ts';

test('MNRE & UP State Subsidy Tier Calculations', async (t) => {
    await t.test('returns 0 subsidy for invalid or 0 kW', () => {
        assert.deepEqual(getSubsidyForCapacity(0), { central: 0, state: 0 });
        assert.deepEqual(getSubsidyForCapacity(-3), { central: 0, state: 0 });
        assert.deepEqual(getSubsidyForCapacity(NaN), { central: 0, state: 0 });
    });

    await t.test('calculates correct subsidy for < 2 kW (e.g. 1 kW)', () => {
        const sub1 = getSubsidyForCapacity(1);
        assert.equal(sub1.central, 30000);
        assert.equal(sub1.state, 15000);

        const sub1_9 = getSubsidyForCapacity(1.9);
        assert.equal(sub1_9.central, 30000);
        assert.equal(sub1_9.state, 15000);
    });

    await t.test('calculates correct subsidy for 2 kW to < 3 kW (e.g. 2 kW)', () => {
        const sub2 = getSubsidyForCapacity(2);
        assert.equal(sub2.central, 60000);
        assert.equal(sub2.state, 30000);

        const sub2_5 = getSubsidyForCapacity(2.5);
        assert.equal(sub2_5.central, 60000);
        assert.equal(sub2_5.state, 30000);
    });

    await t.test('caps subsidy for >= 3 kW (e.g. 3 kW, 5 kW, 10 kW)', () => {
        const sub3 = getSubsidyForCapacity(3);
        assert.equal(sub3.central, 78000);
        assert.equal(sub3.state, 30000);

        const sub10 = getSubsidyForCapacity(10);
        assert.equal(sub10.central, 78000);
        assert.equal(sub10.state, 30000);
    });
});

test('Financial Savings & ROI Calculations', async (t) => {
    await t.test('computes annual generation and savings accurately for 3 kW system', () => {
        const capacity = 3;
        const totalCost = 180000;
        const centralSubsidy = 78000;
        const stateSubsidy = 30000;

        const res = calculateSavings(capacity, totalCost, centralSubsidy, stateSubsidy);

        // 3 kW * 4 units/day = 12 units/day
        assert.equal(res.unitsPerDay, 12);
        // 12 units/day * 365 days = 4380 units/year
        assert.equal(res.annualUnits, 4380);
        // 4380 units * Rs. 6.5/unit = Rs. 28,470/year
        assert.equal(res.annualSavings, 28470);
        // Total subsidy = 78,000 + 30,000 = 108,000
        assert.equal(res.totalSubsidy, 108000);
        // Net cost = 180,000 - 108,000 = 72,000
        assert.equal(res.netCost, 72000);
        // ROI = 72,000 / 28,470 = ~2.53 -> rounded to 2.5 years
        assert.equal(res.roiYears, 2.5);
    });

    await t.test('handles zero and edge conditions without NaN or infinity', () => {
        const res = calculateSavings(0, 0, 0, 0);
        assert.equal(res.unitsPerDay, 0);
        assert.equal(res.annualUnits, 0);
        assert.equal(res.annualSavings, 0);
        assert.equal(res.roiYears, 0);
        assert.equal(res.netCost, 0);
    });
});

test('GST Composite Rate Configuration', () => {
    const computedComposite = +((gstConfig.supplyShare * gstConfig.supplyRate + gstConfig.serviceShare * gstConfig.serviceRate) / 100).toFixed(1);
    assert.equal(gstConfig.compositeRate, computedComposite, 'GST composite rate matches 70/30 split of 5% supply and 18% services');
    assert.equal(computedComposite, 8.9);
});

test('Multi-Tenant Quote Prefix Generation', async (t) => {
    await t.test('generates acronym for 3+ word company names', () => {
        assert.equal(generateQuotePrefix('Karan Solar Shop'), 'KSS');
        assert.equal(generateQuotePrefix('Tata Solar Power'), 'TSP');
        assert.equal(generateQuotePrefix('Apex Green Infra Limited'), 'AGI');
    });

    await t.test('generates prefix for 2-word company names', () => {
        assert.equal(generateQuotePrefix('Sun Energy'), 'SUE');
        assert.equal(generateQuotePrefix('Shree Solar'), 'SHS');
    });

    await t.test('generates prefix for single word company names', () => {
        assert.equal(generateQuotePrefix('Airtel'), 'AIR');
        assert.equal(generateQuotePrefix('Sol'), 'SOL');
    });

    await t.test('handles empty or missing company names gracefully', () => {
        assert.equal(generateQuotePrefix(''), 'QT');
        assert.equal(generateQuotePrefix('   '), 'QT');
    });
});

test('Service Proposal Reference Formatter', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ref = generateServiceRefNumber('KSS');
    assert.equal(ref, `KSS/OM/${year}-${month}`);
});

test('Quote HTML Security Sanitization', async (t) => {
    await t.test('neutralizes script tags and HTML injection in customer name', () => {
        const maliciousCustomer = '<script>alert("XSS")</script>John Doe';
        const html = generateQuoteHtml({
            customerInfo: { name: maliciousCustomer, address: '<img src=x onerror=alert(1)>', phone: '9876543210' },
            selectedProduct: { capacity: 3, phase: 1, panelBrand: '<b>Hacked</b>' },
            calculations: { basePrice: 100000, extraCosts: 0, gstAmount: 8900, total: 108900, effectiveCost: 30900 },
            components: [
                { name: '<script>evil()</script>Panel', description: 'desc', quantity: '1', make: 'Safe' }
            ]
        });

        // Must not contain raw executable tags
        assert.equal(html.includes('<script>alert("XSS")</script>'), false);
        assert.equal(html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;John Doe'), true);
        assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
        assert.equal(html.includes('&lt;b&gt;Hacked&lt;/b&gt;'), true);
        assert.equal(html.includes('&lt;script&gt;evil()&lt;/script&gt;Panel'), true);
    });
});
