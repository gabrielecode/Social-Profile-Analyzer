/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { apiV1CorsMiddleware, apiV1AuthMiddleware } from '../auth/apiKeyAuth.ts';
import { parseProfileUrl } from '../profileUrl.ts';
import { fetchInstagramProfile } from '../readers/instagram.ts';
import { fetchTikTokProfile } from '../readers/tiktok.ts';
import { fetchFacebookProfile } from '../readers/facebook.ts';
import { generateFullAdvice, formatRecommendedServices } from '../services/adviceService.ts';
import type { ProfileData } from '../types.ts';

const v1Router = Router();

// Op.1 — CORS per browser (salvo origini esplicitamente elencate in ALLOWED_ORIGINS)
v1Router.use(apiV1CorsMiddleware);

// Op.1 — Autenticazione Bearer con confronto a tempo costante (401 senza dettagli in caso di errore)
v1Router.use(apiV1AuthMiddleware);

/**
 * GET /api/v1/health
 * Verifica lo stato dell'API v1 protetta e la validità delle credenziali fornite.
 */
v1Router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    schemaVersion: 1,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/analyze
 * Body: { url: string }
 *
 * Esegue in un'unica chiamata:
 * 1. Validazione e parsing dell'URL (con protezione SSRF)
 * 2. Lettura del profilo pubblico da Instagram, TikTok o Facebook
 * 3. Consigli (IA con fallback automatico su regole)
 * 4. Servizi raccomandati collegati al catalogo Aurora-ADV
 *
 * Risposta JSON versionata:
 * {
 *   "success": true,
 *   "schemaVersion": 1,
 *   "data": {
 *     "profile": {},
 *     "advice": {},
 *     "recommendedServices": [],
 *     "generatedAt": "..."
 *   }
 * }
 */
v1Router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (!rawUrl) {
      res.status(400).json({
        success: false,
        schemaVersion: 1,
        error: 'URL non specificato. Fornisci un payload JSON con il campo "url" (es. { "url": "https://..." }).',
        code: 'MISSING_URL',
      });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = parseProfileUrl(rawUrl);
    } catch (parseErr: unknown) {
      const errorMsg =
        parseErr instanceof Error ? parseErr.message : 'URL non valido o piattaforma non supportata.';
      res.status(400).json({
        success: false,
        schemaVersion: 1,
        error: errorMsg,
        code: 'INVALID_URL',
      });
      return;
    }

    let profileData: ProfileData;
    switch (parsedUrl.platform) {
      case 'instagram':
        profileData = await fetchInstagramProfile(parsedUrl);
        break;
      case 'tiktok':
        profileData = await fetchTikTokProfile(parsedUrl);
        break;
      case 'facebook':
        profileData = await fetchFacebookProfile(parsedUrl);
        break;
      default:
        res.status(400).json({
          success: false,
          schemaVersion: 1,
          error: 'Piattaforma social non supportata. Piattaforme ammesse: Instagram, TikTok, Facebook.',
          code: 'UNSUPPORTED_PLATFORM',
        });
        return;
    }

    // Generazione consigli: IA potenziata con fallback automatico a regole
    const advice = await generateFullAdvice(profileData);

    // Servizi raccomandati formattati
    const recommendedServices = formatRecommendedServices(advice.recommendedServices || []);

    // Separa advice interno dal profilo per una struttura pulita e senza ridondanze
    const { advice: _internalAdvice, ...cleanProfile } = profileData;

    res.json({
      success: true,
      schemaVersion: 1,
      data: {
        profile: cleanProfile,
        advice,
        recommendedServices,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Errore imprevisto durante l'analisi del profilo.";
    console.error('[API /api/v1/analyze error]:', errorMessage);

    res.status(500).json({
      success: false,
      schemaVersion: 1,
      error: errorMessage,
      code: 'ANALYSIS_ERROR',
    });
  }
});

// Gestione 404 per rotte v1 non registrate (ma autenticate)
v1Router.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    schemaVersion: 1,
    error: 'Endpoint non trovato su /api/v1.',
    code: 'NOT_FOUND',
  });
});

export default v1Router;
