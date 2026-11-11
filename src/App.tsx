/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Copy,
  Check,
  Server,
  Zap,
  Info,
  Clock,
  Cpu,
  RefreshCw,
  ExternalLink,
  Users,
  UserCheck,
  Video,
  ShieldCheck,
  ShieldAlert,
  Code2,
  X,
  FileText,
  BadgeCheck,
  Heart,
  Target,
  Lightbulb,
  TrendingUp,
  Layers,
  ArrowRight,
} from 'lucide-react';

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

export type AdviceCategory = 'bio' | 'content' | 'engagement' | 'trust' | 'growth';
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
  // Stato profilo da link
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

  // Generazione consigli IA avanzati
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
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Impossibile generare i consigli IA.');
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

  // Esempi rapidi di profili pubblici supportati
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
      label: 'Facebook (Mark Zuckerberg)',
      url: 'https://www.facebook.com/zuck',
    },
  ];

  // Esempi di prompt per OpenRouter
  const samplePrompts = [
    'Quali sono i 3 pilastri fondamentali di un profilo social vincente?',
    'Come strutturare una Bio Instagram ad alto tasso di conversione?',
    'Consigli per rendere accattivante il sommario di LinkedIn',
    '3 errori gravi da evitare nella foto profilo aziendale',
  ];

  // Controllo stato del backend
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Errore HTTP ${res.status} durante l'analisi.`);
      }

      setProfileResult(data.data);
      if (typeof data.durationMs === 'number') {
        setAnalysisDuration(data.durationMs);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Errore durante la lettura del profilo.";
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
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

  const getPlatformBadge = (platform: 'instagram' | 'tiktok' | 'facebook') => {
    switch (platform) {
      case 'instagram':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 text-pink-300 border border-pink-500/30">
            Instagram
          </span>
        );
      case 'tiktok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/50 text-cyan-300 border border-cyan-500/30">
            TikTok
          </span>
        );
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/50 text-blue-300 border border-blue-500/30">
            Facebook
          </span>
        );
    }
  };

  const getCompletenessBadge = (level: 'full' | 'partial' | 'none') => {
    switch (level) {
      case 'full':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Completezza: Dati Completi (Full)
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Completezza: Dati Parziali (Partial)
          </span>
        );
      case 'none':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Completezza: Dati Non Estratti (None)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Barra di navigazione superiore */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">
                  Social Profile Analyzer
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Lettura automatica profilo
                </span>
              </div>
            </div>
          </div>

          {/* Badge stato connessione */}
          <div className="flex items-center gap-3">
            {isHealthLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Verifica backend...</span>
              </div>
            ) : healthError ? (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-800/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Backend disconnesso</span>
                <button
                  onClick={checkHealth}
                  className="hover:text-rose-200 ml-1 p-0.5 rounded hover:bg-rose-900/50"
                  title="Riprova connessione"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            ) : health?.openrouter.configured ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>OpenRouter Pronto</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-800/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>OpenRouter (No Key)</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Contenuto Principale */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Banner informativo OpenRouter solo se manca la chiave */}
        {!isHealthLoading && health && !health.openrouter.configured && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-100">
                  OPENROUTER_API_KEY non configurata nel file .env
                </p>
                <p className="text-amber-300/80 text-xs mt-0.5">
                  La lettura automatica dei profili social da link funziona senza AI né chiavi. Per collaudare anche il box OpenRouter in basso, imposta la chiave nel file <code className="px-1.5 py-0.5 rounded bg-black/40 text-amber-200 font-mono">.env</code>.
                </p>
              </div>
            </div>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-medium text-amber-100 transition shrink-0"
            >
              <span>Genera Chiave OpenRouter</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* SEZIONE 1: Lettura Automatica Profilo da Link */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-xl relative overflow-hidden space-y-6">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-3 relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reader Pubblico Diretto • Protezione SSRF • Timeout 10s • Max 1 MB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Lettura Dati Pubblici da Link
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Incolla il link HTTPS di un profilo pubblico <strong className="text-slate-200">Instagram</strong>, <strong className="text-slate-200">TikTok</strong> o <strong className="text-slate-200">Facebook</strong>. Il backend scarica la pagina in modalità protetta, estrae i metadati Open Graph, JSON incorporato e metriche senza fare uso di AI, screenshot o PDF.
            </p>
          </div>

          {/* Esempi rapidi da cliccare */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">
              Esempi di profili pubblici da testare:
            </span>
            <div className="flex flex-wrap gap-2">
              {sampleProfiles.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setProfileUrl(sample.url);
                    handleAnalyzeProfile(sample.url);
                  }}
                  disabled={isAnalyzing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 hover:text-white text-slate-300 border border-slate-700/60 transition inline-flex items-center gap-1.5"
                >
                  <Link2 className="w-3 h-3 text-indigo-400" />
                  <span>{sample.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form di inserimento URL */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyzeProfile();
            }}
            className="space-y-3"
          >
            <label
              htmlFor="profile-url"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Link del profilo social
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Link2 className="w-5 h-5" />
                </div>
                <input
                  id="profile-url"
                  type="url"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  placeholder="https://www.instagram.com/cristiano/ oppure https://www.tiktok.com/@tiktok"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isAnalyzing || !profileUrl.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 select-none"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Lettura in corso...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Analizza Profilo</span>
                    </>
                  )}
                </button>

                {profileResult && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileResult(null);
                      setAnalysisError(null);
                    }}
                    className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                    title="Azzera risultato"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              * Vengono accettati esclusivamente host consentiti (instagram.com, tiktok.com, facebook.com). Indirizzi locali, IP diretti o host non allowlistati vengono bloccati dal modulo SSRF.
            </p>
          </form>

          {/* Errore di validazione o fetch */}
          {analysisError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 space-y-1 text-sm">
              <div className="flex items-center gap-2 font-semibold text-rose-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Impossibile completare la lettura del profilo</span>
              </div>
              <p className="text-xs text-rose-200/90 font-mono bg-black/40 p-2.5 rounded-lg whitespace-pre-wrap">
                {analysisError}
              </p>
            </div>
          )}

          {/* SCHEDA RISULTATO PROFILO (ProfileData) */}
          {profileResult && (
            <div className="pt-6 border-t border-slate-800 space-y-6">
              {/* Header scheda: Stato completezza e metriche di caricamento */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {getPlatformBadge(profileResult.platform)}
                  {getCompletenessBadge(profileResult.completeness)}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {analysisDuration !== null && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {analysisDuration} ms
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60 transition"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{showRawJson ? 'Nascondi JSON' : 'Ispeziona JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Avviso in caso di completezza parziale o assente */}
              {(profileResult.completeness === 'partial' || profileResult.completeness === 'none') && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 shadow-lg shadow-amber-950/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-100 leading-relaxed">
                      Non è stato possibile leggere tutti i dati pubblici di questo profilo. Nel prossimo passaggio potrai caricare degli screenshot per completare l'analisi.
                    </p>
                  </div>
                </div>
              )}

              {/* Informazioni Principali del Profilo */}
              <div className="bg-slate-950/80 rounded-2xl p-6 border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                  <div className="flex items-center gap-4">
                    {/* Avatar con fallback su errore o immagine non disponibile */}
                    <div className="relative shrink-0">
                      {profileResult.avatarUrl && !avatarLoadError ? (
                        <img
                          src={profileResult.avatarUrl}
                          alt={profileResult.displayName || profileResult.handle}
                          onError={() => setAvatarLoadError(true)}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xl uppercase shadow-md">
                          {profileResult.displayName ? profileResult.displayName.charAt(0) : profileResult.handle.charAt(0)}
                        </div>
                      )}
                      {profileResult.verified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow" title="Account Verificato">
                          <BadgeCheck className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                          {profileResult.displayName || `@${profileResult.handle}`}
                        </h2>
                        {profileResult.verified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                            <BadgeCheck className="w-3 h-3" />
                            Verificato
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="font-mono text-indigo-400">@{profileResult.handle}</span>
                        <span>•</span>
                        <a
                          href={profileResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white underline decoration-slate-600 hover:decoration-white transition"
                        >
                          <span>Apri link pubblico</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="self-stretch sm:self-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAnalyzeProfile(profileResult.url)}
                      disabled={isAnalyzing}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                      title="Ricarica profilo"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                      <span>Ricarica Dati</span>
                    </button>
                  </div>
                </div>

                {/* Griglia Metriche / Statistiche */}
                <div
                  className={`grid grid-cols-1 gap-3 ${
                    profileResult.totalLikes !== undefined
                      ? 'sm:grid-cols-2 lg:grid-cols-4'
                      : 'sm:grid-cols-3'
                  }`}
                >
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Follower</span>
                      <span className="text-lg font-bold text-white font-mono">
                        {formatNumber(profileResult.followers)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Seguiti (Following)</span>
                      <span className="text-lg font-bold text-white font-mono">
                        {formatNumber(profileResult.following)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Post / Video Totali</span>
                      <span className="text-lg font-bold text-white font-mono">
                        {formatNumber(profileResult.postsCount)}
                      </span>
                    </div>
                  </div>

                  {profileResult.totalLikes !== undefined && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                        <Heart className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block">Like Totali</span>
                        <span className="text-lg font-bold text-white font-mono">
                          {formatNumber(profileResult.totalLikes)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bio & Link Esterno */}
                {(profileResult.bio || profileResult.externalLink) && (
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
                    {profileResult.bio && (
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {profileResult.bio}
                      </p>
                    )}
                    {profileResult.externalLink && (
                      <div className="pt-2 flex items-center gap-2 text-xs">
                        <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-400">Link in bio:</span>
                        <a
                          href={profileResult.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline font-mono truncate"
                        >
                          {profileResult.externalLink}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* SEZIONE CONSIGLI MIRATI PER MIGLIORARE IL PROFILO */}
                {profileResult.advice && (
                  <div className="pt-6 border-t border-slate-800 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/50 via-purple-950/40 to-slate-900/70 p-5 rounded-2xl border border-indigo-500/30">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <Target className="w-4.5 h-4.5" />
                          </div>
                          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            <span>Consigli Mirati per Migliorare il Profilo</span>
                            {profileResult.advice.aiGenerated && (
                              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-300" />
                                Potenziato da IA
                              </span>
                            )}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                          {profileResult.advice.summary}
                        </p>
                      </div>

                      {/* Profile Health Score Gauge */}
                      {typeof profileResult.advice.overallScore === 'number' && (
                        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                              Salute Profilo
                            </span>
                            <span className="text-xl font-extrabold text-white font-mono">
                              {profileResult.advice.overallScore}/100
                            </span>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-indigo-500/40 flex items-center justify-center relative shadow-inner">
                            <span className={`text-xs font-bold ${
                              profileResult.advice.overallScore >= 80
                                ? 'text-emerald-400'
                                : profileResult.advice.overallScore >= 50
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}>
                              {profileResult.advice.overallScore}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Filtri per Categoria */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'all', label: 'Tutti i Consigli', count: profileResult.advice.tips.length },
                          { id: 'bio', label: 'Bio & CTA', count: profileResult.advice.tips.filter(t => t.category === 'bio').length },
                          { id: 'content', label: 'Contenuti', count: profileResult.advice.tips.filter(t => t.category === 'content').length },
                          { id: 'engagement', label: 'Engagement', count: profileResult.advice.tips.filter(t => t.category === 'engagement').length },
                          { id: 'trust', label: 'Fiducia & Branding', count: profileResult.advice.tips.filter(t => t.category === 'trust').length },
                          { id: 'growth', label: 'Crescita', count: profileResult.advice.tips.filter(t => t.category === 'growth').length },
                        ].filter(cat => cat.id === 'all' || cat.count > 0).map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id as any)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                              selectedCategory === cat.id
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                : 'bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
                              {cat.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Pulsante per generazione consigli IA */}
                      <button
                        type="button"
                        onClick={handleGenerateAiAdvice}
                        disabled={isGeneratingAiAdvice}
                        className="text-xs px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow transition inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isGeneratingAiAdvice ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Elaborazione IA in corso...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{profileResult.advice.aiGenerated ? 'Rigenera Consigli IA' : 'Genera Consigli Avanzati con IA'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiAdviceError && (
                      <div className="text-xs p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
                        {aiAdviceError}
                      </div>
                    )}

                    {/* Griglia delle schede di consiglio */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profileResult.advice.tips
                        .filter((tip) => selectedCategory === 'all' || tip.category === selectedCategory)
                        .map((tip) => (
                          <div
                            key={tip.id}
                            className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between gap-3 relative group hover:border-slate-700 transition shadow-md"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                  {tip.category === 'bio' ? 'Bio & CTA' : tip.category === 'content' ? 'Contenuti' : tip.category === 'engagement' ? 'Engagement' : tip.category === 'trust' ? 'Fiducia' : 'Crescita'}
                                </span>

                                {/* Priority Badge */}
                                {tip.priority === 'high' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                                    🔴 Priorità Alta
                                  </span>
                                ) : tip.priority === 'medium' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    🟡 Priorità Media
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                                    🔵 Suggerimento
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                                {tip.title}
                              </h4>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {tip.description}
                              </p>
                            </div>

                            {/* Actionable Step Box */}
                            <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-indigo-500/20 text-xs text-indigo-200/90 flex items-start gap-2.5">
                              <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-indigo-300 font-semibold block mb-0.5">
                                  Azione Pratica Consigliata:
                                </strong>
                                <span>{tip.actionableStep}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Post recenti estratti (es. TikTok itemList) */}
                {profileResult.recentPosts && profileResult.recentPosts.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ultimi Video Pubblici Rilevati ({profileResult.recentPosts.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {profileResult.recentPosts.map((post, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between gap-2.5 text-xs"
                        >
                          <p className="text-slate-200 line-clamp-2">
                            {post.caption || 'Nessuna descrizione specificata'}
                          </p>

                          <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] pt-1 border-t border-slate-800/60">
                            <div className="flex items-center gap-3">
                              {post.likes !== undefined && <span>❤️ {formatNumber(post.likes)}</span>}
                              {post.views !== undefined && <span>👁️ {formatNumber(post.views)}</span>}
                              {post.comments !== undefined && <span>💬 {formatNumber(post.comments)}</span>}
                            </div>
                            {post.url && (
                              <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                              >
                                <span>Guarda</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avvisi, note di login wall o particolarità */}
                {profileResult.warnings && profileResult.warnings.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Note e Avvisi sulla lettura pubblica ({profileResult.warnings.length})</span>
                    </h3>
                    <div className="space-y-1.5">
                      {profileResult.warnings.map((warn, wIdx) => (
                        <div
                          key={wIdx}
                          className="text-xs p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-amber-200/90 flex items-start gap-2"
                        >
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campi mancanti (senza inventare nulla) */}
                {profileResult.missingFields && profileResult.missingFields.length > 0 && (
                  <div className="pt-2 text-xs text-slate-400 space-y-1.5">
                    <span className="font-medium text-slate-300">
                      Campi non disponibili pubblicamente ({profileResult.missingFields.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {profileResult.missingFields.map((field, fIdx) => (
                        <span
                          key={fIdx}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      * Come da vincoli di progetto, nessun dato viene inventato o interpolato se la piattaforma ne limita la visibilità pubblica o richiede un login wall.
                    </p>
                  </div>
                )}
              </div>

              {/* Vista JSON grezzo per ispezione tecnica */}
              {showRawJson && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800 text-slate-400">
                    <span className="font-mono text-indigo-400">Formato ProfileData (server/types.ts)</span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition text-xs"
                    >
                      {jsonCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiato</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copia JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-300 p-2 overflow-x-auto max-h-96 leading-relaxed bg-black/40 rounded-xl">
                    {JSON.stringify(profileResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SEZIONE 2: Test Integrazione OpenRouter Esistente (NON modificata) */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Collaudo Connessione OpenRouter
                </h2>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Invia una richiesta dal frontend al backend Express (<code className="text-indigo-400">POST /api/test-ai</code>) per testare OpenRouter.
              </p>
            </div>

            {/* Dettagli Modello Configurato */}
            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 self-start sm:self-auto text-xs text-slate-300">
              <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] block">Modello attivo:</span>
                <span className="font-mono text-purple-300 font-medium">
                  {health?.openrouter.model || 'meta-llama/llama-3.3-70b-instruct'}
                </span>
              </div>
            </div>
          </div>

          {/* Prompt suggeriti */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">
              Esempi di prompt rapidi:
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    handleTestAi(p);
                  }}
                  disabled={isAiLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 hover:text-white text-slate-300 border border-slate-700/60 transition text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Area Input Prompt Personalizzabile */}
          <div className="space-y-2">
            <label
              htmlFor="ai-prompt"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Prompt inviato al modello
            </label>
            <textarea
              id="ai-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Inserisci un prompt di test da inviare a OpenRouter..."
              className="w-full p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-sans transition resize-none"
            />
          </div>

          {/* Pulsante Esegui Test */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-500" />
              <span>Chiamata instradata via <strong>Express</strong> con timeout e retry automatico</span>
            </div>

            <button
              type="button"
              onClick={() => handleTestAi()}
              disabled={isAiLoading || !prompt.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Interrogazione OpenRouter in corso...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Esegui Test AI</span>
                </>
              )}
            </button>
          </div>

          {/* Risultato o Errore del Test AI */}
          {aiResult && (
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiResult.success ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Risposta Ricevuta con Successo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Errore nella Risposta
                    </span>
                  )}
                </div>

                {/* Metriche di esecuzione */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {aiResult.durationMs !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {aiResult.durationMs} ms
                    </span>
                  )}
                  {aiResult.usage?.total_tokens !== undefined && (
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                      {aiResult.usage.total_tokens} token totali
                    </span>
                  )}
                </div>
              </div>

              {aiResult.success ? (
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-3 relative group">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-900">
                    <span className="font-mono text-purple-400 text-[11px]">
                      Modello: {aiResult.model}
                    </span>
                    <button
                      onClick={handleCopyAiResponse}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 transition"
                      title="Copia negli appunti"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiato</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copia testo</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {aiResult.response}
                  </div>
                </div>
              ) : (
                <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-5 space-y-2">
                  <p className="text-sm font-semibold text-rose-300">
                    Dettagli dell'errore:
                  </p>
                  <p className="text-xs font-mono text-rose-200/90 bg-black/40 p-3 rounded-xl whitespace-pre-wrap">
                    {aiResult.error}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Suggerimento: Controlla che la chiave in <code className="text-slate-300 font-mono">.env</code> sia valida e che il modello specificato sia disponibile sul tuo account OpenRouter.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SEZIONE 3: Stato del Sistema & Diagnostica */}
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Stato dell'Infrastruttura
                </span>
                <span className="text-[11px] text-slate-400">
                  Backend Express montato con middleware Vite
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">API Health:</span>
                <span
                  className={
                    health?.status === 'ok' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                  }
                >
                  {health?.status || 'In attesa'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">OpenRouter Key:</span>
                <span
                  className={
                    health?.openrouter.configured
                      ? 'text-emerald-400 font-semibold'
                      : 'text-amber-400'
                  }
                >
                  {health?.openrouter.configured ? 'Configurata' : 'Assente'}
                </span>
              </div>
              <button
                onClick={checkHealth}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                title="Ricarica stato health"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHealthLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Social Profile Analyzer — Lettura automatica profili (Instagram, TikTok, Facebook)</span>
          <span className="text-slate-600">Frontend chiama esclusivamente /api/*</span>
        </div>
      </footer>
    </div>
  );
}
