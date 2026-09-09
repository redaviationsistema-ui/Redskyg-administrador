function text(value) {
  if (!['string', 'number'].includes(typeof value)) return '';
  const result = String(value).trim();
  return /^(null|undefined)$/i.test(result) ? '' : result;
}
const first = (...values) => values.map(text).find(Boolean) || '';
export function buildAvailabilityEmail(quote) {
  const email = text(quote.client_email);
  const folio = text(quote.quote_number);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('El cliente debe tener un email válido.');
  if (!folio) throw new Error('La cotización debe tener folio.');
  const items = (Array.isArray(quote.items) ? quote.items : []).map((item) => ({
    part: first(item.part_number, item.partNumber, item.PartNumber, item.partnumber, item.PARTNUMBER),
    certificate: first(item.cert_type, item.certType, item.certificate_type, item['CERT TYPE']),
  }));
  if (!items.length || items.some((item) => !item.part)) throw new Error('Cada pieza debe tener un P/N.');
  const name = first(quote.client_contact, quote.client_name) || 'Customer';
  const parts = [...new Set(items.map((item) => item.part))].join(', ');
  const hasCertificate = items.some((item) => item.certificate);
  const certificationLines = items.length === 1
    ? (items[0].certificate ? [`The unit is offered with ${items[0].certificate} certification.`] : [])
    : items.filter((item) => item.certificate).map((item) => `P/N ${item.part} is offered with ${item.certificate} certification.`);
  const body = [
    `Dear ${name},`,
    'Thank you for your interest.',
    `We would like to confirm that P/N ${parts} is currently available.`,
    ...certificationLines,
    hasCertificate
      ? 'Could you please confirm whether this certification is acceptable for your requirement and if you are still interested in the unit so we can proceed with the next steps?'
      : 'Could you please confirm if you are still interested in the unit so we can proceed with the next steps?',
    'We look forward to your comments.',
    'Best regards,',
    'Sky Group / Red Aviation',
  ].join('\n\n');
  return {
    email, to: email, quote: folio,
    ...(text(quote.id) ? { quote_id: text(quote.id) } : {}),
    client_name: name,
    part_number: parts,
    ...(items.length === 1 && items[0].certificate ? { certificate_type: items[0].certificate } : {}),
    subject: `Availability Confirmation | P/N ${parts} | ${folio}`,
    body,
  };
}

export async function postAvailabilityEmail(payload, { endpoint, fetchImpl = fetch } = {}) {
  const url = new URL(endpoint || 'https://redskyg.com/administrador/send_quote_v3.php');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    body: JSON.stringify({
      to: payload.email,
      email: payload.email,
      client_name: payload.client_name || 'Customer',
      quote: payload.quote,
      part_number: payload.part_number,
      certificate_type: payload.certificate_type || '',
    }),
  });
  const raw = await response.text();
  let data = null;
  let invalidJson = false;
  try { data = JSON.parse(raw); } catch { invalidJson = true; }
  if (!response.ok || data?.success !== true) {
    const message = typeof data?.message === 'string' ? data.message.trim().slice(0, 500) : '';
    const error = new Error(message || 'El servidor no confirmó el envío del correo.');
    error.diagnostics = {
      endpoint: `${url.origin}${url.pathname}`,
      httpStatus: response.status,
      contentType: response.headers?.get('content-type'),
      invalidJson,
      // Only retain a recognizable opening marker, never PHP source or customer data.
      responsePreview: invalidJson
        ? (raw.trimStart().match(/^(?:<\?php|<!doctype html>|<html\b|[<>{}\[\]])/i)?.[0] || '[contenido omitido]')
        : undefined,
    };
    throw error;
  }
  return data;
}

export const AVAILABILITY_RECORD_ERROR = 'El correo fue enviado correctamente, pero no se pudo guardar el registro en validation_description.';

export async function appendAvailabilityRecord(client, id, payload, now = new Date()) {
  const timestamp = now.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  const entry = `[${timestamp}] Availability & Certification Confirmation enviado a ${payload.email} | P/N ${payload.part_number} | Folio ${payload.quote}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current, error: readError } = await client.from('quotes')
      .select('id, validation_description').eq('id', id).single();
    if (readError) throw readError;
    if (!current) throw new Error('No se encontró la cotización para guardar el registro.');
    const previous = current.validation_description;
    const updatedDescription = previous ? `${previous}\n\n${entry}` : entry;
    let update = client.from('quotes')
      .update({ validation_description: updatedDescription }).eq('id', id);
    // Compare the exact value read, including null, so concurrent edits are not lost.
    update = previous === null
      ? update.is('validation_description', null)
      : update.eq('validation_description', previous);
    const { data, error } = await update.select('id, validation_description').maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  throw new Error('No se pudo guardar el registro: la cotización cambió o no se permitió actualizarla.');
}

export function createAvailabilitySender({ loadQuote, send, saveRecord }) {
  let busy = false;
  return async (id) => {
    if (busy) return;
    busy = true;
    try {
      const quote = await loadQuote(id);
      if (quote.id == null) throw new Error('La cotización debe tener un ID.');
      const payload = buildAvailabilityEmail(quote);
      const response = await send(payload);
      if (response?.success !== true) throw new Error(response?.message || 'El servidor no confirmó el envío del correo.');
      let savedQuote;
      try {
        savedQuote = await saveRecord(quote.id, payload);
      } catch (cause) {
        const error = new Error(AVAILABILITY_RECORD_ERROR, { cause });
        error.emailSent = true;
        throw error;
      }
      return { ...response, quote: savedQuote };
    } finally { busy = false; }
  };
}
