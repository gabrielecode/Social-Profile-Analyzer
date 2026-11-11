/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: ChatCompletionUsage;
  finishReason?: string;
  raw?: unknown;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct';

/**
 * Verifica se la chiave API di OpenRouter è presente nell'ambiente.
 */
export function isOpenRouterConfigured(): boolean {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return Boolean(key && key.length > 0 && !key.includes('your-key-here'));
}

/**
 * Restituisce il modello configurato o quello di default.
 */
export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
}

/**
 * Pulisce eventuali messaggi di errore per garantire che le credenziali non vengano mai esposte.
 */
function sanitizeError(errorText: string): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (apiKey && apiKey.length > 5) {
    return errorText.split(apiKey).join('[REDACTED_API_KEY]');
  }
  return errorText;
}

/**
 * Esegue una chat completion tramite l'API di OpenRouter (compatibile OpenAI)
 * con supporto a timeout, retry automatico per errori transitori e sanitizzazione errori.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey || apiKey.length === 0 || apiKey.includes('your-key-here')) {
    throw new Error(
      'OPENROUTER_API_KEY non è configurata o non è valida. Aggiungi la tua chiave API nel file .env.'
    );
  }

  const model = options.model?.trim() || getOpenRouterModel();
  const maxRetries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 30000;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 1000;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': appUrl,
    'X-Title': 'Social Profile Analyzer',
  };

  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (response.ok) {
        const data = await response.json();
        const choice = data.choices?.[0];
        const content = choice?.message?.content ?? '';

        return {
          content,
          model: data.model || model,
          usage: data.usage,
          finishReason: choice?.finish_reason,
          raw: data,
        };
      }

      // Gestione risposta non OK
      let errorDetails = '';
      try {
        const errorJson = await response.json();
        errorDetails =
          errorJson?.error?.message ||
          errorJson?.message ||
          JSON.stringify(errorJson);
      } catch {
        errorDetails = await response.text();
      }

      const isRetryable =
        response.status === 429 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504 ||
        response.status === 500;

      const sanitizedMessage = sanitizeError(
        `OpenRouter HTTP ${response.status}: ${errorDetails || response.statusText}`
      );

      if (isRetryable && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(
          `[OpenRouter] Tentativo ${attempt + 1}/${maxRetries + 1} fallito (${response.status}). Nuovo tentativo tra ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw new Error(sanitizedMessage);
    } catch (err: unknown) {
      clearTimeout(timerId);

      const isAbort =
        (err as Error)?.name === 'AbortError' ||
        controller.signal.aborted;

      const rawMsg = isAbort
        ? `Richiesta a OpenRouter scaduta dopo ${timeoutMs}ms (timeout)`
        : (err as Error)?.message || 'Errore sconosciuto durante la chiamata a OpenRouter';

      const errorMsg = sanitizeError(rawMsg);
      lastError = new Error(errorMsg);

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(
          `[OpenRouter] Errore tentativo ${attempt + 1}/${maxRetries + 1}: ${errorMsg}. Riprovo tra ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw (
    lastError ||
    new Error('Impossibile completare la richiesta a OpenRouter dopo vari tentativi.')
  );
}
