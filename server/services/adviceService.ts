/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  chatCompletion,
  isOpenRouterConfigured,
} from '../openrouter.ts';
import {
  generateProfileAdvice,
  generateTailoredBio,
  buildSuggestedLinkInBio,
  inferProfileIndustry,
  enforceCharLimit,
} from '../adviceGenerator.ts';
import { SERVICES_CATALOG, BRAND_NAME, getServiceById } from '../config/offer.ts';
import type { ProfileData, ProfileAdvice, RecommendedService } from '../types.ts';

export interface FormattedRecommendedService {
  serviceId: string;
  reason: string;
  name: string;
  target?: string;
  includes?: string;
  price?: string;
}

/**
 * Genera i consigli per il profilo con IA (OpenRouter) e fallback automatico sui consigli mirati basati su regole.
 */
export async function generateFullAdvice(profileData: ProfileData): Promise<ProfileAdvice> {
  const configured = isOpenRouterConfigured();

  // Se OpenRouter non è configurato, usa direttamente i consigli basati su regole
  if (!configured) {
    const fallbackAdvice = generateProfileAdvice(profileData);
    fallbackAdvice.aiGenerated = false;
    return fallbackAdvice;
  }

  try {
    const catalogJson = JSON.stringify(SERVICES_CATALOG, null, 2);
    const platformCharLimit =
      profileData.platform === 'tiktok' ? 80 : profileData.platform === 'facebook' ? 255 : 150;

    const detectedIndustry = inferProfileIndustry(profileData);

    const systemPrompt = `Sei un Senior Social Media Strategist dell'agenzia "${BRAND_NAME}".
Analizza i dati reali estratti dal profilo social e fornisci una diagnosi onesta, rigorosa e direttamente collegata ai servizi di "${BRAND_NAME}".

CATALOGO UFFICIALE DEI SERVIZI ${BRAND_NAME} (usa solo ed esclusivamente questi ID e prezzi):
${catalogJson}

REGOLE INDEROGABILI:
1. CITARE VALORI REALI: Nel campo "finding" di ogni consiglio, cita SEMPRE il dato reale fornito (es. "5.888 follower e 3.900 seguiti", "La bio conta solo 22 caratteri", "0 post pubblicati", "Nessun link esterno").
2. NESSUNA LACUNA INVENTATA: I problemi segnalati devono derivare SOLO ed ESCLUSIVAMENTE dai dati forniti. Non inventare o ipotizzare metriche assenti (es. engagement rate, hashtag, visualizzazioni, ecc.) per forzare la vendita. Se un dato non è presente, non inventarlo.
3. TONO PROFESSIONALE ED ONESTO: Rispetta il cliente. Sii trasparente, costruttivo e focalizzato su azioni concrete.
4. DEDUZIONE DEL SETTORE: Nel campo "inferredIndustry", deduci con massima precisione il settore specifico dell'attività analizzando handle, nome, bio e post (es. "${detectedIndustry}").
5. BIO RISCRITTA PRONTA DA COPIARE PER IL CLIENTE: Nel campo "suggestedBio", proponi una nuova bio scritta ESCLUSIVAMENTE PER IL CLIENTE E LA SUA SPECIFICA ATTIVITÀ (es. se è un'app di salute per animali parla di benessere animali e download app; se è una pizzeria parla di pizza; se è un parrucchiere parla di look e capelli).
   - REGOLE ANTI-BOILERPLATE: NON inserire MAI frasi generiche da agenzia pubblicitaria (come "Soluzioni su misura", "Aiutiamo i nostri clienti con servizi professionali dedicati", "Richiedi un preventivo"), e NON fare MAI riferimento ad Aurora-ADV o ai suoi servizi all'interno della bio del cliente.
   - LIMITE CARATTERI RIGOROSO: per ${profileData.platform.toUpperCase()} il limite MASSIMO ASSOLUTO è di ${platformCharLimit} caratteri (spazi ed emoji inclusi). Se TikTok, DEVE avere meno di 80 caratteri!
   - LINGUA: Se la bio originale del profilo è in inglese, mantieni la lingua inglese.
6. STRUTTURA CONCRETA PER LINK IN BIO: Nel campo "suggestedLinkInBio", proponi una struttura concreta: usa il link reale del cliente se presente (es. ${profileData.externalLink || 'il suo sito/app'}), oppure un link WhatsApp con numero di ESEMPIO FITTIZIO come "https://wa.me/391234567890 (Esempio WhatsApp per contatti diretti)". NON USARE MAI numeri reali o recapiti di Aurora-ADV.
7. SERVIZI CONSIGLIATI: In "recommendedServices" includi al massimo 2 servizi del catalogo ${BRAND_NAME} coerenti con le criticità reali rilevate. Per ognuno scrivi una "reason" che cita obbligatoriamente un dato reale del profilo. In ogni consiglio ("tips"), inserisci in "serviceId" l'id corrispondente del catalogo oppure null.
8. NUMERO DI CONSIGLI: Fornisci da 3 a massimo 5 consigli, ordinati per priorità decrescente ("high" > "medium" > "low").

FORMATO RISPOSTA:
Rispondi ESCLUSIVAMENTE con un JSON valido (senza blocchi markdown né testo prima o dopo) con questo schema:
{
  "overallScore": number (1-100),
  "summary": "Sintesi chiara in 2 frasi della diagnosi del profilo",
  "inferredIndustry": "string",
  "suggestedBio": "string (entro ${platformCharLimit} caratteri)",
  "suggestedLinkInBio": "string",
  "tips": [
    {
      "id": "string",
      "category": "bio" | "content" | "community" | "trust" | "growth",
      "title": "Titolo del consiglio",
      "finding": "Dato reale rilevato con numeri o testi effettivi",
      "impact": "Perché conta per l'attività (una frase)",
      "quickWin": "Cosa fare subito da solo (concreto)",
      "proHelp": "Cosa farebbe un professionista ${BRAND_NAME}",
      "serviceId": "id-catalogo-o-null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "recommendedServices": [
    {
      "serviceId": "id-catalogo",
      "reason": "Motivazione basata su un dato reale del profilo"
    }
  ]
}`;

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
      recentPostsSample: (profileData.recentPosts || []).slice(0, 3).map((p: any) => ({
        caption: p.caption,
        likes: p.likes,
        views: p.views,
        comments: p.comments,
      })),
    }, null, 2);

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.5,
        maxTokens: 1500,
        timeoutMs: 25000,
        retries: 1,
      }
    );

    const cleanJson = result.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsedAdvice = JSON.parse(cleanJson);

    if (!parsedAdvice || !Array.isArray(parsedAdvice.tips) || parsedAdvice.tips.length === 0) {
      throw new Error('Formato JSON non conforme: tips non valido');
    }

    parsedAdvice.tips = parsedAdvice.tips.slice(0, 5).map((tip: any, idx: number) => ({
      id: tip.id || `ai-tip-${idx + 1}`,
      category: tip.category === 'engagement' ? 'community' : (tip.category || 'growth'),
      title: tip.title || `Consiglio ${idx + 1}`,
      finding: tip.finding || tip.description || 'Dato rilevato durante l\'analisi',
      impact: tip.impact || 'Elemento cruciale per massimizzare la conversione dai social.',
      quickWin: tip.quickWin || tip.actionableStep || 'Aggiorna questo elemento dalle impostazioni del profilo.',
      proHelp: tip.proHelp || 'Ottimizziamo questo aspetto con una strategia su misura Aurora-ADV.',
      serviceId: typeof tip.serviceId === 'string' && tip.serviceId.length > 0 ? tip.serviceId : undefined,
      priority: tip.priority === 'high' || tip.priority === 'medium' || tip.priority === 'low' ? tip.priority : 'medium',
    }));

    if (!Array.isArray(parsedAdvice.recommendedServices)) {
      parsedAdvice.recommendedServices = [];
    } else {
      parsedAdvice.recommendedServices = parsedAdvice.recommendedServices.slice(0, 2);
    }

    if (!parsedAdvice.inferredIndustry || 
        parsedAdvice.inferredIndustry === 'Non determinabile' || 
        parsedAdvice.inferredIndustry.includes('Attività locale o professionale')) {
      parsedAdvice.inferredIndustry = detectedIndustry;
    }

    // Forza sempre l'uso della logica senza IA per bio e link (bozze guidate)
    parsedAdvice.suggestedBio = generateTailoredBio(profileData, parsedAdvice.inferredIndustry);
    parsedAdvice.suggestedLinkInBio = buildSuggestedLinkInBio(profileData);


    parsedAdvice.aiGenerated = true;
    return parsedAdvice;
  } catch (parseError) {
    console.warn('[adviceService] Fallback su regole per errore IA:', parseError instanceof Error ? parseError.message : parseError);
    const fallback = generateProfileAdvice(profileData);
    fallback.aiGenerated = false;
    return fallback;
  }
}

/**
 * Formatta i servizi consigliati arricchendoli con le informazioni dal catalogo ufficiale.
 */
export function formatRecommendedServices(
  recommended: RecommendedService[] = []
): FormattedRecommendedService[] {
  return recommended.map((rec) => {
    const catalogItem = getServiceById(rec.serviceId);
    return {
      serviceId: rec.serviceId,
      reason: rec.reason,
      name: catalogItem?.nome || rec.serviceId,
      target: catalogItem?.perChi,
      includes: catalogItem?.include,
      price: catalogItem?.prezzo,
    };
  });
}
