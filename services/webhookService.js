const axios = require('axios'); // Need to install axios or use fetch (Node 18+)
// Using fetch since Node 18+ supports it natively, but let's stick to axios if we install it, or just fetch.
// I'll use native fetch to avoid another dependency if possible, but axios is safer for older nodes.
// Let's assume Node 18+ or I'll add axios to package.json later.
// Actually, I'll use standard http/https module or fetch.
// Let's use fetch.

async function triggerWebhook(event, data, merchantSettings) {
    // merchantSettings should contain webhook_url if configured
    // For MVP, let's assume a global webhook or per-merchant setting

    // In a real app, we'd look up the merchant's webhook URL from their settings.
    // For this demo, I'll just log it or send to a dummy URL if provided in env.

    const webhookUrl = merchantSettings?.webhook_url;

    if (!webhookUrl) {
        console.log(`[Webhook] No URL configured for event: ${event}`);
        return;
    }

    console.log(`[Webhook] Triggering ${event} to ${webhookUrl}`);

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, data, timestamp: new Date() })
        });
        console.log(`[Webhook] Success`);
    } catch (err) {
        console.error(`[Webhook] Failed:`, err.message);
    }
}

module.exports = { triggerWebhook };
