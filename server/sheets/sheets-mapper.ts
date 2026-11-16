import type { PoliticalRecord, RecordSection, RecordVisibility } from '../../shared/types';

export const SHEET_HEADERS = [
  'id',
  'section',
  'category',
  'title',
  'period',
  'detail',
  'status',
  'visibility',
  'sort_order',
] as const;

export function validateSheetHeaders(headers: string[]): { valid: boolean; missing: string[] } {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const missing = SHEET_HEADERS.filter((expected) => !normalized.includes(expected));
  return { valid: missing.length === 0, missing: [...missing] };
}

export function rowArrayToRecord(row: string[], headers: string[]): PoliticalRecord | null {
  const indexMap = new Map<string, number>();
  headers.forEach((h, i) => indexMap.set(h.trim().toLowerCase(), i));

  const get = (key: (typeof SHEET_HEADERS)[number]): string => {
    const idx = indexMap.get(key);
    return idx !== undefined ? String(row[idx] ?? '').trim() : '';
  };

  const id = get('id');
  const title = get('title');
  if (!id || !title) return null;

  const rawVis = get('visibility').toLowerCase();
  const visibility: RecordVisibility = rawVis === 'privada' ? 'privada' : 'publica';
  const sortOrderRaw = Number(get('sort_order'));

  return {
    id,
    section: (get('section') || 'actividad_jac') as RecordSection,
    category: get('category') || 'Actividad comunitaria JAC',
    title,
    period: get('period') || 'Pendiente de confirmar',
    detail: get('detail'),
    status: get('status') || 'Confirmado',
    visibility,
    sort_order: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 100,
  };
}

export function recordToRowArray(record: PoliticalRecord): string[] {
  return [
    record.id,
    record.section,
    record.category,
    record.title,
    record.period,
    record.detail,
    record.status,
    record.visibility,
    String(record.sort_order),
  ];
}

export function filterPublicRecords(records: PoliticalRecord[]): PoliticalRecord[] {
  return records
    .filter((r) => r.visibility === 'publica')
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}
