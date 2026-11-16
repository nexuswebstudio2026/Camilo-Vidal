import { ArrowRight, BookOpen, Compass, FolderKanban, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SocialLinksBar } from '../../components/SocialLinksBar';
import { usePublicData } from '../../context/PublicDataContext';

export function HomePage() {
  const { settings, records, loading } = usePublicData();
  const hasAuthorizedPhoto = Boolean(settings?.authorizedPhotoUrl?.trim());
  const publicCount = records.length;

  return (
    <div>
      {/* Hero editorial */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-xs font-medium tracking-widest uppercase text-[var(--accent-gold)]">
              Girardot, 1994 · Comuna 8 de Pasto · Servicio comunitario
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.6rem] font-semibold leading-[1.08] tracking-tight text-[var(--text-ink)]">
              Andrés Camilo Vidal Canchón
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl leading-relaxed">
              Estudiante de cuarto semestre de Administración Pública en la ESAP, exsecretario y expresidente de Junta de Acción Comunal, y ciudadano comprometido con la participación local. Proyecta su aspiración futura a edil de la Comuna 8 de Pasto rumbo a octubre de 2027.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/vida-politica"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md bg-[var(--brand-green)] text-white dark:text-[#0b140f] hover:bg-[var(--brand-green-hover)] transition-colors whitespace-nowrap"
              >
                <span>Conocer trayectoria</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/historia"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md border border-[var(--border-hairline)] text-[var(--text-ink)] hover:bg-[var(--bg-surface)] transition-colors whitespace-nowrap"
              >
                <span>Leer biografía</span>
              </Link>
            </div>

            {settings && (
              <div className="pt-4 border-t border-[var(--border-hairline)]">
                <SocialLinksBar links={settings.socialLinks} />
              </div>
            )}
          </div>

          {/* Neutral visual space when no authorized photo exists */}
          <div className="lg:col-span-5 flex">
            {hasAuthorizedPhoto && settings?.authorizedPhotoUrl ? (
              <figure className="w-full rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex flex-col">
                <img
                  src={settings.authorizedPhotoUrl}
                  alt="Fotografía oficial autorizada de Andrés Camilo Vidal Canchón"
                  referrerPolicy="no-referrer"
                  className="w-full h-80 lg:h-full object-cover"
                />
                {settings.authorizedPhotoCaption && (
                  <figcaption className="px-5 py-3 text-xs italic text-[var(--text-muted)] border-t border-[var(--border-hairline)]">
                    {settings.authorizedPhotoCaption}
                  </figcaption>
                )}
              </figure>
            ) : (
              <div
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-8 flex flex-col justify-between min-h-[320px]"
                aria-label="Ficha documental de Andrés Camilo Vidal Canchón"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                  <span className="font-mono-tabular text-xs uppercase tracking-widest text-[var(--text-muted)]">
                    Archivo cívico
                  </span>
                  <span className="font-mono-tabular text-xs text-[var(--accent-gold)]">
                    1994 — 2027
                  </span>
                </div>

                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-full border border-[var(--accent-gold)] bg-[var(--bg-surface)] flex items-center justify-center">
                    <span className="font-editorial text-3xl font-semibold tracking-wider text-[var(--text-ink)]">
                      ACV
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                    {settings?.authorizedPhotoCaption ||
                      'Espacio reservado exclusivamente para fotografía oficial autorizada por Andrés Camilo Vidal Canchón.'}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-hairline)] text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">Formación actual</dt>
                    <dd className="font-semibold text-[var(--text-ink)] mt-0.5">
                      4.º semestre ESAP (en curso)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Hitos publicados</dt>
                    <dd className="font-mono-tabular font-semibold text-[var(--text-ink)] mt-0.5">
                      {loading ? '—' : `${publicCount} registros`}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Brief Biography & Trajectory Invitation */}
      <section className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-[var(--accent-gold)] font-medium">
                Presentación
              </p>
              <h2 className="font-editorial text-3xl font-semibold text-[var(--text-ink)]">
                Trabajo barrial y formación en lo público
              </h2>
            </div>
            <div className="lg:col-span-8 space-y-4 text-[var(--text-muted)] max-w-prose leading-relaxed">
              <p>
                Nacido en Girardot, Cundinamarca, el 17 de abril de 1994, Andrés Camilo Vidal Canchón cursó su primaria en la Escuela Rafael Pombo de Girardot y obtuvo su grado de bachiller en 2012 en el colegio INEM de Pasto.
              </p>
              <p>
                Su interés por la gestión comunitaria se consolidó tras su regreso a Girardot en octubre de 2017, ejerciendo como secretario de Junta de Acción Comunal (2018–2022) y posteriormente como presidente electo desde julio de 2022 hasta su renuncia anticipada en marzo de 2026 por amenazas personales. Hoy proyecta su trabajo ciudadano hacia una eventual aspiración a edil de la Comuna 8 de Pasto en octubre de 2027.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            <Link
              to="/vida-personal"
              className="group p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <Compass className="w-5 h-5 text-[var(--brand-green)]" aria-hidden="true" />
                <h3 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
                  Vida personal
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Orígenes, estudios confirmados, áreas de conocimiento y vocación comunitaria.
                </p>
              </div>
              <span className="text-xs font-semibold text-[var(--brand-green)] group-hover:underline">
                Explorar sección →
              </span>
            </Link>

            <Link
              to="/vida-politica"
              className="group p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <Landmark className="w-5 h-5 text-[var(--brand-green)]" aria-hidden="true" />
                <h3 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
                  Vida política
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Etapas en la Junta de Acción Comunal, hitos vecinales y aspiración a la Comuna 8.
                </p>
              </div>
              <span className="text-xs font-semibold text-[var(--brand-green)] group-hover:underline">
                Ver etapas →
              </span>
            </Link>

            <Link
              to="/proyectos"
              className="group p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <FolderKanban className="w-5 h-5 text-[var(--brand-green)]" aria-hidden="true" />
                <h3 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
                  Proyectos
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Junta de Acción Comunal, Nexus Web Studio y proyecto cívico hacia 2027.
                </p>
              </div>
              <span className="text-xs font-semibold text-[var(--brand-green)] group-hover:underline">
                Consultar áreas →
              </span>
            </Link>

            <Link
              to="/historia"
              className="group p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <BookOpen className="w-5 h-5 text-[var(--brand-green)]" aria-hidden="true" />
                <h3 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
                  Biografía
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Recorrido cronológico completo con hechos confirmados y sin especulaciones.
                </p>
              </div>
              <span className="text-xs font-semibold text-[var(--brand-green)] group-hover:underline">
                Leer historia →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
