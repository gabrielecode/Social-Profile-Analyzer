/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileData, ParsedProfileUrl } from '../types.ts';
import {
  fetchPublicHtml,
  extractMetaTags,
  parseHumanNumber,
  decodeHtmlEntities,
} from './fetchHelper.ts';

/**
 * Reader pubblico per pagine e profili Facebook.
 * Legge og:title, og:description, og:image e dati pubblici disponibili (nome, descrizione, categoria, follower/like).
 * Rileva in modo esplicito login wall o barriere d'accesso senza inventare alcun dato.
 */
export async function fetchFacebookProfile(
  parsedUrl: ParsedProfileUrl
): Promise<ProfileData> {
  const warnings: string[] = [];
  const missingFields: string[] = [];

  const profileUrl = parsedUrl.normalizedUrl;
  const handle = parsedUrl.handle;

  // Esegui il fetch della pagina pubblica (timeout 10s, max 1MB, protezione SSRF)
  const fetchResult = await fetchPublicHtml(profileUrl);

  if (!fetchResult.ok && !fetchResult.html) {
    warnings.push(
      fetchResult.error ||
        `Impossibile raggiungere Facebook (Codice di stato HTTP: ${fetchResult.status}).`
    );
    return {
      platform: 'facebook',
      handle,
      url: profileUrl,
      recentPosts: [],
      completeness: 'none',
      missingFields: [
        'displayName',
        'bio',
        'followers',
        'following',
        'postsCount',
        'avatarUrl',
      ],
      warnings,
    };
  }

  const html = fetchResult.html;
  const meta = extractMetaTags(html);

  // 1. Rilevamento Login Wall Facebook
  const pageTitle = meta['title'] || '';
  const isLoginWall =
    /log\s*in\s*(?:to\s*)?facebook/i.test(pageTitle) ||
    /accedi\s*(?:a\s*)?facebook/i.test(pageTitle) ||
    /entra\s*(?:su\s*)?facebook/i.test(pageTitle) ||
    /facebook\s*[-–|]\s*(?:log in|accedi|registrati)/i.test(pageTitle) ||
    html.includes('id="login_form"') ||
    html.includes('/login.php') ||
    fetchResult.finalUrl.includes('/login');

  if (isLoginWall) {
    warnings.push(
      "Login wall rilevato: Facebook richiede l'autenticazione per accedere ai dettagli completi del profilo. Sono stati estratti unicamente i meta-tag pubblici disponibili senza alcuna interpolazione."
    );
  }

  let displayName: string | undefined;
  let bio: string | undefined;
  let category: string | undefined;
  let followers: number | string | undefined;
  let following: number | string | undefined;
  let postsCount: number | string | undefined;
  let avatarUrl: string | undefined;

  // 2. Analisi og:title
  // Tipici formati:
  // - "Mark Zuckerberg | Facebook"
  // - "OpenAI - Azienda di intelligenza artificiale | Facebook"
  // - "Nike - Beaverton, Oregon - Azienda | Facebook"
  const ogTitle = meta['og:title'] || pageTitle;
  if (ogTitle) {
    const cleanTitle = ogTitle
      .replace(/\s*[|•\-–]\s*Facebook.*$/i, '')
      .replace(/\s*[|•\-–]\s*Home.*$/i, '')
      .trim();

    if (cleanTitle && !/log\s*in|accedi/i.test(cleanTitle)) {
      // Controlla se contiene un separatore con la categoria
      const titleParts = cleanTitle.split(/\s*[-–|•]\s*/);
      displayName = titleParts[0].trim();

      if (titleParts.length > 1) {
        category = titleParts[1].trim();
      }
    }
  }

  // 3. Analisi og:description
  // Tipici formati:
  // - "123.456 mi piace · 12.000 persone ne parlano. Azienda informatica a Roma. Scopri di più..."
  // - "12,345 likes · 500 talking about this. Media/news company..."
  // - "5,400 followers · 2 following · Public figure..."
  const ogDesc = meta['og:description'] || meta['description'] || '';

  if (ogDesc) {
    // Like o Follower count: sia "Follower: 121.471.700" sia "121M Followers" sia "Mi piace: 10K"
    const folLabelFirst = ogDesc.match(
      /(?:Follower|Followers|Mi piace|Likes|Persone che seguono|Seguaci)\s*[:：]\s*([0-9][0-9.,]*\s*[KkMmBbnl]?)/i
    );
    const folNumFirst = ogDesc.match(
      /([0-9][0-9.,]*\s*[KkMmBbnl]?)\s*(?:followers|follower|mi piace|likes)/i
    );
    if (folLabelFirst) {
      followers = parseHumanNumber(folLabelFirst[1]);
    } else if (folNumFirst) {
      followers = parseHumanNumber(folNumFirst[1]);
    }

    // Following count se presente: sia "Following: 50" sia "50 following"
    const followingLabelFirst = ogDesc.match(
      /(?:Following|Seguiti|Persone seguite)\s*[:：]\s*([0-9][0-9.,]*\s*[KkMmBbnl]?)/i
    );
    const followingNumFirst = ogDesc.match(
      /([0-9][0-9.,]*\s*[KkMmBbnl]?)\s*(?:following|seguiti)/i
    );
    if (followingLabelFirst) {
      following = parseHumanNumber(followingLabelFirst[1]);
    } else if (followingNumFirst) {
      following = parseHumanNumber(followingNumFirst[1]);
    }

    // Estrai bio e categoria dalla descrizione
    let cleanDesc = ogDesc
      // Rimuove prefisso nome es. "Mark Zuckerberg."
      .replace(new RegExp(`^${displayName}\\.\\s*`, 'i'), '')
      // Rimuove "Follower: 121.471.700 ·" o "123 mi piace ·"
      .replace(/(?:Follower|Followers|Mi piace|Likes)\s*[:：]\s*[0-9.,\sKkMmBbnl]+[·•.]\s*/gi, '')
      .replace(/^[0-9][0-9.,]*\s*[KkMmBbnl]?\s*(?:mi piace|likes|follower|followers)[^.]*?(?:[·•.]\s*|$)/i, '')
      .replace(/[0-9][0-9.,]*\s*[KkMmBbnl]?\s*(?:persone ne parlano|talking about this)[^.]*?(?:[·•.]\s*|$)/i, '')
      .trim();

    if (cleanDesc) {
      const descParts = cleanDesc.split(/\s*[·•]\s*/);
      if (descParts.length > 1 && !category) {
        category = descParts[0].trim();
        bio = descParts.slice(1).join(' · ').trim();
      } else {
        bio = cleanDesc;
      }
    }
  }

  // 4. Analisi Schema.org JSON-LD se presente
  const jsonLdMatch = html.match(
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonLdMatch && jsonLdMatch[1]) {
    try {
      const parsedLd = JSON.parse(jsonLdMatch[1]);
      const entity = parsedLd.mainEntity || parsedLd;
      if (entity) {
        if (!displayName && entity.name) {
          displayName = decodeHtmlEntities(entity.name);
        }
        if (!bio && entity.description) {
          bio = decodeHtmlEntities(entity.description);
        }
      }
    } catch {
      // Ignora JSON-LD malformato
    }
  }

  // 5. Estrazione Avatar (og:image)
  if (meta['og:image'] && !meta['og:image'].includes('facebook_default') && !meta['og:image'].includes('logo')) {
    avatarUrl = meta['og:image'];
  }

  if (category) {
    warnings.push(`Categoria rilevata per la pagina: "${category}".`);
  }

  // 6. Calcolo campi mancanti
  if (!displayName) missingFields.push('displayName');
  if (!bio) missingFields.push('bio');
  if (followers === undefined) missingFields.push('followers');
  if (following === undefined) missingFields.push('following');
  if (postsCount === undefined) missingFields.push('postsCount');
  if (!avatarUrl) missingFields.push('avatarUrl');

  // 7. Calcolo completezza
  let completeness: 'full' | 'partial' | 'none' = 'none';
  if (displayName && followers !== undefined) {
    completeness = 'full';
  } else if (displayName || followers !== undefined || avatarUrl || bio) {
    completeness = 'partial';
  } else {
    completeness = 'none';
    if (!warnings.some((w) => w.includes('Login wall'))) {
      warnings.push(
        "Nessun dato pubblico estraibile: la pagina Facebook potrebbe essere chiusa, non accessibile pubblicamente o limitata per area geografica."
      );
    }
  }

  return {
    platform: 'facebook',
    handle,
    url: profileUrl,
    displayName,
    bio,
    followers,
    following,
    postsCount,
    avatarUrl,
    recentPosts: [], // I post pubblici Facebook richiedono Graph API o rendering lato browser
    completeness,
    missingFields,
    warnings,
  };
}
