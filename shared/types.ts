export type RecordVisibility = 'publica' | 'privada';

export type RecordSection =
  | 'secretario_jac'
  | 'presidente_jac'
  | 'actividad_jac'
  | 'aspiracion_edil'
  | 'proyeccion_edil'
  | 'proyecto_jac'
  | 'proyecto_nexus'
  | 'proyecto_edil';

export interface PoliticalRecord {
  id: string;
  section: RecordSection;
  title: string;
  chronology_start: string;
  chronology_end: string;
  detail: string;
  status: string;
  visibility: RecordVisibility;
  sort_order: number;
}

export interface SocialLinkItem {
  id: string;
  network: 'Facebook' | 'Instagram' | 'X' | 'TikTok' | 'Threads' | 'YouTube' | 'WhatsApp' | string;
  label: string;
  url: string;
  enabled: boolean;
}

export interface SiteSettings {
  socialLinks: SocialLinkItem[];
  projects: {
    jacSummary: string;
    nexusSummary: string;
    edilSummary: string;
  };
  personalNote: string;
  authorizedPhotoUrl: string;
  authorizedPhotoCaption: string;
}

export interface AuditReport {
  id: string;
  createdAt: string;
  model: string;
  includedFiles: string[];
  excludedPatterns: string[];
  markdownReport: string;
  status: 'completado' | 'error';
  errorMessage?: string;
}

export interface AutomationTask {
  id: string;
  name: string;
  type: 'auditoria_sitio' | 'sincronizacion_sheets';
  cronLabel: string;
  intervalMinutes: number;
  timezone: string;
  status: 'activa' | 'pausada';
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: string | null;
  lastError: string | null;
}

export interface SheetsStatusInfo {
  configured: boolean;
  source: 'google-sheets' | 'local-store';
  spreadsheetIdMasked: string | null;
  sheetName: string;
  lastSyncAt: string | null;
  cacheBehavior: string;
  lastError: string | null;
  headers: string[];
}

export interface AuthSessionState {
  authenticated: boolean;
  username: string | null;
  needsInitialSetup: boolean;
  envConfigured: boolean;
}
