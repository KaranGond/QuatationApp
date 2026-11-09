// Karan Solar Shop & Multi-Vendor Details
export const companies = [
    {
        id: "a0000000-0000-0000-0000-000000000001",
        slug: "karan-solar",
        name: "Karan Solar Shop",
        tagline: "CLEAN ENERGY | BRIGHTER TOMORROW",
        gstin: "",
        headOffice: "Varanasi, Uttar Pradesh, India",
        registeredOffice: "Varanasi, Uttar Pradesh, India",
        phone: "+91 9005770466",
        alternatePhone: "9044555572",
        email: "karangond221998@gmail.com",
        bank: {
            name: "HDFC Bank",
            branch: "Shivpur, Varanasi",
            accountName: "KARAN SOLAR SHOP",
            accountNumber: "50200123854806",
            ifsc: "HDFC0004807",
            upiId: "karan.solar@hdfcbank",
        },
        logo: "/logo.png",
        signature: "/signature.png",
        stamp: null,
        qr_code_url: "/payment.png",
        authorizedSignatory: "Karan Gond",
    }
];

export const companyDetails = companies[0];

/**
 * Resolves a company ID or legacy slug ('karan') to the matching company object
 */
export function findCompany(id?: string) {
    if (!id) return companies[0];
    return companies.find(c =>
        c.id === id ||
        c.slug === id ||
        (id === 'karan' && (c.slug === 'karan-solar' || c.id === 'a0000000-0000-0000-0000-000000000001')) ||
        (id === 'arpit' && (c.slug === 'karan-solar' || c.id === 'a0000000-0000-0000-0000-000000000001'))
    ) || companies[0];
}

// Default Subsidy Amounts (can be overridden per quotation)
// For 3 KW and above
export const defaultSubsidy = {
    central: 78000,  // PM Surya Ghar (3 KW+)
    state: 30000,    // State Government
};

// Capacity-based subsidy lookup under PM Surya Ghar: Muft Bijli Yojana (MNRE)
// < 2 KW (e.g. 1 KW): Central = ₹30,000, State = ₹15,000 (Total ₹45,000)
// 2 KW to < 3 KW (e.g. 2 KW): Central = ₹60,000, State = ₹30,000 (Total ₹90,000)
// ≥ 3 KW (capped): Central = ₹78,000, State = ₹30,000 (Total ₹1,08,000)
export const getSubsidyForCapacity = (capacityKw: number): { central: number; state: number } => {
    const cap = Math.max(0, Number(capacityKw) || 0);
    if (cap <= 0) {
        return { central: 0, state: 0 };
    }
    if (cap < 2) {
        return { central: 30000, state: 15000 };
    }
    if (cap < 3) {
        return { central: 60000, state: 30000 };
    }
    return { central: 78000, state: 30000 };
};

// GST Configuration
export const gstConfig = {
    compositeRate: 8.9, // Default composite rate
    supplyRate: 5,      // 5% on 70% (Supply)
    serviceRate: 18,    // 18% on 30% (Service)
    supplyShare: 70,    // 70% supply
    serviceShare: 30,   // 30% service
};

// Calculation: Effective GST = (70% × 5%) + (30% × 18%) = 3.5% + 5.4% = 8.9%

// Quote Number Prefix
export const quoteNumberPrefix = "KSS"; // Karan Solar Shop

// Generate Quote Number
export const generateQuoteNumber = (customerInitials: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const day = String(now.getDate()).padStart(2, '0');
    return `${quoteNumberPrefix}/${year}/${customerInitials}/${day}`;
};

// Default Terms by System Type
export const defaultTerms = {
    'On-grid': [
        'Payment: 10% Advance on structure installation.',
        'Delivery: 85% Before delivery of kit. 5% Post installation.',
        'Insurance: Freight and transit insurance included.',
        'Discom: Net meter fee charged directly to electricity bill.',
        'Consumer Scope: Structure elevation & civil material.',
        'Permits: Name change/Load increment charged extra.',
        'Structure: 80 Micron GI Sheet with wind resistance.',
        'Support: Assistance in Net Metering documentation.',
        'Grid Voltage: 185V to 275V without frequent fluctuation.',
        'Delivery Timeline: Within 4 weeks from confirmed order.',
        'Installation: Within 45 days from confirmed order & payment.',
        'AC Wire: Up to 10m included. Extra charged as per actual.',
        'Earthing Wire: Up to 30m included. Extra charged as per actual.',
        'Warranty: Solar Module 25 Years, PCU 5 Years. External damages not covered.',
    ],
    'Off-grid': [
        'Payment: 50% Advance. 50% Before delivery.',
        'Insurance: Freight and transit insurance included.',
        'Consumer Scope: Structure elevation & civil material.',
        'Delivery Timeline: Within 4 weeks from confirmed order.',
        'Installation: Within 45 days from confirmed order & payment.',
        'AC Wire: Up to 10m included. Extra charged as per actual.',
        'Earthing Wire: Up to 30m included. Extra charged as per actual.',
        'Warranty: Solar Module 25 Years, Inverter 2 Years, Battery 2 Years.',
    ],
    'Hybrid': [
        'Payment: 10% Advance on structure installation.',
        'Delivery: 85% Before delivery of kit. 5% Post installation.',
        'Insurance: Freight and transit insurance included.',
        'Discom: Net meter fee charged directly to electricity bill.',
        'Consumer Scope: Structure elevation & civil material.',
        'Permits: Name change/Load increment charged extra.',
        'Structure: 80 Micron GI Sheet with wind resistance.',
        'Support: Assistance in Net Metering documentation.',
        'Grid Voltage: 185V to 275V without frequent fluctuation.',
        'Delivery Timeline: Within 4 weeks from confirmed order.',
        'Installation: Within 45 days from confirmed order & payment.',
        'AC Wire: Up to 10m included. Extra charged as per actual.',
        'Earthing Wire: Up to 30m included. Extra charged as per actual.',
        'Warranty: Solar Module 25 Years, Hybrid Inverter 5 Years, Li-Ion Battery 5 Years.',
    ],
    'VFD/Drive': [
        'Payment: 50% Advance with order confirmation.',
        'Delivery: 50% Before delivery.',
        'Insurance: Freight and transit insurance included.',
        'Installation: Charges as per site conditions.',
        'Warranty: VFD 2 Years, Solar Modules 25 Years.',
    ],
};

// Default Components by System Type
export const defaultComponents = {
    'On-grid': [
        { name: 'Solar Photovoltaic Modules', description: '580Wp (DCR) Topcon Modules', quantity: '6 Nos', make: 'Waaree/Adani/Premier', sort_order: 1 },
        { name: 'PCU / Inverter', description: 'On-Grid String Inverter 3KW', quantity: '01 No', make: 'Polycab/Shakti', sort_order: 2 },
        { name: 'DC Distribution Box (DCDB)', description: 'IP65 CRCA with DP MCB', quantity: '01 No', make: 'Standard', sort_order: 3 },
        { name: 'AC Distribution Box (ACDB)', description: 'SPD, Changeover, MCB, Meter', quantity: '01 No', make: 'Standard', sort_order: 4 },
        { name: 'AC Cable (Main Connection)', description: 'Copper Multi-strand, 4 Sq mm', quantity: '10 Mtrs', make: 'Standard', sort_order: 5 },
        { name: 'DC Interconnecting Cables', description: 'Polycab 4 Sq mm, UV Protected', quantity: '40 Mtrs', make: 'Standard', sort_order: 6 },
        { name: 'Module Mounting Structure', description: 'GI 80 Micron, 150kmph Wind Load', quantity: '01 Set', make: 'GI 80 Micron', sort_order: 7 },
        { name: 'Earthing System', description: '3 Nos Copper Bonded + Chemical', quantity: '03 Sets', make: 'Standard', sort_order: 8 },
        { name: 'Lightning Arrestor', description: 'Conventional Type 1.25" Dia', quantity: '01 Set', make: 'Standard', sort_order: 9 },
    ],
    'Off-grid': [
        { name: 'Solar Photovoltaic Modules', description: 'PV Modules', quantity: '4 Nos', make: 'Waaree/Adani', sort_order: 1 },
        { name: 'Off-Grid Inverter', description: 'PWM/MPPT Inverter', quantity: '01 No', make: 'Standard', sort_order: 2 },
        { name: 'Battery Bank', description: 'Tubular/SMF Battery', quantity: '04 Nos', make: 'Exide/Luminous', sort_order: 3 },
        { name: 'Charge Controller', description: 'MPPT/PWM Controller', quantity: '01 No', make: 'Standard', sort_order: 4 },
        { name: 'DC Cables', description: 'PVC Insulated, UV Protected', quantity: '30 Mtrs', make: 'Standard', sort_order: 5 },
        { name: 'Module Mounting Structure', description: 'GI 80 Micron', quantity: '01 Set', make: 'GI 80 Micron', sort_order: 6 },
        { name: 'Earthing System', description: 'Copper Bonded + Chemical', quantity: '02 Sets', make: 'Standard', sort_order: 7 },
    ],
    'Hybrid': [
        { name: 'Solar Photovoltaic Modules', description: '580Wp (NDCR) PV Modules', quantity: '9 Nos', make: 'Waaree/Adani/Premier', sort_order: 1 },
        { name: 'PCU / Inverter', description: 'Hybrid Inverter 3.6KW', quantity: '01 No', make: 'Servotech', sort_order: 2 },
        { name: 'Lithium Ion Battery', description: '12.8V 100Ah 2000 Cycle', quantity: '02 Nos', make: 'Servotech', sort_order: 3 },
        { name: 'BMS', description: 'Battery Management System', quantity: '01 No', make: 'Standard', sort_order: 4 },
        { name: 'AC Cable', description: 'Copper, 6Sq mm', quantity: 'As per actual', make: 'Standard', sort_order: 5 },
        { name: 'DC Interconnecting Cables', description: '4 Sq mm, UV Protected', quantity: '150 Mtrs', make: 'Standard', sort_order: 6 },
        { name: 'Module Mounting Structure', description: 'MMS in pre GI sheet', quantity: '01 Set', make: 'GI 80 Micron', sort_order: 7 },
        { name: 'Earthing System', description: 'Copper Bonded + Chemical', quantity: '03 Sets', make: 'Standard', sort_order: 8 },
        { name: 'Lightning Arrestor', description: 'Conventional Type 1.25" Dia', quantity: '01 Set', make: 'Standard', sort_order: 9 },
    ],
    'VFD/Drive': [
        { name: 'Solar Photovoltaic Modules', description: '600Wp (NDCR) Pv Modules', quantity: '48 NOS', make: 'Waaree / Adani Solar / Premier', sort_order: 1 },
        { name: 'VFD Drive', description: '25HP VFD', quantity: '1 NOS', make: 'INVT / Crompton', sort_order: 2 },
        { name: 'AC Cable', description: 'Copper, 6Sq mm', quantity: 'As per actual', make: 'Standard', sort_order: 3 },
        { name: 'DC Interconnecting Cables', description: '1C x 4 sqmm 1.1kV, PVC insulated, UV Protected unarmored Cu Cable', quantity: '150 Mtrs', make: 'Standard', sort_order: 4 },
        { name: 'Module Mounting Structure', description: 'MMS in pre GI sheet', quantity: '1 Set', make: 'GI 80 Micron', sort_order: 5 },
        { name: 'Earthing System', description: '10 sqmm AL Solid Cable + Chemical earthing + 3nos copper bonded rod', quantity: 'As per actual', make: 'Standard', sort_order: 6 },
        { name: 'Lightning Arrestor', description: 'Conventional Type 1.25" Dia.', quantity: '1 Set', make: 'Standard', sort_order: 7 },
    ],
};

// ========== SERVICE PROPOSAL DEFAULTS ==========

// Default Service Types (O&M, Cleaning, AMC etc.)
export type ServiceItem = {
    sno: number;
    description: string;
    hsnSac: string;
    qty: string;
    unit: string;
    rate: number;
    amount: number;
    monthlyRate?: number;
};

export const defaultServiceItems: ServiceItem[] = [
    {
        sno: 1,
        description: 'Operation & Maintenance Works (O & M) Solar Power Plant',
        hsnSac: '998717',
        qty: '1',
        unit: 'Year',
        rate: 320000,
        amount: 320000,
        monthlyRate: 26666.67,
    },
];

export const serviceGstRate = 18; // 18% GST for services

// Default Service Terms & Conditions
export const defaultServiceTerms: string[] = [
    'Annual Calibration: Annual calibration of all energy meters shall be carried out. Any additional related activities covered under Operation & Maintenance (O&M) shall also be included within the scope of this proposal.',
    'Module Cleaning Frequency & Manpower: One (1) scheduled module cleaning will be provided per month. If a 2nd cleaning is required within the same month, it will be subject to a 50% extra charge.',
    'Consumable Electrical Components: Replacement of minor consumable items including MC4 connectors, lugs, and nut bolts shall be included up to five (05) pieces each per month. Any requirement beyond this quantity shall be chargeable at actual material cost.',
    'Major Equipment Faults: Repairs or replacement related to major components such as inverters, ACDB, DCDB, PV modules, earthing systems, etc., shall be chargeable at actual material cost.',
    'Site Facilities: The client shall provide a suitable office space at site for deployment of manpower, along with adequate storage for tools and tackles.',
    'Contract Finalization: The contract shall be executed only after a joint site inspection conducted in the presence of the client\'s authorized representative.',
];

// Generate Service Proposal Reference Number
export const generateServiceRefNumber = (prefix: string = 'KSS'): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${prefix}/OM/${year}-${month}`;
};

// ========== END SERVICE PROPOSAL DEFAULTS ==========

// Savings Calculator Constants
export const savingsConfig = {
    unitsPerKwPerDay: 4,      // Average units generated per KW per day
    daysPerYear: 365,
    gridCostPerUnit: 6.5,     // Average cost per unit from grid (Rs.)
};

// Calculate savings data
export const calculateSavings = (
    capacityKw: number,
    totalCost: number,
    centralSubsidy: number = defaultSubsidy.central,
    stateSubsidy: number = defaultSubsidy.state
): {
    unitsPerDay: number;
    annualUnits: number;
    annualSavings: number;
    totalSubsidy: number;
    netCost: number;
    roiYears: number;
} => {
    const safeCapacity = Math.max(0, Number(capacityKw) || 0);
    const safeCost = Math.max(0, Number(totalCost) || 0);
    const safeCentral = Math.max(0, Number(centralSubsidy) || 0);
    const safeState = Math.max(0, Number(stateSubsidy) || 0);

    const unitsPerDay = safeCapacity * savingsConfig.unitsPerKwPerDay;
    const annualUnits = unitsPerDay * savingsConfig.daysPerYear;
    const annualSavings = annualUnits * savingsConfig.gridCostPerUnit;
    const totalSubsidy = safeCentral + safeState;
    const netCost = Math.max(0, safeCost - totalSubsidy);
    const roiYears = annualSavings > 0 ? netCost / annualSavings : 0;

    return {
        unitsPerDay: Math.round(unitsPerDay * 100) / 100,
        annualUnits: Math.round(annualUnits * 100) / 100,
        annualSavings: Math.round(annualSavings * 100) / 100,
        totalSubsidy,
        netCost,
        roiYears: Math.round(roiYears * 10) / 10,
    };
};
