/**
 * Thin client for the Meta WhatsApp Business Cloud API (template messages only).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages/send-messages
 */
export type SendTemplateInput = { to: string; templateName: string; language: string; params: string[] };

export async function sendTemplate(input: SendTemplateInput): Promise<{ id: string }> {
  if (process.env.WHATSAPP_DRY_RUN === "true") {
    console.log(`[whatsapp:dry-run] to=${input.to} template=${input.templateName} params=${JSON.stringify(input.params)}`);
    return { id: `dry-run-${Date.now()}` };
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
  }
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components: input.params.length
          ? [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }]
          : [],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok) throw new Error(json.error?.message ? `${json.error.message} (code ${json.error.code})` : `WhatsApp API HTTP ${res.status}`);
  return { id: json.messages?.[0]?.id ?? "" };
}
