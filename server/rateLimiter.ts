/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Crea un middleware di rate limiting in memoria senza dipendenze esterne.
 * Traccia le richieste per IP, risponde con 429 e header Retry-After quando il limite viene superato,
 * e pulisce periodicamente le voci scadute per non far crescere la memoria.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = 'Troppe richieste, riprova tra un minuto' } = options;
  const ipMap = new Map<string, number[]>();

  // Pulisci periodicamente le voci scadute per evitare memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipMap.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        ipMap.delete(ip);
      } else {
        ipMap.set(ip, valid);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const timestamps = (ipMap.get(ip) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    timestamps.push(now);
    ipMap.set(ip, timestamps);
    next();
  };
}
