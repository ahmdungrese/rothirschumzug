/**
 * Global Input Validation, Sanitization & Security Shield
 * Prevents XSS, script injection, multi-line pollution, and enforces standard limits.
 */

// Universal Regexes
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Human name regex: letters (including German Umlauts & Arabic), spaces, hyphens, dots, apostrophes
export const HUMAN_NAME_REGEX = /^[a-zA-ZÀ-ÿ\u0600-\u06FF\s\-'.]+$/;

// Allowed characters in phone numbers
export const PHONE_CHARS_REGEX = /^[+0-9\s\-./()]+$/;

// Detects dangerous script tags, HTML tags, or javascript pseudo-protocols
export function containsMaliciousCode(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    /<[^>]*>/i.test(val) || // HTML tags <...>
    /javascript:/i.test(lower) ||
    /data:text\/html/i.test(lower) ||
    /<\s*script/i.test(lower) ||
    /onload\s*=/i.test(lower) ||
    /onerror\s*=/i.test(lower) ||
    /onclick\s*=/i.test(lower) ||
    /<iframe/i.test(lower)
  );
}

// Sanitize string: strips HTML tags, replaces newlines in single-line inputs, truncates
export function sanitizeText(val: string, maxLength: number = 60): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[\r\n]+/g, ' ') // strip line breaks
    .slice(0, maxLength);
}

// Dedicated Name Validator
export function validateHumanName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Bitte geben Sie einen Namen ein.';
  }
  if (containsMaliciousCode(name)) {
    return 'Ungültige Eingabe: HTML- oder Script-Code ist nicht erlaubt.';
  }
  if (trimmed.length < 2) {
    return 'Der Name muss mindestens 2 Zeichen lang sein.';
  }
  if (trimmed.length > 50) {
    return 'Der Name darf maximal 50 Zeichen lang sein.';
  }
  if (!HUMAN_NAME_REGEX.test(trimmed)) {
    return 'Der Name darf nur Buchstaben, Leerzeichen, Punkte und Bindestriche enthalten (keine Symbole wie !, @, #, *, etc.).';
  }
  return null;
}

// Dedicated Login-ID / Identifier Validator (Phone or Email)
export function validateLoginIdentifier(loginId: string): string | null {
  const trimmed = loginId.trim();
  if (!trimmed) {
    return 'Bitte geben Sie eine Handynummer oder E-Mail-Adresse ein.';
  }
  if (containsMaliciousCode(loginId)) {
    return 'Ungültige Eingabe: HTML- oder Script-Code ist nicht erlaubt.';
  }
  if (trimmed.length > 80) {
    return 'Die Eingabe darf maximal 80 Zeichen lang sein.';
  }
  if (trimmed.includes('@')) {
    if (!EMAIL_REGEX.test(trimmed)) {
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z. B. name@rothirsch-umzug.de).';
    }
  } else {
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (!PHONE_CHARS_REGEX.test(trimmed) || digitsOnly.length < 6) {
      return 'Ungültige Eingabe: Bitte eine gültige Handynummer (mind. 6 Ziffern) oder E-Mail eingeben.';
    }
    if (digitsOnly.length > 25) {
      return 'Die Telefonnummer ist zu lang (maximal 25 Ziffern).';
    }
  }
  return null;
}

// Dedicated Password Validator
export function validatePasswordInput(password: string): string | null {
  const trimmed = password.trim();
  if (!trimmed) {
    return 'Bitte geben Sie ein Start-Passwort ein.';
  }
  if (containsMaliciousCode(password)) {
    return 'Ungültige Eingabe: HTML- oder Script-Code ist nicht erlaubt.';
  }
  if (trimmed.length < 6) {
    return 'Das Passwort muss mindestens 6 Zeichen oder Ziffern lang sein (z. B. 6-stelliger PIN).';
  }
  if (trimmed.length > 50) {
    return 'Das Passwort darf maximal 50 Zeichen lang sein.';
  }
  return null;
}
