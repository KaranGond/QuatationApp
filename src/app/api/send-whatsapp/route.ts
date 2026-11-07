import { NextRequest, NextResponse } from "next/server";
import { getUserSession, unauthorizedResponse } from "@/lib/authGuard";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const session = await getUserSession(request);
        if (!session) return unauthorizedResponse();

        const body = await request.json();
        const { phone, quotationData, vendor_id } = body;
        const effectiveVendorId = (!session.isSuperAdmin && session.vendor_id)
            ? session.vendor_id
            : vendor_id;

        if (!phone) {
            return NextResponse.json({ success: false, message: "Phone required" }, { status: 400 });
        }

        const apiKey = process.env.DOUBLETICK_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, message: "API key missing" }, { status: 500 });
        }

        // Resolve vendor details dynamically for multi-tenant branding
        let vendorName = "Solar Shop";
        let vendorPhone = "";

        if (effectiveVendorId) {
            try {
                const supabase = getServerSupabase();
                const { data: vendorData } = await supabase
                    .from('vendors')
                    .select('name, phone')
                    .eq('id', effectiveVendorId)
                    .single();
                if (vendorData) {
                    vendorName = vendorData.name || vendorName;
                    vendorPhone = vendorData.phone || "";
                }
            } catch {
                // Fallback to defaults
            }
        }

        // Clean and format phone - need +91 format
        const digits = String(phone).replace(/\D/g, "");
        if (digits.length < 10) {
            return NextResponse.json({ success: false, message: "Invalid phone" }, { status: 400 });
        }
        const last10 = digits.slice(-10);
        const formattedPhone = `+91${last10}`;

        // Build quotation message
        const {
            customerName = "Customer",
            systemSize = 0,
            panelBrand = "",
            panelWattage = 0,
            totalAmount = 0,
            effectiveCost = 0,
            centralSubsidy = 0,
            stateSubsidy = 0
        } = quotationData || {};

        const message = `🌞 *${vendorName.toUpperCase()}*
━━━━━━━━━━━━━━━━━
*Solar Quotation*

Dear *${customerName}*,

📊 *System: ${systemSize} KW*
• Panels: ${panelBrand} ${panelWattage}Wp

💰 *Total: ₹${new Intl.NumberFormat("en-IN").format(totalAmount)}*
🎁 Subsidy: ₹${new Intl.NumberFormat("en-IN").format(centralSubsidy + stateSubsidy)}
✨ *Pay Only: ₹${new Intl.NumberFormat("en-IN").format(effectiveCost)}*
${vendorPhone ? `\n📞 Contact: ${vendorPhone}` : ""}
━━━━━━━━━━━━━━━━━`;

        // Try text message first (works if customer messaged within 24hrs)
        const textPayload = {
            messages: [{ to: formattedPhone, content: { text: message } }]
        };

        let res = await fetch("https://public.doubletick.io/whatsapp/message/text", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": apiKey
            },
            body: JSON.stringify(textPayload)
        });

        let data = await res.json();

        // If text failed, try template message
        if (!res.ok) {
            // Use the quotation_document template already set up in DoubleTick
            const templatePayload = {
                messages: [{
                    to: formattedPhone,
                    content: {
                        templateName: "quotation_document",
                        language: "en",
                        templateData: {
                            body: { placeholders: [] }
                        }
                    }
                }]
            };

            res = await fetch("https://public.doubletick.io/whatsapp/message/template", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": apiKey
                },
                body: JSON.stringify(templatePayload)
            });

            data = await res.json();
        }

        if (!res.ok) {
            const errMsg = Array.isArray(data.message) ? data.message.join(", ") : (data.message || "Failed to send");
            return NextResponse.json({
                success: false,
                message: errMsg,
                sentTo: formattedPhone,
                note: "WhatsApp requires customer to have messaged you first, or you need an approved template."
            }, { status: res.status });
        }

        return NextResponse.json({ success: true, message: `Sent to ${formattedPhone}` });

    } catch (err: unknown) {
        console.error("WhatsApp API error:", err);
        return NextResponse.json({ success: false, message: (err as Error)?.message || 'Unknown error' }, { status: 500 });
    }
}
