/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Users,
  UserCheck,
  Video,
  Heart,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  Code2,
  Cpu,
  Server,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface HealthData {
  status: string;
  timestamp: string;
  service: string;
  openrouter: {
    configured: boolean;
    model: string;
  };
}

interface TestAiResponse {
  success: boolean;
  prompt?: string;
  model?: string;
  response?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  durationMs?: number;
  error?: string;
}

export interface RecentPost {
  caption?: string;
  likes?: number | string;
  comments?: number | string;
  views?: number | string;
  url?: string;
}

export type AdviceCategory = 'bio' | 'content' | 'community' | 'trust' | 'growth' | 'engagement';
export type AdvicePriority = 'high' | 'medium' | 'low';

export interface AdviceItem {
  id: string;
  category: AdviceCategory;
  title: string;
  description: string;
  priority: AdvicePriority;
  actionableStep: string;
}

export interface ProfileAdvice {
  overallScore?: number;
  summary: string;
  tips: AdviceItem[];
  aiGenerated?: boolean;
}

export interface ProfileData {
  platform: 'instagram' | 'tiktok' | 'facebook';
  handle: string;
  url: string;
  displayName?: string;
  bio?: string;
  externalLink?: string;
  followers?: number | string;
  following?: number | string;
  postsCount?: number | string;
  totalLikes?: number | string;
  verified?: boolean;
  avatarUrl?: string;
  recentPosts: RecentPost[];
  completeness: 'full' | 'partial' | 'none';
  missingFields: string[];
  warnings: string[];
  advice?: ProfileAdvice;
}

export default function App() {
  // Stato profilo da analizzare
  const [profileUrl, setProfileUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState<number | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | AdviceCategory>('all');
  const [isGeneratingAiAdvice, setIsGeneratingAiAdvice] = useState(false);
  const [aiAdviceError, setAiAdviceError] = useState<string | null>(null);

  // Pannello tecnico / Strumenti sviluppatore (chiuso di default)
  const [showDevTools, setShowDevTools] = useState(false);

  // Stato salute backend
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Stato test AI OpenRouter
  const defaultPrompt =
    'Quali sono i 3 pilastri fondamentali di un profilo social efficace e professionale? Rispondi in 3 brevi punti.';
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<TestAiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Profili di esempio per test immediato
  const sampleProfiles = [
    {
      platform: 'instagram' as const,
      label: 'Instagram (@cristiano)',
      url: 'https://www.instagram.com/cristiano/',
    },
    {
      platform: 'tiktok' as const,
      label: 'TikTok (@tiktok)',
      url: 'https://www.tiktok.com/@tiktok',
    },
    {
      platform: 'facebook' as const,
      label: 'Facebook (@zuck)',
      url: 'https://www.facebook.com/zuck',
    },
  ];

  // Prompt per test AI
  const samplePrompts = [
    'Quali sono i 3 pilastri di un profilo social vincente?',
    'Come creare una Bio Instagram ad alto tasso di conversione?',
    '3 errori gravi da evitare nella foto profilo aziendale',
  ];

  // Controllo stato backend
  const checkHealth = async () => {
    setIsHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`Errore HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Impossibile connettersi al backend';
      setHealthError(message);
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Esecuzione chiamata POST /api/analyze-profile
  const handleAnalyzeProfile = async (targetUrl?: string) => {
    const urlToAnalyze = (targetUrl ?? profileUrl).trim();
    if (!urlToAnalyze || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setProfileResult(null);
    setAvatarLoadError(false);
    setAnalysisDuration(null);

    try {
      const res = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: urlToAnalyze,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(
          res.status === 429
            ? 'Troppe richieste inviate. Riprova tra un minuto.'
            : `Il server ha restituito una risposta non in formato JSON (HTTP ${res.status}).`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Errore HTTP ${res.status} durante l'analisi.`);
      }

      setProfileResult(data.data);
      if (typeof data.durationMs === 'number') {
        setAnalysisDuration(data.durationMs);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Errore durante la lettura del profilo.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generazione consigli IA avanzati (POST /api/generate-ai-advice)
  const handleGenerateAiAdvice = async () => {
    if (!profileResult || isGeneratingAiAdvice) return;
    setIsGeneratingAiAdvice(true);
    setAiAdviceError(null);

    try {
      const res = await fetch('/api/generate-ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: profileResult }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(
          res.status === 429
            ? 'Troppe richieste inviate. Riprova tra un minuto.'
            : `Il server ha restituito una risposta non in formato JSON (HTTP ${res.status}).`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Errore HTTP ${res.status} durante la generazione dei consigli IA.`);
      }

      if (data.advice) {
        setProfileResult({
          ...profileResult,
          advice: data.advice,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la generazione dei consigli IA.';
      setAiAdviceError(msg);
    } finally {
      setIsGeneratingAiAdvice(false);
    }
  };

  // Esecuzione chiamata POST /api/test-ai
  const handleTestAi = async (customText?: string) => {
    const textToSend = customText ?? prompt;
    if (!textToSend.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiResult(null);

    try {
      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: textToSend,
        }),
      });

      const data: TestAiResponse = await res.json();
      setAiResult(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Errore durante la chiamata a /api/test-ai';
      setAiResult({
        success: false,
        error: msg,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Esportazione Report PDF con jsPDF
  const handleExportPdf = () => {
    if (!profileResult) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 16;

    // Header pulito stile Apple
    doc.setFillColor(0, 113, 227); // #0071e3
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SOCIAL PROFILE ANALYZER', 16, 14);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Report Analisi Profilo & Consigli', pageWidth - 16, 14, { align: 'right' });

    y = 34;

    // Profilo
    doc.setTextColor(29, 29, 31); // #1d1d1f
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const titleText = profileResult.displayName
      ? `${profileResult.displayName} (@${profileResult.handle})`
      : `@${profileResult.handle}`;
    doc.text(titleText, 16, y);

    y += 6;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 115); // #6e6e73
    doc.text(
      `Piattaforma: ${profileResult.platform.toUpperCase()}  |  Data: ${new Date().toLocaleDateString('it-IT')}  |  URL: ${profileResult.url}`,
      16,
      y
    );

    y += 10;

    // Box Metriche
    doc.setFillColor(245, 245, 247); // #f5f5f7
    doc.roundedRect(16, y, pageWidth - 32, 26, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 29, 31);
    doc.text('METRICHE CHIAVE E SALUTE PROFILO', 20, y + 8);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 115);
    const followersTxt = `Follower: ${formatNumber(profileResult.followers)}`;
    const followingTxt = `Seguiti: ${formatNumber(profileResult.following)}`;
    const postsTxt = `Post/Video: ${formatNumber(profileResult.postsCount)}`;
    const scoreTxt =
      profileResult.advice?.overallScore !== undefined
        ? `Punteggio Salute: ${profileResult.advice.overallScore}/100`
        : `Completezza: ${profileResult.completeness}`;

    doc.text(`${followersTxt}   |   ${followingTxt}   |   ${postsTxt}`, 20, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 113, 227);
    doc.text(scoreTxt, 20, y + 22);

    y += 34;

    // Bio
    if (profileResult.bio) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 29, 31);
      doc.text('BIOGRAFIA DEL PROFILO', 16, y);
      y += 5;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 67);

      const splitBio = doc.splitTextToSize(profileResult.bio, pageWidth - 32);
      doc.text(splitBio, 16, y);
      y += splitBio.length * 4.5 + 8;
    }

    // Sezione Consigli
    if (profileResult.advice && profileResult.advice.tips.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 113, 227);
      doc.text('CONSIGLI PER MIGLIORARE IL PROFILO', 16, y);
      y += 6;

      if (profileResult.advice.summary) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(110, 110, 115);
        const splitSummary = doc.splitTextToSize(profileResult.advice.summary, pageWidth - 32);
        doc.text(splitSummary, 16, y);
        y += splitSummary.length * 4.2 + 6;
      }

      profileResult.advice.tips.forEach((tip, idx) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        const priorityLabel =
          tip.priority === 'high'
            ? '[PRIORITÀ ALTA]'
            : tip.priority === 'medium'
            ? '[PRIORITÀ MEDIA]'
            : '[BUONA PRATICA]';

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 29, 31);
        doc.text(`${idx + 1}. ${tip.title} ${priorityLabel}`, 16, y);
        y += 4.5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 115);
        const splitDesc = doc.splitTextToSize(tip.description, pageWidth - 32);
        doc.text(splitDesc, 20, y);
        y += splitDesc.length * 3.8 + 2;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 113, 227);
        const actionTxt = `Passo concreto: ${tip.actionableStep}`;
        const splitAction = doc.splitTextToSize(actionTxt, pageWidth - 32);
        doc.text(splitAction, 20, y);
        y += splitAction.length * 3.8 + 5;
      });
    }

    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(174, 174, 178);
      doc.text(
        `Social Profile Analyzer · Report @${profileResult.handle} · Pagina ${i} di ${pageCount}`,
        16,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`Report_Social_${profileResult.handle}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCopyAiResponse = () => {
    if (aiResult?.response) {
      navigator.clipboard.writeText(aiResult.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJson = () => {
    if (profileResult) {
      navigator.clipboard.writeText(JSON.stringify(profileResult, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    }
  };

  const formatNumber = (val: number | string | undefined): string => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'number') return val.toLocaleString('it-IT');
    return String(val);
  };

  // Helper per Op.3: mostra SOLO tile con dato disponibile (niente tile vuoti, niente "0" o "—")
  const isValidMetric = (val: number | string | undefined | null): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'number') return val > 0;
    const str = String(val).trim();
    if (!str || str === '0' || str === '—' || str === '-' || str.toLowerCase() === 'null') {
      return false;
    }
    return true;
  };

  // Piattaforme icone SVG
  const renderPlatformIcon = (platform: 'instagram' | 'tiktok' | 'facebook', className = 'w-4 h-4') => {
    if (platform === 'instagram') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
      );
    }
    if (platform === 'tiktok') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.34-6.32V8.75a8.28 8.28 0 0 0 3.91 1.25V6.69z" />
        </svg>
      );
    }
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  };

  const getPlatformBadge = (platform: 'instagram' | 'tiktok' | 'facebook') => {
    switch (platform) {
      case 'instagram':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#e1306c]/10 text-[#c13584]">
            {renderPlatformIcon('instagram', 'w-3.5 h-3.5')}
            <span>Instagram</span>
          </span>
        );
      case 'tiktok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1d1d1f]/8 text-[#1d1d1f]">
            {renderPlatformIcon('tiktok', 'w-3.5 h-3.5')}
            <span>TikTok</span>
          </span>
        );
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#0071e3]/10 text-[#0071e3]">
            {renderPlatformIcon('facebook', 'w-3.5 h-3.5')}
            <span>Facebook</span>
          </span>
        );
    }
  };

  // Calcolo controlli per Op. 3 e Op. 4
  const followersNum =
    typeof profileResult?.followers === 'number'
      ? profileResult.followers
      : typeof profileResult?.followers === 'string'
      ? parseFloat(profileResult.followers.replace(/,/g, ''))
      : 0;

  const followingNum =
    typeof profileResult?.following === 'number'
      ? profileResult.following
      : typeof profileResult?.following === 'string'
      ? parseFloat(profileResult.following.replace(/,/g, ''))
      : 0;

  const hasFollowerRatio =
    profileResult &&
    isValidMetric(profileResult.followers) &&
    isValidMetric(profileResult.following) &&
    followersNum > 0 &&
    followingNum > 0;

  const ratioValue = hasFollowerRatio ? followersNum / followingNum : 0;
  const isRatioHealthy = hasFollowerRatio && ratioValue >= 1;

  const bioLength = profileResult?.bio ? profileResult.bio.trim().length : 0;
  const isBioOptimal = bioLength >= 40 && bioLength <= 150;
  const isBioShort = bioLength > 0 && bioLength < 40;

  // Calcolo Punteggio e Cerchio SVG
  const overallScore =
    profileResult?.advice?.overallScore !== undefined
      ? profileResult.advice.overallScore
      : profileResult?.completeness === 'full'
      ? 85
      : 60;

  const circleRadius = 26;
  const circleCircumference = 2 * Math.PI * circleRadius; // ~163.36
  const circleDashoffset =
    circleCircumference - (circleCircumference * Math.min(100, Math.max(0, overallScore))) / 100;

  const scoreColor =
    overallScore >= 80 ? '#34c759' : overallScore >= 50 ? '#ff9f0a' : '#ff3b30';

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] antialiased flex flex-col font-sans">
      {/* Header a tutta larghezza con padding responsive */}
      <header className="w-full bg-[#ffffff]/80 backdrop-blur-md border-b border-[#e5e5ea] sticky top-0 z-30 transition-colors">
        <div className="w-full px-4 lg:px-8 2xl:px-12 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-[17px] tracking-[-0.015em] text-[#1d1d1f] truncate">
              Social Profile Analyzer
            </span>
            {profileResult && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#6e6e73]">
                <span>/</span>
                <span className="font-medium text-[#1d1d1f] truncate">@{profileResult.handle}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            {profileResult && (
              <button
                type="button"
                onClick={() => {
                  setProfileResult(null);
                  setProfileUrl('');
                }}
                className="text-xs text-[#0071e3] hover:underline font-medium px-2 py-1 transition"
              >
                Nuova analisi
              </button>
            )}

            {isHealthLoading ? (
              <span className="inline-flex items-center gap-1.5 text-[#6e6e73]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071e3]" />
                <span className="hidden sm:inline">Connessione...</span>
              </span>
            ) : health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34c759]/10 text-[#248a3d]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                <span>Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ff3b30]/10 text-[#d70015]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main a tutta larghezza con padding responsive: px-4 mobile, px-8 da lg, px-12 da 2xl */}
      <main className="flex-1 w-full px-4 lg:px-8 2xl:px-12 flex flex-col">
        {!profileResult ? (
          /* ==================================================================== */
          /* STATO PRE-ANALISI: Sezione iniziale ampia centrata verticalmente      */
          /* ==================================================================== */
          <div className="flex-1 flex flex-col justify-center items-center py-10 sm:py-16 lg:py-24 my-auto min-h-[calc(100vh-3.5rem-5rem)]">
            <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-8">
              {/* Titolo grande ed elegante */}
              <div className="space-y-3 sm:space-y-4 max-w-2xl px-2">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.12]">
                  Analizza qualsiasi profilo social
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-[#6e6e73] leading-relaxed max-w-xl mx-auto">
                  Estrai metriche pubbliche, verifica i parametri chiave e ricevi consigli mirati per migliorare la tua presenza online.
                </p>
              </div>

              {/* Barra di ricerca larga */}
              <div className="w-full max-w-3xl px-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAnalyzeProfile();
                  }}
                  className="w-full"
                >
                  <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white rounded-[22px] sm:rounded-[26px] border border-[#e5e5ea] p-2 shadow-[0_4px_24px_rgba(0,0,0,0.06)] focus-within:border-[#0071e3] focus-within:ring-4 focus-within:ring-[#0071e3]/15 transition-all">
                    <div className="relative flex-1 flex items-center min-w-0 pl-3.5 sm:pl-4 pr-2 py-2 sm:py-0">
                      <Search className="w-5 h-5 text-[#6e6e73] shrink-0" />
                      <input
                        id="profile-url-input"
                        type="url"
                        value={profileUrl}
                        onChange={(e) => setProfileUrl(e.target.value)}
                        placeholder="Incolla link Instagram, TikTok o Facebook..."
                        className="w-full bg-transparent pl-3.5 pr-2 py-2 text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder-[#6e6e73]/60 focus:outline-none"
                        disabled={isAnalyzing}
                      />
                      {profileUrl && (
                        <button
                          type="button"
                          onClick={() => setProfileUrl('')}
                          className="p-1.5 text-[#6e6e73] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition shrink-0"
                          title="Cancella link"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="p-1 sm:p-0 shrink-0">
                      <button
                        type="submit"
                        disabled={isAnalyzing || !profileUrl.trim()}
                        className="w-full sm:w-auto px-7 py-3 rounded-[16px] sm:rounded-[20px] bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-sm sm:text-[15px] shadow-sm transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Analisi...</span>
                          </>
                        ) : (
                          <span>Analizza profilo</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Banner Errore */}
                {analysisError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3.5 p-4 rounded-[18px] bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] flex items-start gap-3 text-xs leading-relaxed text-left"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#d70015] shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <p className="font-semibold text-[#d70015]">Impossibile analizzare il link</p>
                      <p className="text-[#d70015]/90">{analysisError}</p>
                    </div>
                  </motion.div>
                )}

                {/* Icone delle piattaforme & link di esempio rapido */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-[#6e6e73]">
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
                    <span className="text-[12px] font-medium text-[#6e6e73]">Piattaforme supportate:</span>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[#1d1d1f]" title="Instagram">
                        {renderPlatformIcon('instagram', 'w-4 h-4 text-[#e1306c]')}
                        <span className="text-[12px] font-medium">Instagram</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#1d1d1f]" title="TikTok">
                        {renderPlatformIcon('tiktok', 'w-4 h-4 text-[#1d1d1f]')}
                        <span className="text-[12px] font-medium">TikTok</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#1d1d1f]" title="Facebook">
                        {renderPlatformIcon('facebook', 'w-4 h-4 text-[#0071e3]')}
                        <span className="text-[12px] font-medium">Facebook</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <span className="text-[11px] text-[#6e6e73]">Prova:</span>
                    {sampleProfiles.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setProfileUrl(sample.url);
                          handleAnalyzeProfile(sample.url);
                        }}
                        disabled={isAnalyzing}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-[#e5e5ea] text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition shadow-xs"
                      >
                        {sample.label.split(' ')[1] || sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* STATO POST-ANALISI: Due colonne da lg in su (Sinistra sticky, destra  */
          /* consigli in griglia 2 col da xl, 3 da 2xl + blocco CTA)              */
          /* ==================================================================== */
          <div className="w-full space-y-6 pt-5 pb-8">
            {/* Barra di ricerca superiore compatta */}
            <div className="w-full">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAnalyzeProfile();
                }}
                className="w-full max-w-4xl"
              >
                <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white rounded-[20px] border border-[#e5e5ea] p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/20 transition-all">
                  <div className="relative flex-1 flex items-center min-w-0 pl-3.5 pr-2 py-1.5 sm:py-0">
                    <Search className="w-4 h-4 text-[#6e6e73] shrink-0" />
                    <input
                      id="profile-url-input-post"
                      type="url"
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      placeholder="Incolla un altro link Instagram, TikTok o Facebook..."
                      className="w-full bg-transparent pl-3 pr-2 py-1.5 text-[14px] text-[#1d1d1f] placeholder-[#6e6e73]/60 focus:outline-none"
                      disabled={isAnalyzing}
                    />
                    {profileUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileUrl('')}
                        className="p-1 text-[#6e6e73] hover:text-[#1d1d1f] rounded-full hover:bg-[#f5f5f7] transition shrink-0"
                        title="Cancella link"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-1 sm:p-0 shrink-0 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isAnalyzing || !profileUrl.trim()}
                      className="w-full sm:w-auto px-5 py-2 rounded-[14px] bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-xs sm:text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 select-none"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Analisi...</span>
                        </>
                      ) : (
                        <span>Analizza</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {analysisError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3.5 rounded-[16px] bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] flex items-start gap-3 text-xs leading-relaxed max-w-4xl"
                >
                  <AlertTriangle className="w-4 h-4 text-[#d70015] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <p className="font-semibold text-[#d70015]">Impossibile analizzare il link</p>
                    <p className="text-[#d70015]/90">{analysisError}</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Layout responsive a due colonne (da lg in su) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
              {/* ================================================================ */}
              {/* COLONNA SINISTRA (STICKY): Scheda profilo con punteggio e tile    */}
              {/* ================================================================ */}
              <div className="lg:col-span-5 xl:col-span-4 2xl:col-span-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-5">
                {/* Banner dati parziali (se presente) */}
                {(profileResult.completeness === 'partial' || profileResult.completeness === 'none') && (
                  <div className="p-3.5 rounded-[18px] bg-[#ff9f0a]/12 border border-[#ff9f0a]/25 text-[#b45309] flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-[#b45309] shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-semibold">Dati pubblici parziali: </span>
                      <span>
                        Alcuni metadati non sono esposti pubblicamente senza login. L'analisi si basa sui dati accessibili.
                      </span>
                    </div>
                  </div>
                )}

                {/* CARD PROFILO */}
                <div className="bg-white rounded-[24px] border border-[#e5e5ea] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
                  {/* Header Profilo con Avatar, Nomi, Badge e Punteggio Circolare */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        {profileResult.avatarUrl && !avatarLoadError ? (
                          <img
                            src={profileResult.avatarUrl}
                            alt={profileResult.displayName || profileResult.handle}
                            onError={() => setAvatarLoadError(true)}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] object-cover border border-[#e5e5ea] shadow-xs"
                          />
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[#1d1d1f] font-semibold text-xl uppercase shadow-xs">
                            {profileResult.displayName
                              ? profileResult.displayName.charAt(0)
                              : profileResult.handle.charAt(0)}
                          </div>
                        )}
                        {profileResult.verified && (
                          <div
                            className="absolute -bottom-1 -right-1 bg-[#0071e3] text-white rounded-full p-0.5 shadow-sm"
                            title="Account Verificato"
                          >
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] tracking-tight truncate">
                          {profileResult.displayName || `@${profileResult.handle}`}
                        </h2>

                        <div className="flex items-center gap-1.5 text-xs text-[#6e6e73] flex-wrap">
                          <span className="font-medium text-[#1d1d1f] truncate">@{profileResult.handle}</span>
                          <span>·</span>
                          {getPlatformBadge(profileResult.platform)}
                        </div>

                        <div className="pt-0.5">
                          <a
                            href={profileResult.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#0071e3] hover:underline"
                          >
                            <span>Visita profilo</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Destra: Punteggio Anello Circolare Stile Apple */}
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                          <circle
                            cx="32"
                            cy="32"
                            r={circleRadius}
                            stroke="#e5e5ea"
                            strokeWidth="5"
                            fill="transparent"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r={circleRadius}
                            stroke={scoreColor}
                            strokeWidth="5"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={circleDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-500 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-base sm:text-lg font-semibold text-[#1d1d1f] tabular-nums leading-none">
                            {overallScore}
                          </span>
                          <span className="text-[8px] text-[#6e6e73] font-medium leading-none mt-0.5">
                            /100
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-[#6e6e73] mt-1 text-center">
                        Salute
                      </span>
                    </div>
                  </div>

                  {/* Tile statistiche (Follower, Seguiti, Post, Like totali) */}
                  {(() => {
                    const statTiles = [];
                    if (isValidMetric(profileResult.followers)) {
                      statTiles.push({
                        id: 'followers',
                        label: 'FOLLOWER',
                        value: formatNumber(profileResult.followers),
                      });
                    }
                    if (isValidMetric(profileResult.following)) {
                      statTiles.push({
                        id: 'following',
                        label: 'SEGUITI',
                        value: formatNumber(profileResult.following),
                      });
                    }
                    if (isValidMetric(profileResult.postsCount)) {
                      statTiles.push({
                        id: 'posts',
                        label: 'POST',
                        value: formatNumber(profileResult.postsCount),
                      });
                    }
                    if (isValidMetric(profileResult.totalLikes)) {
                      statTiles.push({
                        id: 'likes',
                        label: 'LIKE TOTALI',
                        value: formatNumber(profileResult.totalLikes),
                      });
                    }
                    if (statTiles.length === 0) return null;

                    return (
                      <div
                        className={`grid gap-2.5 ${
                          statTiles.length === 4
                            ? 'grid-cols-2'
                            : statTiles.length === 3
                            ? 'grid-cols-3'
                            : statTiles.length === 2
                            ? 'grid-cols-2'
                            : 'grid-cols-1'
                        }`}
                      >
                        {statTiles.map((tile) => (
                          <div
                            key={tile.id}
                            className="bg-[#f5f5f7] rounded-[16px] p-3 sm:p-3.5 transition"
                          >
                            <span className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider block">
                              {tile.label}
                            </span>
                            <span className="text-lg sm:text-xl font-semibold text-[#1d1d1f] tabular-nums block mt-0.5 truncate">
                              {tile.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Biografia del Profilo */}
                  {(profileResult.bio || profileResult.externalLink) && (
                    <div className="bg-[#f5f5f7] rounded-[16px] p-3.5 text-xs space-y-2">
                      {profileResult.bio && (
                        <p className="text-[#1d1d1f] text-[13px] leading-relaxed whitespace-pre-wrap">
                          {profileResult.bio}
                        </p>
                      )}
                      {profileResult.externalLink && (
                        <div className="flex items-center gap-1.5 text-[#0071e3] pt-0.5">
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <a
                            href={profileResult.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline truncate font-medium text-xs"
                          >
                            {profileResult.externalLink}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Righe di controllo qualità */}
                  <div className="space-y-0 divide-y divide-[#e5e5ea] pt-1">
                    <div className="pb-2.5 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">
                      Controlli Qualità Profilo
                    </div>

                    {/* 1. Rapporto follower / seguiti */}
                    {hasFollowerRatio && (
                      <div className="py-2.5 flex items-start gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isRatioHealthy ? 'bg-[#34c759]/12 text-[#248a3d]' : 'bg-[#ff9f0a]/15 text-[#b45309]'
                          }`}
                        >
                          {isRatioHealthy ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-[#1d1d1f]">
                              Rapporto follower / seguiti
                            </span>
                            <span className="text-xs font-medium text-[#6e6e73] tabular-nums">
                              {ratioValue >= 10 ? ratioValue.toFixed(1) : ratioValue.toFixed(2)}x
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6e6e73] mt-0.5 leading-relaxed">
                            {isRatioHealthy
                              ? 'Ottimo rapporto: più follower che seguiti.'
                              : 'Seguiti superiori ai follower.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 2. Lunghezza Bio */}
                    {profileResult.bio !== undefined && (
                      <div className="py-2.5 flex items-start gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isBioOptimal
                              ? 'bg-[#34c759]/12 text-[#248a3d]'
                              : isBioShort
                              ? 'bg-[#ff9f0a]/15 text-[#b45309]'
                              : 'bg-[#ff3b30]/12 text-[#d70015]'
                          }`}
                        >
                          {isBioOptimal ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isBioShort ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-[#1d1d1f]">
                              Lunghezza biografia
                            </span>
                            <span className="text-xs font-medium text-[#6e6e73] tabular-nums">
                              {bioLength} car.
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6e6e73] mt-0.5 leading-relaxed">
                            {isBioOptimal
                              ? 'Lunghezza ottimale per chiarezza e CTA.'
                              : isBioShort
                              ? 'Bio sintetica: arricchiscila con parole chiave.'
                              : 'Bio vuota: aggiungi una descrizione chiara.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3. Link Esterno */}
                    <div className="py-2.5 flex items-start gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          profileResult.externalLink
                            ? 'bg-[#34c759]/12 text-[#248a3d]'
                            : 'bg-[#ff9f0a]/15 text-[#b45309]'
                        }`}
                      >
                        {profileResult.externalLink ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#1d1d1f]">
                            Link esterno / CTA
                          </span>
                          <span className="text-xs font-medium text-[#6e6e73]">
                            {profileResult.externalLink ? 'Configurato' : 'Assente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6e6e73] mt-0.5 leading-relaxed">
                          {profileResult.externalLink
                            ? 'Punto di atterraggio attivo per conversioni.'
                            : 'Nessun link esterno rilevato nel profilo.'}
                        </p>
                      </div>
                    </div>

                    {/* 4. Completezza Estrazione */}
                    <div className="py-2.5 flex items-start gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          profileResult.completeness === 'full'
                            ? 'bg-[#34c759]/12 text-[#248a3d]'
                            : 'bg-[#ff9f0a]/15 text-[#b45309]'
                        }`}
                      >
                        {profileResult.completeness === 'full' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#1d1d1f]">
                            Completezza metadati
                          </span>
                          <span className="text-xs font-medium text-[#6e6e73]">
                            {profileResult.completeness === 'full' ? 'Completa' : 'Parziale'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6e6e73] mt-0.5 leading-relaxed">
                          {profileResult.completeness === 'full'
                            ? 'Tutti i dati pubblici previsti acquisiti.'
                            : 'Alcuni campi richiedono login per l\'accesso.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barra Azioni Scheda (Export PDF, Ricarica, JSON) */}
                  <div className="pt-3 border-t border-[#e5e5ea] flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-[#6e6e73]">
                      {analysisDuration !== null && (
                        <span className="tabular-nums">Tempo: {analysisDuration} ms</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-[12px] bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-medium shadow-xs transition active:scale-[0.98]"
                        title="Scarica il report PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAnalyzeProfile(profileResult.url)}
                        disabled={isAnalyzing}
                        className="p-1.5 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] text-xs font-medium border border-[#e5e5ea] transition"
                        title="Ricarica dati profilo"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="p-1.5 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#6e6e73] hover:text-[#1d1d1f] text-xs font-medium border border-[#e5e5ea] transition"
                        title="Ispeziona JSON"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Ispezione JSON opzionale */}
                  {showRawJson && (
                    <div className="pt-2">
                      <div className="bg-[#f5f5f7] rounded-[16px] p-3 text-xs font-mono space-y-2 border border-[#e5e5ea]">
                        <div className="flex items-center justify-between text-[#6e6e73]">
                          <span>Dati estratti (JSON)</span>
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="inline-flex items-center gap-1 text-[#0071e3] hover:underline"
                          >
                            {jsonCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{jsonCopied ? 'Copiato' : 'Copia'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 bg-white rounded-[10px] border border-[#e5e5ea] overflow-x-auto max-h-56 leading-relaxed text-[#1d1d1f] text-[11px]">
                          {JSON.stringify(profileResult, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ================================================================ */}
              {/* COLONNA DESTRA: Consigli in griglia (2 col da xl, 3 da 2xl)      */}
              {/* + Blocco CTA + Ultimi video pubblici                             */}
              {/* ================================================================ */}
              <div className="lg:col-span-7 xl:col-span-8 2xl:col-span-9 space-y-6 min-w-0">
                {profileResult.advice && (
                  <div className="space-y-5">
                    {/* Header Consigli + Genera con IA */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
                          <span>Consigli per il Profilo</span>
                          {profileResult.advice.aiGenerated && (
                            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                              AI Potenziata
                            </span>
                          )}
                        </h3>
                        {profileResult.advice.summary && (
                          <p className="text-xs sm:text-[13px] text-[#6e6e73] mt-1 max-w-2xl leading-relaxed">
                            {profileResult.advice.summary}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateAiAdvice}
                        disabled={isGeneratingAiAdvice}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[14px] bg-white border border-[#e5e5ea] hover:border-[#0071e3] text-[#0071e3] text-xs font-medium transition shadow-xs disabled:opacity-50 shrink-0"
                      >
                        {isGeneratingAiAdvice ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071e3]" />
                            <span>Elaborazione IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
                            <span>{profileResult.advice.aiGenerated ? 'Rigenera con IA' : 'Genera con IA'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiAdviceError && (
                      <div className="p-3.5 rounded-[16px] bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015] text-xs">
                        {aiAdviceError}
                      </div>
                    )}

                    {/* Filtri categoria */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[
                        { id: 'all' as const, label: 'Tutti', count: profileResult.advice.tips.length },
                        { id: 'bio' as const, label: 'Bio & CTA', count: profileResult.advice.tips.filter(t => t.category === 'bio').length },
                        { id: 'content' as const, label: 'Contenuti', count: profileResult.advice.tips.filter(t => t.category === 'content').length },
                        { id: 'community' as const, label: 'Community', count: profileResult.advice.tips.filter(t => t.category === 'community' || (t.category as string) === 'engagement').length },
                        { id: 'trust' as const, label: 'Fiducia', count: profileResult.advice.tips.filter(t => t.category === 'trust').length },
                        { id: 'growth' as const, label: 'Crescita', count: profileResult.advice.tips.filter(t => t.category === 'growth').length },
                      ]
                        .filter(cat => cat.id === 'all' || cat.count > 0)
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id as any)}
                            className={`text-xs px-3 py-1.5 rounded-[12px] font-medium transition flex items-center gap-1.5 ${
                              selectedCategory === cat.id
                                ? 'bg-[#1d1d1f] text-white shadow-xs'
                                : 'bg-white text-[#6e6e73] hover:text-[#1d1d1f] border border-[#e5e5ea]'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span
                              className={`text-[10px] tabular-nums font-mono px-1 rounded-full ${
                                selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-[#f5f5f7] text-[#6e6e73]'
                              }`}
                            >
                              {cat.count}
                            </span>
                          </button>
                        ))}
                    </div>

                    {/* GRIGLIA CONSIGLI: 2 colonne da xl, 3 da 2xl. Card ad altezza uniforme senza spazi vuoti */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch">
                      {profileResult.advice.tips
                        .filter((tip) => {
                          if (selectedCategory === 'all') return true;
                          if (selectedCategory === 'community' || (selectedCategory as string) === 'engagement') {
                            return tip.category === 'community' || (tip.category as string) === 'engagement';
                          }
                          return tip.category === selectedCategory;
                        })
                        .map((tip) => (
                          <div
                            key={tip.id}
                            className="bg-white rounded-[22px] border border-[#e5e5ea] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-[#d1d1d6] transition-all flex flex-col justify-between gap-3 h-full"
                          >
                            <div className="space-y-2 flex-1 flex flex-col">
                              {/* Categoria e Pill Priorità */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] uppercase font-semibold text-[#6e6e73] tracking-wider">
                                  {tip.category === 'bio'
                                    ? 'Bio & CTA'
                                    : tip.category === 'content'
                                    ? 'Contenuti'
                                    : tip.category === 'community' || (tip.category as string) === 'engagement'
                                    ? 'Community'
                                    : tip.category === 'trust'
                                    ? 'Fiducia'
                                    : 'Crescita'}
                                </span>

                                {tip.priority === 'high' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ff3b30]/10 text-[#d70015]">
                                    Alta Priorità
                                  </span>
                                ) : tip.priority === 'medium' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ff9f0a]/12 text-[#b45309]">
                                    Media Priorità
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34c759]/12 text-[#248a3d]">
                                    Buona Pratica
                                  </span>
                                )}
                              </div>

                              <h4 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                                {tip.title}
                              </h4>

                              <p className="text-xs text-[#6e6e73] leading-relaxed flex-1">
                                {tip.description}
                              </p>
                            </div>

                            {/* Passo concreto fissato in basso a fondo card */}
                            <div className="bg-[#f5f5f7] rounded-[14px] p-3 text-xs text-[#1d1d1f] border border-[#e5e5ea]/50 space-y-0.5 mt-auto">
                              <span className="font-semibold text-[#1d1d1f] block text-[11px] uppercase tracking-wider text-[#6e6e73]">
                                Passo concreto:
                              </span>
                              <p className="text-xs leading-relaxed text-[#1d1d1f] font-normal">
                                {tip.actionableStep}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* BLOCCO CTA STRATEGICO */}
                    <div className="bg-gradient-to-br from-[#1d1d1f] via-[#2c2c2e] to-[#1d1d1f] text-white rounded-[24px] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 mt-6">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/90">
                          <Sparkles className="w-3 h-3 text-[#34c759]" />
                          <span>Report Strategico</span>
                        </div>
                        <h4 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                          Pronto a potenziare il profilo @{profileResult.handle}?
                        </h4>
                        <p className="text-xs sm:text-[13px] text-white/70 leading-relaxed">
                          Esporta il report completo in PDF con le metriche rilevate, il punteggio di salute e tutti i passi concreti per il tuo team o i tuoi clienti.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handleExportPdf}
                          className="px-5 py-3 rounded-[16px] bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs sm:text-sm font-semibold shadow-sm transition active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Esporta Report PDF</span>
                        </button>
                        {!profileResult.advice.aiGenerated && (
                          <button
                            type="button"
                            onClick={handleGenerateAiAdvice}
                            disabled={isGeneratingAiAdvice}
                            className="px-4 py-3 rounded-[16px] bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-medium border border-white/10 transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isGeneratingAiAdvice ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Elaborazione...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-[#34c759]" />
                                <span>Approfondisci con IA</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ultimi video pubblici (se presenti) */}
                {profileResult.recentPosts && profileResult.recentPosts.length > 0 && (
                  <div className="bg-white rounded-[22px] border border-[#e5e5ea] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider">
                        Ultimi Video Pubblici ({profileResult.recentPosts.length})
                      </span>
                    </div>

                    <div className="divide-y divide-[#e5e5ea]">
                      {profileResult.recentPosts.map((post, pIdx) => (
                        <div key={pIdx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="text-[#1d1d1f] truncate font-medium">
                              {post.caption || 'Nessuna descrizione'}
                            </p>
                            <div className="flex items-center gap-3 text-[#6e6e73] text-[11px] mt-0.5 tabular-nums">
                              {post.likes !== undefined && <span>{formatNumber(post.likes)} like</span>}
                              {post.views !== undefined && <span>{formatNumber(post.views)} viste</span>}
                              {post.comments !== undefined && <span>{formatNumber(post.comments)} commenti</span>}
                            </div>
                          </div>

                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#0071e3] hover:underline text-xs shrink-0"
                            >
                              <span>Vedi</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PANNELLO TECNICO (Sezione comprimibile "Strumenti sviluppatore", chiusa di default) */}
        <section className="w-full pt-6 border-t border-[#e5e5ea] mt-auto pb-8">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowDevTools(!showDevTools)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#f5f5f7]/60 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#6e6e73]">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#1d1d1f] block">
                    Strumenti sviluppatore
                  </span>
                  <span className="text-[11px] text-[#6e6e73]">
                    Stato server, diagnostica backend e collaudo modello AI
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    health?.status === 'ok'
                      ? 'bg-[#34c759]/10 text-[#248a3d]'
                      : 'bg-[#ff9f0a]/10 text-[#b45309]'
                  }`}
                >
                  {health?.status === 'ok' ? 'API Ok' : 'In attesa'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#6e6e73] transition-transform duration-200 ${
                    showDevTools ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* Contenuto comprimibile chiuso di default */}
            {showDevTools && (
              <div className="p-4 sm:p-5 border-t border-[#e5e5ea] space-y-5 bg-[#f5f5f7]/30">
                {/* 1. Stato del Sistema & Diagnostica */}
                <div className="bg-white rounded-[16px] p-3.5 border border-[#e5e5ea] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1d1d1f]">Stato dell'Infrastruttura</span>
                    <button
                      type="button"
                      onClick={checkHealth}
                      className="p-1 text-[#6e6e73] hover:text-[#1d1d1f] rounded hover:bg-[#f5f5f7] transition"
                      title="Ricarica health"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isHealthLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2 rounded-[10px] bg-[#f5f5f7]">
                      <span className="text-[#6e6e73] block text-[10px]">API Health</span>
                      <span className={health?.status === 'ok' ? 'text-[#248a3d] font-semibold' : 'text-[#6e6e73]'}>
                        {health?.status || 'In verifica'}
                      </span>
                    </div>

                    <div className="p-2 rounded-[10px] bg-[#f5f5f7]">
                      <span className="text-[#6e6e73] block text-[10px]">OpenRouter Key</span>
                      <span className={health?.openrouter.configured ? 'text-[#248a3d] font-semibold' : 'text-[#b45309]'}>
                        {health?.openrouter.configured ? 'Configurata' : 'Assente (.env)'}
                      </span>
                    </div>

                    <div className="p-2 rounded-[10px] bg-[#f5f5f7]">
                      <span className="text-[#6e6e73] block text-[10px]">Modello</span>
                      <span className="text-[#1d1d1f] truncate block" title={health?.openrouter.model}>
                        {health?.openrouter.model ? health.openrouter.model.split('/').pop() : 'Llama-3.3'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Banner se manca la chiave OpenRouter */}
                {!isHealthLoading && health && !health.openrouter.configured && (
                  <div className="p-3.5 rounded-[14px] bg-[#ff9f0a]/10 border border-[#ff9f0a]/20 text-[#b45309] text-xs space-y-1">
                    <p className="font-semibold">Chiave OPENROUTER_API_KEY non presente nel file .env</p>
                    <p className="text-[11px] text-[#b45309]/90">
                      La lettura automatica dei profili social funziona senza AI. Per abilitare anche il test del modello, imposta la chiave nel file <code>.env</code>.
                    </p>
                  </div>
                )}

                {/* 2. Collaudo Connessione OpenRouter (Test AI) */}
                <div className="bg-white rounded-[16px] p-4 border border-[#e5e5ea] space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider">
                      Test Modello AI (POST /api/test-ai)
                    </h4>
                    <p className="text-[11px] text-[#6e6e73] mt-0.5">
                      Invia un prompt al backend Express per testare la risposta del modello.
                    </p>
                  </div>

                  {/* Prompt veloci */}
                  <div className="flex flex-wrap gap-1.5">
                    {samplePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPrompt(p);
                          handleTestAi(p);
                        }}
                        disabled={isAiLoading}
                        className="text-[11px] px-2.5 py-1 rounded-[10px] bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] transition text-left"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Inserisci un prompt di test..."
                    className="w-full p-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-[12px] text-xs text-[#1d1d1f] placeholder-[#6e6e73]/60 focus:outline-none focus:border-[#0071e3] transition resize-none"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleTestAi()}
                      disabled={isAiLoading || !prompt.trim()}
                      className="px-4 py-1.5 rounded-[12px] bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-medium shadow-xs transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {isAiLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                          <span>Esecuzione...</span>
                        </>
                      ) : (
                        <span>Esegui Test AI</span>
                      )}
                    </button>
                  </div>

                  {/* Risultato Test AI */}
                  {aiResult && (
                    <div className="pt-2 border-t border-[#e5e5ea] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-medium ${
                            aiResult.success ? 'text-[#248a3d]' : 'text-[#d70015]'
                          }`}
                        >
                          {aiResult.success ? 'Risposta ricevuta' : 'Errore nella richiesta'}
                        </span>
                        {aiResult.durationMs !== undefined && (
                          <span className="text-[11px] text-[#6e6e73] font-mono">
                            {aiResult.durationMs} ms
                          </span>
                        )}
                      </div>

                      {aiResult.success ? (
                        <div className="p-3 bg-[#f5f5f7] rounded-[12px] text-xs text-[#1d1d1f] leading-relaxed relative group space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-[#6e6e73]">
                            <span className="font-mono">{aiResult.model}</span>
                            <button
                              type="button"
                              onClick={handleCopyAiResponse}
                              className="text-[#0071e3] hover:underline inline-flex items-center gap-1"
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copied ? 'Copiato' : 'Copia'}</span>
                            </button>
                          </div>
                          <div className="whitespace-pre-wrap">{aiResult.response}</div>
                        </div>
                      ) : (
                        <div className="p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-[12px] text-xs text-[#d70015] font-mono whitespace-pre-wrap">
                          {aiResult.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer a tutta larghezza con padding responsive */}
      <footer className="w-full border-t border-[#e5e5ea] py-6 text-xs text-[#6e6e73] mt-auto">
        <div className="w-full px-4 lg:px-8 2xl:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Social Profile Analyzer</span>
          <span className="text-[#86868b]">Design pulito stile Apple · Tema chiaro</span>
        </div>
      </footer>
    </div>
  );
}
