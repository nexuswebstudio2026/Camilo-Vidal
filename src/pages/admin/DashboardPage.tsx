import { Bot, Database, Globe, Landmark, LayoutDashboard, LogOut } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { PoliticalRecord, SheetsStatusInfo, SiteSettings } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { usePublicData } from '../../context/PublicDataContext';
import { AdminAiAgentsTab } from './AdminAiAgentsTab';
import { AdminDatabaseTab } from './AdminDatabaseTab';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminPoliticalCrudTab } from './AdminPoliticalCrudTab';
import { AdminPublicSiteTab } from './AdminPublicSiteTab';

type AdminModule = 'inicio' | 'vida_politica' | 'base_datos' | 'agentes_ia' | 'sitio_publico';

export function DashboardPage() {
  const { session, loading: authLoading, logout, authFetch } = useAuth();
  const { refreshPublicData } = usePublicData();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [activeModule, setActiveModule] = useState<AdminModule>('inicio');
  const [records, setRecords] = useState<PoliticalRecord[]>([]);
  const [sheetsStatus, setSheetsStatus] = useState<SheetsStatusInfo | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadAdminData = useCallback(async (forceSync = false) => {
    setDataError(null);
    try {
      const url = forceSync ? '/api/admin/records?sync=1' : '/api/admin/records';
      const res = await authFetch(url);
      if (res.status === 401) {
        navigate('/iniciar-sesion?motivo=sesion', { replace: true });
        return;
      }
      if (!res.ok) {
        throw new Error('No fue posible cargar los datos del panel.');
      }
      const data = await res.json();
      setRecords(data.records || []);
      setSheetsStatus(data.sheetsStatus || null);
      setSettings(data.settings || null);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Error cargando el panel.');
    } finally {
      setLoadingData(false);
    }
  }, [authFetch, navigate]);

  useEffect(() => {
    if (session.authenticated) {
      void loadAdminData(false);
    }
  }, [session.authenticated, loadAdminData]);

  const handleRefreshAll = async () => {
    await Promise.all([loadAdminData(false), refreshPublicData()]);
  };

  const handleSettingsSaved = async (next: SiteSettings) => {
    setSettings(next);
    await refreshPublicData();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-sm text-[var(--text-muted)]">
        Verificando credenciales de acceso...
      </div>
    );
  }

  if (!session.authenticated) {
    return <Navigate to="/iniciar-sesion" replace />;
  }

  const navItems: { id: AdminModule; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'inicio', label: 'Inicio / Panel', icon: LayoutDashboard },
    { id: 'vida_politica', label: 'Vida política', icon: Landmark },
    { id: 'base_datos', label: 'Base de datos', icon: Database },
    { id: 'agentes_ia', label: 'Agentes de IA', icon: Bot },
    { id: 'sitio_publico', label: 'Sitio público', icon: Globe },
  ];

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-ink)]">
      {/* Left Sidebar: toggles exclusively via Camilo's initials avatar (no independent arrow button) */}
      <aside
        aria-label="Navegación del panel privado"
        className={`shrink-0 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col justify-between transition-[width] duration-200 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Avatar button with Camilo's initials — ONLY toggle control for sidebar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-expanded={sidebarOpen}
              aria-label={
                sidebarOpen
                  ? 'Contraer barra lateral del panel'
                  : 'Expandir barra lateral del panel'
              }
              title="Pulsa el avatar para abrir o cerrar la barra lateral"
              className="w-11 h-11 rounded-full bg-[var(--brand-green)] text-white dark:text-[#0b140f] font-editorial text-base font-semibold tracking-wider flex items-center justify-center shrink-0 border border-[var(--accent-gold)] hover:bg-[var(--brand-green-hover)] transition-colors cursor-pointer"
            >
              ACV
            </button>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-ink)] truncate">
                  Camilo Vidal
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">{session.username}</p>
              </div>
            )}
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-ink)] border border-[var(--border-hairline)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]/60 hover:text-[var(--text-ink)]'
                  } ${sidebarOpen ? '' : 'justify-center'}`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[var(--brand-green)]" aria-hidden="true" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer ${
              sidebarOpen ? '' : 'justify-center'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main admin workspace */}
      <div className="flex-1 min-w-0">
        <header className="h-16 px-4 sm:px-6 gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex items-center justify-between">
          <p className="text-xs font-mono-tabular text-[var(--text-muted)] truncate">
            Panel privado / {navItems.find((i) => i.id === activeModule)?.label}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold text-[var(--text-ink)] hover:text-[var(--brand-green)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </header>

        <main className="max-w-6xl mx-auto p-6 sm:p-8">
          {loadingData && (
            <div className="p-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]">
              Cargando información administrativa...
            </div>
          )}

          {dataError && (
            <div
              role="alert"
              className="p-6 rounded-xl border border-[var(--status-error)] bg-[var(--bg-elevated)] text-sm text-[var(--status-error)]"
            >
              {dataError}
            </div>
          )}

          {!loadingData && !dataError && (
            <>
              {activeModule === 'inicio' && settings && (
                <AdminOverviewTab
                  records={records}
                  sheetsStatus={sheetsStatus}
                  settings={settings}
                  onSettingsSaved={handleSettingsSaved}
                />
              )}
              {activeModule === 'vida_politica' && (
                <AdminPoliticalCrudTab records={records} onRefreshAll={handleRefreshAll} />
              )}
              {activeModule === 'base_datos' && (
                <AdminDatabaseTab
                  records={records}
                  sheetsStatus={sheetsStatus}
                  onSyncFromSheets={() => loadAdminData(true)}
                />
              )}
              {activeModule === 'agentes_ia' && <AdminAiAgentsTab />}
              {activeModule === 'sitio_publico' && <AdminPublicSiteTab />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
