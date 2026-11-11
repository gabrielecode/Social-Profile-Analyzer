/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json());

  // Registra le rotte backend su /api/*
  app.use('/api', apiRouter);

  if (!isProduction) {
    // In sviluppo: monta Vite come middleware per React HMR e bundling on-the-fly
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In produzione: serve i file statici dalla cartella /dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Social Profile Analyzer] Server in ascolto su http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Social Profile Analyzer] Errore critico durante l\'avvio del server:', err);
  process.exit(1);
});
