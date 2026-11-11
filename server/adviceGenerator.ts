/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileData, ProfileAdvice, AdviceItem } from './types.ts';

/**
 * Genera consigli mirati per migliorare un profilo social in base ai dati reali estratti.
 * Analizza Bio, link esterni, follower/following, numero di post, like totali e particolarità della piattaforma.
 */
export function generateProfileAdvice(profile: ProfileData): ProfileAdvice {
  const tips: AdviceItem[] = [];
  let score = 100;

  const {
    platform,
    displayName,
    bio,
    externalLink,
    followers,
    following,
    postsCount,
    totalLikes,
    avatarUrl,
    verified,
    completeness,
    missingFields,
  } = profile;

  // Converti metriche numeriche se presenti
  const followersNum = typeof followers === 'number' ? followers : typeof followers === 'string' ? parseFloat(followers) : 0;
  const followingNum = typeof following === 'number' ? following : typeof following === 'string' ? parseFloat(following) : 0;
  const postsNum = typeof postsCount === 'number' ? postsCount : typeof postsCount === 'string' ? parseFloat(postsCount) : 0;

  // 1. ANALISI BIO & POSIZIONAMENTO
  if (!bio || bio.trim().length === 0) {
    score -= 25;
    tips.push({
      id: 'bio-missing',
      category: 'bio',
      title: 'Aggiungi una Bio Chiara e Inserisci una Value Proposition',
      description: `La bio del profilo è vuota o non è stata possibile rilevarla. La bio è il primo elemento che un visitatore legge nei primi 3 secondi.`,
      priority: 'high',
      actionableStep: `Scrivi una bio in 3 righe: Linea 1: Chi sei e chi aiuti; Linea 2: Risultato principale o contenuto chiave; Linea 3: Call to Action verso il link in bio.`,
    });
  } else if (bio.trim().length < 40) {
    score -= 10;
    tips.push({
      id: 'bio-short',
      category: 'bio',
      title: 'Arricchisci la Bio con Parole Chiave e Emoji Strutturate',
      description: `La bio attuale (${bio.trim().length} caratteri) è molto sintetica. Potrebbe non trasmettere chiaramente il valore offerto.`,
      priority: 'medium',
      actionableStep: `Inserisci termini di ricerca rilevanti per la tua nicchia e formatta il testo su righe separate con elenchi puntati tramite emoji.`,
    });
  } else {
    tips.push({
      id: 'bio-good',
      category: 'bio',
      title: 'Ottimizza la Call-to-Action Finale nella Bio',
      description: `La bio è presente e ben definita. Assicurati che l'ultima riga guidi chiaramente l'utente verso il link o un'azione specifica.`,
      priority: 'low',
      actionableStep: `Aggiungi una freccia orientata verso il basso (👇) con un invito esplicito (es. "Scarica la guida gratuita", "Prenota una consulenza").`,
    });
  }

  // 2. ANALISI LINK IN BIO / LINK ESTERNO
  if (!externalLink) {
    score -= 15;
    tips.push({
      id: 'link-missing',
      category: 'growth',
      title: 'Inserisci un Link in Bio (Linktree, Sito o Landing Page)',
      description: `Nessun link esterno rilevato nel profilo. Senza un link diretto perdi opportunità di conversione e traffico esterno.`,
      priority: 'high',
      actionableStep: `Aggiungi il link al tuo sito web, shop, WhatsApp Business o usa un aggregatore come Linktree per raccogliere più risorse in un unico punto.`,
    });
  } else {
    tips.push({
      id: 'link-present',
      category: 'growth',
      title: 'Traccia i Clic sul Link in Bio con parametri UTM',
      description: `Il link in bio (${externalLink}) è attivo. Assicurati di monitorare quanti visitatori arrivano da questa piattaforma.`,
      priority: 'low',
      actionableStep: `Usa un accorciatore come Bitly o aggiungi parametri UTM al tuo link per misurare le conversioni provenienti da ${platform}.`,
    });
  }

  // 3. ANALISI METRICHE & ENGAGEMENT (FOLLOWER / FOLLOWING)
  if (followingNum > 0 && followersNum > 0) {
    const ratio = followingNum / followersNum;
    if (followingNum > followersNum && followersNum < 1000) {
      score -= 15;
      tips.push({
        id: 'ratio-unbalanced',
        category: 'engagement',
        title: 'Ribilancia il Rapporto Seguiti / Follower',
        description: `Segui più persone (${followingNum.toLocaleString('it-IT')}) rispetto ai tuoi follower (${followersNum.toLocaleString('it-IT')}). Questo può trasmettere un'immagine di profilo amatoriale o di "follow-unfollow".`,
        priority: 'medium',
        actionableStep: `Smetti di seguire account inattivi o non pertinenti fino a portare il numero di persone seguite al sotto dei tuoi follower totali.`,
      });
    }
  }

  // 4. ANALISI POST & FREQUENZA CONTENUTI
  if (postsNum === 0 && !missingFields.includes('postsCount')) {
    score -= 20;
    tips.push({
      id: 'posts-zero',
      category: 'content',
      title: 'Pubblica i Primi Contenuti per Attivare il Profilo',
      description: `Il profilo non ha ancora contenuti pubblicati. Un profilo privo di post non trasmette fiducia agli utenti che vi atterrano.`,
      priority: 'high',
      actionableStep: `Pianifica e pubblica almeno 3-6 contenuti di presentazione o valore formativo per riempire la griglia iniziale del profilo.`,
    });
  } else if (postsNum > 0 && postsNum < 12) {
    score -= 10;
    tips.push({
      id: 'posts-few',
      category: 'content',
      title: 'Costruisci una Griglia di Contenuti Solida (almeno 9-12 post)',
      description: `Hai ${postsNum} contenuti. Una griglia riempita con almeno 9-12 post offre una panoramica completa del tuo brand.`,
      priority: 'medium',
      actionableStep: `Crea un piano editoriale basato su 3 pilastri principali: Educational, Personal Brand/Dietro le quinte e Promozione.`,
    });
  }

  // 5. CONSIGLI SPECIFICI PER PIATTAFORMA
  if (platform === 'instagram') {
    tips.push({
      id: 'ig-reels',
      category: 'growth',
      title: 'Focalizzati sui Reels per Aumentare la Copertura Organica',
      description: `Su Instagram i Reels sono il formato principale per essere scoperti da nuovi utenti non ancora follower.`,
      priority: 'medium',
      actionableStep: `Pubblica 3 Reels a settimana con ganci visivi e di testo nei primi 3 secondi e sottotitoli sempre visibili.`,
    });
    tips.push({
      id: 'ig-highlights',
      category: 'trust',
      title: 'Organizza le Storie in Evidenza (Highlights)',
      description: `Le storie in evidenza funzionano come un menu per il tuo profilo (es. Chi Sono, Servizi, Recensioni, FAQ).`,
      priority: 'low',
      actionableStep: `Crea 4 storie in evidenza con copertine coordinate col tuo brand: "Chi Sono", "Servizi", "Risultati/Recensioni" e "Contatti".`,
    });
  } else if (platform === 'tiktok') {
    if (totalLikes !== undefined) {
      tips.push({
        id: 'tt-likes',
        category: 'trust',
        title: 'Sfrutta i Like Totali come Riprova Sociale',
        description: `Il tuo profilo vanta ${typeof totalLikes === 'number' ? totalLikes.toLocaleString('it-IT') : totalLikes} like totali accumulati.`,
        priority: 'low',
        actionableStep: `Metti in evidenza (fissa in alto) i 3 video che hanno ottenuto più like per dare subito prova della qualità dei tuoi contenuti.`,
      });
    }
    tips.push({
      id: 'tt-hooks',
      category: 'content',
      title: 'Perfeziona il Gancio nei Primi 2-3 Secondi dei Video',
      description: `Su TikTok la percentuale di completamento del video determina la spinta nei Per Te (FYP).`,
      priority: 'high',
      actionableStep: `Sostituisci le introduzioni lente con frasi ad alto impatto (es. "Stop allo scroll: ecco il segreto per...") ed evita saluti iniziali prolungati.`,
    });
  } else if (platform === 'facebook') {
    tips.push({
      id: 'fb-cover',
      category: 'trust',
      title: 'Ottimizza l\'Immagine di Copertina e il Pulsante di Pagina',
      description: `La pagina Facebook necessita di un banner visivo professionale e di un pulsante azione (Invia Messaggio, Chiama, Acquista).`,
      priority: 'medium',
      actionableStep: `Inserisci una copertina in formato 16:9 con il payoff dell'attività e imposta il pulsante "Invia messaggio" su WhatsApp o Messenger.`,
    });
  }

  // 6. FIDUCIA E BRANDING
  if (!avatarUrl || missingFields.includes('avatarUrl')) {
    score -= 15;
    tips.push({
      id: 'avatar-missing',
      category: 'trust',
      title: 'Imposta una Foto Profilo ad Alta Risoluzione',
      description: `L'immagine del profilo non è visibile o non è stata trovata. L'avatar è il primo elemento visivo di riconoscimento.`,
      priority: 'high',
      actionableStep: `Carica una foto a mezzo busto ben illuminata su sfondo a contrasto (per brand personali) o un logo vettoriale ben leggibile su sfondo neutro (per aziende).`,
    });
  }

  if (!verified && followersNum > 10000) {
    tips.push({
      id: 'verification-step',
      category: 'trust',
      title: 'Valuta la Richiesta del Badge di Verifica',
      description: `Con una base di follower di ${followersNum.toLocaleString('it-IT')}, la spunta blu aumenta drasticamente la credibilità dell'account.`,
      priority: 'low',
      actionableStep: `Avvia la procedura di verifica ufficiale o iscrizione al programma Meta Verified / TikTok Verification nelle impostazioni del profilo.`,
    });
  }

  // 7. GESTIONE COMPLETEZZA SCHEDA
  if (completeness === 'partial' || completeness === 'none') {
    tips.push({
      id: 'completeness-warning',
      category: 'growth',
      title: 'Completa l\'Analisi Caricando Screenshot del Profilo',
      description: `Alcuni dati pubblici (bio estesa o post recenti) sono limitati da login wall della piattaforma.`,
      priority: 'medium',
      actionableStep: `Carica uno screenshot del profilo nell'apposito modulo per consentire all'IA di analizzare visivamente anche le storie in evidenza e la grafica del profilo.`,
    });
  }

  // Limita lo score tra 10 e 100
  const finalScore = Math.max(15, Math.min(100, score));

  let summary = '';
  if (finalScore >= 80) {
    summary = `Ottima base di partenza su ${platform.toUpperCase()}! Il profilo presenta dati ben strutturati; focalizzati sull'ottimizzazione delle conversioni e sulla costanza nei contenuti.`;
  } else if (finalScore >= 50) {
    summary = `Profilo con buon potenziale su ${platform.toUpperCase()}, ma ci sono alcune lacune strategiche (bio, link o engagement) su cui intervenire subito per massimizzare la crescita.`;
  } else {
    summary = `Il profilo necessita di un intervento di ottimizzazione importante. Segui i consigli ad alta priorità per costruire un posizionamento professionale su ${platform.toUpperCase()}.`;
  }

  return {
    overallScore: finalScore,
    summary,
    tips,
    aiGenerated: false,
  };
}
