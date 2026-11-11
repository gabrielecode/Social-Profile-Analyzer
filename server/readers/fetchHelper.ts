/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isAllowedHost } from '../profileUrl.ts';

export interface FetchHtmlResult {
  ok: boolean;
  status: number;
  statusText?: string;
  html: string;
  finalUrl: string;
  error?: string;
  truncated?: boolean;
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MAX_BYTES = 1024 * 1024; // 1 MB
const TIMEOUT_MS = 10000; // 10s
const MAX_REDIRECTS = 5;

/**
 * Scarica una pagina HTML pubblica rispettando i vincoli di sicurezza:
 * - User-Agent da browser reale
 * - Timeout 10s con AbortSignal
 * - Dimensione massima 1 MB (prevenzione DoS)
 * - Nessun redirect verso host fuori allowlist (protezione SSRF)
 * - Modalità best-effort: non genera crash del server
 */
export async function fetchPublicHtml(initialUrl: string): Promise<FetchHtmlResult> {
  let currentUrl = initialUrl;
  let redirectsCount = 0;

  const overallController = new AbortController();
  const overallTimer = setTimeout(() => {
    overallController.abort();
  }, TIMEOUT_MS);

  try {
    while (redirectsCount <= MAX_REDIRECTS) {
      // Verifica host prima di ogni fetch
      let parsedCurrent: URL;
      try {
        parsedCurrent = new URL(currentUrl);
      } catch {
        return {
          ok: false,
          status: 0,
          html: '',
          finalUrl: currentUrl,
          error: `URL non valido durante il recupero: "${currentUrl}".`,
        };
      }

      if (parsedCurrent.protocol !== 'https:') {
        return {
          ok: false,
          status: 0,
          html: '',
          finalUrl: currentUrl,
          error: `Protocollo non sicuro bloccato durante il fetch: "${parsedCurrent.protocol}".`,
        };
      }

      if (!isAllowedHost(parsedCurrent.hostname)) {
        return {
          ok: false,
          status: 0,
          html: '',
          finalUrl: currentUrl,
          error: `Redirect bloccato per motivi di sicurezza verso l'host non consentito: "${parsedCurrent.hostname}".`,
        };
      }

      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'manual',
        signal: overallController.signal,
      });

      // Gestione Redirect (301, 302, 303, 307, 308)
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.headers.has('location')
      ) {
        const locationHeader = response.headers.get('location') || '';
        let nextUrl: URL;
        try {
          nextUrl = new URL(locationHeader, currentUrl);
        } catch {
          return {
            ok: false,
            status: response.status,
            html: '',
            finalUrl: currentUrl,
            error: `Header location non valido: "${locationHeader}".`,
          };
        }

        // Verifica che il redirect rimanga nei confini di sicurezza
        if (nextUrl.protocol !== 'https:' || !isAllowedHost(nextUrl.hostname)) {
          return {
            ok: false,
            status: response.status,
            html: '',
            finalUrl: currentUrl,
            error: `Redirect verso host o protocollo non consentito bloccato: "${nextUrl.origin}".`,
          };
        }

        currentUrl = nextUrl.toString();
        redirectsCount++;
        continue;
      }

      // Lettura sicura del body con limite di 1 MB
      let html = '';
      let truncated = false;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > MAX_BYTES) {
                const excess = totalBytes - MAX_BYTES;
                const allowedChunk = value.subarray(0, value.length - excess);
                chunks.push(allowedChunk);
                truncated = true;
                try {
                  await reader.cancel();
                } catch {
                  // ignora cancel err
                }
                break;
              }
              chunks.push(value);
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Concatena i chunk
        const mergedArray = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          mergedArray.set(chunk, offset);
          offset += chunk.length;
        }

        html = new TextDecoder('utf-8', { fatal: false }).decode(mergedArray);
      } else {
        html = await response.text();
        if (html.length > MAX_BYTES) {
          html = html.substring(0, MAX_BYTES);
          truncated = true;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        html,
        finalUrl: currentUrl,
        truncated,
      };
    }

    return {
      ok: false,
      status: 310,
      html: '',
      finalUrl: currentUrl,
      error: `Troppi reindirizzamenti (limite massimo di ${MAX_REDIRECTS} superato).`,
    };
  } catch (err: unknown) {
    const isTimeout =
      (err as Error)?.name === 'AbortError' || overallController.signal.aborted;

    return {
      ok: false,
      status: 0,
      html: '',
      finalUrl: currentUrl,
      error: isTimeout
        ? `Richiesta scaduta (timeout ${TIMEOUT_MS / 1000}s superato)`
        : (err as Error)?.message || 'Errore di rete durante la connessione al server',
    };
  } finally {
    clearTimeout(overallTimer);
  }
}

/**
 * Decodifica entità HTML comuni in testo pulito.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

/**
 * Estrae tutti i meta tag rilevanti da un documento HTML.
 */
export function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};

  if (!html) return meta;

  // Estrai title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    meta['title'] = decodeHtmlEntities(titleMatch[1]);
  }

  // Estrai <meta property="..." content="..."> e <meta name="..." content="...">
  const metaRegex =
    /<meta\s+[^>]*?(?:name|property)=["']([^"']+)["'][^>]*?content=["']([^"']*)["'][^>]*?>|<meta\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']([^"']+)["'][^>]*?>/gi;

  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const key = (match[1] || match[4] || '').toLowerCase().trim();
    const value = decodeHtmlEntities(match[2] || match[3] || '');
    if (key && value && !meta[key]) {
      meta[key] = value;
    }
  }

  return meta;
}

/**
 * Converte stringhe con moltiplicatori (es. "10M", "1.2K", "3,500", "500k") in numeri se possibile,
 * altrimenti restituisce la stringa formattata.
 */
export function parseHumanNumber(raw: string | number | undefined | null): number | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return raw;

  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return undefined;

  // Es. 1,234,567 o 1.234.567
  const pureNumMatch = cleaned.match(/^([0-9.,]+)$/);
  if (pureNumMatch) {
    const s = pureNumMatch[1];
    // Se contiene solo una virgola o punto decimale: 1.5 o 1,5
    if (/^[0-9]+[.,][0-9]{1,2}$/.test(s)) {
      return parseFloat(s.replace(',', '.'));
    }
    // Rimozione separatori migliaia
    const numOnly = s.replace(/[.,]/g, '');
    const parsed = parseInt(numOnly, 10);
    return isNaN(parsed) ? cleaned : parsed;
  }

  // Es. 10.5M, 10M, 150K, 2.5B, 12mln
  const multiplierMatch = cleaned.match(/^([0-9.,]+)\s*([kKmMbB]|mln|mila)?$/i);
  if (multiplierMatch) {
    const numPart = parseFloat(multiplierMatch[1].replace(',', '.'));
    const unit = (multiplierMatch[2] || '').toLowerCase();
    if (isNaN(numPart)) return cleaned;

    if (unit === 'k' || unit === 'mila') return Math.round(numPart * 1_000);
    if (unit === 'm' || unit === 'mln') return Math.round(numPart * 1_000_000);
    if (unit === 'b') return Math.round(numPart * 1_000_000_000);
    return Math.round(numPart);
  }

  return cleaned;
}
