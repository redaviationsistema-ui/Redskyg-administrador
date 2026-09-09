import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAvailabilityEmail, postAvailabilityEmail, createAvailabilitySender, appendAvailabilityRecord, AVAILABILITY_RECORD_ERROR } from '../src/utils/availabilityConfirmationEmail.js';
const quote = () => ({ id: 17, quote_number: 'TEST-17', client_contact: 'Test Customer', client_email: 'client@example.test', status: 'PENDING', sent_at: null, seguimiento: 'Original', validation_description: 'History', items: [{ part_number: 'PART-17', cert_type: 'TEST-CERT', description: 'TECHNICAL DETAILS', cd: 'SV', unavailable_certificates: ['EASA Form 1', 'CA Form 1'], unitPrice: 123456.78, image: 'IMAGE.jpg' }] });

test('plain English email includes customer, part, folio and real certificate only', () => {
 const mail = buildAvailabilityEmail(quote());
 assert.equal(mail.subject, 'Availability Confirmation | P/N PART-17 | TEST-17');
 assert.equal(mail.body, 'Dear Test Customer,\n\nThank you for your interest.\n\nWe would like to confirm that P/N PART-17 is currently available.\n\nThe unit is offered with TEST-CERT certification.\n\nCould you please confirm whether this certification is acceptable for your requirement and if you are still interested in the unit so we can proceed with the next steps?\n\nWe look forward to your comments.\n\nBest regards,\n\nSky Group / Red Aviation');
 assert.deepEqual(Object.keys(mail), ['email','to','quote','quote_id','client_name','part_number','certificate_type','subject','body']);
 for (const forbidden of ['123456.78','TECHNICAL DETAILS','EASA Form 1','CA Form 1','IMAGE.jpg','<table','<img','<div','✓','✕']) assert.ok(!JSON.stringify(mail).includes(forbidden));
 for (const key of ['pdf','html','price','image','items','status','sent_at','seguimiento']) assert.ok(!(key in mail));
});

test('missing certificate never blocks, invents or mentions certification', async () => {
 for (const value of [undefined,null,'','null','undefined']) {
  const input = quote(); input.items[0].cert_type = value;
  const mail = buildAvailabilityEmail(input);
  assert.ok(!mail.body.includes('certification'));
  assert.ok(!mail.body.includes('CoFC'));
  assert.ok(mail.body.includes('Could you please confirm if you are still interested in the unit so we can proceed with the next steps?'));
  const send = createAvailabilitySender({saveRecord: async () => ({}),loadQuote:async()=>input,send:async()=>({success:true})});
  assert.equal((await send(17)).success,true);
 }
});

test('null-like customer names use Dear Customer', () => {
 for (const value of [undefined,null,'','null','undefined']) {
  const input = quote(); input.client_contact=value;
  const mail=buildAvailabilityEmail(input);
  assert.ok(mail.body.startsWith('Dear Customer,'));
  assert.ok(!/null|undefined/.test(mail.body));
 }
});

for (const field of ['client_email','quote_number','part_number']) {
 test(`missing ${field} prevents requests`,async()=>{
  const input=quote(); if(field==='part_number') input.items[0].part_number=''; else input[field]='';
  let count=0; const send=createAvailabilitySender({saveRecord: async () => ({}),loadQuote:async()=>input,send:async()=>{count++;}});
  await assert.rejects(send(17)); assert.equal(count,0);
 });
}

test('invalid email is rejected',()=>{assert.throws(()=>buildAvailabilityEmail({...quote(),client_email:'invalid'}));});

test('click sends once and never mutates quote state',async()=>{
 const input=quote(), before=structuredClone(input);let count=0;
 const send=createAvailabilitySender({saveRecord: async () => ({}),loadQuote:async()=>input,send:async payload=>{count++;assert.equal(payload.to,input.client_email);return {success:true};}});
 assert.equal((await send(17)).success,true);assert.equal(count,1);assert.deepEqual(input,before);
});

test('double click produces one request; success and errors release the button sender',async()=>{
 let release,count=0;
 const send=createAvailabilitySender({saveRecord: async () => ({}),loadQuote:async()=>quote(),send:async()=>{count++;await new Promise(resolve=>{release=resolve;});return {success:true};}});
 const first=send(17);await Promise.resolve();await Promise.resolve();await send(17);assert.equal(count,1);release();await first;
 let attempts=0;
 const retry=createAvailabilitySender({saveRecord: async () => ({}),loadQuote:async()=>quote(),send:async()=>{if(++attempts===1)throw Error('failed');return {success:true};}});
 await assert.rejects(retry(17));assert.equal((await retry(17)).success,true);
});

const endpoint = 'https://redskyg.com/administrador/send_quote_v3.php';
const response = (data, status = 200) => new Response(JSON.stringify(data), {
 status, headers: { 'Content-Type': 'application/json' },
});

test('POST uses production URL and exact JSON payload without attachments or price', async () => {
 const input = quote(), before = structuredClone(input);
 for (const configured of [undefined, '', endpoint]) {
  const result = await postAvailabilityEmail(buildAvailabilityEmail(input), {
   endpoint: configured,
   fetchImpl: async (url, init) => {
    assert.equal(url.href, endpoint);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.deepEqual(JSON.parse(init.body), {
     to: input.client_email, email: input.client_email, client_name: input.client_contact,
     quote: input.quote_number, part_number: 'PART-17', certificate_type: 'TEST-CERT',
    });
    return response({ ok: true, success: true, message: 'Email sent successfully.' });
   },
  });
  assert.equal(result.success, true);
 }
 assert.deepEqual(input, before);
});

test('only boolean success true with successful HTTP status confirms delivery', async () => {
 for (const data of [{success:false},{success:false,message:'Email not sent'},{success:false,message:'Correo no enviado'},{ok:true},{success:'true'},null]) {
  await assert.rejects(postAvailabilityEmail(buildAvailabilityEmail(quote()), {fetchImpl: async () => response(data)}));
 }
 await assert.rejects(postAvailabilityEmail({}, {fetchImpl: async () => response({success:true},500)}));
 assert.equal((await postAvailabilityEmail({}, {fetchImpl: async () => response({success:true})})).success,true);
});

test('missing customer and certificate use safe JSON defaults', async () => {
 const input = quote(); delete input.client_contact; delete input.items[0].cert_type;
 await postAvailabilityEmail(buildAvailabilityEmail(input), {fetchImpl: async (_url, init) => {
  const payload = JSON.parse(init.body);
  assert.equal(payload.client_name, 'Customer'); assert.equal(payload.certificate_type, '');
  return response({success:true});
 }});
});

test('non-JSON diagnostics identify endpoint, status, type and safe opening characters', async () => {
 for (const raw of ['<?php $secret="private";', '<!DOCTYPE html><html>client@example.test</html>', 'private secret']) {
  await assert.rejects(postAvailabilityEmail({}, {fetchImpl: async () => new Response(raw, {status:502,headers:{'Content-Type':'text/html'}})}), error => {
   assert.equal(error.diagnostics.endpoint, endpoint);
   assert.equal(error.diagnostics.httpStatus, 502);
   assert.equal(error.diagnostics.contentType, 'text/html');
   assert.equal(error.diagnostics.invalidJson, true);
   assert.ok(error.diagnostics.responsePreview);
   assert.ok(!/private|secret|client@example/.test(JSON.stringify(error.diagnostics)));
   return true;
  });
 }
});

test('relative endpoints fail before fetching and transport failures propagate', async () => {
 let calls = 0;
 await assert.rejects(postAvailabilityEmail({}, {endpoint:'/administrador/send_quote_v3.php',fetchImpl:async()=>{calls++;}}));
 assert.equal(calls,0);
 await assert.rejects(postAvailabilityEmail({}, {fetchImpl:async()=>{throw new TypeError('Failed to fetch');}}), /Failed to fetch/);
});

test('multiple pieces use their own real certificate without inventing missing ones',()=>{
 const input=quote(); input.items.push({part_number:'PART-18'});
 const mail=buildAvailabilityEmail(input);assert.ok(mail.subject.includes('PART-17, PART-18'));assert.ok(mail.body.includes('P/N PART-17 is offered with TEST-CERT'));assert.ok(!mail.body.includes('PART-18 is offered'));
});

test('original table preserved and new action has local loading and updates the saved description locally',()=>{
 const source=fs.readFileSync('src/views/Quotes/inventario/QuotesValidation.vue','utf8');
 assert.ok(source.includes('<AvailabilityConfirmationButton :quote-id="quote.id" @record-saved="onAvailabilityRecordSaved" />'));
 assert.deepEqual([...source.matchAll(/<th>(.*?)<\/th>/g)].map(m=>m[1]),['Quote','Customer','Numero','Status','Segimiento','Date','Items','Description','Actions']);
 assert.equal((source.match(/class="stat-card"/g)||[]).length,4);
 assert.ok(!source.includes('certificate_status'));assert.ok(!source.includes('Ver datos y certificación'));
 const button=fs.readFileSync('src/components/AvailabilityConfirmationButton.vue','utf8');
 assert.ok(button.includes('Enviar confirmación de disponibilidad'));assert.ok(button.includes(':disabled="sending"'));assert.ok(button.includes('Enviando...'));
 assert.ok(!/\.update\(|\.insert\(|\.rpc\(|InventoryPdf|iframe/.test(button));
 assert.ok(button.includes("emit('record-saved', result.quote)"));
 assert.ok(button.includes('Correo enviado y registro guardado correctamente.'));
 assert.ok(button.includes("feedback.warning('Correo enviado; registro pendiente', error.message)"));
 assert.ok(source.includes('quote.validation_description = savedQuote.validation_description'));
 assert.ok(source.includes('{{ getDescriptionNotes(quote) }}'));
 for(const path of ['database/quote_certification_candidate.sql','database/quote_certification_local_test.sql','database/quote_certification_preflight.sql','DOCS/quote-certification.md','src/features/quote-certification']) assert.equal(fs.existsSync(path),false);
});

// An in-memory quotes store models filtered writes and concurrent changes.
function quoteStore(initial, { beforeWrite, readError, writeError } = {}) {
 const state = structuredClone(initial);
 const writes = [];
 let reads = 0;
 const client = { from(table) {
  assert.equal(table, 'quotes');
  let patch;
  const filters = [];
  const query = {
   select() { return query; },
   eq(key, value) { filters.push([key, value]); return query; },
   is(key, value) { filters.push([key, value]); return query; },
   update(value) { patch = value; return query; },
   async single() {
    reads++;
    assert.deepEqual(filters, [['id', state.id]]);
    return { data: structuredClone(state), error: readError };
   },
   async maybeSingle() {
    writes.push({ patch, filters });
    if (writeError) return { data: null, error: writeError };
    beforeWrite?.(state, writes.length);
    if (!filters.every(([key, value]) => state[key] === value)) return { data: null, error: null };
    Object.assign(state, patch);
    return { data: {id: state.id, validation_description: state.validation_description}, error: null };
   },
  };
  return query;
 }};
 return { client, state, writes, get reads() { return reads; } };
}
const recordDate = new Date(2026, 8, 9, 13, 45);
const expectedEntry = `[${recordDate.toLocaleString('es-MX', {dateStyle:'short',timeStyle:'short'})}] Availability & Certification Confirmation enviado a client@example.test | P/N PART-17 | Folio TEST-17`;

for (const previous of [null, '', 'Cliente contactado por teléfono.', '  Historial\noriginal.\n']) {
 test(`successful email appends to ${JSON.stringify(previous)} and changes no other fields`, async () => {
  const input = {...quote(), validation_description: previous, sale_status: 'vendio', sales_info: {note:'existing'}};
  const store = quoteStore(input);
  let sent = 0;
  const sender = createAvailabilitySender({
   loadQuote: async () => structuredClone(input),
   send: async () => { assert.equal(store.reads, 0); assert.equal(store.writes.length,0); sent++; return {success:true}; },
   saveRecord: (id, payload) => { assert.equal(sent,1); return appendAvailabilityRecord(store.client,id,payload,recordDate); },
  });
  const result = await sender(input.id);
  const expected = previous ? `${previous}\n\n${expectedEntry}` : expectedEntry;
  assert.deepEqual(store.state, {...input, validation_description:expected});
  assert.equal(result.quote.validation_description,expected);
  assert.equal(store.writes.length,1);
  assert.deepEqual(store.writes[0].patch,{validation_description:expected});
  assert.ok(store.writes[0].filters.some(([key,value]) => key==='id' && value===input.id));
 });
}

test('failed email never reads or writes the record and preserves the server error', async () => {
 for (const result of [{success:false,message:'El correo destino es inválido.'},{success:'true'},{ok:true}]) {
  let saves = 0;
  const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>result,saveRecord:async()=>{saves++;}});
  await assert.rejects(sender(17), error => { assert.ok(!error.emailSent); if (result.message) assert.equal(error.message,result.message); return true; });
  assert.equal(saves,0);
 }
 await assert.rejects(postAvailabilityEmail({}, {fetchImpl:async()=>response({success:false,message:'El correo destino es inválido.'},422)}), /El correo destino es inválido\./);
 let saves = 0;
 const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>{throw Error('network');},saveRecord:async()=>{saves++;}});
 await assert.rejects(sender(17),/network/); assert.equal(saves,0);
});

test('record read and write failures report that email was already sent, with technical cause', async () => {
 for (const operation of ['readError','writeError']) {
  const cause = {message:'database unavailable',code:'TEST'};
  const store = quoteStore(quote(),{[operation]:cause});
  let sends = 0;
  const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>{sends++;return {success:true};},saveRecord:(id,payload)=>appendAvailabilityRecord(store.client,id,payload)});
  await assert.rejects(sender(17), error => {
   assert.equal(error.emailSent,true); assert.equal(error.message,AVAILABILITY_RECORD_ERROR); assert.equal(error.cause,cause); return true;
  });
  assert.equal(sends,1); assert.equal(store.state.validation_description,'History');
 }
});

test('double click stays blocked during record saving, yielding one email and one entry', async () => {
 let release, saving;
 const started = new Promise(resolve => {saving=resolve;});
 const gate = new Promise(resolve => {release=resolve;});
 const store = quoteStore(quote()); let sends=0;
 const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>{sends++;return {success:true};},saveRecord:async(id,payload)=>{saving();await gate;return appendAvailabilityRecord(store.client,id,payload,recordDate);}});
 const first = sender(17); await started; await sender(17); release(); await first;
 assert.equal(sends,1); assert.equal(store.writes.length,1);
 assert.equal(store.state.validation_description,`History\n\n${expectedEntry}`);
});

test('reads latest history after sending and retries conflicts without sending email again', async () => {
 const store = quoteStore(quote(),{beforeWrite:(state,attempt)=>{if(attempt===1)state.validation_description+='\nConcurrent edit';}});
 let sends=0;
 const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>{sends++;store.state.validation_description='Edited during email';return {success:true};},saveRecord:(id,payload)=>appendAvailabilityRecord(store.client,id,payload,recordDate)});
 await sender(17);
 assert.equal(sends,1); assert.equal(store.reads,2);
 assert.equal(store.state.validation_description,`Edited during email\nConcurrent edit\n\n${expectedEntry}`);
});

test('repeated conflicts fail honestly without overwriting history or resending', async () => {
 const store = quoteStore(quote(),{beforeWrite:state=>{state.validation_description+=' updated';}});
 let sends=0;
 const sender = createAvailabilitySender({loadQuote:async()=>quote(),send:async()=>{sends++;return {success:true};},saveRecord:(id,payload)=>appendAvailabilityRecord(store.client,id,payload)});
 await assert.rejects(sender(17),error=>error.emailSent===true && error.message===AVAILABILITY_RECORD_ERROR);
 assert.equal(sends,1); assert.equal(store.writes.length,3);
 assert.equal(store.state.validation_description,'History updated updated updated');
});
