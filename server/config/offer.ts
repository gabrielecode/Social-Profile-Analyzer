/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BRAND_NAME = 'Aurora-ADV';

export interface ServiceItem {
  id: string;
  nome: string;
  perChi: string;
  include: string;
  prezzo: string;
}

export const SERVICES_CATALOG: ServiceItem[] = [
  {
    id: 'check-up',
    nome: 'Check-up',
    perChi: 'Ingresso a bassa frizione',
    include: 'Report scritto + consulenza 30 min',
    prezzo: 'CHF 99',
  },
  {
    id: 'social-start',
    nome: 'Social Start',
    perChi: 'Profili fermi o inesistenti',
    include: 'Setup FB/IG + linea grafica e template + 8 post/mese',
    prezzo: 'da CHF 350–490/mese',
  },
  {
    id: 'social-crescita',
    nome: 'Social Crescita',
    perChi: 'Negozi/ristoranti/studi che vogliono contatti dai social',
    include: 'Start + 12–16 post/mese con Stories e Reels + calendario editoriale + gestione commenti/messaggi 24h',
    prezzo: 'da CHF 700–950/mese',
  },
  {
    id: 'contenuti-su-misura',
    nome: 'Contenuti Su Misura',
    perChi: 'Chi vuole immagini autentiche',
    include: 'Shooting foto/video in sede (mezza giornata) + Reels pronti per 1–2 mesi',
    prezzo: 'da CHF 350–600 a sessione',
  },
  {
    id: 'adv-setup',
    nome: 'ADV Setup',
    perChi: 'Chi vuole provare o gestirsi poi da solo',
    include: 'Analisi obiettivo/target + tracciamento + 1 campagna Google o Meta',
    prezzo: 'da CHF 390–590',
  },
  {
    id: 'adv-locale',
    nome: 'ADV Locale',
    perChi: 'PMI locali con budget medio-basso',
    include: 'Gestione mensile 1 piattaforma + targeting locale',
    prezzo: 'da CHF 350–500/mese',
  },
  {
    id: 'presenza-base',
    nome: 'Presenza Base / Sito Monopagina',
    perChi: 'Chi parte da zero',
    include: 'Sito monopagina professionale per presentare l\'attività e convertire i contatti',
    prezzo: 'CHF 599',
  },
  {
    id: 'seo-locale-start',
    nome: 'SEO Locale Start',
    perChi: 'Chi ha un sito ma non compare nei risultati locali',
    include: 'Ottimizzazione presenza locale su motori di ricerca e mappe',
    prezzo: 'da CHF 300–500/mese',
  },
  {
    id: 'visibilita-completa',
    nome: 'Visibilità Completa',
    perChi: 'Chi vuole delegare tutto',
    include: 'Social Crescita + ADV Locale + SEO Locale Start, report unico',
    prezzo: 'da CHF 1\'200–1\'600/mese',
  },
  {
    id: 'agente-ai',
    nome: 'Agente AI che risponde per te',
    perChi: 'Attività con molte chiamate/appuntamenti',
    include: 'Agente AI intelligente per gestione chiamate e appuntamenti 24/7',
    prezzo: 'CHF 60/mese',
  },
];

export function getServiceById(id: string): ServiceItem | undefined {
  return SERVICES_CATALOG.find((s) => s.id === id);
}

export function getContactConfig() {
  const whatsapp = process.env.CONTACT_WHATSAPP?.trim();
  const email = process.env.CONTACT_EMAIL?.trim();
  const url = process.env.CONTACT_URL?.trim();

  return {
    brand: BRAND_NAME,
    ...(whatsapp ? { whatsapp } : { whatsapp: '41764411359' }),
    ...(email ? { email } : { email: 'developers@graficawebdesign.com' }),
    ...(url ? { url } : {}),
    services: SERVICES_CATALOG,
  };
}
