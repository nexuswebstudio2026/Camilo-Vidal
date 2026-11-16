import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  isProd: boolean;
  appUrl: string;
  sessionSecret: string;
  sessionSecretFromEnv: boolean;
  adminUsername: string | null;
  adminPasswordHash: string | null;
  adminPasswordPlainEnv: string | null;
  geminiApiKey: string | null;
  googleSheets: {
    spreadsheetId: string | null;
    sheetName: string;
    serviceAccountEmail: string | null;
    privateKey: string | null;
  };
  dataDir: string;
}

function resolveSessionSecret(dataDir: string): { secret: string; fromEnv: boolean } {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return { secret: envSecret, fromEnv: true };
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, '.session-secret');
  if (fs.existsSync(secretFile)) {
    const saved = fs.readFileSync(secretFile, 'utf8').trim();
    if (saved.length >= 32) {
      return { secret: saved, fromEnv: false };
    }
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  return { secret: generated, fromEnv: false };
}

export function loadServerConfig(): ServerConfig {
  const dataDir = path.resolve(process.cwd(), 'data');
  const session = resolveSessionSecret(dataDir);

  let serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() || null;

  const rawJsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJsonEnv && (!serviceAccountEmail || !privateKey)) {
    try {
      const jsonText = rawJsonEnv.startsWith('{')
        ? rawJsonEnv
        : Buffer.from(rawJsonEnv, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonText) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        serviceAccountEmail = parsed.client_email.trim();
        privateKey = parsed.private_key.trim();
      }
    } catch {
      // Ignore malformed env JSON; SheetsRepositoryService will report unconfigured/error cleanly
    }
  }

  return {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProd: process.env.NODE_ENV === 'production',
    appUrl: process.env.APP_URL?.trim() || 'http://localhost:3000',
    sessionSecret: session.secret,
    sessionSecretFromEnv: session.fromEnv,
    adminUsername: process.env.ADMIN_USERNAME?.trim() || null,
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH?.trim() || null,
    adminPasswordPlainEnv: process.env.ADMIN_PASSWORD?.trim() || null,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || 'Registros',
      serviceAccountEmail,
      privateKey: privateKey ? privateKey.replace(/\\n/g, '\n') : null,
    },
    dataDir,
  };
}
