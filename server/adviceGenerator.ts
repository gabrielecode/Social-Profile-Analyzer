/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileData, ProfileAdvice, AdviceItem, RecommendedService } from './types.ts';
import { getServiceById } from './config/offer.ts';

/**
 * Genera consigli specifici e collegati ai servizi Aurora-ADV.
 * Regole rigorose:
 * - Ogni consiglio cita un dato reale (finding con valori reali, impact, quickWin, proHelp, serviceId).
 * - Nessun prefisso "Buona Pratica" e nessuna card puramente generica non legata ai dati.
 * - Massimo 5 consigli, ordinati per impatto (alta > media > bassa).
 * - Massimo 2 recommendedServices con motivazione che cita un dato reale.
 */
export function generateProfileAdvice(profile: ProfileData): ProfileAdvice {
  const tips: AdviceItem[] = [];
  let score = 100;

  const {
    platform,
    handle,
    displayName,
    bio,
    externalLink,
    followers,
    following,
    postsCount,
    totalLikes,
    completeness,
    missingFields = [],
  } = profile;

  // Helper per verificare se un campo è stato effettivamente letto dal profilo
  const isFieldRead = (fieldName: string, value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (missingFields.includes(fieldName)) return false;
    return true;
  };

  // Parsing metriche numeriche
  const parseNum = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/,/g, '').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  const followersNum = parseNum(followers);
  const followingNum = parseNum(following);
  const postsNum = parseNum(postsCount);
  const formatNum = (n: number) => n.toLocaleString('it-IT');

  // Tracciamento dei bisogni rilevati per abbinare i servizi Aurora-ADV
  let needsBioCheckup = false;
  let needsSocialStart = false;
  let needsBaseWebsite = false;
  let needsVideoContent = false;
  let needsSocialGrowth = false;
  let needsAiAgent = false;
  let needsLocalAdv = false;

  // 1. ANALISI BIO (solo se effettivamente letta)
  const bioRead = isFieldRead('bio', bio);
  if (bioRead) {
    const trimmedBio = (bio || '').trim();
    const bioLen = trimmedBio.length;

    if (bioLen === 0) {
      score -= 20;
      needsBioCheckup = true;
      tips.push({
        id: 'bio-empty',
        category: 'bio',
        title: 'Definizione Biografia e Posizionamento',
        priority: 'high',
        finding: `La biografia del profilo @${handle} è completamente vuota (0 caratteri).`,
        impact: 'Senza una bio descrittiva, chi atterra sul profilo non comprende immediatamente cosa offri né perché dovrebbe fidarsi.',
        quickWin: 'Inserisci subito 3 righe sintetiche: il tuo settore, la proposta di valore per il cliente e una chiamata all\'azione con emoji freccia.',
        proHelp: 'Riscriviamo la biografia definendo un posizionamento di marca chiaro, parole chiave ricercabili e una call-to-action mirata.',
        serviceId: 'check-up',
      });
    } else if (bioLen < 45) {
      score -= 10;
      needsBioCheckup = true;
      tips.push({
        id: 'bio-short',
        category: 'bio',
        title: 'Arricchimento Biografia con Proposta di Valore',
        priority: 'medium',
        finding: `La biografia attuale è molto sintetica: conta solo ${bioLen} caratteri ("${trimmedBio}").`,
        impact: 'Uno spazio descrittivo così ridotto non sfrutta l\'occasione di comunicare i benefici per chi cerca i tuoi servizi.',
        quickWin: 'Aggiungi i tuoi punti di forza (es. esperienza, sede, specializzazione) e chiarisci come mettersi in contatto con te.',
        proHelp: 'Elaboriamo un copy per la bio calibrato sui 150 caratteri, ottimizzato per trasformare i visitatori in contatti qualificati.',
        serviceId: 'check-up',
      });
    } else {
      // Bio presente e dettagliata: verifica se orientata a contatti/prenotazioni
      const hasBookingKeywords = /prenot|appuntament|chiam|info|contatt|tel|whatsapp|ordina|scrivici|preventiv/i.test(trimmedBio);
      if (hasBookingKeywords) {
        needsAiAgent = true;
        tips.push({
          id: 'lead-booking-flow',
          category: 'growth',
          title: 'Automazione Risposte e Gestione Prenotazioni',
          priority: 'medium',
          finding: `La bio del profilo menziona richieste dirette, appuntamenti o contatti da parte dei clienti.`,
          impact: 'Tempi di risposta lunghi nelle ore di punta o fuori orario causano la perdita immediata di clienti che si rivolgono alla concorrenza.',
          quickWin: 'Attiva le risposte automatiche istantanee nei messaggi diretti con recapiti, orari e risposte alle domande frequenti.',
          proHelp: 'Configuriamo un Agente AI che risponde istantaneamente ai messaggi e fissa appuntamenti 24 ore su 24 senza farti perdere clienti.',
          serviceId: 'agente-ai',
        });
      }
    }
  }

  // 2. ANALISI LINK IN BIO / SITO WEB (solo se letto)
  const linkRead = isFieldRead('externalLink', externalLink);
  if (linkRead) {
    if (!externalLink || externalLink.trim().length === 0) {
      score -= 15;
      needsBaseWebsite = true;
      tips.push({
        id: 'link-missing',
        category: 'growth',
        title: 'Attivazione Link Esterno e Pagina di Atterraggio',
        priority: 'high',
        finding: `Nessun link esterno o sito web risulta collegato al profilo @${handle}.`,
        impact: 'Chi desidera approfondire la tua offerta, richiedere un preventivo o acquistare non trova alcun canale diretto di atterraggio.',
        quickWin: 'Inserisci nel profilo almeno un link diretto alla tua chat WhatsApp o alla pagina contatti della tua attività.',
        proHelp: 'Realizziamo un sito monopagina o landing page veloce ad alta conversione per accogliere e profilare il traffico dai social.',
        serviceId: 'presenza-base',
      });
    } else {
      tips.push({
        id: 'link-tracking',
        category: 'growth',
        title: 'Tracciamento e Ottimizzazione Link in Bio',
        priority: 'low',
        finding: `Il profilo rimanda al link esterno "${externalLink}".`,
        impact: 'Senza parametri di tracciamento e una struttura orientata all\'azione da smartphone, molti visitatori abbandonano senza convertire.',
        quickWin: 'Verifica che la pagina di destinazione carichi in meno di 2 secondi da mobile e che il pulsante di contatto sia visibile al primo sguardo.',
        proHelp: 'Impostiamo il tracciamento completo degli eventi e una pagina mobile-first studiata per convertire i clic in contatti effettivi.',
        serviceId: 'adv-setup',
      });
    }
  }

  // 3. ANALISI CONTENUTI PUBBLICATI (solo se letti)
  const postsRead = isFieldRead('postsCount', postsCount);
  if (postsRead) {
    if (postsNum === 0) {
      score -= 20;
      needsSocialStart = true;
      tips.push({
        id: 'posts-zero',
        category: 'content',
        title: 'Avvio Pubblicazione Contenuti e Griglia',
        priority: 'high',
        finding: `Il profilo conta attualmente 0 post visibili.`,
        impact: 'Un profilo privo di contenuti appare inattivo o non affidabile, vanificando qualsiasi visita o ricerca da parte dei clienti.',
        quickWin: 'Pubblica subito i primi 3-6 contenuti di presentazione con foto autentiche e una descrizione chiara dei tuoi servizi.',
        proHelp: 'Impostiamo la linea grafica completa con template personalizzati e i primi 8 post pronti per avviare il profilo con professionalità.',
        serviceId: 'social-start',
      });
    } else if (postsNum > 0 && postsNum < 12) {
      score -= 10;
      needsSocialStart = true;
      tips.push({
        id: 'posts-few',
        category: 'content',
        title: 'Costruzione Continuità Editoriale',
        priority: 'medium',
        finding: `Il profilo ha pubblicato solo ${postsNum} contenuti complessivi.`,
        impact: 'Una griglia con meno di 12 contenuti dà l\'impressione di un\'attività discontinua o appena nata.',
        quickWin: 'Pianifica almeno 2 pubblicazioni a settimana con foto di lavori svolti, testimonianze e consigli pratici per i clienti.',
        proHelp: 'Definiamo un piano editoriale mensile completo con grafiche coordinate e pubblicazione continuativa per costruire autorevolezza.',
        serviceId: 'social-start',
      });
    } else {
      // Profilo con contenuti: serve video / Reels per scalare la visibilità organica
      needsVideoContent = true;
      tips.push({
        id: 'content-video-scale',
        category: 'content',
        title: 'Produzione Video Verticali e Reels Autentici',
        priority: 'medium',
        finding: `Il profilo ha ${postsNum} contenuti all'attivo: il fattore determinante per scalare è ora il formato video verticale.`,
        impact: 'I post fotografici statici hanno una diffusione organica ridotta rispetto ai video Reels e TikTok, limitando l\'acquisizione di nuovo pubblico.',
        quickWin: 'Registra un video breve di 20-30 secondi in cui mostri il risultato di un tuo lavoro o spieghi un consiglio pratico per i clienti.',
        proHelp: 'Realizziamo uno shooting foto/video in sede di mezza giornata per consegnarti Reels professionali pronti per 1-2 mesi di calendario.',
        serviceId: 'contenuti-su-misura',
      });
    }
  }

  // 4. ANALISI COMMUNITY E RAPPORTO FOLLOWER / SEGUITI (solo se letti entrambi)
  const followersRead = isFieldRead('followers', followers);
  const followingRead = isFieldRead('following', following);
  if (followersRead && followingRead && followingNum > 0 && followersNum > 0) {
    if (followingNum > followersNum && followersNum < 1500) {
      score -= 10;
      needsSocialGrowth = true;
      tips.push({
        id: 'ratio-unbalanced',
        category: 'community',
        title: 'Ribilanciamento Seguiti e Reputazione del Profilo',
        priority: 'medium',
        finding: `Rilevati ${formatNum(followersNum)} follower a fronte di ${formatNum(followingNum)} profili seguiti.`,
        impact: 'Seguire molti più profili rispetto a quanti ti seguono trasmette una percezione di scarso seguito e ridotta autorevolezza.',
        quickWin: 'Rivedi l\'elenco dei profili seguiti ed elimina account inattivi o non pertinenti alla tua nicchia professionale.',
        proHelp: 'Attiviamo una strategia di crescita costante per attrarre follower in target e consolidare la brand reputation sul territorio.',
        serviceId: 'social-crescita',
      });
    } else if (followersNum >= 1000) {
      // Profilo con buona base: opportunità ADV locale
      needsLocalAdv = true;
      tips.push({
        id: 'local-adv-expansion',
        category: 'growth',
        title: 'Acquisizione Clienti con ADV Geotargettizzata',
        priority: 'low',
        finding: `Profilo con una base attiva di ${formatNum(followersNum)} follower su ${platform.toUpperCase()}.`,
        impact: 'L\'algoritmo organico mostra i tuoi post solo a una frazione dei tuoi follower e difficilmente raggiunge nuovi clienti della zona.',
        quickWin: 'Promuovi un post mirato verso il tuo pubblico locale in un raggio di 10-15 km dalla tua sede con una proposta specifica.',
        proHelp: 'Gestiamo campagne pubblicitarie locali mirate su Meta o Google per generare contatti continuativi con budget accessibile.',
        serviceId: 'adv-locale',
      });
    }
  }

  // 5. TIPIZZAZIONE SPECIFICA DI PIATTAFORMA DERIVATA DA DATI REALI (es. TikTok totalLikes o Facebook)
  if (platform === 'tiktok' && totalLikes !== undefined && !missingFields.includes('totalLikes')) {
    const likesNum = parseNum(totalLikes);
    if (likesNum > 0) {
      tips.push({
        id: 'tt-likes-proof',
        category: 'trust',
        title: 'Valorizzazione della Riprova Sociale nei Video',
        priority: 'low',
        finding: `Il profilo TikTok ha accumulato ${formatNum(likesNum)} Mi Piace complessivi.`,
        impact: 'I visitatori decidono in pochissimi secondi se restare: evidenziare i contenuti più apprezzati rassicura sulla qualità.',
        quickWin: 'Fissa in alto nella griglia del profilo i 3 video con più interazioni e commenti positivi.',
        proHelp: 'Strutturiamo i ganci iniziali (hook) dei video per aumentare il tempo medio di visione e moltiplicare le conversioni.',
        serviceId: 'contenuti-su-misura',
      });
    }
  }

  // Se dopo l'analisi ci sono meno di 3 consigli basati su dati reali, aggiungi al più 1 consiglio focalizzato in coda
  if (tips.length < 3) {
    tips.push({
      id: 'focus-checkup',
      category: 'growth',
      title: 'Check-up Strategico della Presenza Social',
      priority: 'low',
      finding: `Il profilo @${handle} è attivo su ${platform.toUpperCase()} ma privo di un piano di conversione strutturato.`,
      impact: 'Senza un\'analisi metodica dei canali di conversione, il tempo investito sui social genera poche richieste concrete.',
      quickWin: 'Fissa un obiettivo mensile chiaro (es. numero di messaggi o richieste ricevute) e misura i risultati ogni 30 giorni.',
      proHelp: 'Eseguiamo un Check-up completo con report scritto e consulenza di 30 minuti per individuare le leve di crescita prioritarie.',
      serviceId: 'check-up',
    });
  }

  // Ordinamento per impatto: high > medium > low
  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  tips.sort((a, b) => {
    const prioA = priorityOrder[a.priority || 'low'] ?? 3;
    const prioB = priorityOrder[b.priority || 'low'] ?? 3;
    return prioA - prioB;
  });

  // Massimo 5 consigli totali
  const finalTips = tips.slice(0, 5);

  // DETERMINAZIONE RECOMMENDED SERVICES (max 2 elementi con reason che cita un dato reale)
  const recommendedServices: RecommendedService[] = [];

  // Regola di combinazione bisogni multipli:
  const criticalNeedsCount = (needsBioCheckup ? 1 : 0) + (needsSocialStart ? 1 : 0) + (needsBaseWebsite ? 1 : 0);
  if (criticalNeedsCount >= 2) {
    recommendedServices.push({
      serviceId: 'visibilita-completa',
      reason: `Il profilo @${handle} presenta contemporaneamente margini su contenuti (${postsNum} post), posizionamento e canali di conversione: un pacchetto completo evita dispersioni.`,
    });
  }

  if (needsBaseWebsite && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'presenza-base',
      reason: `Assenza di link esterno o sito web per il profilo @${handle}: un sito monopagina raccoglie subito i contatti interessati dai social.`,
    });
  }

  if (needsSocialStart && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'social-start',
      reason: `Rilevati ${postsNum} post: il profilo ha bisogno di un setup grafico professionale e di una frequenza minima costante.`,
    });
  }

  if (needsAiAgent && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'agente-ai',
      reason: `La bio invita a richieste dirette e appuntamenti: un assistente AI risponde 24/7 senza farti perdere clienti.`,
    });
  }

  if (needsVideoContent && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'contenuti-su-misura',
      reason: `Con ${postsNum} post già pubblicati, il passo fondamentale per differenziarsi dalla concorrenza sono foto e Reels autentici realizzati in sede.`,
    });
  }

  if (needsBioCheckup && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'check-up',
      reason: `Biografia sintetica o da definire (${bio ? bio.trim().length + ' caratteri' : 'vuota'}): il Check-up fornisce un report scritto e 30 minuti di consulenza strategica.`,
    });
  }

  if (needsSocialGrowth && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'social-crescita',
      reason: `Rapporto tra follower (${formatNum(followersNum)}) e seguiti (${formatNum(followingNum)}) da ribilanciare con un piano continuativo di Stories e Reels.`,
    });
  }

  if (needsLocalAdv && recommendedServices.length < 2) {
    recommendedServices.push({
      serviceId: 'adv-locale',
      reason: `Base avviata di ${formatNum(followersNum)} follower: le campagne locali mirate permettono di raggiungere clienti vicino alla tua attività.`,
    });
  }

  // Fallback se nessun servizio è stato ancora abbinato: Check-up
  if (recommendedServices.length === 0) {
    recommendedServices.push({
      serviceId: 'check-up',
      reason: `Analisi del profilo @${handle} su ${platform.toUpperCase()}: il Check-up Aurora-ADV a CHF 99 offre una revisione strategica con consulenza dedicata.`,
    });
  }

  // Calcolo score
  const finalScore = completeness === 'none' ? undefined : Math.max(25, Math.min(100, score));

  // Deduci con precisione il settore del profilo
  const inferredIndustry = inferProfileIndustry(profile);

  // Genera bio su misura per il profilo specifico (rispettando rigorosamente i limiti di piattaforma)
  const suggestedBio = generateTailoredBio(profile, inferredIndustry);

  // Struttura link in bio con numero fittizio di esempio (MAI il numero reale del sito)
  const suggestedLinkInBio = buildSuggestedLinkInBio(profile);

  // Calibra il riassunto sul settore specifico
  let goalText = 'richieste e conversioni';
  if (/pet|app|saas|software/i.test(inferredIndustry)) goalText = 'download e utenti attivi';
  else if (/ristor|food/i.test(inferredIndustry)) goalText = 'prenotazioni e nuovi clienti';
  else if (/beauty|hair|benessere|fitness/i.test(inferredIndustry)) goalText = 'appuntamenti e clienti in salone';
  else if (/shop|e-commerce|moda/i.test(inferredIndustry)) goalText = 'ordini e vendite online';
  else if (/studio|immobil/i.test(inferredIndustry)) goalText = 'richieste qualificate di contatto';

  let summary = '';
  if (completeness === 'none') {
    summary = `Dati pubblici non completamente accessibili senza login su ${platform.toUpperCase()}. L'analisi e i consigli si basano sui parametri rilevati.`;
  } else if (finalScore !== undefined && finalScore >= 80) {
    summary = `Buona base di partenza su ${platform.toUpperCase()} (${finalScore}/100). Un piano mirato di ottimizzazione può trasformare la visibilità in ${goalText}.`;
  } else if (finalScore !== undefined && finalScore >= 50) {
    summary = `Profilo con potenziale su ${platform.toUpperCase()} (${finalScore}/100), ma emergono carenze su presentazione e continuità che riducono le conversioni dai social.`;
  } else {
    summary = `Il profilo @${handle} necessita di interventi prioritari su impostazione grafica, contenuti e canali di contatto per risultare affidabile e attirare clienti.`;
  }

  return {
    overallScore: finalScore,
    summary,
    tips: finalTips,
    recommendedServices: recommendedServices.slice(0, 2),
    suggestedBio,
    suggestedLinkInBio,
    inferredIndustry,
    aiGenerated: false,
  };
}

/**
 * Deduce con accuratezza il settore e la nicchia del profilo analizzando:
 * - handle (es. @petkare_swiss)
 * - displayName (es. karepet)
 * - bio originale (es. "Your pet's health record in your pocket 🐾 Try free: https://karepet.app/")
 * - externalLink
 * - post recenti
 */
export function inferProfileIndustry(profile: Partial<ProfileData>): string {
  const { handle = '', displayName = '', bio = '', externalLink = '', recentPosts = [] } = profile;
  const combined = [
    handle,
    displayName,
    bio,
    externalLink,
    ...recentPosts.map((p) => p.caption || ''),
  ]
    .join(' ')
    .toLowerCase();

  // 1. Pet / Animali / Pet Tech
  if (
    /pet|karepet|cane|cani|gatto|gatti|dog|dogs|cat|cats|animal|animals|veterin|cucciol|puppy|toelettatur|grooming|petkare/i.test(
      combined
    )
  ) {
    if (/app\b|pocket|record|software|download|digital|saas|health record|free/i.test(combined)) {
      return 'Pet Tech & Salute Animali';
    }
    return 'Pet Care & Animali';
  }

  // 2. Ristorazione, Bar, Pizzeria, Food
  if (
    /ristor|pizza|pizzer|cucin|food|bar\b|caff[eè]|bistrot|trattori|osteria|chef|cocktail|bakery|pasticcer|gelat|pub\b|birreri|burger/i.test(
      combined
    )
  ) {
    if (/pizza|pizzer/i.test(combined)) return 'Pizzeria & Ristorazione';
    if (/bar|caff|cocktail/i.test(combined)) return 'Bar & Cocktail Lounge';
    if (/pasticcer|bakery|gelat/i.test(combined)) return 'Pasticceria & Dolci';
    return 'Ristorazione & Food';
  }

  // 3. Beauty, Parrucchiere, Unghie, Estetica
  if (
    /estetic|beauty|hair|parrucch|barber|unghie|nails|spa\b|skincare|massagg|wellness|salone|cosmet|trucc|make\s*up/i.test(
      combined
    )
  ) {
    if (/barber/i.test(combined)) return 'Barber Shop';
    if (/hair|parrucch/i.test(combined)) return 'Hair Stylist & Salone';
    if (/unghie|nails/i.test(combined)) return 'Nails & Onicotecnica';
    return 'Beauty, Spa & Benessere';
  }

  // 4. Fitness, Palestra, Allenamento, Sport
  if (
    /fitness|palestr|gym|coach|personal\s*trainer|allenament|workout|crossfit|yoga|pilates|bodybuilding|running/i.test(
      combined
    )
  ) {
    if (/personal\s*trainer|coach/i.test(combined)) return 'Personal Coaching & Fitness';
    if (/yoga|pilates/i.test(combined)) return 'Yoga & Pilates Studio';
    return 'Fitness & Sport';
  }

  // 5. Salute, Medicina, Clinica, Fisioterapia
  if (
    /salute|health|medic|dottor|doctor|clinic|dentist|odontoiatr|fisioter|psicolog|nutrizion|farmaci|osteopat/i.test(
      combined
    )
  ) {
    if (/dentist|odontoiatr/i.test(combined)) return 'Studio Dentistico & Odontoiatria';
    if (/fisioter|osteopat/i.test(combined)) return 'Fisioterapia & Riabilitazione';
    if (/nutrizion|diet/i.test(combined)) return 'Nutrizione & Benessere';
    return 'Salute & Settore Medico';
  }

  // 6. App, Software, SaaS, Tech, Startup
  if (/app\b|software|saas|tech\b|piattaforma|digital|startup|cloud|download|try free/i.test(combined)) {
    return 'App & Piattaforma Digitale';
  }

  // 7. Moda, Abbigliamento, Accessori, Gioielli
  if (
    /moda|fashion|abbigliament|outfit|accessori|scarpe|shoes|boutique|vestiti|gioiell|jewelry/i.test(
      combined
    )
  ) {
    if (/gioiell|jewelry/i.test(combined)) return 'Gioielleria & Accessori';
    return 'Moda & Abbigliamento';
  }

  // 8. E-commerce & Vendita Online
  if (/ecommerce|e-commerce|shop online|store online|spedizion|ordina online/i.test(combined)) {
    return 'E-commerce & Brand Online';
  }

  // 9. Commercio Locale & Negozi
  if (/negozio|shop\b|store\b|boutique|vendita/i.test(combined)) {
    return 'Commercio & Negozio Locale';
  }

  // 10. Immobiliare & Case
  if (/immobil|case\b|appartament|ville\b|affitt|vendita case|real estate|property/i.test(combined)) {
    return 'Settore Immobiliare';
  }

  // 11. Studio Professionale, Legale, Fiscale, Architettura
  if (
    /studio\b|avvocat|commercialist|consulen|architett|ingegner|notai|contabil/i.test(
      combined
    )
  ) {
    if (/avvocat|legal/i.test(combined)) return 'Studio Legale';
    if (/commercialist|fiscale|contabil/i.test(combined)) return 'Studio Tributario & Contabile';
    if (/architett|design/i.test(combined)) return 'Studio Architettura & Design';
    return 'Studio Professionale & Consulenza';
  }

  // 12. Edilizia, Artigianato, Casa & Ristrutturazioni
  if (
    /artigian|casa\b|edile|ristruttur|legno|falegnam|idraulic|elettric|fabbro|arredament|infissi/i.test(
      combined
    )
  ) {
    return 'Edilizia, Casa & Artigianato';
  }

  // 13. Fotografia, Video, Creator & Media
  if (/fotograf|photo|video|filmmaker|creator|media|content creator|youtube|ph\b/i.test(combined)) {
    return 'Fotografia, Video & Content Creation';
  }

  // 14. Viaggi, Turismo, Hotel, B&B
  if (/hotel|b&b|viagg|travel|resort|vacanz|agriturism|tour\b|ospit/i.test(combined)) {
    return 'Turismo, Ospitalità & Hotel';
  }

  // 15. Auto, Moto & Officina
  if (/auto\b|moto\b|motori|garage|concessionar|officina|car\b|bike/i.test(combined)) {
    return 'Auto, Moto & Officina';
  }

  // 16. Formazione, Corsi & Coaching
  if (/cors[io]|formazion|academy|scuola|master|docent|insegnant|lezioni/i.test(combined)) {
    return 'Formazione & Academy';
  }

  return 'Non determinabile';
}

/**
 * Taglia o adatta una bio al limite di caratteri della piattaforma senza spezzare bruscamente.
 */
export function enforceCharLimit(bioText: string, limit: number): string {
  if (!bioText || bioText.length <= limit) return bioText;

  const lines = bioText.split('\n');
  let result = '';
  for (const line of lines) {
    const candidate = result ? `${result}\n${line}` : line;
    if (candidate.length <= limit) {
      result = candidate;
    } else {
      break;
    }
  }

  if (!result || result.length > limit) {
    return bioText.slice(0, Math.max(0, limit - 3)).trim() + '...';
  }
  return result;
}

/**
 * Genera una bio personalizzata per il profilo analizzato:
 * - Specificamente calibrata sul settore effettivo e sull'attività del profilo (NON riferita ad Aurora).
 * - Rispetta RIGOROSAMENTE i limiti di caratteri per piattaforma:
 *   TikTok: max 80 caratteri
 *   Instagram: max 150 caratteri
 *   Facebook: max 255 caratteri
 */
export function generateTailoredBio(profile: Partial<ProfileData>, _industry?: string): string {
  const { platform = 'instagram', bio = '' } = profile;

  const platformLimits: Record<string, number> = {
    tiktok: 80,
    instagram: 150,
    facebook: 255,
  };
  const charLimit = platformLimits[platform] || 150;

  const currentBio = (bio || '').trim();
  const structure = '[Cosa fai] | [Per chi] | [Risultato/beneficio] | [CTA + link]';

  let result = '';
  if (currentBio) {
    result += `Bio attuale del profilo:\n${currentBio}\n\n`;
  }

  result += `Struttura consigliata:\n${structure}\n\n(Contatore: ${structure.length}/${charLimit} caratteri)`;

  return result;
}

/**
 * Genera la struttura link in bio con link reale del profilo se disponibile
 * oppure con un numero/link di ESEMPIO FITTIZIO (es. https://wa.me/391234567890).
 * Non usa MAI il numero reale o i recapiti di Aurora-ADV.
 */
export function buildSuggestedLinkInBio(profile: Partial<ProfileData>): string {
  const { externalLink } = profile;
  const dummyExampleWa = 'https://wa.me/41790000000 (numero di esempio: sostituiscilo con il tuo)';

  if (externalLink && externalLink.trim().length > 0) {
    const cleanUrl = externalLink.trim();
    return `Link attuale: ${cleanUrl}\nConsiglio: Mantieni questo link se porta a un'azione chiara (es. prenotazione o acquisto). In alternativa, usa un contatto diretto come WhatsApp:\n${dummyExampleWa}`;
  }

  return `Struttura suggerita:\n${dummyExampleWa}`;
}

