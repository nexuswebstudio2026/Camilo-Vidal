import { Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import type { PoliticalRecord, RecordVisibility } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_OPTIONS = [
  'Secretaría JAC',
  'Presidencia JAC',
  'Actividad comunitaria JAC',
  'Aspiración a edil',
  'Proyección futura como edil',
  'Proyecto JAC',
  'Proyecto Nexus Web Studio',
  'Proyecto campaña edil',
];

const STATUS_OPTIONS = [
  'Confirmado',
  'En curso',
  'Concluido anticipadamente',
  'Pendiente de confirmación',
  'Aspiración futura',
  'Etapa condicional',
];

interface FormState {
  category: string;
  title: string;
  period: string;
  status: string;
  detail: string;
  visibility: RecordVisibility;
  sort_order: string;
}

const EMPTY_FORM: FormState = {
  category: 'Actividad comunitaria JAC',
  title: '',
  period: '',
  status: 'Confirmado',
  detail: '',
  visibility: 'publica',
  sort_order: '100',
};

interface Props {
  records: PoliticalRecord[];
  onRefreshAll: () => Promise<void>;
}

export function AdminPoliticalCrudTab({ records, onRefreshAll }: Props) {
  const { authFetch } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<PoliticalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const validateClient = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.category.trim()) errs.category = 'Selecciona una categoría.';
    if (form.title.trim().length < 3) errs.title = 'El título debe tener al menos 3 caracteres.';
    if (!form.period.trim()) errs.period = 'Indica la cronología o periodo.';
    if (!form.status.trim()) errs.status = 'Selecciona el estado.';
    if (form.detail.trim().length < 10) {
      errs.detail = 'Los detalles deben tener al menos 10 caracteres.';
    }
    const orderNum = Number(form.sort_order);
    if (!Number.isFinite(orderNum) || orderNum < 0 || orderNum > 9999) {
      errs.sort_order = 'Ingresa un número entre 0 y 9999.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartEdit = (rec: PoliticalRecord) => {
    setEditingId(rec.id);
    setForm({
      category: rec.category,
      title: rec.title,
      period: rec.period,
      status: rec.status,
      detail: rec.detail,
      visibility: rec.visibility,
      sort_order: String(rec.sort_order),
    });
    setFieldErrors({});
    setFeedback(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validateClient()) return;

    setSubmitting(true);
    try {
      const payload = {
        category: form.category,
        title: form.title,
        period: form.period,
        status: form.status,
        detail: form.detail,
        visibility: form.visibility,
        sort_order: Number(form.sort_order),
      };

      const url = editingId ? `/api/admin/records/${editingId}` : '/api/admin/records';
      const method = editingId ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar el registro.' });
        return;
      }

      await onRefreshAll();
      setFeedback({
        type: 'success',
        text: data.sheetsWarning
          ? `Registro guardado localmente, con advertencia de Google Sheets: ${data.sheetsWarning}`
          : editingId
            ? 'Registro actualizado y rutas públicas sincronizadas.'
            : 'Nuevo registro creado y publicado según su visibilidad.',
      });
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFieldErrors({});
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al guardar el registro.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRecord) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const res = await authFetch(`/api/admin/records/${confirmDeleteRecord.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'No se pudo eliminar el registro.' });
      } else {
        await onRefreshAll();
        if (editingId === confirmDeleteRecord.id) {
          handleCancelEdit();
        }
        setFeedback({
          type: 'success',
          text: `Registro "${confirmDeleteRecord.title}" eliminado correctamente.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red intentando eliminar el registro.' });
    } finally {
      setDeleting(false);
      setConfirmDeleteRecord(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[var(--text-ink)]">
          Vida política — Gestión CRUD
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Crea, edita o elimina registros de trayectoria comunitaria y proyectos. Solo los registros con visibilidad pública aparecen en el sitio.
        </p>
      </header>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-sm ${
            feedback.type === 'success'
              ? 'border-[var(--status-success)] text-[var(--status-success)] bg-[var(--bg-elevated)]'
              : 'border-[var(--status-error)] text-[var(--status-error)] bg-[var(--bg-elevated)]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Form without any "Etapa" field */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
          <h2 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
            {editingId ? 'Editar registro existente' : 'Nuevo registro comunitario o político'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="rec-category" className="block text-xs font-semibold text-[var(--text-ink)]">
              Categoría
            </label>
            <select
              id="rec-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {fieldErrors.category && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.category}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="rec-title" className="block text-xs font-semibold text-[var(--text-ink)]">
              Título
            </label>
            <input
              id="rec-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej. Jornada comunitaria de limpieza"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            />
            {fieldErrors.title && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="rec-period" className="block text-xs font-semibold text-[var(--text-ink)]">
              Cronología o periodo
            </label>
            <input
              id="rec-period"
              type="text"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              placeholder="Ej. Abril de 2022 o Pendiente de confirmar"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            />
            {fieldErrors.period && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.period}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="rec-status" className="block text-xs font-semibold text-[var(--text-ink)]">
              Estado
            </label>
            <select
              id="rec-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.status}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="rec-visibility" className="block text-xs font-semibold text-[var(--text-ink)]">
              Visibilidad
            </label>
            <select
              id="rec-visibility"
              value={form.visibility}
              onChange={(e) =>
                setForm({ ...form, visibility: e.target.value as RecordVisibility })
              }
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            >
              <option value="publica">Pública (visible en el sitio)</option>
              <option value="privada">Privada (solo en panel)</option>
            </select>
            {fieldErrors.visibility && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.visibility}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="rec-order" className="block text-xs font-semibold text-[var(--text-ink)]">
              Orden cronológico
            </label>
            <input
              id="rec-order"
              type="number"
              min={0}
              max={9999}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono-tabular rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
            />
            {fieldErrors.sort_order && (
              <p className="text-xs text-[var(--status-error)]">{fieldErrors.sort_order}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="rec-detail" className="block text-xs font-semibold text-[var(--text-ink)]">
            Detalles
          </label>
          <textarea
            id="rec-detail"
            rows={3}
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="Describe el hecho confirmado sin inventar cifras, radicados ni terceros."
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-ink)]"
          />
          {fieldErrors.detail && (
            <p className="text-xs text-[var(--status-error)]">{fieldErrors.detail}</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-[var(--brand-green)] text-white dark:text-[#0b140f] hover:bg-[var(--brand-green-hover)] disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Guardando...'
                : editingId
                  ? 'Actualizar registro'
                  : 'Crear registro'}
            </span>
          </button>
        </div>
      </form>

      {/* Records list */}
      <section className="space-y-4">
        <h2 className="font-editorial text-2xl font-semibold text-[var(--text-ink)]">
          Registros almacenados ({records.length})
        </h2>

        {records.length === 0 ? (
          <div className="p-8 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]">
            No hay registros guardados todavía. Usa el formulario superior para crear el primero.
          </div>
        ) : (
          <ul className="space-y-3">
            {records.map((rec) => (
              <li
                key={rec.id}
                className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex flex-col lg:flex-row lg:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="font-mono-tabular font-semibold text-[var(--accent-gold)]">
                      #{rec.sort_order}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{rec.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{rec.period}</span>
                    <span aria-hidden="true">·</span>
                    <span>{rec.status}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        rec.visibility === 'publica'
                          ? 'text-[var(--status-success)] font-medium'
                          : 'text-[var(--status-warning)] font-medium'
                      }
                    >
                      Visibilidad {rec.visibility}
                    </span>
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-[var(--text-ink)]">
                    {rec.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{rec.detail}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(rec)}
                    aria-label={`Editar "${rec.title}"`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-[var(--border-hairline)] text-[var(--text-ink)] hover:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRecord(rec)}
                    aria-label={`Eliminar "${rec.title}"`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Delete confirmation modal */}
      {confirmDeleteRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmar-eliminacion"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 space-y-4">
            <h3
              id="titulo-confirmar-eliminacion"
              className="font-editorial text-2xl font-semibold text-[var(--text-ink)]"
            >
              Confirmar eliminación
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              ¿Deseas eliminar el registro{' '}
              <strong className="text-[var(--text-ink)]">"{confirmDeleteRecord.title}"</strong>? Esta acción actualizará la base de datos y las rutas públicas.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRecord(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-[var(--border-hairline)] text-[var(--text-ink)] hover:bg-[var(--bg-surface)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--status-error)] text-white hover:opacity-90 cursor-pointer"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
