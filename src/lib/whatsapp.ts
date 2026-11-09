import axios from 'axios';

export async function sendWhatsAppMessage(phone: string, pdfUrl: string) {
  let formattedPhone = phone;
  try {
    const apiKey = process.env.DOUBLETICK_API_KEY;
    const senderPhone = process.env.DOUBLETICK_SENDER_PHONE;
    if (!apiKey || !senderPhone) {
      console.log('ℹ️ DoubleTick API not configured. WhatsApp will be shared directly via wa.me links.');
      return;
    }
    let cleanedPhone = phone.replace(/[^0-9]/g, '');
    // Strip leading country code if present (91XXXXXXXXXX)
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.slice(2);
    }
    // Strip leading 0 (Indian STD format: 0XXXXXXXXXX)
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.slice(1);
    }
    if (cleanedPhone.length !== 10) throw new Error(`Invalid phone number: ${phone}`);
    formattedPhone = `+91${cleanedPhone}`;
    // Extract clean filename from URL (handles signed URLs with query params)
    const urlPath = new URL(pdfUrl).pathname;
    const cleanFilename = urlPath.split('/').pop() || 'quotation.pdf';

    const payload = {
      messages: [{ to: formattedPhone, from: senderPhone, content: { templateName: 'quotation_document', language: 'en', templateData: { header: { type: 'DOCUMENT' as const, mediaUrl: pdfUrl, filename: cleanFilename }, body: { placeholders: [] } } } }]
    };

    console.log(`📤 Sending WhatsApp to ${formattedPhone} with PDF: ${cleanFilename}`);
    console.log(`   PDF URL length: ${pdfUrl.length} chars`);

    const send = async () => {
      const response = await axios.post(
        'https://public.doubletick.io/whatsapp/message/template',
        payload,
        { headers: { 'accept': 'application/json', 'content-type': 'application/json', 'Authorization': apiKey }, timeout: 20000 }
      );
      // Log the DoubleTick response for debugging
      console.log('DoubleTick response:', JSON.stringify(response.data));
      return response;
    };
    let attempt = 0;
    const maxAttempts = 3;
    while (true) {
      try {
        await send();
        break;
      } catch (err: unknown) {
        attempt += 1;
        const axErr = err as any;
        const isTimeout = axErr?.code === 'ECONNABORTED' || /timeout/i.test(axErr?.message || '');
        console.warn(`WhatsApp send attempt ${attempt}/${maxAttempts} failed:`, axErr?.response?.data || axErr?.message);
        if (attempt >= maxAttempts || !isTimeout) throw err;
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
    console.log(`✅ WhatsApp message queued for ${formattedPhone} (note: delivery is async)`);
  } catch (error) {
    const errorData = (error as any).response?.data;
    console.error('Doubletick API error:', errorData || (error as any).message);
    
    // Check if the error indicates the number is not registered on WhatsApp
    let errorMessage = 'Failed to send WhatsApp message.';
    if (errorData) {
      const details = JSON.stringify(errorData).toLowerCase();
      if (details.includes('not a valid whatsapp') || details.includes('not registered') || details.includes('invalid contact')) {
        errorMessage = `The number ${formattedPhone} is not registered on WhatsApp.`;
      } else if (errorData.message) {
        errorMessage = `WhatsApp Error: ${errorData.message}`;
      } else if (errorData.error?.message) {
        errorMessage = `WhatsApp Error: ${errorData.error.message}`;
      }
    }
    throw new Error(errorMessage);
  }
}