import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Navigation,
  MapPin,
  Phone,
  FileText,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Compass,
  ShieldCheck,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import {
  Establecimiento,
  INITIAL_ESTABLECIMIENTOS,
  CategoriaParada,
  EstadoFactura,
} from './data/establecimientos';
import { InteractiveMap } from './components/InteractiveMap';
import { InvoiceLightbox } from './components/InvoiceLightbox';
import { AdminModal } from './components/AdminModal';

const STORAGE_KEY = 'naciente_establecimientos_v2';
const SHEETS_URL_KEY = 'naciente_sheets_url';

const CATEGORY_LABELS: Record<CategoriaParada, string> = {
  combustible: 'Combustible (EDS)',
  restaurante: 'Restaurante',
  hotel: 'Hotel y Hospedaje',
  otro: 'Parqueadero / Otro',
};

const ESTADO_LABELS: Record<EstadoFactura, string> = {
  fe: 'Exigir Factura Electrónica',
  sinfe: 'Autorizado sin F.E.',
  pendiente: 'F.E. por verificar',
};

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function App() {
  const [establishments, setEstablishments] = useState<Establecimiento[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial data
    }
    return INITIAL_ESTABLECIMIENTOS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('TODAS');
  const [categoryFilter, setCategoryFilter] = useState<'todas' | CategoriaParada>('todas');
  const [onlyRequireFE, setOnlyRequireFE] = useState(false);
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);

  const [selectedEstId, setSelectedEstId] = useState<string | null>(null);
  const [lightboxEst, setLightboxEst] = useState<Establecimiento | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [showHeadquarters, setShowHeadquarters] = useState(true);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sheetsUrl, setSheetsUrl] = useState<string>(
    () => localStorage.getItem(SHEETS_URL_KEY) || ''
  );

  // Coordinate picking from map for Admin
  const [mapPickMode, setMapPickMode] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(establishments));
    } catch {
      // Ignore quota errors
    }
  }, [establishments]);

  const syncFromSheets = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const url = localStorage.getItem(SHEETS_URL_KEY) || sheetsUrl;
    if (!url) {
      return {
        ok: false,
        message: 'Ingresa primero la URL de tu Google Apps Script (/exec).',
      };
    }

    try {
      const resp = await fetch(url, { method: 'GET' });
      const data = await resp.json();

      if (Array.isArray(data) && data.length > 0) {
        setEstablishments(data);
        return {
          ok: true,
          message: `Sincronización completada (${data.length} establecimientos).`,
        };
      } else if (data && typeof data === 'object') {
        const extracted: Establecimiento[] = [];
        Object.values(data).forEach((routeObj: unknown) => {
          if (
            routeObj &&
            typeof routeObj === 'object' &&
            'paradas' in routeObj &&
            Array.isArray((routeObj as { paradas: Establecimiento[] }).paradas)
          ) {
            (routeObj as { paradas: Establecimiento[] }).paradas.forEach(
              (p, i) => {
                extracted.push({
                  id: p.id || `sheet_${ extracted.length + i + 1}`,
                  nombre: p.nombre || 'Sin nombre',
                  ciudad: p.ciudad || '',
                  direccion: p.direccion || '',
                  nit: p.nit || 'Pendiente',
                  estado: p.estado || 'sinfe',
                  categoria: p.categoria || 'otro',
                  lat: Number(p.lat),
                  lng: Number(p.lng),
                  foto: p.foto || null,
                  telefono: p.telefono || '',
                  observaciones: p.observaciones || '',
                  region: p.region || 'Andina',
                  corredor: p.corredor || '',
                });
              }
            );
          }
        });
        if (extracted.length > 0) {
          setEstablishments(extracted);
          return {
            ok: true,
            message: `Sincronizados ${extracted.length} establecimientos desde Google Sheets.`,
          };
        }
      }
      return {
        ok: true,
        message: 'Conectado a Google Sheets. Sin cambios pendientes.',
      };
    } catch {
      return {
        ok: false,
        message:
          'No fue posible conectar con Google Sheets. Usando datos guardados en este dispositivo.',
      };
    }
  }, [sheetsUrl]);

  useEffect(() => {
    if (sheetsUrl) {
      syncFromSheets();
    }
  }, [sheetsUrl, syncFromSheets]);

  const regions = useMemo(() => {
    const unique = Array.from(
      new Set(establishments.map((e) => e.region).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
    return ['TODAS', ...unique];
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = establishments.filter((item) => {
      if (selectedRegion !== 'TODAS' && item.region !== selectedRegion) {
        return false;
      }
      if (categoryFilter !== 'todas' && item.categoria !== categoryFilter) {
        return false;
      }
      if (onlyRequireFE && item.estado !== 'fe') {
        return false;
      }
      if (onlyWithPhoto && !item.foto) {
        return false;
      }
      if (!q) return true;

      return [
        item.nombre,
        item.ciudad,
        item.direccion,
        item.region,
        item.corredor,
        item.nit,
        item.telefono,
        item.observaciones,
      ].some((val) => String(val || '').toLowerCase().includes(q));
    });

    if (sortByDistance && userLocation) {
      return [...list].sort((a, b) => {
        const distA = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          a.lat,
          a.lng
        );
        const distB = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          b.lat,
          b.lng
        );
        return distA - distB;
      });
    }

    return list;
  }, [
    establishments,
    searchQuery,
    selectedRegion,
    categoryFilter,
    onlyRequireFE,
    onlyWithPhoto,
    sortByDistance,
    userLocation,
  ]);

  const stats = useMemo(() => {
    const total = filteredEstablishments.length;
    const requireFe = filteredEstablishments.filter((i) => i.estado === 'fe').length;
    const sinFe = filteredEstablishments.filter((i) => i.estado === 'sinfe').length;
    const withPhoto = filteredEstablishments.filter((i) => Boolean(i.foto)).length;
    return { total, requireFe, sinFe, withPhoto };
  }, [filteredEstablishments]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRegion('TODAS');
    setCategoryFilter('todas');
    setOnlyRequireFE(false);
    setOnlyWithPhoto(false);
    setSelectedEstId(null);
  };

  const handleLocateDriver = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Tu navegador no soporta geolocalización GPS.');
      return;
    }
    setLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setSortByDistance(true);
        setLocating(false);
        setLocationNotice(
          'Ubicación GPS activa: paradas ordenadas por cercanía a tu posición.'
        );
      },
      () => {
        setLocating(false);
        setLocationNotice(
          'No se pudo obtener tu ubicación. Verifica que el permiso de ubicación esté activo.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleCopyNit = (id: string, nit: string) => {
    if (!nit || nit === 'Pendiente') return;
    navigator.clipboard?.writeText(nit);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const handleSaveEstablishment = async (
    est: Establecimiento,
    isEdit: boolean
  ) => {
    setEstablishments((prev) => {
      if (isEdit) {
        return prev.map((item) => (item.id === est.id ? est : item));
      }
      return [est, ...prev];
    });
    setSelectedEstId(est.id);

    if (sheetsUrl) {
      try {
        await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: isEdit ? 'updatePlace' : 'addPlace',
            place: est,
          }),
        });
      } catch {
        // Saved locally even if sheet is offline
      }
    }
  };

  const handleDeleteEstablishment = async (id: string) => {
    setEstablishments((prev) => prev.filter((item) => item.id !== id));
    if (selectedEstId === id) setSelectedEstId(null);

    if (sheetsUrl) {
      try {
        await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deletePlace', placeId: id }),
        });
      } catch {
        // Deleted locally
      }
    }
  };

  const handleResetDefaults = () => {
    setEstablishments(INITIAL_ESTABLECIMIENTOS);
    localStorage.removeItem(STORAGE_KEY);
    handleResetFilters();
  };

  const handleSaveSheetsUrl = (url: string) => {
    setSheetsUrl(url);
    localStorage.setItem(SHEETS_URL_KEY, url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#"
          className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Naciente S.A.S.
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#directorio"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Directorio Vial
          </a>
          <a
            href="#mapa-vial"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Mapa Interactivo
          </a>
          <a
            href="#recomendaciones"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Protocolo Conductor
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAdminOpen(true)}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Administración
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero & Operational Summary */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Rionegro, Antioquia · Guía Oficial de Rutas y Paradas Autorizadas
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Guía para Conductores
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Consulta estaciones de combustible, restaurantes, hoteles y
                parqueaderos autorizados por contabilidad. Verifica cuándo exigir
                Factura Electrónica antes de realizar el pago.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleLocateDriver}
                disabled={locating}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Compass className={`w-4 h-4 text-sky-700 ${locating ? 'animate-spin' : ''}`} />
                <span>{locating ? 'Ubicando GPS...' : 'Mi ubicación actual'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ver todos ({establishments.length})</span>
              </button>
            </div>
          </div>

          {/* 4-Column Operational KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div>
              <div className="text-xs text-slate-500">Lugares en pantalla</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {stats.total}
              </div>
              <div className="text-[11px] text-slate-500">
                {selectedRegion === 'TODAS' ? 'Todas las regiones' : selectedRegion}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Exigir Factura Electrónica</div>
              <div className="text-2xl font-bold text-red-600 font-mono tabular-nums mt-0.5">
                {stats.requireFe}
              </div>
              <div className="text-[11px] text-slate-500">
                Obligatorio pedir F.E.
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Autorizados sin F.E.</div>
              <div className="text-2xl font-bold text-sky-700 font-mono tabular-nums mt-0.5">
                {stats.sinFe}
              </div>
              <div className="text-[11px] text-slate-500">
                Soporte con NIT legible
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Facturas de ejemplo</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {stats.withPhoto}
              </div>
              <div className="text-[11px] text-slate-500">
                Con soporte fotográfico
              </div>
            </div>
          </div>

          {locationNotice && (
            <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-3 text-xs text-sky-900">
              <span>{locationNotice}</span>
              {userLocation && (
                <button
                  type="button"
                  onClick={() => setSortByDistance((s) => !s)}
                  className="font-semibold underline cursor-pointer whitespace-nowrap"
                >
                  {sortByDistance ? 'Orden original' : 'Ordenar por cercanía'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Search & Filter Toolbar */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar establecimiento, municipio, vía, NIT o teléfono..."
                aria-label="Buscar establecimiento o municipio"
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-700"
              />
            </div>

            {/* Region Selector */}
            <div className="flex items-center gap-2 sm:min-w-[240px]">
              <label
                htmlFor="region-filter"
                className="text-xs font-bold text-slate-700 whitespace-nowrap"
              >
                Región:
              </label>
              <select
                id="region-filter"
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedEstId(null);
                }}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-700 cursor-pointer"
              >
                {regions.map((r) => {
                  const count =
                    r === 'TODAS'
                      ? establishments.length
                      : establishments.filter((e) => e.region === r).length;
                  return (
                    <option key={r} value={r}>
                      {r === 'TODAS' ? `Todas las regiones (${count})` : `${r} (${count})`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Interactive Category & Requirement Segmented Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto"
              role="group"
              aria-label="Filtrar por categoría"
            >
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'combustible', label: 'Combustible' },
                  { id: 'restaurante', label: 'Restaurante' },
                  { id: 'hotel', label: 'Hotel' },
                  { id: 'otro', label: 'Parqueadero / Otro' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat.id);
                    setSelectedEstId(null);
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    categoryFilter === cat.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyRequireFE((v) => !v)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  onlyRequireFE
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Solo Exigir F.E.
              </button>

              <button
                type="button"
                onClick={() => setOnlyWithPhoto((v) => !v)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  onlyWithPhoto
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Con factura de ejemplo
              </button>
            </div>
          </div>
        </section>

        {/* Main Workspace Split: Map + Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Sticky Interactive Map */}
          <section
            id="mapa-vial"
            className="lg:col-span-5 lg:sticky lg:top-20 bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Mapa Vial de Colombia
                </h2>
                <p className="text-xs text-slate-500">
                  Toca cualquier marcador para ver detalles o iniciar ruta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHeadquarters((s) => !s)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  showHeadquarters
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Sede Rionegro</span>
              </button>
            </div>

            <div className="h-[360px] lg:h-[460px]">
              <InteractiveMap
                items={filteredEstablishments}
                selectedId={selectedEstId}
                userLocation={userLocation}
                showHeadquarters={showHeadquarters}
                onSelectEstablishment={(est) => setSelectedEstId(est.id)}
                onOpenInvoice={(est) => setLightboxEst(est)}
                mapPickMode={mapPickMode}
                onMapPickCoordinates={(lat, lng) => {
                  setPickedCoords({ lat, lng });
                  setMapPickMode(false);
                  setIsAdminOpen(true);
                }}
              />
            </div>

            {/* Clean Unboxed Legend */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                  <span>Exigir F.E.</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-700 inline-block" />
                  <span>Autorizado sin F.E.</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" />
                  <span>F.E. por verificar</span>
                </span>
              </div>
              {selectedEstId && (
                <button
                  type="button"
                  onClick={() => setSelectedEstId(null)}
                  className="text-sky-700 font-semibold hover:underline cursor-pointer"
                >
                  Centrar todos
                </button>
              )}
            </div>
          </section>

          {/* Right Column: Establishments Directory List */}
          <section id="directorio" className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Establecimientos Autorizados ({filteredEstablishments.length})
              </h2>
              <span className="text-xs text-slate-500">
                {sortByDistance && userLocation
                  ? 'Ordenados por cercanía GPS'
                  : 'Ordenados por región y corredor'}
              </span>
            </div>

            {filteredEstablishments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                <p className="text-base font-bold text-slate-900">
                  No se encontraron establecimientos con estos filtros
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Prueba cambiando la región seleccionada, limpiando el texto de
                  búsqueda o mostrando todas las categorías.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Mostrar todos los establecimientos
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEstablishments.map((est, idx) => {
                  const isSelected = est.id === selectedEstId;
                  const distanceKm = userLocation
                    ? calculateDistanceKm(
                        userLocation.lat,
                        userLocation.lng,
                        est.lat,
                        est.lng
                      )
                    : null;

                  return (
                    <article
                      key={est.id}
                      onClick={() => setSelectedEstId(est.id)}
                      className={`bg-white rounded-2xl p-5 border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-sky-700 ring-1 ring-sky-700 bg-sky-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Kicker: Zero-Pill Unboxed Metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-700">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-700">
                            {CATEGORY_LABELS[est.categoria]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{est.region}</span>
                          {est.corredor && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{est.corredor}</span>
                            </>
                          )}
                        </div>

                        {/* Semantic Invoice Requirement Status */}
                        <div className="flex items-center gap-1.5 font-semibold">
                          {est.estado === 'fe' ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{ESTADO_LABELS.fe}</span>
                            </span>
                          ) : est.estado === 'pendiente' ? (
                            <span className="text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{ESTADO_LABELS.pendiente}</span>
                            </span>
                          ) : (
                            <span className="text-sky-700 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>{ESTADO_LABELS.sinfe}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & City */}
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-lg font-bold text-slate-900">
                          {est.nombre}
                        </h3>
                        {distanceKm !== null && (
                          <span className="text-xs font-mono font-semibold text-sky-800 shrink-0 tabular-nums">
                            A {distanceKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {est.ciudad} — {est.direccion}
                      </p>

                      {/* NIT, Phone & Observations */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">NIT:</span>
                          <span className="font-mono font-medium text-slate-800">
                            {est.nit || 'Pendiente'}
                          </span>
                          {est.nit && est.nit !== 'Pendiente' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyNit(est.id, est.nit);
                              }}
                              title="Copiar NIT"
                              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              {copiedId === est.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {est.telefono && (
                          <a
                            href={`tel:${est.telefono}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono text-sky-700 hover:underline font-medium"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{est.telefono}</span>
                          </a>
                        )}

                        {est.observaciones && (
                          <span className="text-slate-500">
                            Nota: {est.observaciones}
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons (Minimum 44px touch targets) */}
                      <div
                        className="mt-4 flex flex-wrap items-center gap-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            `${est.lat},${est.lng}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[170px] min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                        >
                          <Navigation className="w-4 h-4 shrink-0" />
                          <span>Cómo llegar en Google Maps</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-75 shrink-0" />
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEstId(est.id);
                            const mapEl = document.getElementById('mapa-vial');
                            if (window.innerWidth < 1024 && mapEl) {
                              mapEl.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <MapPin className="w-4 h-4 text-sky-700 shrink-0" />
                          <span>Ver en mapa</span>
                        </button>

                        {est.foto && (
                          <button
                            type="button"
                            onClick={() => setLightboxEst(est)}
                            className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                            <span>Ver factura ejemplo</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Driver Protocol & Accounting Guidelines */}
        <section
          id="recomendaciones"
          className="bg-white border border-slate-200 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold text-slate-900">
            Recomendaciones y Protocolo Contable para el Conductor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm text-slate-600">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-bold text-slate-900 text-xs mb-1">
                01. Seguridad Vial Primero
              </div>
              <p className="text-xs leading-relaxed">
                Utiliza esta guía únicamente con el vehículo detenido en un
                lugar seguro antes de iniciar la marcha.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-bold text-slate-900 text-xs mb-1">
                02. Factura Electrónica (F.E.)
              </div>
              <p className="text-xs leading-relaxed">
                En todos los puntos marcados con{' '}
                <strong className="text-red-600">
                  Exigir Factura Electrónica
                </strong>
                , solicita siempre la emisión electrónica a nombre de Naciente
                S.A.S.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-bold text-slate-900 text-xs mb-1">
                03. Verificación de Soporte
              </div>
              <p className="text-xs leading-relaxed">
                En establecimientos con soporte físico autorizado, verifica que
                el documento tenga nombre comercial y NIT legibles como en las
                fotos de referencia.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-bold text-slate-900 text-xs mb-1">
                04. Nuevos Proveedores en Ruta
              </div>
              <p className="text-xs leading-relaxed">
                Si necesitas detenerte en un establecimiento no incluido en este
                directorio, comunícate previamente con el área de contabilidad.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Naciente S.A.S. · Km 1 Vía Aeropuerto Las Palmas, Bodega 10-12,
            Rionegro, Antioquia
          </span>
          <span>Hecho por Andrés Felipe Ospina · Guía de Conductores</span>
        </div>
      </footer>

      {/* Invoice Photo Lightbox */}
      <InvoiceLightbox
        establishment={lightboxEst}
        onClose={() => setLightboxEst(null)}
      />

      {/* Unified Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        establishments={establishments}
        regions={regions}
        onSaveEstablishment={handleSaveEstablishment}
        onDeleteEstablishment={handleDeleteEstablishment}
        onResetDefaults={handleResetDefaults}
        sheetsUrl={sheetsUrl}
        onSaveSheetsUrl={handleSaveSheetsUrl}
        onManualSync={syncFromSheets}
        pickedCoords={pickedCoords}
        onRequestMapPick={() => {
          setIsAdminOpen(false);
          setMapPickMode(true);
          const mapEl = document.getElementById('mapa-vial');
          if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </div>
  );
}

export default App;
