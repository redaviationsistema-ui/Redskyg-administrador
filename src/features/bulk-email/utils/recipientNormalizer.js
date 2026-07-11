import { getEmailDomain, isAutomatedEmail, isValidEmail, normalizeEmail } from "./emailValidator";

const EMAIL_HEADERS = ["email", "correo"];
const NAME_HEADERS = ["name", "nombre"];
const COMPANY_HEADERS = ["company", "empresa"];
const DOMAIN_HEADERS = ["domain", "dominio"];

function pickValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

export function normalizeRecipient(input) {
  const email = normalizeEmail(pickValue(input, EMAIL_HEADERS) || input?.email || "");
  const name = pickValue(input, NAME_HEADERS);
  const company = pickValue(input, COMPANY_HEADERS);
  const domain = pickValue(input, DOMAIN_HEADERS) || getEmailDomain(email);

  return {
    email,
    name,
    company,
    domain,
    isValid: isValidEmail(email),
    isAutomated: isAutomatedEmail(email),
  };
}

export function normalizeRecipients(inputs = [], unsubscribedEmails = []) {
  const unsubscribeSet = new Set(unsubscribedEmails.map((value) => normalizeEmail(value)));
  const seen = new Set();
  const records = [];

  for (const item of inputs) {
    const normalized = normalizeRecipient(item);
    const isEmpty = !normalized.email && !normalized.name && !normalized.company;

    if (isEmpty) {
      continue;
    }

    const isDuplicate = seen.has(normalized.email);
    if (normalized.email) {
      seen.add(normalized.email);
    }

    records.push({
      ...normalized,
      isDuplicate,
      isUnsubscribed: unsubscribeSet.has(normalized.email),
    });
  }

  const summary = records.reduce(
    (accumulator, record) => {
      accumulator.total += 1;
      if (record.isValid) {
        accumulator.valid += 1;
      } else {
        accumulator.invalid += 1;
      }
      if (record.isDuplicate) {
        accumulator.duplicates += 1;
      }
      if (record.isAutomated) {
        accumulator.automated += 1;
      }
      if (record.isUnsubscribed) {
        accumulator.unsubscribed += 1;
      }
      if (record.isValid && !record.isDuplicate && !record.isAutomated && !record.isUnsubscribed) {
        accumulator.ready += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      automated: 0,
      unsubscribed: 0,
      ready: 0,
    },
  );

  return { records, summary };
}
