import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PoliticalRecord, SiteSettings } from '../../shared/types';

interface PublicDataContextValue {
  records: PoliticalRecord[];
  settings: SiteSettings | null;
  loading: boolean;
  error: string | null;
  refreshPublicData: () => Promise<void>;
}

const PublicDataContext = createContext<PublicDataContextValue | null>(null);

export function PublicDataProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<PoliticalRecord[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPublicData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/public/content');
      if (!res.ok) {
        throw new Error('No fue posible cargar la información pública.');
      }
      const data = (await res.json()) as { records: PoliticalRecord[]; settings: SiteSettings };
      setRecords(data.records || []);
      setSettings(data.settings || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando información.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPublicData();
  }, [refreshPublicData]);

  return (
    <PublicDataContext.Provider value={{ records, settings, loading, error, refreshPublicData }}>
      {children}
    </PublicDataContext.Provider>
  );
}

export function usePublicData(): PublicDataContextValue {
  const ctx = useContext(PublicDataContext);
  if (!ctx) throw new Error('usePublicData debe usarse dentro de PublicDataProvider.');
  return ctx;
}
