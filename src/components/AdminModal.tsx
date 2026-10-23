import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Upload,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  Establecimiento,
  CategoriaParada,
  EstadoFactura,
} from '../data/establecimientos';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishments: Establecimiento[];
  regions: string[];
  onSaveEstablishment: (est: Establecimiento, isEdit: boolean) => void;
  onDeleteEstablishment: (id: string) => void;
  onResetDefaults: () => void;
  sheetsUrl: string;
  onSaveSheetsUrl: (url: string) => void;
  onManualSync: () => Promise<{ ok: boolean; message: string }>;
  pickedCoords: { lat: number; lng: number } | null;
  onRequestMapPick: () => void;
}

const DEFAULT_ADMIN_PASSWORD = 'naciente2026';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function getStoredAdminHash(): string {
  return (
    localStorage.getItem('naciente_admin_pass_hash') ||
    simpleHash(DEFAULT_ADMIN_PASSWORD)
  );
}

const EMPTY_FORM: Omit<Establecimiento, 'id'> = {
  nombre: '',
  ciudad: '',
  region: 'Oriente Antioqueño',
  corredor: '',
  direccion: '',
  nit: '',
  telefono: '',
  categoria: 'restaurante',
  estado: 'fe',
  lat: 6.16,
  lng: -75.4247,
  observaciones: '',
  foto: null,
};

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  establishments,
  regions,
  onSaveEstablishment,
  onDeleteEstablishment,
  onResetDefaults,
  sheetsUrl,
  onSaveSheetsUrl,
  onManualSync,
  pickedCoords,
  onRequestMapPick,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'sync'>('form');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Establecimiento, 'id'>>(EMPTY_FORM);
  const [customRegion, setCustomRegion] = useState('');
  const [formFeedback, setFormFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [manageSearch, setManageSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [localSheetsUrl, setLocalSheetsUrl] = useState(sheetsUrl);
  const [syncState, setSyncState] = useState<{
    loading: boolean;
    ok: boolean | null;
    msg: string;
  }>({ loading: false, ok: null, msg: '' });

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    setLocalSheetsUrl(sheetsUrl);
  }, [sheetsUrl]);

  useEffect(() => {
    if (pickedCoords) {
      setForm((prev) => ({
        ...prev,
        lat: pickedCoords.lat,
        lng: pickedCoords.lng,
      }));
      setFormFeedback({
        type: 'ok',
        text: `Coordenadas capturadas del mapa: ${pickedCoords.lat}, ${pickedCoords.lng}`,
      });
    }
  }, [pickedCoords]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (simpleHash(passwordInput.trim()) === getStoredAdminHash()) {
      setIsAuthenticated(true);
      setAuthError('');
      setPasswordInput('');
    } else {
      setAuthError('Contraseña incorrecta. Intenta nuevamente.');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setForm((prev) => ({ ...prev, foto: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPlace = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRegion =
      form.region === '__nueva__' ? customRegion.trim() : form.region.trim();

    if (!form.nombre.trim() || !form.ciudad.trim() || !finalRegion) {
      setFormFeedback({
        type: 'err',
        text: 'Completa el nombre comercial, municipio y región.',
      });
      return;
    }

    if (isNaN(Number(form.lat)) || isNaN(Number(form.lng))) {
      setFormFeedback({
        type: 'err',
        text: 'Ingresa una latitud y longitud válidas.',
      });
      return;
    }

    const payload: Establecimiento = {
      id: editingId || `est_${Date.now()}`,
      nombre: form.nombre.trim(),
      ciudad: form.ciudad.trim(),
      region: finalRegion,
      corredor: form.corredor?.trim() || '',
      direccion: form.direccion.trim() || 'Dirección en vía principal',
      nit: form.nit.trim() || 'Pendiente',
      telefono: form.telefono?.trim() || '',
      categoria: form.categoria,
      estado: form.estado,
      lat: Number(form.lat),
      lng: Number(form.lng),
      observaciones: form.observaciones?.trim() || '',
      foto: form.foto || null,
    };

    onSaveEstablishment(payload, Boolean(editingId));
    setFormFeedback({
      type: 'ok',
      text: editingId
        ? `Se actualizó "${payload.nombre}" correctamente.`
        : `Se agregó "${payload.nombre}" al directorio.`,
    });
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomRegion('');
  };

  const startEdit = (est: Establecimiento) => {
    setEditingId(est.id);
    setForm({
      nombre: est.nombre,
      ciudad: est.ciudad,
      region: est.region,
      corredor: est.corredor || '',
      direccion: est.direccion,
      nit: est.nit,
      telefono: est.telefono || '',
      categoria: est.categoria,
      estado: est.estado,
      lat: est.lat,
      lng: est.lng,
      observaciones: est.observaciones || '',
      foto: est.foto,
    });
    setFormFeedback(null);
    setActiveTab('form');
  };

  const handleSyncTrigger = async () => {
    onSaveSheetsUrl(localSheetsUrl.trim());
    setSyncState({
      loading: true,
      ok: null,
      msg: 'Sincronizando con Google Sheets...',
    });
    const res = await onManualSync();
    setSyncState({ loading: false, ok: res.ok, msg: res.message });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (simpleHash(currentPass) !== getStoredAdminHash()) {
      setPassMsg({ ok: false, text: 'La contraseña actual no coincide.' });
      return;
    }
    if (newPass.trim().length < 4) {
      setPassMsg({
        ok: false,
        text: 'La nueva contraseña debe tener mínimo 4 caracteres.',
      });
      return;
    }
    localStorage.setItem(
      'naciente_admin_pass_hash',
      simpleHash(newPass.trim())
    );
    setCurrentPass('');
    setNewPass('');
    setPassMsg({
      ok: true,
      text: 'Contraseña actualizada correctamente en este dispositivo.',
    });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(establishments, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `directorio_conductores_naciente_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredManageList = establishments.filter((e) => {
    const q = manageSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      e.nombre.toLowerCase().includes(q) ||
      e.ciudad.toLowerCase().includes(q) ||
      e.region.toLowerCase().includes(q) ||
      e.nit.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Administración del Directorio Vial
            </h2>
            <p className="text-xs text-slate-500">
              Naciente S.A.S. · Gestión de paradas autorizadas y facturación
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de administración"
            className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Lock className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                Ingresa la clave de administrador de contabilidad/logística para
                agregar, editar o eliminar establecimientos autorizados.
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-pass-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Contraseña de acceso
              </label>
              <input
                id="admin-pass-input"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Ingresa la contraseña..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
              />
              {authError && (
                <p className="text-xs text-red-600 font-medium mt-1.5">
                  {authError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Desbloquear Panel
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* Segmented Control Tabs */}
            <div className="px-6 pt-4 bg-white border-b border-slate-200">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'form'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {editingId ? 'Editar Parada' : 'Agregar Parada'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'list'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Directorio ({establishments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'sync'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sincronización y Clave
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* TAB 1: ADD / EDIT FORM */}
              {activeTab === 'form' && (
                <form onSubmit={handleSubmitPlace} className="space-y-4">
                  {editingId && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
                      <span className="font-semibold">
                        Modo edición activo: modificando establecimiento
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setForm(EMPTY_FORM);
                        }}
                        className="underline font-semibold cursor-pointer"
                      >
                        Cancelar edición
                      </button>
                    </div>
                  )}

                  {formFeedback && (
                    <div
                      className={`p-3.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                        formFeedback.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      {formFeedback.type === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{formFeedback.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nombre comercial *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.nombre}
                        onChange={(e) =>
                          setForm({ ...form, nombre: e.target.value })
                        }
                        placeholder="Ej: Restaurante La Montaña"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Municipio y Departamento *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.ciudad}
                        onChange={(e) =>
                          setForm({ ...form, ciudad: e.target.value })
                        }
                        placeholder="Ej: Guarne, Antioquia"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Región *
                      </label>
                      <select
                        value={form.region}
                        onChange={(e) =>
                          setForm({ ...form, region: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-sky-600"
                      >
                        {regions
                          .filter((r) => r !== 'TODAS')
                          .map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        <option value="__nueva__">+ Otra región nueva...</option>
                      </select>
                      {form.region === '__nueva__' && (
                        <input
                          type="text"
                          value={customRegion}
                          onChange={(e) => setCustomRegion(e.target.value)}
                          placeholder="Escribe el nombre de la región"
                          className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Corredor Vial (opcional)
                      </label>
                      <input
                        type="text"
                        value={form.corredor || ''}
                        onChange={(e) =>
                          setForm({ ...form, corredor: e.target.value })
                        }
                        placeholder="Ej: Autopista Medellín–Bogotá"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Dirección o referencia kilómetro
                      </label>
                      <input
                        type="text"
                        value={form.direccion}
                        onChange={(e) =>
                          setForm({ ...form, direccion: e.target.value })
                        }
                        placeholder="Ej: Km 25 Vía Barbosa"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NIT / Cédula
                      </label>
                      <input
                        type="text"
                        value={form.nit}
                        onChange={(e) =>
                          setForm({ ...form, nit: e.target.value })
                        }
                        placeholder="Ej: 901.076.394-1"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Categoría
                      </label>
                      <select
                        value={form.categoria}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            categoria: e.target.value as CategoriaParada,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-sky-600"
                      >
                        <option value="combustible">Combustible (EDS)</option>
                        <option value="restaurante">Restaurante</option>
                        <option value="hotel">Hotel / Hospedaje</option>
                        <option value="otro">Parqueadero / Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Requisito de Facturación
                      </label>
                      <select
                        value={form.estado}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            estado: e.target.value as EstadoFactura,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-sky-600"
                      >
                        <option value="fe">Exigir Factura Electrónica</option>
                        <option value="sinfe">Autorizado (Sin F.E.)</option>
                        <option value="pendiente">F.E. por verificar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Teléfono de contacto
                      </label>
                      <input
                        type="text"
                        value={form.telefono || ''}
                        onChange={(e) =>
                          setForm({ ...form, telefono: e.target.value })
                        }
                        placeholder="Ej: 3127771167"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700">
                        Coordenadas Geográficas (WGS84)
                      </span>
                      <button
                        type="button"
                        onClick={onRequestMapPick}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <MapPin className="w-3.5 h-3.5 text-sky-700" />
                        <span>Elegir tocando el mapa</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Latitud
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.lat}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lat: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Longitud
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.lng}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              lng: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Observaciones para el conductor
                      </label>
                      <input
                        type="text"
                        value={form.observaciones || ''}
                        onChange={(e) =>
                          setForm({ ...form, observaciones: e.target.value })
                        }
                        placeholder="Ej: Parqueadero amplio y hospedaje"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Foto de factura de ejemplo (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">
                            {form.foto ? 'Cambiar imagen cargada' : 'Subir imagen'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                        {form.foto && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, foto: null })}
                            className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {editingId
                          ? 'Guardar Cambios'
                          : 'Guardar Establecimiento'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: MANAGE DIRECTORY */}
              {activeTab === 'list' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <input
                      type="search"
                      value={manageSearch}
                      onChange={(e) => setManageSearch(e.target.value)}
                      placeholder="Filtrar por nombre, municipio, NIT o región..."
                      className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar JSON</span>
                      </button>
                      {!confirmReset ? (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar Base</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onResetDefaults();
                              setConfirmReset(false);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Confirmar restauración
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                    {filteredManageList.map((est) => (
                      <div
                        key={est.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">
                            {est.region} · {est.ciudad} ·{' '}
                            <span className="font-mono">NIT {est.nit}</span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {est.nombre}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(est)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          {confirmDeleteId === est.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteEstablishment(est.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                Sí, borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(est.id)}
                              aria-label={`Eliminar ${est.nombre}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: GOOGLE SHEETS SYNC & PASSWORD */}
              {activeTab === 'sync' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Sincronización con Google Sheets (Apps Script)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Conecta la URL de tu Google Apps Script (terminada en{' '}
                      <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                        /exec
                      </code>
                      ) para sincronizar establecimientos entre dispositivos. Si
                      no se configura, todos los cambios se guardan localmente
                      en este navegador.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL del Web App de Google Apps Script
                      </label>
                      <input
                        type="url"
                        value={localSheetsUrl}
                        onChange={(e) => setLocalSheetsUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/XXXX/exec"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-sky-600"
                      />
                    </div>

                    {syncState.msg && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-medium ${
                          syncState.ok === true
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : syncState.ok === false
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {syncState.msg}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={syncState.loading}
                        onClick={handleSyncTrigger}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            syncState.loading ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Guardar URL y Sincronizar</span>
                      </button>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Cambiar contraseña de administración
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Contraseña actual
                        </label>
                        <input
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          placeholder="Contraseña actual"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nueva contraseña
                        </label>
                        <input
                          type="password"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          placeholder="Mínimo 4 caracteres"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    </div>
                    {passMsg && (
                      <p
                        className={`text-xs font-medium ${
                          passMsg.ok ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {passMsg.text}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      Actualizar Contraseña
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
