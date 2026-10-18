// Minimal HTML page of the unsubscribe link (seen by the contacted business, not the team).
import { environment } from '~config/environment';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Step = { step: 'confirm'; action: string } | { step: 'ready'; name: string } | { step: 'error' };

export function unsubscribePage(p: Step): string {
  const company = escape(environment.companyName);
  const content =
    p.step === 'confirm'
      ? `<h1>¿No quieres recibir más mensajes?</h1>
         <p>Confirma y ${company} no volverá a contactarte por ningún canal.</p>
         <form method="post" action="${escape(p.action)}"><button type="submit">Sí, no quiero más mensajes</button></form>`
      : p.step === 'ready'
        ? `<h1>Listo</h1><p>${escape(p.name)} no volverá a recibir mensajes de ${company}. Disculpa la molestia.</p>`
        : `<h1>Enlace no válido</h1><p>No pudimos procesar la solicitud. Responde al correo que recibiste con la palabra BAJA y lo haremos a mano.</p>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Mensajes de ${company}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#f5f5f2;color:#1f2420;margin:0;padding:48px 16px}
main{max-width:460px;margin:0 auto;background:#fff;border:1px solid #e3e3dd;border-radius:12px;padding:28px}
h1{font-size:21px;margin:0 0 8px}p{color:#555d57;margin:0 0 18px}
button{font:inherit;font-weight:600;background:#13684c;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}</style>
</head><body><main>${content}</main></body></html>`;
}
