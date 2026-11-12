/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import type { Request, Response, NextFunction } from 'express';

dotenv.config();

export function getIntegrationApiKeys(): string[] {
  const envVal = process.env.EXTERNAL_INTEGRATION_KEYS;
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Verifica la chiave API fornita a tempo costante (constant-time) per prevenire attacchi timing.
 * Utilizza SHA-256 per garantire buffer di dimensione fissa (32 byte) ed evitare errori di lunghezza in timingSafeEqual.
 */
export function verifyIntegrationKey(providedKey: string): boolean {
  if (!providedKey || typeof providedKey !== 'string') return false;
  const allowedKeys = getIntegrationApiKeys();
  if (allowedKeys.length === 0) return false;

  const providedHash = crypto.createHash('sha256').update(providedKey.trim()).digest();
  let isValid = false;

  // Itera su tutte le chiavi senza interruzione anticipata per mantenere tempi uniformi
  for (const allowedKey of allowedKeys) {
    const allowedHash = crypto.createHash('sha256').update(allowedKey).digest();
    const match = crypto.timingSafeEqual(providedHash, allowedHash);
    if (match) {
      isValid = true;
    }
  }

  return isValid;
}

/**
 * Recupera l'elenco delle origini consentite dalla variabile d'ambiente ALLOWED_ORIGINS.
 */
export function getAllowedOrigins(): string[] {
  const envVal = process.env.ALLOWED_ORIGINS;
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);
}

/**
 * Middleware CORS per /api/v1/*
 * Nessun header CORS per i browser, salvo per le origini esplicitamente elencate in ALLOWED_ORIGINS.
 */
export function apiV1CorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawOrigin = req.headers.origin;
  const origin = typeof rawOrigin === 'string' ? rawOrigin.trim().replace(/\/+$/, '') : '';
  const allowedOrigins = getAllowedOrigins();

  const isOriginAllowed = Boolean(
    origin &&
    allowedOrigins.length > 0 &&
    allowedOrigins.some((allowed) => allowed.toLowerCase() === origin.toLowerCase())
  );

  if (isOriginAllowed && rawOrigin) {
    res.setHeader('Access-Control-Allow-Origin', rawOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }

  // Se è una richiesta preflight OPTIONS
  if (req.method === 'OPTIONS') {
    if (isOriginAllowed) {
      res.status(204).end();
      return;
    }
    // Origine non permessa o preflight non autorizzato: 401 senza dettagli
    res.status(401).end();
    return;
  }

  next();
}

/**
 * Middleware di autenticazione per /api/v1/*
 * Richiede l'header `Authorization: Bearer <chiave>`.
 * Esegue confronto a tempo costante.
 * In caso di fallimento o chiave non valida: 401 senza dettagli.
 */
export function apiV1AuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    res.status(401).end();
    return;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    res.status(401).end();
    return;
  }

  const token = match[1].trim();
  if (!verifyIntegrationKey(token)) {
    res.status(401).end();
    return;
  }

  next();
}
