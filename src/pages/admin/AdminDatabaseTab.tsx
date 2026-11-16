import { RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import type { PoliticalRecord, SheetsStatusInfo } from '../../../shared/types';

interface Props {
  records: PoliticalRecord[];
  sheetsStatus: SheetsStatusInfo | null;
  onSyncFromSheets: () => Promise<void>;
}

export function AdminDatabaseTab({ records, sheetsStatus, onSyncFromSheets }: Props) {
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'todas' | 'publica' | 'privada'>('todas');
  const [syncing, setSyncing] = useState(false);

  const filtered = records.filter((r) => {
    if (visibilityFilter !== 'todas' && r.visibility !== visibilityFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q) ||
      r.detail.toLowerCase().includes(q)
    );
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncFromSheets();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[var(--text-ink)]">
            Base de datos y Google Sheets
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Registros estructurados que alimentan las páginas públicas cuando su visibilidad es pública.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-ink)] hover:bg-[var(--bg-surface)] disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{syncing ? 'Sincronizando...' : 'Actualizar lectura'}</span>
        </button>
      </header>

      {/* Sheets connection & cache transparency */}
      {sheetsStatus && (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-5 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-[var(--text-muted)]">Estado de Google Sheets</p>
              <p className="font-semibold text-[var(--text-ink)] mt-0.5">
                {sheetsStatus.configured
                  ? `Configurado (${sheetsStatus.spreadsheetIdMasked} · Hoja "${sheetsStatus.sheetName}")`
                  : 'Pendiente de credenciales de cuenta de servicio'}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Última sincronización local</p>
              <p className="font-mono-tabular text-[var(--text-ink)] mt-0.5">
                {sheetsStatus.lastSyncAt
                  ? new Date(sheetsStatus.lastSyncAt).toLocaleString('es-CO')
                  : 'Sin registro'}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Encabezados requeridos (9 columnas)</p>
              <p className="font-mono-tabular text-[var(--accent-gold)] mt-0.5 break-all">
                {sheetsStatus.headers.join(', ')}
              </p>
            </div>
          </div>

          <p className="text-[var(--text-muted)] border-t border-[var(--border-hairline)] pt-3 leading-relaxed">
            <strong className="text-[var(--text-ink)]">Comportamiento real de caché:</strong>{' '}
            {sheetsStatus.cacheBehavior}
          </p>

          {sheetsStatus.lastError && (
            <p role="alert" className="text-[var(--status-error)] font-medium">
              Última incidencia reportada por Google Sheets: {sheetsStatus.lastError}
            </p>
          )}
        </div>
      )}

      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <label htmlFor="db-search" className="sr-only">
            Buscar en base de datos
          </label>
          <input
            id="db-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por id, título, categoría o detalle..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-ink)]"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar por visibilidad"
          className="flex items-center gap-1 p-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
        >
          {(['todas', 'publica', 'privada'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setVisibilityFilter(opt)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize cursor-pointer ${
                visibilityFilter === opt
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-ink)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-ink)]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Data table */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular text-[var(--text-muted)]">
              <th className="py-3 px-3">id</th>
              <th className="py-3 px-3">section</th>
              <th className="py-3 px-3">category</th>
              <th className="py-3 px-3">title</th>
              <th className="py-3 px-3">period</th>
              <th className="py-3 px-3">status</th>
              <th className="py-3 px-3">visibility</th>
              <th className="py-3 px-3 text-right">sort_order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-[var(--text-muted)]">
                  No se encontraron registros con el filtro aplicado.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--bg-surface)]/60">
                  <td className="py-3 px-3 font-mono-tabular text-[var(--text-muted)] whitespace-nowrap">
                    {row.id}
                  </td>
                  <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">{row.section}</td>
                  <td className="py-3 px-3 whitespace-nowrap">{row.category}</td>
                  <td className="py-3 px-3 font-medium text-[var(--text-ink)] min-w-[200px]">
                    {row.title}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">{row.period}</td>
                  <td className="py-3 px-3 whitespace-nowrap">{row.status}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={
                        row.visibility === 'publica'
                          ? 'text-[var(--status-success)] font-semibold'
                          : 'text-[var(--status-warning)] font-semibold'
                      }
                    >
                      {row.visibility}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono-tabular text-right">{row.sort_order}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
