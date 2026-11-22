export interface HasRecordId {
  id: string;
}

export function compareRecordsById(a: HasRecordId, b: HasRecordId): number {
  return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRecordsById<T extends HasRecordId>(records: readonly T[]): T[] {
  return [...records].sort(compareRecordsById);
}
