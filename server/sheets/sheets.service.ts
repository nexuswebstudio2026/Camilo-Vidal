import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AcademicRecord, AcademicRecordType, PoliticalRecord, SheetsStatusInfo, SiteSettings } from '../../shared/types';
import type { ServerConfig } from '../config/env';
import { INITIAL_RECORDS, INITIAL_SETTINGS } from '../data/seed-data';
import {
  filterPublicRecords,
  recordToRowArray,
  rowArrayToRecord,
  SHEET_HEADERS,
  validateSheetHeaders,
} from './sheets-mapper';

const ACADEMIC_HEADERS = [
  'id', 'type', 'title', 'institution', 'chronology_start', 'chronology_end',
  'status', 'detail', 'visibility', 'sort_order',
] as const;

const INITIAL_ACADEMIC_ROWS: Omit<AcademicRecord, 'id'>[] = [
  {
    type: 'Primaria', title: 'Estudios de primaria', institution: 'Escuela Rafael Pombo de Girardot',
    chronology_start: '', chronology_end: '', status: 'Finalizado',
    detail: 'Cursó y terminó la primaria en la Escuela Rafael Pombo de Girardot, Cundinamarca.',
    visibility: 'publica', sort_order: 10,
  },
  {
    type: 'Bachillerato', title: 'Bachiller académico', institution: 'Colegio INEM de Pasto',
    chronology_start: '', chronology_end: '2012', status: 'Finalizado',
    detail: 'Se graduó como bachiller en 2012 en el colegio INEM de la ciudad de Pasto.',
    visibility: 'publica', sort_order: 20,
  },
  {
    type: 'Pregrado', title: 'Administración Pública', institution: 'Escuela Superior de Administración Pública (ESAP)',
    chronology_start: '', chronology_end: '', status: 'En curso · cuarto semestre',
    detail: 'Actualmente cursa cuarto semestre de Administración Pública en la ESAP. Este registro describe un programa en curso y no un título terminado.',
    visibility: 'publica', sort_order: 30,
  },
  {
    type: 'Área de conocimiento', title: 'Áreas de conocimiento declaradas', institution: '',
    chronology_start: '', chronology_end: '', status: 'Conocimientos amplios',
    detail: 'Contaduría, administración de empresas, mercadeo, derecho, programación web y administración pública. Esta ficha no afirma títulos ni certificaciones en esas áreas.',
    visibility: 'publica', sort_order: 40,
  },
];

interface LocalStoreData {
  records: PoliticalRecord[];
  settings: SiteSettings;
  lastSyncAt: string | null;
}

function normalizeStoredRecord(value: unknown): PoliticalRecord {
  const raw = (value || {}) as Record<string, unknown>;
  const legacyPeriod = typeof raw.period === 'string' ? raw.period.trim() : '';
  const legacyRange = legacyPeriod.split(/\s+[–—-]\s+/, 2);
  const remaining = { ...raw };
  delete remaining.category;
  delete remaining.period;
  return {
    ...remaining,
    chronology_start: typeof raw.chronology_start === 'string' && raw.chronology_start.trim()
      ? raw.chronology_start
      : legacyRange[0] || 'Pendiente de confirmar',
    chronology_end: typeof raw.chronology_end === 'string'
      ? raw.chronology_end
      : legacyRange[1] || '',
  } as PoliticalRecord;
}

export class SheetsRepositoryService {
  private readonly storePath: string;
  private cachedStore: LocalStoreData | null = null;
  private lastSheetsSyncAt: number = 0;
  private lastSocialSyncAt: number = 0;
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
          const migrated = {
            ...parsed,
            records: parsed.records.map(normalizeStoredRecord),
          };
          this.saveLocalStore(migrated);
          return migrated;
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

  async listSpreadsheetTabs(): Promise<string[]> {
    if (!this.isSheetsConfigured()) {
      throw new Error('Google Sheets no está configurado en este servidor.');
    }
    const { spreadsheetId } = this.config.googleSheets;
    const token = await this.getServiceAccountAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId!)}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error(`No se pudieron consultar las pestañas (HTTP ${response.status}).`);
    const body = (await response.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
    return (body.sheets || []).map((sheet) => sheet.properties?.title || '').filter(Boolean);
  }

  async readSpreadsheetTab(title: string): Promise<{ headers: string[]; rows: string[][] }> {
    if (!this.isSheetsConfigured()) {
      throw new Error('Google Sheets no está configurado en este servidor.');
    }
    const tabs = await this.listSpreadsheetTabs();
    if (!tabs.includes(title)) throw new Error('La pestaña seleccionada ya no existe en Google Sheets.');
    const { spreadsheetId } = this.config.googleSheets;
    const token = await this.getServiceAccountAccessToken();
    const escapedTitle = title.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escapedTitle}'!A:ZZ`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId!)}/values/${range}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error(`No se pudo leer la pestaña seleccionada (HTTP ${response.status}).`);
    const body = (await response.json()) as { values?: unknown[][] };
    const values = (body.values || []).map((row) => row.map((cell) => String(cell ?? '')));
    const headers = values[0] || [];
    const width = Math.max(headers.length, ...values.slice(1).map((row) => row.length), 0);
    while (headers.length < width) headers.push(`Columna ${headers.length + 1}`);
    return { headers, rows: values.slice(1).filter((row) => row.some((cell) => cell !== '')) };
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

  private async ensureSocialLinksSheet(token: string): Promise<void> {
    const { spreadsheetId, socialLinksSheetName } = this.config.googleSheets;
    if (!spreadsheetId) return;
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const metadataRes = await fetch(`${baseUrl}?fields=sheets.properties(sheetId,title)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metadataRes.ok) throw new Error(`No se pudieron consultar las pestañas de Google Sheets (HTTP ${metadataRes.status}).`);
    const metadata = (await metadataRes.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
    if (metadata.sheets?.some((sheet) => sheet.properties?.title === socialLinksSheetName)) return;

    const createRes = await fetch(`${baseUrl}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: socialLinksSheetName, gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    if (!createRes.ok) throw new Error(`No se pudo crear la pestaña ${socialLinksSheetName} (HTTP ${createRes.status}).`);
    const initRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${socialLinksSheetName}'!A1:E1`)}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['id', 'red', 'nombre', 'url', 'activo']] }),
    });
    if (!initRes.ok) throw new Error(`No se pudieron crear los encabezados de ${socialLinksSheetName} (HTTP ${initRes.status}).`);
  }

  private async fetchSocialLinksFromGoogleSheets(): Promise<SiteSettings['socialLinks']> {
    const { spreadsheetId, socialLinksSheetName } = this.config.googleSheets;
    if (!spreadsheetId) throw new Error('Falta GOOGLE_SHEETS_SPREADSHEET_ID.');
    const token = await this.getServiceAccountAccessToken();
    await this.ensureSocialLinksSheet(token);
    const range = encodeURIComponent(`'${socialLinksSheetName}'!A1:E1000`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`No se pudo leer ${socialLinksSheetName} (HTTP ${res.status}).`);
    const body = (await res.json()) as { values?: string[][] };
    const rows = body.values || [];
    const headers = (rows[0] || []).map((value) => String(value).trim().toLowerCase());
    const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const idIdx = find('id');
    const networkIdx = find('red', 'network', 'plataforma');
    const labelIdx = find('nombre', 'label', 'perfil');
    const urlIdx = find('url', 'enlace', 'link');
    const enabledIdx = find('activo', 'enabled', 'visible');
    if ([networkIdx, urlIdx].some((index) => index < 0)) {
      throw new Error(`La hoja ${socialLinksSheetName} requiere encabezados "red" y "url"; opcionalmente "id", "nombre" y "activo".`);
    }
    return rows.slice(1).flatMap((row, index) => {
      const network = String(row[networkIdx] || '').trim();
      const url = String(row[urlIdx] || '').trim();
      if (!network || !url) return [];
      const enabledValue = enabledIdx < 0 ? 'true' : String(row[enabledIdx] || '').trim().toLowerCase();
      return [{
        id: String((idIdx >= 0 ? row[idIdx] : '') || `social-${index + 1}`).trim(),
        network,
        label: String((labelIdx >= 0 ? row[labelIdx] : '') || 'Perfil oficial').trim(),
        url,
        enabled: ['true', '1', 'sí', 'si', 'activo', 'publico', 'público'].includes(enabledValue),
      }];
    });
  }

  private async writeSocialLinksToGoogleSheets(links: SiteSettings['socialLinks']): Promise<void> {
    const { spreadsheetId, socialLinksSheetName } = this.config.googleSheets;
    if (!spreadsheetId) return;
    const token = await this.getServiceAccountAccessToken();
    await this.ensureSocialLinksSheet(token);
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const clearRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${socialLinksSheetName}'!A1:E1000`)}:clear`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (!clearRes.ok) throw new Error(`No se pudo limpiar la hoja ${socialLinksSheetName} (HTTP ${clearRes.status}).`);
    const values = [
      ['id', 'red', 'nombre', 'url', 'activo'],
      ...links.map((item) => [item.id, item.network, item.label, item.url, item.enabled ? 'TRUE' : 'FALSE']),
    ];
    const writeRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${socialLinksSheetName}'!A1`)}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!writeRes.ok) throw new Error(`No se pudieron guardar las redes en Google Sheets (HTTP ${writeRes.status}).`);
  }

  private async writeAllRecordsToGoogleSheets(records: PoliticalRecord[]): Promise<void> {
    const { spreadsheetId, sheetName } = this.config.googleSheets;
    if (!spreadsheetId) return;
    const token = await this.getServiceAccountAccessToken();

    const values: string[][] = [
      [...SHEET_HEADERS],
      ...records.slice().sort((a, b) => a.sort_order - b.sort_order).map(recordToRowArray),
    ];

    const clearRange = encodeURIComponent(`${sheetName}!A1:H1000`);
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
    const greatestNumericId = store.records.reduce((max, item) => {
      const numericId = Number(item.id);
      return Number.isSafeInteger(numericId) && numericId > max ? numericId : max;
    }, store.records.length);
    let nextId = greatestNumericId + 1;
    while (store.records.some((item) => item.id === String(nextId))) nextId += 1;
    const record: PoliticalRecord = {
      ...input,
      id: String(nextId),
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

  async getPublicSettings(forceSync = false): Promise<SiteSettings> {
    if (this.isSheetsConfigured()) {
      const now = Date.now();
      if (forceSync || now - this.lastSocialSyncAt >= this.cacheTtlMs) {
        try {
          const socialLinks = await this.fetchSocialLinksFromGoogleSheets();
          const store = this.ensureStoreInitialized();
          this.saveLocalStore({ ...store, settings: { ...store.settings, socialLinks } });
          this.lastSocialSyncAt = now;
          this.lastSheetsError = null;
        } catch (err) {
          this.lastSheetsError = err instanceof Error ? err.message : 'Error consultando redes sociales en Google Sheets.';
        }
      }
    }
    return this.ensureStoreInitialized().settings;
  }

  async updateProfilePhotoUrlInInformationSheet(photoUrl: string): Promise<string | undefined> {
    if (!this.isSheetsConfigured()) {
      return 'Google Sheets no está configurado en este servidor; la foto quedó guardada localmente.';
    }

    const { spreadsheetId, informationSheetName } = this.config.googleSheets;
    if (!spreadsheetId) return 'Falta configurar el ID de Google Sheets.';

    try {
      const token = await this.getServiceAccountAccessToken();
      const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
      const metadataRes = await fetch(`${baseUrl}?fields=sheets.properties(sheetId,title)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!metadataRes.ok) {
        throw new Error(`No se pudo consultar las pestañas de Google Sheets (HTTP ${metadataRes.status}).`);
      }

      const metadata = (await metadataRes.json()) as {
        sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
      };
      let infoSheet = metadata.sheets?.find(
        (sheet) => sheet.properties?.title === informationSheetName
      )?.properties;

      if (!infoSheet?.sheetId) {
        const createRes = await fetch(`${baseUrl}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: informationSheetName, gridProperties: { frozenRowCount: 1 } } } }],
          }),
        });
        if (!createRes.ok) {
          throw new Error(`No se pudo crear la pestaña ${informationSheetName} (HTTP ${createRes.status}).`);
        }
        const created = (await createRes.json()) as {
          replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }>;
        };
        infoSheet = created.replies?.[0]?.addSheet?.properties;
        if (!infoSheet?.sheetId) throw new Error('Google Sheets no devolvió el identificador de Información.');

        const initializeRes = await fetch(
          `${baseUrl}/values/${encodeURIComponent(`'${informationSheetName}'!A1:B2`)}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [
                ['Logo', 'URL de almacenamiento'],
                ['Foto de perfil', photoUrl],
              ],
            }),
          }
        );
        if (!initializeRes.ok) {
          throw new Error(`No se pudo inicializar la tabla de Información (HTTP ${initializeRes.status}).`);
        }
        return undefined;
      }

      const headerRes = await fetch(
        `${baseUrl}/values/${encodeURIComponent(`'${informationSheetName}'!A1:B2`)}?majorDimension=ROWS`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!headerRes.ok) {
        throw new Error(`No se pudo leer la tabla de Información (HTTP ${headerRes.status}).`);
      }
      const headerBody = (await headerRes.json()) as { values?: string[][] };
      const values = headerBody.values || [];
      if (values[0]?.[0] !== 'Logo' || values[0]?.[1] !== 'URL de almacenamiento') {
        return `La pestaña ${informationSheetName} existe, pero sus encabezados no coinciden con “Logo” y “URL de almacenamiento”; no se modificó.`;
      }

      const updateRes = await fetch(
        `${baseUrl}/values/${encodeURIComponent(`'${informationSheetName}'!B2`)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [[photoUrl]] }),
        }
      );
      if (!updateRes.ok) {
        throw new Error(`No se pudo guardar la URL en Información (HTTP ${updateRes.status}).`);
      }
      return undefined;
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo actualizar la pestaña Información.';
    }
  }

  async updateSettings(next: SiteSettings): Promise<{ settings: SiteSettings; sheetsWarning?: string }> {
    const store = this.ensureStoreInitialized();
    this.saveLocalStore({
      ...store,
      settings: next,
      lastSyncAt: new Date().toISOString(),
    });
    let sheetsWarning: string | undefined;
    if (this.isSheetsConfigured()) {
      try {
        await this.writeSocialLinksToGoogleSheets(next.socialLinks);
        this.lastSocialSyncAt = Date.now();
        this.lastSheetsError = null;
      } catch (err) {
        sheetsWarning = err instanceof Error ? err.message : 'No se pudieron guardar las redes en Google Sheets.';
        this.lastSheetsError = sheetsWarning;
      }
    } else {
      sheetsWarning = 'Google Sheets no está configurado en este servidor; las redes quedaron guardadas localmente.';
    }
    return { settings: next, sheetsWarning };
  }

  private async ensureAcademicSheet(token: string): Promise<void> {
    const { spreadsheetId, academicSheetName } = this.config.googleSheets;
    if (!spreadsheetId) throw new Error('Falta configurar GOOGLE_SHEETS_SPREADSHEET_ID.');
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const metadataRes = await fetch(`${baseUrl}?fields=sheets.properties(sheetId,title)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metadataRes.ok) throw new Error(`No se pudieron consultar las hojas (HTTP ${metadataRes.status}).`);
    const metadata = (await metadataRes.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
    const exists = metadata.sheets?.some((sheet) => sheet.properties?.title === academicSheetName);
    if (!exists) {
      const createRes = await fetch(`${baseUrl}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: academicSheetName, gridProperties: { frozenRowCount: 1 } } } }] }),
      });
      if (!createRes.ok) throw new Error(`No se pudo crear la hoja ${academicSheetName} (HTTP ${createRes.status}).`);
      const seeded: string[][] = [
        [...ACADEMIC_HEADERS],
        ...INITIAL_ACADEMIC_ROWS.map((record, index) => this.academicRecordToRow({ ...record, id: String(index + 1) })),
      ];
      const initRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${academicSheetName}'!A1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: seeded }),
      });
      if (!initRes.ok) throw new Error(`No se pudieron inicializar los registros académicos (HTTP ${initRes.status}).`);
      return;
    }
    const headerRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${academicSheetName}'!A1:J1`)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!headerRes.ok) throw new Error(`No se pudo leer la hoja ${academicSheetName} (HTTP ${headerRes.status}).`);
    const headerBody = (await headerRes.json()) as { values?: string[][] };
    if (!headerBody.values?.[0]?.length) {
      const initRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${academicSheetName}'!A1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[...ACADEMIC_HEADERS]] }),
      });
      if (!initRes.ok) throw new Error(`No se pudieron crear los encabezados de ${academicSheetName}.`);
    }
  }

  private academicRecordToRow(record: AcademicRecord): string[] {
    return [record.id, record.type, record.title, record.institution, record.chronology_start,
      record.chronology_end, record.status, record.detail, record.visibility, String(record.sort_order)];
  }

  private async readAcademicRecords(): Promise<AcademicRecord[]> {
    const { spreadsheetId, academicSheetName } = this.config.googleSheets;
    const token = await this.getServiceAccountAccessToken();
    await this.ensureAcademicSheet(token);
    const range = encodeURIComponent(`'${academicSheetName}'!A1:J1000`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId!)}/values/${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`No se pudieron leer los registros académicos (HTTP ${response.status}).`);
    const body = (await response.json()) as { values?: string[][] };
    const rows = body.values || [];
    const headers = (rows[0] || []).map((value) => value.trim().toLowerCase());
    const index = (name: string) => headers.indexOf(name);
    if (['id', 'type', 'title', 'institution', 'chronology_start', 'chronology_end', 'status', 'detail', 'visibility', 'sort_order'].some((name) => index(name) < 0)) {
      throw new Error(`La hoja ${academicSheetName} requiere las columnas académicas inicializadas por el sitio.`);
    }
    const read = (row: string[], name: string) => String(row[index(name)] ?? '').trim();
    return rows.slice(1).flatMap((row) => {
      const id = read(row, 'id');
      const title = read(row, 'title');
      if (!id || !title) return [];
      const rawType = read(row, 'type') as AcademicRecordType;
      const types: AcademicRecordType[] = ['Primaria', 'Bachillerato', 'Pregrado', 'Posgrado', 'Curso', 'Diplomado', 'Área de conocimiento', 'Otro'];
      const sort = Number(read(row, 'sort_order'));
      return [{
        id, type: types.includes(rawType) ? rawType : 'Otro', title, institution: read(row, 'institution'),
        chronology_start: read(row, 'chronology_start'), chronology_end: read(row, 'chronology_end'),
        status: read(row, 'status') || 'Finalizado', detail: read(row, 'detail'),
        visibility: read(row, 'visibility').toLowerCase() === 'privada' ? 'privada' as const : 'publica' as const,
        sort_order: Number.isFinite(sort) ? sort : 100,
      }];
    }).sort((a, b) => a.sort_order - b.sort_order);
  }

  async getAcademicRecords(publicOnly = false): Promise<AcademicRecord[]> {
    const records = await this.readAcademicRecords();
    return publicOnly ? records.filter((record) => record.visibility === 'publica') : records;
  }

  private async writeAcademicRecords(records: AcademicRecord[]): Promise<void> {
    const { spreadsheetId, academicSheetName } = this.config.googleSheets;
    const token = await this.getServiceAccountAccessToken();
    await this.ensureAcademicSheet(token);
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId!)}`;
    const range = encodeURIComponent(`'${academicSheetName}'!A1:J1000`);
    const clearRes = await fetch(`${baseUrl}/values/${range}:clear`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!clearRes.ok) throw new Error(`No se pudo limpiar la hoja académica (HTTP ${clearRes.status}).`);
    const values = [[...ACADEMIC_HEADERS], ...records.slice().sort((a, b) => a.sort_order - b.sort_order).map((record) => this.academicRecordToRow(record))];
    const writeRes = await fetch(`${baseUrl}/values/${encodeURIComponent(`'${academicSheetName}'!A1`)}?valueInputOption=RAW`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!writeRes.ok) throw new Error(`No se pudieron guardar los registros académicos (HTTP ${writeRes.status}).`);
  }

  async createAcademicRecord(input: Omit<AcademicRecord, 'id'>): Promise<AcademicRecord> {
    const records = await this.readAcademicRecords();
    const nextId = records.reduce((max, item) => Math.max(max, Number(item.id) || 0), records.length) + 1;
    const record = { ...input, id: String(nextId) };
    await this.writeAcademicRecords([...records, record]);
    return record;
  }

  async updateAcademicRecord(id: string, input: Omit<AcademicRecord, 'id'>): Promise<AcademicRecord | null> {
    const records = await this.readAcademicRecords();
    if (!records.some((record) => record.id === id)) return null;
    const updated = { ...input, id };
    await this.writeAcademicRecords(records.map((record) => record.id === id ? updated : record));
    return updated;
  }

  async deleteAcademicRecord(id: string): Promise<boolean> {
    const records = await this.readAcademicRecords();
    if (!records.some((record) => record.id === id)) return false;
    await this.writeAcademicRecords(records.filter((record) => record.id !== id));
    return true;
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
