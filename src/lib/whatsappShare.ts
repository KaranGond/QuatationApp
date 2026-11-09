/**
 * WhatsApp Direct Share Utility (Free, No Paid API Required)
 * Generates direct wa.me links that launch WhatsApp / WhatsApp Business
 * on Android, iOS, Windows, Mac, or Web with a pre-filled quote message and PDF link.
 */

export interface SolarQuoteWhatsAppParams {
    customerName: string;
    customerPhone: string;
    quoteNumber: string;
    quoteDate?: string;
    systemCapacityKw?: number | string | null;
    systemType?: string;
    panelBrand?: string;
    panelWattage?: number | string;
    totalAmount: number;
    centralSubsidy?: number;
    stateSubsidy?: number;
    pdfUrl?: string | null;
    vendorName: string;
    vendorSignatory?: string;
    vendorPhone?: string;
    isB2B?: boolean;
    b2bDetails?: {
        refNumber?: string;
        make?: string;
        itemCount?: number;
        taxableSubtotal?: number;
        gstAmount?: number;
        grandTotal?: number;
        dispatchLocation?: string;
        paymentTerms?: string;
    };
    isService?: boolean;
    serviceDetails?: {
        refNumber?: string;
        itemCount?: number;
        grandTotal?: number;
    };
}

/**
 * Normalizes phone numbers to 91XXXXXXXXXX format for Indian WhatsApp links.
 */
export function formatWhatsAppPhoneNumber(phone: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');

    // 12-digit already starting with 91
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits;
    }

    // 11-digit starting with 0 (e.g. 09876543210)
    if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    // 10-digit Indian standard mobile
    if (digits.length === 10) {
        return `91${digits}`;
    }

    return digits;
}

/**
 * Builds a clean, professional, concise WhatsApp message with transaction details
 * and a direct link to view/download the official quotation PDF.
 * Free of emojis and markdown asterisks for a clean corporate appearance.
 */
export function buildQuoteWhatsAppMessage(params: SolarQuoteWhatsAppParams): string {
    const {
        customerName,
        quoteNumber,
        quoteDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        systemCapacityKw,
        systemType = 'Solar Power Plant',
        panelBrand,
        panelWattage,
        totalAmount,
        centralSubsidy = 0,
        stateSubsidy = 0,
        pdfUrl,
        vendorName,
        vendorSignatory,
        vendorPhone,
        isB2B,
        b2bDetails,
        isService,
        serviceDetails,
    } = params;

    const formatINR = (val: number) =>
        new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(val || 0));

    // 1. B2B Commercial Mounting Structure & BOS Mode
    if (isB2B && b2bDetails) {
        const lines: string[] = [
            `Dear ${customerName.trim()},`,
            '',
            `Please view the details of your B2B commercial quotation below:`,
            '',
            `Quote Ref: ${b2bDetails.refNumber || quoteNumber}`,
            `Date: ${quoteDate}`,
            b2bDetails.make ? `Make: ${b2bDetails.make}` : '',
            b2bDetails.itemCount ? `Line Items: ${b2bDetails.itemCount} items` : '',
            b2bDetails.taxableSubtotal ? `Taxable Subtotal: ₹${formatINR(b2bDetails.taxableSubtotal)}/-` : '',
            b2bDetails.gstAmount ? `GST: ₹${formatINR(b2bDetails.gstAmount)}/-` : '',
            `Grand Total: ₹${formatINR(b2bDetails.grandTotal || totalAmount)}/-`,
            b2bDetails.dispatchLocation ? `Dispatch: ${b2bDetails.dispatchLocation}` : '',
            b2bDetails.paymentTerms ? `Payment Terms: ${b2bDetails.paymentTerms}` : '',
        ].filter(Boolean);

        if (pdfUrl) {
            lines.push(
                '',
                `To view and download your official quotation document, click:`,
                pdfUrl
            );
        }

        lines.push(
            '',
            `Sincerely,`,
            `${vendorName}`,
            vendorSignatory ? `${vendorSignatory}` : '',
            vendorPhone ? `Phone: ${vendorPhone}` : ''
        );

        return lines.filter(Boolean).join('\n');
    }

    // 2. Service & O&M Mode
    if (isService && serviceDetails) {
        const lines: string[] = [
            `Dear ${customerName.trim()},`,
            '',
            `Please view the details of your solar service proposal below:`,
            '',
            `Proposal Ref: ${serviceDetails.refNumber || quoteNumber}`,
            `Date: ${quoteDate}`,
            serviceDetails.itemCount ? `Scope: ${serviceDetails.itemCount} Service Operations` : '',
            `Total Amount: ₹${formatINR(serviceDetails.grandTotal || totalAmount)}/-`,
        ].filter(Boolean);

        if (pdfUrl) {
            lines.push(
                '',
                `To view and download your official service document, click:`,
                pdfUrl
            );
        }

        lines.push(
            '',
            `Sincerely,`,
            `${vendorName}`,
            vendorSignatory ? `${vendorSignatory}` : '',
            vendorPhone ? `Phone: ${vendorPhone}` : ''
        );

        return lines.filter(Boolean).join('\n');
    }

    // 3. Standard Rooftop / Commercial Solar Mode
    const totalSubsidy = (Number(centralSubsidy) || 0) + (Number(stateSubsidy) || 0);
    const netCost = Math.max(0, (Number(totalAmount) || 0) - totalSubsidy);

    const lines: string[] = [
        `Dear ${customerName.trim()},`,
        '',
        `Please view the details of your solar quotation below:`,
        '',
        `Quotation No: ${quoteNumber}`,
        `Date: ${quoteDate}`,
        systemCapacityKw ? `Capacity: ${systemCapacityKw} kW (${systemType})` : `System: ${systemType}`,
        panelBrand ? `Solar Panels: ${panelBrand}${panelWattage ? ` ${panelWattage}Wp` : ''}` : '',
        `Total System Amount: ₹${formatINR(totalAmount)}/-`,
    ];

    if (totalSubsidy > 0) {
        lines.push(
            `Govt Subsidy (DBT): ₹${formatINR(totalSubsidy)}/-`,
            `Net Investment: ₹${formatINR(netCost)}/-`
        );
    }

    if (pdfUrl) {
        lines.push(
            '',
            `To view and download your official PDF document, click:`,
            pdfUrl
        );
    }

    lines.push(
        '',
        `Sincerely,`,
        `${vendorName}`,
        vendorSignatory ? `${vendorSignatory}` : '',
        vendorPhone ? `Phone: ${vendorPhone}` : ''
    );

    return lines.filter(Boolean).join('\n');
}

/**
 * Builds direct wa.me link with encoded text message.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
    const formattedPhone = formatWhatsAppPhoneNumber(phone);
    const encodedText = encodeURIComponent(message);
    if (formattedPhone) {
        return `https://wa.me/${formattedPhone}?text=${encodedText}`;
    }
    return `https://wa.me/?text=${encodedText}`;
}

/**
 * Launches WhatsApp directly in a new window or tab.
 * Returns the created Window reference or null if blocked by browser popup blocker.
 */
export function openWhatsAppDirect(phone: string, message: string): Window | null {
    if (typeof window === 'undefined') return null;
    const url = buildWhatsAppLink(phone, message);
    return window.open(url, '_blank', 'noopener,noreferrer');
}

