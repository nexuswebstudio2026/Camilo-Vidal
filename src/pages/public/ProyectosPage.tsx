import { Building2, Code2, Landmark } from 'lucide-react';
import { usePublicData } from '../../context/PublicDataContext';

export function ProyectosPage() {
  const { settings, records, loading, error } = usePublicData();

  const jacProjects = records.filter((r) => r.section === 'proyecto_jac');
  const nexusProjects = records.filter((r) => r.section === 'proyecto_nexus');
  const edilProjects = records.filter((r) => r.section === 'proyecto_edil');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
      <header className="space-y-4 border-b border-[var(--border-hairline)] pb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-[var(--accent-gold)]">
          Proyectos y líneas de trabajo
        </p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-semibold text-[var(--text-ink)]">
          Tres ámbitos diferenciados de gestión e iniciativa
        </h1>
        <p className="text-base text-[var(--text-muted)] max-w-prose leading-relaxed">
          Cada línea de trabajo se presenta por separado para distinguir con claridad la gestión comunal realizada, el espacio de desarrollo web Nexus Web Studio y el proyecto cívico hacia la Comuna 8 de Pasto. Todas las descripciones pueden editarse desde el panel administrativo.
        </p>
      </header>

      {loading && (
        <div className="p-8 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]">
          Cargando áreas de proyecto...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-6 rounded-xl border border-[var(--status-error)] bg-[var(--bg-elevated)] text-sm text-[var(--status-error)]"
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {/* Área 1: Junta de Acción Comunal */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[var(--brand-green)] shrink-0" aria-hidden="true" />
              <h2 className="font-editorial text-3xl font-semibold text-[var(--text-ink)]">
                Junta de Acción Comunal
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-prose leading-relaxed">
              {settings?.projects.jacSummary}
            </p>
            {jacProjects.length > 0 && (
              <ul className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
                {jacProjects.map((item) => (
                  <li key={item.id} className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[var(--accent-gold)]">
                      {item.period} · {item.status}
                    </p>
                    <p className="text-base font-semibold text-[var(--text-ink)]">{item.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Área 2: Nexus Web Studio */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Code2 className="w-5 h-5 text-[var(--brand-green)] shrink-0" aria-hidden="true" />
              <h2 className="font-editorial text-3xl font-semibold text-[var(--text-ink)]">
                Nexus Web Studio
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-prose leading-relaxed">
              {settings?.projects.nexusSummary}
            </p>
            {nexusProjects.length > 0 && (
              <ul className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
                {nexusProjects.map((item) => (
                  <li key={item.id} className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[var(--accent-gold)]">
                      {item.period} · {item.status}
                    </p>
                    <p className="text-base font-semibold text-[var(--text-ink)]">{item.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Área 3: Aspiración y campaña política para edil */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Landmark className="w-5 h-5 text-[var(--brand-green)] shrink-0" aria-hidden="true" />
              <h2 className="font-editorial text-3xl font-semibold text-[var(--text-ink)]">
                Aspiración y campaña política para edil
              </h2>
            </div>
            <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-prose leading-relaxed">
              {settings?.projects.edilSummary}
            </p>
            {edilProjects.length > 0 && (
              <ul className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
                {edilProjects.map((item) => (
                  <li key={item.id} className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[var(--accent-gold)]">
                      {item.period} · {item.status}
                    </p>
                    <p className="text-base font-semibold text-[var(--text-ink)]">{item.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
