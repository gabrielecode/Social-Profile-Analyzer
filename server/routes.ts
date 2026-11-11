/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  chatCompletion,
  isOpenRouterConfigured,
  getOpenRouterModel,
} from './openrouter.ts';
import { parseProfileUrl } from './profileUrl.ts';
import { fetchInstagramProfile } from './readers/instagram.ts';
import { fetchTikTokProfile } from './readers/tiktok.ts';
import { fetchFacebookProfile } from './readers/facebook.ts';
import { createRateLimiter } from './rateLimiter.ts';
import { generateProfileAdvice } from './adviceGenerator.ts';

const router = Router();

// Rate limiter: massimo 10 richieste al minuto per IP su analyze-profile
const analyzeProfileLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Troppe richieste, riprova tra un minuto',
});

// Rate limiter: massimo 5 richieste al minuto per IP su test-ai
const testAiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Troppe richieste, riprova tra un minuto',
});

/**
 * GET /api/health
 * Verifica lo stato del backend e se OpenRouter è configurato con chiave API.
 * Nota di sicurezza: la chiave non viene MAI esposta qui né altrove.
 */
router.get('/health', (_req: Request, res: Response) => {
  const configured = isOpenRouterConfigured();
  const model = getOpenRouterModel();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Social Profile Analyzer API',
    openrouter: {
      configured,
      model,
    },
  });
});

/**
 * POST /api/test-ai
 * Invia un prompt a OpenRouter e restituisce la risposta generata dal modello.
 */
router.post('/test-ai', testAiLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const configured = isOpenRouterConfigured();
    if (!configured) {
      res.status(503).json({
        success: false,
        error:
          'OPENROUTER_API_KEY non è configurata. Imposta la variabile nel file .env sul server per testare OpenRouter.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const customPrompt = typeof req.body?.prompt === 'string' && req.body.prompt.trim().length > 0
      ? req.body.prompt.trim()
      : null;

    const selectedModel = typeof req.body?.model === 'string' && req.body.model.trim().length > 0
      ? req.body.model.trim()
      : undefined;

    const promptToSend =
      customPrompt ||
      'Sei un assistente specializzato nell\'analisi di profili social (Social Profile Analyzer). Rispondi in italiano in modo sintetico e professionale (massimo 3 frasi): quali sono i 3 pilastri fondamentali di un profilo social vincente?';

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'Sei un esperto di social media marketing e profile auditing per Social Profile Analyzer. Rispondi con precisione, stile moderno e in lingua italiana.',
        },
        {
          role: 'user',
          content: promptToSend,
        },
      ],
      {
        model: selectedModel,
        maxTokens: 500,
        temperature: 0.7,
      }
    );

    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      prompt: promptToSend,
      model: result.model,
      response: result.content,
      usage: result.usage,
      finishReason: result.finishReason,
      durationMs,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Errore sconosciuto durante la chiamata AI';

    console.error('[API /api/test-ai error]:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      durationMs,
    });
  }
});

/**
 * POST /api/analyze-profile
 * Riceve { url: string }
 * Valida l'URL e le regole di sicurezza SSRF con parseProfileUrl(url)
 * ed esegue il reader pubblico corrispondente (Instagram, TikTok, Facebook).
 */
router.post('/analyze-profile', analyzeProfileLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({
        success: false,
        error: 'URL non specificato. Inserisci il link di un profilo Instagram, TikTok o Facebook.',
        code: 'MISSING_URL',
      });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = parseProfileUrl(rawUrl);
    } catch (parseErr: unknown) {
      const errorMsg =
        parseErr instanceof Error ? parseErr.message : 'URL non valido o non consentito.';
      res.status(400).json({
        success: false,
        error: errorMsg,
        code: 'INVALID_URL',
      });
      return;
    }

    let profileData;
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
          error: 'Piattaforma non supportata.',
          code: 'UNSUPPORTED_PLATFORM',
        });
        return;
    }

    // Genera consigli mirati automatici basati sui dati estratti
    profileData.advice = generateProfileAdvice(profileData);

    const durationMs = Date.now() - startTime;
    res.json({
      success: true,
      data: profileData,
      durationMs,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Errore imprevisto durante l'analisi del profilo.";

    console.error('[API /api/analyze-profile error]:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      durationMs,
    });
  }
});

/**
 * POST /api/generate-ai-advice
 * Genera consigli avanzati potenziati da IA tramite OpenRouter per il profilo analizzato.
 */
router.post('/generate-ai-advice', testAiLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const configured = isOpenRouterConfigured();
    const profileData = req.body?.profileData;

    if (!profileData || !profileData.platform || !profileData.handle) {
      res.status(400).json({
        success: false,
        error: 'Dati profilo non validi o mancanti.',
      });
      return;
    }

    // Se OpenRouter non è configurato, restituisci comunque i consigli mirati standard
    if (!configured) {
      const fallbackAdvice = generateProfileAdvice(profileData);
      res.json({
        success: true,
        advice: fallbackAdvice,
        aiGenerated: false,
        message: 'OpenRouter non configurato: restituiti consigli mirati basati su regole.',
        durationMs: Date.now() - startTime,
      });
      return;
    }

    const systemPrompt = `Sei un Social Media Strategist senior specializzato nell'ottimizzazione di profili aziendali e personal brand su Instagram, TikTok e Facebook.
Analizza i dati del profilo forniti dall'utente e rispondi ESCLUSIVAMENTE con un oggetto JSON valido con la seguente struttura:
{
  "overallScore": number (tra 1 e 100),
  "summary": "stringa sintetica di 2 frasi con la diagnosi generale del profilo",
  "tips": [
    {
      "id": "stringa-id-univoca",
      "category": "bio" | "content" | "engagement" | "trust" | "growth",
      "title": "Titolo del consiglio diretto e professionale",
      "description": "Spiegazione del perché questo elemento va migliorato basandoti sui dati reali forniti",
      "priority": "high" | "medium" | "low",
      "actionableStep": "Azione pratica concreta da compiere subito"
    }
  ]
}
Fornisci da 4 a 6 consigli estremamente specifici e azionabili in lingua italiana. Rispondi solo in formato JSON.`;

    const userPrompt = JSON.stringify({
      platform: profileData.platform,
      handle: profileData.handle,
      displayName: profileData.displayName,
      bio: profileData.bio,
      externalLink: profileData.externalLink,
      followers: profileData.followers,
      following: profileData.following,
      postsCount: profileData.postsCount,
      totalLikes: profileData.totalLikes,
      verified: profileData.verified,
      completeness: profileData.completeness,
      missingFields: profileData.missingFields,
      recentPostsCount: profileData.recentPosts?.length || 0,
    }, null, 2);

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.6,
        maxTokens: 1200,
      }
    );

    let parsedAdvice;
    try {
      const cleanJson = result.content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedAdvice = JSON.parse(cleanJson);
      parsedAdvice.aiGenerated = true;
    } catch {
      // Fallback se l'IA restituisce testo non JSON
      parsedAdvice = generateProfileAdvice(profileData);
      parsedAdvice.aiGenerated = false;
    }

    res.json({
      success: true,
      advice: parsedAdvice,
      durationMs: Date.now() - startTime,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione dei consigli IA';
    console.error('[API /api/generate-ai-advice error]:', errorMsg);
    res.status(500).json({
      success: false,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    });
  }
});

export default router;
