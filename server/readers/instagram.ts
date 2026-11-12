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
 * Reader pubblico per Instagram.
 * Estrae i metadati Open Graph (og:title, og:description, og:image) e JSON-LD se presenti.
 * Rileva eventuali login wall e restituisce i dati in modalità best-effort.
 */
export async function fetchInstagramProfile(
  parsedUrl: ParsedProfileUrl
): Promise<ProfileData> {
  const warnings: string[] = [];
  const missingFields: string[] = [];

  const profileUrl = parsedUrl.normalizedUrl;
  const initialHandle = parsedUrl.handle;

  // Esegui il fetch della pagina pubblica (timeout 10s, max 1MB, protezione SSRF)
  const fetchResult = await fetchPublicHtml(profileUrl);

  if (!fetchResult.ok && !fetchResult.html) {
    warnings.push(
      fetchResult.error ||
        `Impossibile raggiungere Instagram (Codice di risposta HTTP: ${fetchResult.status}).`
    );
    return {
      platform: 'instagram',
      handle: initialHandle,
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

  // 1. Rilevamento Login Wall o Restrizioni Instagram
  const pageTitle = meta['title'] || '';
  const metaDesc = meta['description'] || '';
  const isGenericTitle =
    pageTitle.trim().toLowerCase() === 'instagram' ||
    (meta['og:title'] || '').trim().toLowerCase() === 'instagram';
  const isLoginSplash =
    /crea un account o accedi/i.test(metaDesc) ||
    /create an account or log in/i.test(metaDesc) ||
    /login\s*•\s*instagram/i.test(pageTitle) ||
    /accedi\s*•\s*instagram/i.test(pageTitle) ||
    html.includes('/accounts/login/') ||
    html.includes('data-login-page') ||
    fetchResult.finalUrl.includes('/accounts/login/');

  const isLoginWall = isLoginSplash || (isGenericTitle && !meta['og:description']);

  if (isLoginWall) {
    warnings.push(
      "Instagram richiede l'autenticazione (Login Wall). Sono stati estratti solo i meta-tag pubblici indicizzati disponibili senza interpolazione."
    );
  }

  // 2. Estrazione dati da og:title
  // Tipici formati:
  // - "Cristiano Ronaldo (@cristiano) • Foto e video di Instagram"
  // - "Nome Cognome (@handle) on Instagram"
  let displayName: string | undefined;
  let detectedHandle = initialHandle;

  const ogTitle = meta['og:title'] || pageTitle;
  if (ogTitle && !isGenericTitle) {
    const handleMatch = ogTitle.match(/^(.*?)\s*\(@([a-zA-Z0-9._]+)\)/i);
    if (handleMatch) {
      const parsedName = handleMatch[1].trim();
      const parsedHandle = handleMatch[2].trim();
      if (parsedName && !/instagram/i.test(parsedName)) {
        displayName = parsedName;
      }
      if (parsedHandle) {
        detectedHandle = parsedHandle;
      }
    } else {
      const cleanTitle = ogTitle
        .replace(/\s*[•\-–]\s*(?:Instagram|Foto e video di Instagram|Photos and Videos).*$/i, '')
        .trim();
      if (cleanTitle && !/login|accedi/i.test(cleanTitle) && !/instagram/i.test(cleanTitle)) {
        displayName = cleanTitle;
      }
    }
  }

  // 3. Estrazione dati da og:description
  let followers: number | string | undefined;
  let following: number | string | undefined;
  let postsCount: number | string | undefined;
  let bio: string | undefined;

  const ogDesc = meta['og:description'] || metaDesc;

  if (ogDesc && !/crea un account o accedi|create an account/i.test(ogDesc)) {
    // Le statistiche (follower, seguiti, post) restano estratte come ora dalla parte prima del primo " - "
    const firstDashIndex = ogDesc.indexOf(' - ');
    const statsPart = firstDashIndex !== -1 ? ogDesc.substring(0, firstDashIndex) : ogDesc;

    // Follower regex: sia "640M Follower" che "Follower: 640M"
    const folLabelFirst = statsPart.match(/(?:Follower|Followers|Seguaci)\s*[:：]\s*([0-9][0-9.,]*\s*[KkMmBbnl]?)/i);
    const folNumFirst = statsPart.match(/([0-9][0-9.,]*\s*[KkMmBbnl]?)\s*(?:Followers|follower|abbonati)/i);
    if (folLabelFirst) {
      followers = parseHumanNumber(folLabelFirst[1]);
    } else if (folNumFirst) {
      followers = parseHumanNumber(folNumFirst[1]);
    }

    // Following regex: sia "560 Seguiti" che "Seguiti: 560"
    const followLabelFirst = statsPart.match(/(?:Following|Seguiti|Persone seguite)\s*[:：]\s*([0-9][0-9.,]*\s*[KkMmBbnl]?)/i);
    const followNumFirst = statsPart.match(/([0-9][0-9.,]*\s*[KkMmBbnl]?)\s*(?:Following|seguiti|persone seguite)/i);
    if (followLabelFirst) {
      following = parseHumanNumber(followLabelFirst[1]);
    } else if (followNumFirst) {
      following = parseHumanNumber(followNumFirst[1]);
    }

    // Posts count regex: sia "3.700 Post" che "Post: 3.700"
    const postLabelFirst = statsPart.match(/(?:Post|Posts|Pubblicazioni)\s*[:：]\s*([0-9][0-9.,]*\s*[KkMmBbnl]?)/i);
    const postNumFirst = statsPart.match(/([0-9][0-9.,]*\s*[KkMmBbnl]?)\s*(?:Posts|post|pubblicazioni)/i);
    if (postLabelFirst) {
      postsCount = parseHumanNumber(postLabelFirst[1]);
    } else if (postNumFirst) {
      postsCount = parseHumanNumber(postNumFirst[1]);
    }

    // Estrazione Bio: solo dal testo tra virgolette dopo "on Instagram:" / "su Instagram:" (o equivalente).
    // Non dividere più og:description ad ogni "-" o ":".
    // Se non c'è una bio chiaramente identificabile, lascia bio non valorizzata: mai testo di boilerplate.
    const bioMatch =
      ogDesc.match(/(?:(?:on|su|en|sur|auf)\s+)?Instagram\s*[:：]\s*["“«„]([\s\S]*?)["”»“]\s*$/i) ||
      ogDesc.match(/(?:(?:on|su|en|sur|auf)\s+)?Instagram\s*[:：]\s*["“«„]([\s\S]*?)["”»“]/i);

    if (bioMatch && bioMatch[1]) {
      const candidateBio = decodeHtmlEntities(bioMatch[1]).replace(/^["“«„]|["”»“]$/g, '').trim();
      const isBoilerplate = /^(?:See Instagram photos and videos|Guarda le foto e i video|Crea un account|Create an account)/i.test(candidateBio);
      if (candidateBio.length > 0 && !isBoilerplate) {
        bio = candidateBio;
      }
    }
  }

  // 4. Cerca Schema.org JSON-LD (Person / ProfilePage) per eventuale displayName
  const jsonLdMatch = html.match(
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonLdMatch && jsonLdMatch[1]) {
    try {
      const parsedLd = JSON.parse(jsonLdMatch[1]);
      const mainEntity = parsedLd.mainEntity || parsedLd;
      if (mainEntity) {
        if (!displayName && mainEntity.name) {
          displayName = decodeHtmlEntities(mainEntity.name);
        }
      }
    } catch {
      // Ignora JSON-LD malformato
    }
  }

  // 6. Estrazione Immagine Profilo (og:image)
  let avatarUrl: string | undefined;
  if (meta['og:image'] && !meta['og:image'].includes('blank') && !meta['og:image'].includes('default')) {
    avatarUrl = meta['og:image'];
  }

  // Estrazione link esterno se presente nella bio
  let externalLink: string | undefined;
  if (bio) {
    const urlMatch = bio.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      externalLink = urlMatch[0].replace(/[.,;!]+$/, '');
    }
  }

  // 7. Calcolo campi mancanti
  if (!displayName) missingFields.push('displayName');
  if (!bio) missingFields.push('bio');
  if (followers === undefined) missingFields.push('followers');
  if (following === undefined) missingFields.push('following');
  if (postsCount === undefined) missingFields.push('postsCount');
  if (!avatarUrl) missingFields.push('avatarUrl');
  if (!externalLink) missingFields.push('externalLink');

  // 8. Valutazione completezza
  let completeness: 'full' | 'partial' | 'none' = 'none';
  const foundStats = [followers, following, postsCount].filter((v) => v !== undefined).length;

  if (foundStats >= 2 && displayName) {
    completeness = 'full';
  } else if (foundStats > 0 || displayName || avatarUrl || bio) {
    completeness = 'partial';
  } else {
    completeness = 'none';
    if (!warnings.includes("Instagram richiede l'autenticazione (Login Wall). Sono stati estratti solo i meta-tag pubblici indicizzati disponibili.")) {
      warnings.push(
        "Nessun dato pubblico estraibile: la pagina potrebbe essere privata, inesistente o soggetta a blocco antibot."
      );
    }
  }

  return {
    platform: 'instagram',
    handle: detectedHandle,
    url: profileUrl,
    displayName,
    bio,
    externalLink,
    followers,
    following,
    postsCount,
    avatarUrl,
    recentPosts: [], // I post recenti su Instagram richiedono autenticazione e rendering JS lato client
    completeness,
    missingFields,
    warnings,
  };
}
