export type CookieConsentChoice = 'accepted' | 'rejected' | 'unknown';

const COOKIE_NAME = 'apl_cookie_consent';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseCookieConsentValue(value: string | null): CookieConsentChoice {
  if (value === 'accepted' || value === 'rejected') {
    return value;
  }

  return 'unknown';
}

export function getCookieConsentFromDocument(): CookieConsentChoice {
  return parseCookieConsentValue(readCookie(COOKIE_NAME));
}

export function setCookieConsent(value: Exclude<CookieConsentChoice, 'unknown'>): void {
  if (typeof document === 'undefined') {
    return;
  }

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secure}`;
}
