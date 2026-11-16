import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PoliticalRecord, SheetsStatusInfo, SiteSettings } from '../../shared/types';
import type { ServerConfig } from '../config/env';
import { INITIAL_RECORDS, INITIAL_SETTINGS } from '../data/seed-data';
import {
  filterPublicRecords,
  recordToRowArray,
  rowArrayToRecord,
  SHEET_HEADERS,
  validateSheetHeaders,
} from './sheets-mapper';

interface LocalStoreData {
  records: PoliticalRecord[];
  settings: SiteSettings;
  lastSyncAt: string | null;
}

export class SheetsRepositoryService {
  private readonly storePath: string;
  private cachedStore: LocalStoreData | null = null;
  private lastSheetsSyncAt: number = 0;
  private lastSheetsError: string | null = null;
  private readonly cacheTtlMs = 60_000; // 60s cache to avoid hitting Google Sheets quota on every public read

  constructor(private readonly config: ServerConfig) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.storePath = path.join(config.dataDir, 'store.json');
    this.ensureStoreInitialized();
  }

  private ensureStoreInitialized(): LocalStoreData {
    if (this.cachedStore) return this.cachedStore;
    if (fs.existsSync(this.storePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as LocalStoreData;
        if (Array.isArray(parsed.records) && parsed.settings) {
          this.cachedStore = parsed;
          return parsed;
        }
      } catch {
        // Re-seed if local file was corrupted
      }
    }
    const seeded: LocalStoreData = {
      records: INITIAL_RECORDS,
      settings: INITIAL_SETTINGS,
      lastSyncAt: new Date().toISOString(),
    };
    this.saveLocalStore(seeded);
    return seeded;
  }

  private saveLocalStore(data: LocalStoreData): void {
    this.cachedStore = data;
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf8');
  }

  isSheetsConfigured(): boolean {
    const { spreadsheetId, serviceAccountEmail, privateKey } = this.config.googleSheets;
    return Boolean(spreadsheetId && serviceAccountEmail && privateKey);
  }

  private async getServiceAccountAccessToken(): Promise<string> {
    const { serviceAccountEmail, privateKey } = this.config.googleSheets;
    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Credenciales de cuenta de servicio de Google Sheets no configuradas.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const signingInput = `${header}.${claimSet}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(privateKey, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      throw new Error(`Error autenticando cuenta de servicio (${tokenRes.status}): ${detail.slice(0, 160)}`);
    }
    const json = (await tokenRes.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error('Google OAuth2 no devolvió access_token.');
    }
    return json.access_token;
  }

  private async fetchRecordsFromGoogleSheets(): Promise<PoliticalRecord[]> {
    const { spreadsheetId, sheetName } = this.config.googleSheets;
    if (!spreadsheetId) throw new Error('Falta GOOGLE_SHEETS_SPREADSHEET_ID.');
    const token = await this.getServiceAccountAccessToken();
    const range = encodeURIComponent(`${sheetName}!A1:I1000`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${range}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Google Sheets respondió con código HTTP ${res.status}.`);
    }
    const body = (await res.json()) as { values?: string[][] };
    const rows = body.values || [];
    if (rows.length === 0) {
      throw new Error('La hoja de Google Sheets está vacía; faltan los encabezados requeridos.');
    }
    const headers = rows[0];
    const headerCheck = validateSheetHeaders(headers);
    if (!headerCheck.valid) {
      throw new Error(`Faltan encabezados en Google Sheets: ${headerCheck.missing.join(', ')}`);
    }

    const parsed: PoliticalRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const rec = rowArrayToRecord(rows[i], headers);
      if (rec) parsed.push(rec);
    }
    return parsed.sort((a, b) => a.sort_order - b.sort_order);
  }

  private async writeAllRecordsToGoogleSheets(records: PoliticalRecord[]): Promise<void> {
    const { spreadsheetId, sheetName } = this.config.googleSheets;
    if (!spreadsheetId) return;
    const token = await this.getServiceAccountAccessToken();

    const values: string[][] = [
      [...SHEET_HEADERS],
      ...records.slice().sort((a, b) => a.sort_order - b.sort_order).map(recordToRowArray),
    ];

    const clearRange = encodeURIComponent(`${sheetName}!A1:I1000`);
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${clearRange}:clear`;

    const clearRes = await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!clearRes.ok) {
      throw new Error(`No se pudo limpiar el rango en Google Sheets (HTTP ${clearRes.status}).`);
    }

    const updateRange = encodeURIComponent(`${sheetName}!A1`);
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${updateRange}?valueInputOption=RAW`;

    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
    if (!updateRes.ok) {
      throw new Error(`No se pudo escribir en Google Sheets (HTTP ${updateRes.status}).`);
    }
    this.lastSheetsSyncAt = Date.now();
    this.lastSheetsError = null;
  }

  async syncFromSheetsIfNeeded(force = false): Promise<void> {
    if (!this.isSheetsConfigured()) return;
    const now = Date.now();
    if (!force && now - this.lastSheetsSyncAt < this.cacheTtlMs) return;

    try {
      const remoteRecords = await this.fetchRecordsFromGoogleSheets();
      const store = this.ensureStoreInitialized();
      this.saveLocalStore({
        ...store,
        records: remoteRecords,
        lastSyncAt: new Date().toISOString(),
      });
      this.lastSheetsSyncAt = now;
      this.lastSheetsError = null;
    } catch (err) {
      this.lastSheetsError =
        err instanceof Error ? err.message : 'Error desconocido consultando Google Sheets.';
    }
  }

  async getAllRecords(forceSync = false): Promise<PoliticalRecord[]> {
    await this.syncFromSheetsIfNeeded(forceSync);
    const store = this.ensureStoreInitialized();
    return store.records.slice().sort((a, b) => a.sort_order - b.sort_order);
  }

  async getPublicRecords(): Promise<PoliticalRecord[]> {
    const all = await this.getAllRecords(false);
    return filterPublicRecords(all);
  }

  async createRecord(input: Omit<PoliticalRecord, 'id'>): Promise<{ record: PoliticalRecord; sheetsWarning?: string }> {
    const store = this.ensureStoreInitialized();
    const record: PoliticalRecord = {
      ...input,
      id: `rec-${crypto.randomUUID().slice(0, 8)}`,
    };
    const nextRecords = [...store.records, record].sort((a, b) => a.sort_order - b.sort_order);
    this.saveLocalStore({
      ...store,
      records: nextRecords,
      lastSyncAt: new Date().toISOString(),
    });

    let sheetsWarning: string | undefined;
    if (this.isSheetsConfigured()) {
      try {
        await this.writeAllRecordsToGoogleSheets(nextRecords);
      } catch (err) {
        sheetsWarning =
          err instanceof Error ? err.message : 'No se pudo reflejar el alta en Google Sheets.';
        this.lastSheetsError = sheetsWarning;
      }
    }
    return { record, sheetsWarning };
  }

  async updateRecord(
    id: string,
    input: Omit<PoliticalRecord, 'id'>
  ): Promise<{ record: PoliticalRecord | null; sheetsWarning?: string }> {
    const store = this.ensureStoreInitialized();
    const idx = store.records.findIndex((r) => r.id === id);
    if (idx === -1) return { record: null };

    const updated: PoliticalRecord = { ...input, id };
    const nextRecords = store.records
      .map((r) => (r.id === id ? updated : r))
      .sort((a, b) => a.sort_order - b.sort_order);

    this.saveLocalStore({
      ...store,
      records: nextRecords,
      lastSyncAt: new Date().toISOString(),
    });

    let sheetsWarning: string | undefined;
    if (this.isSheetsConfigured()) {
      try {
        await this.writeAllRecordsToGoogleSheets(nextRecords);
      } catch (err) {
        sheetsWarning =
          err instanceof Error ? err.message : 'No se pudo actualizar la fila en Google Sheets.';
        this.lastSheetsError = sheetsWarning;
      }
    }
    return { record: updated, sheetsWarning };
  }

  async deleteRecord(id: string): Promise<{ deleted: boolean; sheetsWarning?: string }> {
    const store = this.ensureStoreInitialized();
    const exists = store.records.some((r) => r.id === id);
    if (!exists) return { deleted: false };

    const nextRecords = store.records.filter((r) => r.id !== id);
    this.saveLocalStore({
      ...store,
      records: nextRecords,
      lastSyncAt: new Date().toISOString(),
    });

    let sheetsWarning: string | undefined;
    if (this.isSheetsConfigured()) {
      try {
        await this.writeAllRecordsToGoogleSheets(nextRecords);
      } catch (err) {
        sheetsWarning =
          err instanceof Error ? err.message : 'No se pudo eliminar la fila en Google Sheets.';
        this.lastSheetsError = sheetsWarning;
      }
    }
    return { deleted: true, sheetsWarning };
  }

  getSettings(): SiteSettings {
    return this.ensureStoreInitialized().settings;
  }

  updateSettings(next: SiteSettings): SiteSettings {
    const store = this.ensureStoreInitialized();
    this.saveLocalStore({
      ...store,
      settings: next,
      lastSyncAt: new Date().toISOString(),
    });
    return next;
  }

  getSheetsStatus(): SheetsStatusInfo {
    const configured = this.isSheetsConfigured();
    const rawId = this.config.googleSheets.spreadsheetId;
    const masked =
      rawId && rawId.length > 10 ? `${rawId.slice(0, 5)}…${rawId.slice(-4)}` : rawId ? 'Configurado' : null;
    const store = this.ensureStoreInitialized();

    return {
      configured,
      source: configured && !this.lastSheetsError ? 'google-sheets' : 'local-store',
      spreadsheetIdMasked: masked,
      sheetName: this.config.googleSheets.sheetName,
      lastSyncAt: store.lastSyncAt,
      cacheBehavior: configured
        ? 'Caché local en memoria y disco con revalidación cada 60 segundos y escritura inmediata al guardar cambios en el panel (no consulta la hoja en cada visita pública).'
        : 'Sin credenciales de Google Sheets configuradas: opera sobre almacenamiento local persistente (data/store.json) sin exponer filas privadas en rutas públicas.',
      lastError: this.lastSheetsError,
      headers: [...SHEET_HEADERS],
    };
  }
}
