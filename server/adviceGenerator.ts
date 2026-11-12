/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileData, ProfileAdvice, AdviceItem } from './types.ts';

/**
 * Genera consigli mirati per migliorare un profilo social in base ai dati reali estratti.
 * Regola fondamentale: il punteggio si basa SOLO sui campi effettivamente letti.
 * Un dato non disponibile (es. login wall) NON riduce il punteggio.
 * I consigli generici sono a priorità bassa e formulati come buone pratiche generali, mai come problemi rilevati.
 */
export function generateProfileAdvice(profile: ProfileData): ProfileAdvice {
  const tips: AdviceItem[] = [];
  let score = 100;

  const {
    platform,
    bio,
    externalLink,
    followers,
    following,
    postsCount,
    totalLikes,
    verified,
    completeness,
    missingFields = [],
  } = profile;

  // Helper per verificare se un campo è stato effettivamente letto dal profilo
  const isFieldRead = (fieldName: string, value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (missingFields.includes(fieldName)) return false;
    return true;
  };

  // Converti metriche numeriche se presenti
  const followersNum = typeof followers === 'number' ? followers : typeof followers === 'string' ? parseFloat(followers) : 0;
  const followingNum = typeof following === 'number' ? following : typeof following === 'string' ? parseFloat(following) : 0;
  const postsNum = typeof postsCount === 'number' ? postsCount : typeof postsCount === 'string' ? parseFloat(postsCount) : 0;

  // 1. ANALISI BIO & POSIZIONAMENTO (solo se la bio è stata effettivamente letta)
  const bioRead = isFieldRead('bio', bio);
  if (bioRead) {
    if (bio!.trim().length === 0) {
      score -= 20;
      tips.push({
        id: 'bio-empty',
        category: 'bio',
        title: 'Aggiungi una Bio Descrittiva',
        description: 'La bio del profilo è vuota. Una descrizione chiara aiuta i visitatori a comprendere subito la tua proposta di valore.',
        priority: 'medium',
        actionableStep: 'Scrivi una bio in 3 punti sintetici: chi sei, cosa offri e un chiaro invito all\'azione finale.',
      });
    } else if (bio!.trim().length < 40) {
      score -= 10;
      tips.push({
        id: 'bio-short',
        category: 'bio',
        title: 'Arricchisci la Bio con Parole Chiave',
        description: `La bio attuale (${bio!.trim().length} caratteri) è molto sintetica. Può essere valorizzata con termini di ricerca pertinenti per la tua nicchia.`,
        priority: 'low',
        actionableStep: 'Aggiungi dettagli sulle tue competenze o attività ed elenchi puntati con emoji per migliorare la leggibilità.',
      });
    } else {
      tips.push({
        id: 'bio-good',
        category: 'bio',
        title: 'Buona Pratica: Cura la Call-to-Action nella Bio',
        description: 'La bio è presente e ben definita. Come buona pratica, assicurati che guidi chiaramente verso il tuo obiettivo primario o canale di contatto.',
        priority: 'low',
        actionableStep: 'Verifica periodicamente che l\'invito finale sia aggiornato con la risorsa o l\'offerta attiva in questo momento.',
      });
    }
  }

  // 2. ANALISI LINK IN BIO / LINK ESTERNO (solo se il campo è stato effettivamente letto)
  const linkRead = isFieldRead('externalLink', externalLink);
  if (linkRead && externalLink) {
    tips.push({
      id: 'link-present',
      category: 'growth',
      title: 'Buona Pratica: Monitora i Clic sul Link in Bio',
      description: `Il link esterno (${externalLink}) è configurato. Come buona pratica, monitora quante visite e conversioni genera.`,
      priority: 'low',
      actionableStep: `Utilizza parametri UTM o un accorciatore di link per misurare l'efficacia del traffico proveniente da ${platform}.`,
    });
  }

  // 3. ANALISI METRICHE COMMUNITY (FOLLOWER / FOLLOWING) - solo se entrambi sono stati letti
  const followersRead = isFieldRead('followers', followers);
  const followingRead = isFieldRead('following', following);
  if (followersRead && followingRead && followingNum > 0 && followersNum > 0) {
    if (followingNum > followersNum && followersNum < 1000) {
      score -= 15;
      tips.push({
        id: 'ratio-unbalanced',
        category: 'community',
        title: 'Equilibra il Rapporto Seguiti / Follower',
        description: `I dati letti mostrano più profili seguiti (${followingNum.toLocaleString('it-IT')}) rispetto ai follower (${followersNum.toLocaleString('it-IT')}). Ribilanciare questo rapporto favorisce una percezione di maggiore autorevolezza.`,
        priority: 'low',
        actionableStep: 'Rivedi periodicamente la lista degli account seguiti, mantenendo profili affini al tuo settore.',
      });
    }
  }

  // 4. ANALISI CONTENUTI PUBBLICATI (solo se il conteggio post è stato effettivamente letto)
  const postsRead = isFieldRead('postsCount', postsCount);
  if (postsRead) {
    if (postsNum === 0) {
      score -= 15;
      tips.push({
        id: 'posts-zero',
        category: 'content',
        title: 'Pubblica i Primi Contenuti per Attivare il Profilo',
        description: 'Il profilo non ha ancora contenuti pubblici visibili. Pubblicare i primi post serve a presentare il tuo brand ai nuovi visitatori.',
        priority: 'medium',
        actionableStep: 'Pianifica almeno 3-6 contenuti introduttivi di valore per avviare la griglia del profilo.',
      });
    } else if (postsNum > 0 && postsNum < 12) {
      score -= 10;
      tips.push({
        id: 'posts-few',
        category: 'content',
        title: 'Buona Pratica: Costruisci una Griglia con 9-12 Contenuti',
        description: `Hai ${postsNum} contenuti pubblici. Come buona pratica generale, una griglia con almeno 9-12 post offre una panoramica più solida e completa.`,
        priority: 'low',
        actionableStep: 'Definisci 2-3 rubriche tematiche per popolare regolarmente il profilo con contenuti educativi e divulgativi.',
      });
    }
  }

  // 5. CONSIGLI SPECIFICI PER PIATTAFORMA (buone pratiche generali a priorità bassa)
  if (platform === 'instagram') {
    tips.push({
      id: 'ig-reels',
      category: 'growth',
      title: 'Buona Pratica: Valorizza il Formato Reels',
      description: 'Come buona pratica generale su Instagram, i Reels rappresentano il formato più efficace per farsi scoprire organicamente da nuovo pubblico.',
      priority: 'low',
      actionableStep: 'Valuta di integrare 2-3 Reels a settimana nel tuo piano editoriale con un gancio visivo nei primi 3 secondi.',
    });
    tips.push({
      id: 'ig-highlights',
      category: 'trust',
      title: 'Buona Pratica: Organizza le Storie in Evidenza',
      description: 'Come buona pratica di presentazione, le storie in evidenza fungono da vetrina per mostrare chi sei, i tuoi servizi e le risposte alle domande frequenti.',
      priority: 'low',
      actionableStep: 'Crea copertine coordinate col tuo brand per organizzare storie su presentazione, servizi e contatti.',
    });
  } else if (platform === 'tiktok') {
    if (totalLikes !== undefined && !missingFields.includes('totalLikes')) {
      tips.push({
        id: 'tt-likes',
        category: 'trust',
        title: 'Buona Pratica: Valorizza i Video con Più Like',
        description: `Il profilo conta ${typeof totalLikes === 'number' ? totalLikes.toLocaleString('it-IT') : totalLikes} like totali accumulati.`,
        priority: 'low',
        actionableStep: 'Come buona pratica, fissa in alto nella griglia i video con le migliori prestazioni come riprova sociale per i nuovi visitatori.',
      });
    }
    tips.push({
      id: 'tt-hooks',
      category: 'content',
      title: 'Buona Pratica: Cattura l\'Attenzione nei Primi Secondi',
      description: 'Come buona pratica generale su TikTok, catturare l\'attenzione nei primi 2-3 secondi favorisce il completamento della visione del video.',
      priority: 'low',
      actionableStep: 'Inizia i video direttamente con il concetto chiave o una domanda stimolante, evitando introduzioni lente.',
    });
  } else if (platform === 'facebook') {
    tips.push({
      id: 'fb-cover',
      category: 'trust',
      title: 'Buona Pratica: Cura Copertina e Pulsante di Pagina',
      description: 'Come buona pratica per le pagine Facebook, un banner visivo professionale e un pulsante di contatto diretto facilitano le interazioni con i visitatori.',
      priority: 'low',
      actionableStep: 'Inserisci una copertina in formato 16:9 con il payoff dell\'attività e verifica che il pulsante di messaggio o contatto sia attivo.',
    });
  }

  // 6. FIDUCIA E BADGE (buona pratica generale)
  if (!verified && followersRead && followersNum > 10000) {
    tips.push({
      id: 'verification-step',
      category: 'trust',
      title: 'Buona Pratica: Valuta la Richiesta del Badge di Verifica',
      description: `Con una base di oltre ${followersNum.toLocaleString('it-IT')} follower, il badge ufficiale rafforza l'autenticità e la riconoscibilità del profilo.`,
      priority: 'low',
      actionableStep: 'Verifica i criteri di idoneità nelle impostazioni ufficiali della piattaforma.',
    });
  }

  // Calcolo score: solo sui campi effettivamente letti
  const finalScore = completeness === 'none' ? undefined : Math.max(20, Math.min(100, score));

  let summary = '';
  if (completeness === 'none') {
    summary = `Dati pubblici non disponibili per via delle restrizioni della piattaforma ${platform.toUpperCase()}. L'analisi si basa solo sui dati che è stato possibile leggere.`;
  } else if (finalScore !== undefined && finalScore >= 80) {
    summary = `Ottima base di partenza su ${platform.toUpperCase()}! I dati pubblici letti mostrano un profilo ben impostato; continua ad applicare le buone pratiche per consolidare la tua community.`;
  } else if (finalScore !== undefined && finalScore >= 50) {
    summary = `Profilo con buon potenziale su ${platform.toUpperCase()}. Gli elementi analizzati evidenziano margini di miglioramento su bio, contenuti o community per valorizzare la presenza online.`;
  } else {
    summary = `Il profilo su ${platform.toUpperCase()} presenta margini di ottimizzazione sui dati analizzati. Segui le buone pratiche per rafforzare la presentazione e la coerenza del profilo.`;
  }

  return {
    overallScore: finalScore,
    summary,
    tips,
    aiGenerated: false,
  };
}
