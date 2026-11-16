import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { AuditorService } from './server/ai/auditor.service';
import { AutomationsService } from './server/ai/automations.service';
import { AuthService } from './server/auth/auth.service';
import { loadServerConfig } from './server/config/env';
import { SheetsRepositoryService } from './server/sheets/sheets.service';
import {
  validatePoliticalRecordInput,
  validateSiteSettingsInput,
} from './server/validation/records';

async function bootstrap() {
  const config = loadServerConfig();
  const authService = new AuthService(config);
  const sheetsService = new SheetsRepositoryService(config);
  const auditorService = new AuditorService(config);
  const automationsService = new AutomationsService(config, sheetsService, auditorService);

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Origin check on mutating API calls
  app.use('/api', authService.requireSameOriginOnWrite);

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'camilo-vidal-web' });
  });

  // Public data endpoints (ONLY visibility === 'publica')
  app.get('/api/public/content', async (_req, res) => {
    try {
      const records = await sheetsService.getPublicRecords();
      const settings = sheetsService.getSettings();
      res.json({ records, settings });
    } catch {
      res.status(500).json({ error: 'No fue posible cargar la información pública.' });
    }
  });

  // Auth endpoints
  app.get('/api/auth/session', (req, res) => {
    res.json(authService.getSessionState(req));
  });

  app.post('/api/auth/setup', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = authService.setupInitialAdmin(username, password);
    if (!result.ok || !result.username) {
      res.status(400).json({ error: result.error || 'No se pudo configurar el acceso inicial.' });
      return;
    }
    const sessionToken = authService.issueSessionCookie(req, res, result.username);
    res.status(201).json({
      authenticated: true,
      username: result.username,
      needsInitialSetup: false,
      envConfigured: false,
      sessionToken,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = authService.verifyCredentials(username, password);
    if (!result.ok || !result.username) {
      res.status(401).json({ error: result.error || 'Credenciales inválidas.' });
      return;
    }
    const sessionToken = authService.issueSessionCookie(req, res, result.username);
    res.json({
      authenticated: true,
      username: result.username,
      needsInitialSetup: false,
      envConfigured: authService.isEnvConfigured(),
      sessionToken,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    authService.clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Protected Admin API routes
  const adminRouter = express.Router();
  adminRouter.use(authService.requireAuth);

  adminRouter.get('/records', async (req, res) => {
    const forceSync = req.query.sync === '1';
    try {
      const records = await sheetsService.getAllRecords(forceSync);
      const sheetsStatus = sheetsService.getSheetsStatus();
      const settings = sheetsService.getSettings();
      res.json({ records, sheetsStatus, settings });
    } catch {
      res.status(500).json({ error: 'No fue posible consultar los registros administrativos.' });
    }
  });

  adminRouter.post('/records', async (req, res) => {
    const validation = validatePoliticalRecordInput(req.body || {});
    if (!validation.ok || !validation.data) {
      res.status(400).json({ error: 'Validación fallida.', fields: validation.errors });
      return;
    }
    try {
      const created = await sheetsService.createRecord(validation.data);
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: 'No se pudo crear el registro.' });
    }
  });

  adminRouter.put('/records/:id', async (req, res) => {
    const validation = validatePoliticalRecordInput(req.body || {});
    if (!validation.ok || !validation.data) {
      res.status(400).json({ error: 'Validación fallida.', fields: validation.errors });
      return;
    }
    try {
      const updated = await sheetsService.updateRecord(req.params.id, validation.data);
      if (!updated.record) {
        res.status(404).json({ error: 'Registro no encontrado.' });
        return;
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'No se pudo actualizar el registro.' });
    }
  });

  adminRouter.delete('/records/:id', async (req, res) => {
    try {
      const result = await sheetsService.deleteRecord(req.params.id);
      if (!result.deleted) {
        res.status(404).json({ error: 'Registro no encontrado.' });
        return;
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar el registro.' });
    }
  });

  adminRouter.put('/settings', (req, res) => {
    const validation = validateSiteSettingsInput(req.body || {});
    if (!validation.ok || !validation.data) {
      res.status(400).json({ error: 'Configuración inválida.', fields: validation.errors });
      return;
    }
    const saved = sheetsService.updateSettings(validation.data);
    res.json({ settings: saved });
  });

  // AI Auditor routes
  adminRouter.get('/ai/manifest', (_req, res) => {
    res.json({
      manifest: auditorService.getManifestPreview(),
      reports: auditorService.listReports(),
    });
  });

  adminRouter.post('/ai/audit', async (_req, res) => {
    const result = await auditorService.runReadOnlyAudit();
    if (!result.ok) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.status(201).json({ report: result.report });
  });

  // Automations routes
  adminRouter.get('/automations', (_req, res) => {
    res.json({
      tasks: automationsService.listTasks(),
      runtimeNotice:
        'Las tareas programadas se ejecutan únicamente mientras el servidor de la aplicación permanezca activo en ejecución. No se ejecutan con el equipo apagado salvo despliegue continuo en la nube.',
    });
  });

  adminRouter.post('/automations', (req, res) => {
    const result = automationsService.createTask({
      name: String(req.body?.name || ''),
      type: req.body?.type,
      intervalMinutes: Number(req.body?.intervalMinutes),
      timezone: String(req.body?.timezone || 'America/Bogota'),
    });
    if (!result.ok || !result.task) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ task: result.task });
  });

  adminRouter.post('/automations/:id/toggle', (req, res) => {
    const updated = automationsService.togglePause(req.params.id);
    if (!updated) {
      res.status(404).json({ error: 'Automatización no encontrada.' });
      return;
    }
    res.json({ task: updated });
  });

  adminRouter.post('/automations/:id/run', async (req, res) => {
    const result = await automationsService.executeTask(req.params.id);
    if (!result.task) {
      res.status(404).json({ error: result.error || 'Automatización no encontrada.' });
      return;
    }
    res.status(result.ok ? 200 : 502).json(result);
  });

  adminRouter.delete('/automations/:id', (req, res) => {
    const deleted = automationsService.deleteTask(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Automatización no encontrada.' });
      return;
    }
    res.json({ ok: true });
  });

  app.use('/api/admin', adminRouter);

  // Vite dev middleware or static production serving
  if (!config.isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Compila el frontend con npm run build antes de iniciar en producción.');
      }
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Servidor activo en http://0.0.0.0:${config.port} (${config.nodeEnv})`);
  });
}

bootstrap().catch((err) => {
  console.error('Error iniciando el servidor:', err);
  process.exit(1);
});
