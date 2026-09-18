// Capa de salida hacia n8n: nuestro backend nunca habla directamente con
// WhatsApp Business API ni con ningún proveedor de email — solo manda un
// JSON estructurado a un único webhook de n8n, y es el flujo de n8n quien
// decide por qué canal(es) enviar cada destinatario según qué datos de
// contacto tenga (teléfono → WhatsApp, email → email, ambos → ambos).
//
// Sin N8N_WEBHOOK_URL configurada, se simula igual que antes (solo log en
// consola) para no romper nada mientras no haya flujo de n8n montado.

export async function notificar({ tipo, despacho, finca, mensaje, destinatarios }) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`\n📲 [Simulado — falta N8N_WEBHOOK_URL] Notificación "${tipo}" para ${finca?.nombre || 'finca'}:`);
    destinatarios.forEach((d) => {
      console.log(`   ➔ ${d.nombre} (${d.propiedad || 's/p'}) — tel: ${d.telefono || '—'} · email: ${d.email || '—'}`);
    });
    return { enviado: true, real: false };
  }

  const payload = { tipo, despacho, finca, mensaje, destinatarios, disparado_en: new Date().toISOString() };

  const respuesta = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`n8n respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }

  return { enviado: true, real: true };
}
