const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const AUTOMATED_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "mailer-daemon",
  "notifications",
  "security",
  "billing",
  "invoice",
];

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value = "") {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function getEmailDomain(value = "") {
  const email = normalizeEmail(value);
  if (!email.includes("@")) {
    return "";
  }

  return email.split("@")[1] || "";
}

export function isAutomatedEmail(value = "") {
  const email = normalizeEmail(value);
  const [localPart = ""] = email.split("@");
  return AUTOMATED_LOCAL_PARTS.some((part) => localPart.includes(part));
}
