import type { Request, Response } from 'express';
import { createApp } from '../server';

type ExpressApp = Awaited<ReturnType<typeof createApp>>;

let appPromise: Promise<ExpressApp> | undefined;

/**
 * Vercel's Vite preset serves the frontend as static files and does not route
 * an Express catch-all automatically. `vercel.json` rewrites every `/api/*`
 * request here; restore the original path before passing it to Express.
 */
export default async function handler(req: Request, res: Response): Promise<void> {
  const rawPath = req.query.__path;
  const routePath = Array.isArray(rawPath) ? rawPath[0] : rawPath;

  if (typeof routePath !== 'string' || !routePath.trim()) {
    res.status(400).json({ error: 'La ruta de API solicitada no es válida.' });
    return;
  }

  const normalizedPath = routePath.replace(/^\/+/, '');
  if (!normalizedPath || normalizedPath.split('/').some((segment) => segment === '.' || segment === '..')) {
    res.status(400).json({ error: 'La ruta de API solicitada no es válida.' });
    return;
  }

  const rewrittenUrl = new URL(req.url || '/api/app', 'http://vercel.local');
  rewrittenUrl.searchParams.delete('__path');
  req.url = `/api/${normalizedPath}${rewrittenUrl.search}`;

  try {
    appPromise ??= createApp({ includeFrontend: false });
    const app = await appPromise;
    app(req, res);
  } catch (error) {
    console.error('Error inicializando la API en Vercel:', error);
    res.status(500).json({ error: 'No fue posible iniciar el servidor de la aplicación.' });
  }
}
