/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ParsedProfileUrl, Platform } from './types.ts';

/**
 * Hostname consentiti per le piattaforme supportate (protezione SSRF).
 * Vengono accettati esclusivamente domini ufficiali in HTTPS.
 */
export const ALLOWED_HOSTS = new Set<string>([
  'instagram.com',
  'www.instagram.com',
  'tiktok.com',
  'www.tiktok.com',
  'vm.tiktok.com',
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.com',
]);

const INSTAGRAM_HOSTS = new Set<string>(['instagram.com', 'www.instagram.com']);
const TIKTOK_HOSTS = new Set<string>(['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com']);
const FACEBOOK_HOSTS = new Set<string>([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.com',
]);

/**
 * Verifica se un host appartiene alla allowlist consentita.
 */
export function isAllowedHost(host: string): boolean {
  if (!host) return false;
  return ALLOWED_HOSTS.has(host.toLowerCase().trim());
}

/**
 * Verifica la sicurezza dell'URL contro attacchi SSRF, loopback e accessi a reti interne.
 */
export function validateUrlSecurity(urlObj: URL): void {
  // 1. Solo protocollo HTTPS
  if (urlObj.protocol !== 'https:') {
    throw new Error('URL non valido: è consentito esclusivamente il protocollo sicuro HTTPS.');
  }

  // 2. Rifiuta credenziali incorporate nell'URL (es. https://user:pass@domain.com)
  if (urlObj.username || urlObj.password) {
    throw new Error('URL non valido: credenziali utente nell\'URL non consentite.');
  }

  // 3. Rifiuta porte non standard
  if (urlObj.port && urlObj.port !== '443') {
    throw new Error('URL non valido: porte non standard non consentite.');
  }

  const hostname = urlObj.hostname.toLowerCase();

  // 4. Rifiuta IP numerici (IPv4, IPv6, notazioni ottali/esadecimali)
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIpv6 = /^\[?[0-9a-fA-F:]+\]?$/.test(hostname);
  const isHexOrOctal = /^0x[0-9a-fA-F]+$/i.test(hostname) || /^0[0-7]+$/.test(hostname);
  if (isIpv4 || isIpv6 || isHexOrOctal) {
    throw new Error('Accesso negato: gli indirizzi IP diretti sono bloccati per motivi di sicurezza.');
  }

  // 5. Rifiuta localhost e domini locali o interni
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.onion')
  ) {
    throw new Error('Accesso negato: indirizzi locali o interni sono severamente vietati.');
  }

  // 6. Controllo stretto sull'allowlist
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(
      `Piattaforma non supportata o host non autorizzato: "${urlObj.hostname}". Sono ammessi esclusivamente URL ufficiali di Instagram, TikTok e Facebook.`
    );
  }
}

/**
 * Analizza e valida l'URL di un profilo social.
 * Riconosce la piattaforma (Instagram, TikTok, Facebook) e ricava l'handle/username.
 * Applica controlli stringenti di sicurezza SSRF.
 */
export function parseProfileUrl(rawUrl: string): ParsedProfileUrl {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('URL vuoto: inserisci il link di un profilo pubblico Instagram, TikTok o Facebook.');
  }

  const trimmed = rawUrl.trim();

  // Se l'utente ha inserito "instagram.com/user" senza schema, lo segnaliamo chiaramente
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL non valido: specifica il protocollo completo "https://".');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Formato URL non valido: impossibile analizzare l\'indirizzo specificato.');
  }

  // Esegui la verifica di sicurezza SSRF
  validateUrlSecurity(parsed);

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/\/+/g, '/');
  const segments = pathname.split('/').filter(Boolean);

  // --- INSTAGRAM ---
  if (INSTAGRAM_HOSTS.has(hostname)) {
    if (segments.length === 0) {
      throw new Error("L'URL inserito punta alla home page di Instagram e non contiene l'username di un profilo.");
    }

    const firstSegment = segments[0];
    const reservedIgPaths = new Set([
      'p',
      'reel',
      'reels',
      'stories',
      'explore',
      'direct',
      'accounts',
      'developer',
      'about',
      'legal',
      'help',
      'privacy',
      'api',
      'graphql',
    ]);

    if (reservedIgPaths.has(firstSegment.toLowerCase())) {
      throw new Error(
        `L'URL inserito fa riferimento a un post, reel o sezione interna di Instagram ("/${firstSegment}/"), non a un profilo utente.`
      );
    }

    const handle = firstSegment.startsWith('@') ? firstSegment.slice(1) : firstSegment;

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) {
      throw new Error(`Username Instagram non valido: "${handle}".`);
    }

    return {
      platform: 'instagram',
      handle,
      normalizedUrl: `https://www.instagram.com/${handle}/`,
      originalUrl: trimmed,
    };
  }

  // --- TIKTOK ---
  if (TIKTOK_HOSTS.has(hostname)) {
    if (hostname === 'vm.tiktok.com') {
      if (segments.length === 0) {
        throw new Error("L'URL breve di TikTok (vm.tiktok.com) non contiene un codice profilo valido.");
      }
      const shortCode = segments[0];
      return {
        platform: 'tiktok',
        handle: shortCode,
        normalizedUrl: `https://vm.tiktok.com/${shortCode}/`,
        originalUrl: trimmed,
      };
    }

    if (segments.length === 0) {
      throw new Error("L'URL inserito punta alla home page di TikTok e non a un profilo utente.");
    }

    const reservedTiktokPaths = new Set([
      'tag',
      'music',
      'foryou',
      'explore',
      'live',
      'trending',
      'about',
      'legal',
      'privacy',
    ]);

    let rawHandle = segments[0];
    if (reservedTiktokPaths.has(rawHandle.toLowerCase())) {
      throw new Error(
        `L'URL inserito fa riferimento a una sezione interna di TikTok ("/${rawHandle}/"), non a un profilo.`
      );
    }

    if (rawHandle.startsWith('@')) {
      rawHandle = rawHandle.slice(1);
    }

    if (!rawHandle || !/^[a-zA-Z0-9._]{1,50}$/.test(rawHandle)) {
      throw new Error(`Handle TikTok non valido: "${segments[0]}".`);
    }

    return {
      platform: 'tiktok',
      handle: rawHandle,
      normalizedUrl: `https://www.tiktok.com/@${rawHandle}`,
      originalUrl: trimmed,
    };
  }

  // --- FACEBOOK ---
  if (FACEBOOK_HOSTS.has(hostname)) {
    if (segments.length === 0 && !parsed.searchParams.has('id')) {
      throw new Error("L'URL inserito punta alla home page di Facebook e non a una pagina o profilo.");
    }

    const reservedFbPaths = new Set([
      'groups',
      'events',
      'watch',
      'marketplace',
      'gaming',
      'login',
      'recover',
      'help',
      'policies',
      'ads',
      'messages',
      'notifications',
    ]);

    if (segments.length > 0 && reservedFbPaths.has(segments[0].toLowerCase())) {
      if (segments[0].toLowerCase() === 'groups') {
        throw new Error("L'URL fa riferimento a un gruppo Facebook, non a una pagina o profilo pubblico.");
      }
      throw new Error(`L'URL fa riferimento a una sezione di Facebook ("/${segments[0]}/"), non a un profilo.`);
    }

    let handle = '';

    // Caso: facebook.com/profile.php?id=1000...
    if (segments[0] === 'profile.php' && parsed.searchParams.has('id')) {
      handle = parsed.searchParams.get('id') || '';
    } else if (segments[0] === 'pages' && segments.length >= 2) {
      // Caso: facebook.com/pages/NomePagina/12345
      handle = segments[segments.length - 1] || segments[1];
    } else if (segments.length > 0) {
      // Caso classico: facebook.com/pagename
      handle = segments[0];
    }

    if (!handle) {
      throw new Error('Impossibile determinare l\'identificativo o l\'username della pagina Facebook dall\'URL fornito.');
    }

    // Pulisci eventuale @ iniziale o parametri
    handle = handle.startsWith('@') ? handle.slice(1) : handle;

    return {
      platform: 'facebook',
      handle,
      normalizedUrl: `https://www.facebook.com/${handle}`,
      originalUrl: trimmed,
    };
  }

  throw new Error(`Piattaforma non supportata: ${hostname}.`);
}
