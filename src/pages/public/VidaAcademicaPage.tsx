import { useEffect, useState } from 'react';
import type { AcademicRecord } from '../../../shared/types';
import { PublicPortrait } from '../../components/PublicPortrait';
import { usePublicData } from '../../context/PublicDataContext';

function chronology(record: AcademicRecord) {
  return [record.chronology_start, record.chronology_end].filter(Boolean).join(' – ') || 'Fecha no especificada';
}

export function VidaAcademicaPage() {
  const { settings } = usePublicData();
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/public/academic-records')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No fue posible cargar la vida académica.');
        if (active) setRecords(data.records || []);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Error de conexión.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
      <header className="border-b border-[var(--border-hairline)] pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_15rem] gap-8 items-center">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-widest uppercase text-[var(--accent-gold)]">Formación · Registro académico</p>
            <h1 className="font-editorial text-4xl sm:text-5xl font-semibold text-[var(--text-ink)]">Vida académica</h1>
            <p className="text-base text-[var(--text-muted)] max-w-prose leading-relaxed">
              Estudios, programas en curso, cursos, diplomados y áreas de conocimiento registrados por Andrés Camilo Vidal Canchón.
            </p>
          </div>
          <PublicPortrait src={settings?.authorizedPhotoUrl} />
        </div>
      </header>

      {loading && <p className="p-6 rounded-xl border border-[var(--border-hairline)] text-sm text-[var(--text-muted)]">Cargando registros desde Google Sheets…</p>}
      {error && <p role="alert" className="p-6 rounded-xl border border-[var(--status-error)] text-sm text-[var(--status-error)]">{error}</p>}
      {!loading && !error && (records.length ? (
        <ol className="space-y-4">
          {records.map((record) => (
            <li key={record.id} className="p-6 sm:p-7 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] space-y-3">
              <div className="flex flex-wrap gap-2 items-center text-xs text-[var(--text-muted)]">
                <span className="text-[var(--accent-gold)] uppercase tracking-wider font-semibold">{record.type}</span>
                <span aria-hidden="true">·</span><span>{chronology(record)}</span>
                <span aria-hidden="true">·</span><span>{record.status}</span>
              </div>
              <h2 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">{record.title}</h2>
              {record.institution && <p className="text-sm font-medium text-[var(--text-ink)]">{record.institution}</p>}
              <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-prose leading-relaxed">{record.detail}</p>
            </li>
          ))}
        </ol>
      ) : <p className="p-6 rounded-xl border border-[var(--border-hairline)] text-sm text-[var(--text-muted)]">Aún no hay registros académicos públicos.</p>)}
    </article>
  );
}
