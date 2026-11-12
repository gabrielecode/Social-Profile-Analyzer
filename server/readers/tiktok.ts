/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileData, ParsedProfileUrl, RecentPost } from '../types.ts';
import {
  fetchPublicHtml,
  extractMetaTags,
  parseHumanNumber,
  decodeHtmlEntities,
} from './fetchHelper.ts';

interface TikTokUserDetailScope {
  userInfo?: {
    user?: {
      id?: string;
      uniqueId?: string;
      nickname?: string;
      avatarLarger?: string;
      avatarMedium?: string;
      avatarThumb?: string;
      signature?: string;
      verified?: boolean;
      secUid?: string;
      bioLink?: {
        link?: string;
      };
      bioUrl?: string;
    };
    stats?: {
      followerCount?: number;
      followingCount?: number;
      heart?: number;
      heartCount?: number;
      videoCount?: number;
      diggCount?: number;
    };
  };
  itemList?: Array<{
    id?: string;
    desc?: string;
    stats?: {
      diggCount?: number;
      commentCount?: number;
      playCount?: number;
      shareCount?: number;
    };
    video?: {
      id?: string;
    };
  }>;
}

/**
 * Reader pubblico per TikTok.
 * Cerca il JSON incorporato nello script con id="__UNIVERSAL_DATA_FOR_REHYDRATION__",
 * fallback su "SIGI_STATE" e meta Open Graph.
 * Estrae nickname, bio, link in bio, verificato, follower, seguiti, like totali, video count e recentPosts.
 */
export async function fetchTikTokProfile(
  parsedUrl: ParsedProfileUrl
): Promise<ProfileData> {
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const recentPosts: RecentPost[] = [];

  let profileUrl = parsedUrl.normalizedUrl;
  let handle = parsedUrl.handle;

  // Esegui il fetch della pagina pubblica (segue redirect sicuri, es. da vm.tiktok.com a www.tiktok.com/@handle)
  const fetchResult = await fetchPublicHtml(profileUrl);

  if (!fetchResult.ok && !fetchResult.html) {
    warnings.push(
      fetchResult.error ||
        `Impossibile scaricare la pagina TikTok (HTTP ${fetchResult.status}).`
    );
    return {
      platform: 'tiktok',
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

  // Se siamo stati reindirizzati, aggiorna handle ed URL dall'URL finale
  if (fetchResult.finalUrl && fetchResult.finalUrl !== profileUrl) {
    profileUrl = fetchResult.finalUrl;
    const finalMatch = fetchResult.finalUrl.match(/@([a-zA-Z0-9._]+)/);
    if (finalMatch && finalMatch[1]) {
      handle = finalMatch[1];
    }
  }

  const html = fetchResult.html;

  // 1. Controllo Captcha / Bot Detection / Login Wall
  const hasCaptchaModal =
    /id=["']verify-center["']|id=["']captcha-verify-container["']|class=["'][^"']*verify-center/i.test(html);
  if (
    fetchResult.status === 403 ||
    fetchResult.status === 429 ||
    hasCaptchaModal
  ) {
    warnings.push(
      "TikTok ha presentato una schermata di verifica di sicurezza (Captcha / Bot detection). Alcuni o tutti i dati potrebbero non essere visibili."
    );
  }

  let displayName: string | undefined;
  let bio: string | undefined;
  let externalLink: string | undefined;
  let verified: boolean | undefined;
  let avatarUrl: string | undefined;
  let followers: number | string | undefined;
  let following: number | string | undefined;
  let postsCount: number | string | undefined;
  let totalLikes: number | string | undefined;

  let jsonFound = false;

  // 2. Ricerca del JSON principale nello script con id="__UNIVERSAL_DATA_FOR_REHYDRATION__"
  const universalMatch = html.match(
    /<script\s+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (universalMatch && universalMatch[1]) {
    try {
      const rawJson = universalMatch[1].trim();
      const parsed = JSON.parse(rawJson);
      jsonFound = true;

      const defaultScope = parsed['__DEFAULT_SCOPE__'];
      const userDetail: TikTokUserDetailScope =
        defaultScope?.['webapp.user-detail'] || parsed['webapp.user-detail'];

      if (userDetail?.userInfo) {
        const user = userDetail.userInfo.user;
        const stats = userDetail.userInfo.stats;

        if (user) {
          if (user.uniqueId) handle = user.uniqueId;
          if (user.nickname) displayName = decodeHtmlEntities(user.nickname);
          if (user.signature) bio = decodeHtmlEntities(user.signature);
          if (user.bioLink?.link) externalLink = user.bioLink.link;
          else if (user.bioUrl) externalLink = user.bioUrl;
          if (typeof user.verified === 'boolean') verified = user.verified;
          avatarUrl = user.avatarLarger || user.avatarMedium || user.avatarThumb;
        }

        if (stats) {
          if (stats.followerCount !== undefined) followers = stats.followerCount;
          if (stats.followingCount !== undefined) following = stats.followingCount;
          if (stats.videoCount !== undefined) postsCount = stats.videoCount;
          if (stats.heartCount !== undefined) totalLikes = stats.heartCount;
          else if (stats.heart !== undefined) totalLikes = stats.heart;
        }
      }

      // Estrai ultimi video (itemList)
      if (Array.isArray(userDetail?.itemList) && userDetail.itemList.length > 0) {
        for (const item of userDetail.itemList.slice(0, 10)) {
          const videoId = item.id || item.video?.id;
          recentPosts.push({
            caption: item.desc ? decodeHtmlEntities(item.desc) : undefined,
            likes: item.stats?.diggCount,
            comments: item.stats?.commentCount,
            views: item.stats?.playCount,
            url: videoId ? `https://www.tiktok.com/@${handle}/video/${videoId}` : undefined,
          });
        }
      }
    } catch (err: unknown) {
      warnings.push(`Errore nell'analisi del JSON __UNIVERSAL_DATA_FOR_REHYDRATION__: ${(err as Error).message}`);
    }
  }

  // 3. Fallback su SIGI_STATE se __UNIVERSAL_DATA_FOR_REHYDRATION__ non ha fornito i dati completi
  if (!displayName || followers === undefined) {
    const sigiMatch = html.match(
      /<script\s+id=["']SIGI_STATE__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (sigiMatch && sigiMatch[1]) {
      try {
        const sigi = JSON.parse(sigiMatch[1].trim());
        jsonFound = true;
        const users = sigi.UserModule?.users || {};
        const statsMap = sigi.UserModule?.stats || {};
        const userObj = Object.values(users)[0] as Record<string, unknown> | undefined;
        const statsObj = Object.values(statsMap)[0] as Record<string, unknown> | undefined;

        if (userObj) {
          if (!displayName && typeof userObj.nickname === 'string') {
            displayName = decodeHtmlEntities(userObj.nickname);
          }
          if (!bio && typeof userObj.signature === 'string') {
            bio = decodeHtmlEntities(userObj.signature);
          }
          if (verified === undefined && typeof userObj.verified === 'boolean') {
            verified = userObj.verified;
          }
          if (!avatarUrl && typeof userObj.avatarLarger === 'string') {
            avatarUrl = userObj.avatarLarger;
          }
          if (!externalLink && typeof userObj.bioLink === 'object' && userObj.bioLink) {
            externalLink = (userObj.bioLink as { link?: string }).link;
          }
        }

        if (statsObj) {
          if (followers === undefined && statsObj.followerCount !== undefined) {
            followers = statsObj.followerCount as number;
          }
          if (following === undefined && statsObj.followingCount !== undefined) {
            following = statsObj.followingCount as number;
          }
          if (postsCount === undefined && statsObj.videoCount !== undefined) {
            postsCount = statsObj.videoCount as number;
          }
          if (totalLikes === undefined && (statsObj.heartCount !== undefined || statsObj.heart !== undefined)) {
            totalLikes = (statsObj.heartCount ?? statsObj.heart) as number;
          }
        }

        // Ultimi video da ItemModule se non già trovati
        if (recentPosts.length === 0 && sigi.ItemModule) {
          const items = Object.values(sigi.ItemModule) as Array<Record<string, unknown>>;
          for (const item of items.slice(0, 10)) {
            const stats = item.stats as Record<string, number> | undefined;
            const itemId = String(item.id || '');
            recentPosts.push({
              caption: typeof item.desc === 'string' ? decodeHtmlEntities(item.desc) : undefined,
              likes: stats?.diggCount,
              comments: stats?.commentCount,
              views: stats?.playCount,
              url: itemId ? `https://www.tiktok.com/@${handle}/video/${itemId}` : undefined,
            });
          }
        }
      } catch {
        // Ignora parsing SIGI_STATE
      }
    }
  }

  // 4. Fallback su Open Graph Meta Tags
  const meta = extractMetaTags(html);
  if (!displayName && meta['og:title']) {
    // Es. "TikTok (@tiktok) | Guarda gli ultimi video di TikTok su TikTok"
    const ogTitle = meta['og:title'];
    const titleMatch = ogTitle.match(/^(.*?)\s*\(@([a-zA-Z0-9._]+)\)/i);
    if (titleMatch) {
      displayName = titleMatch[1].trim();
      if (!handle) handle = titleMatch[2].trim();
    } else {
      displayName = ogTitle.replace(/\s*[|•\-–].*$/i, '').trim();
    }
  }

  if (!avatarUrl && meta['og:image']) {
    avatarUrl = meta['og:image'];
  }

  if (meta['og:description']) {
    const ogDesc = meta['og:description'];
    if (followers === undefined) {
      const folMatch = ogDesc.match(/([0-9.,]+[KkMmBbnl]?)\s*(?:Followers|follower)/i);
      if (folMatch) followers = parseHumanNumber(folMatch[1]);
    }
    if (totalLikes === undefined) {
      const likeMatch = ogDesc.match(/([0-9.,]+[KkMmBbnl]?)\s*(?:Likes|mi piace)/i);
      if (likeMatch) totalLikes = parseHumanNumber(likeMatch[1]);
    }
    if (!bio) {
      // Estrai eventuale bio se presente nella descrizione
      const bioCandidate = ogDesc.replace(/^.*?(?:Followers|follower|Likes|mi piace)[^.]*\.\s*/i, '').trim();
      if (bioCandidate && !/guarda|watch/i.test(bioCandidate)) {
        bio = bioCandidate;
      }
    }
  }

  if (!jsonFound) {
    warnings.push(
      "Script __UNIVERSAL_DATA_FOR_REHYDRATION__ non rilevato nella risposta HTML. Sono stati utilizzati i meta-tag di fallback."
    );
  }

  // Se externalLink non è stato fornito nel campo dedicato ma è presente nella bio
  if (!externalLink && bio) {
    const urlMatch = bio.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      externalLink = urlMatch[0].replace(/[.,;!]+$/, '');
    }
  }

  // 5. Calcolo campi mancanti
  if (!displayName) missingFields.push('displayName');
  if (!bio) missingFields.push('bio');
  if (followers === undefined) missingFields.push('followers');
  if (following === undefined) missingFields.push('following');
  if (postsCount === undefined) missingFields.push('postsCount');
  if (!avatarUrl) missingFields.push('avatarUrl');
  if (!externalLink) missingFields.push('externalLink');

  // 6. Calcolo completezza
  let completeness: 'full' | 'partial' | 'none' = 'none';
  const hasStats = followers !== undefined && (following !== undefined || postsCount !== undefined);

  if (hasStats && displayName) {
    completeness = 'full';
  } else if (displayName || followers !== undefined || avatarUrl || bio) {
    completeness = 'partial';
  } else {
    completeness = 'none';
    warnings.push('Nessun dato pubblico estraibile dal profilo TikTok fornito.');
  }

  return {
    platform: 'tiktok',
    handle,
    url: profileUrl,
    displayName,
    bio,
    externalLink,
    followers,
    following,
    postsCount,
    totalLikes,
    verified,
    avatarUrl,
    recentPosts,
    completeness,
    missingFields,
    warnings,
  };
}
