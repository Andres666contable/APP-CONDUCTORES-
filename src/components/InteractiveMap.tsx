import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Establecimiento, SEDE_NACIENTE } from '../data/establecimientos';

interface InteractiveMapProps {
  items: Establecimiento[];
  selectedId: string | null;
  userLocation: { lat: number; lng: number } | null;
  showHeadquarters: boolean;
  onSelectEstablishment: (est: Establecimiento) => void;
  onOpenInvoice: (est: Establecimiento) => void;
  mapPickMode?: boolean;
  onMapPickCoordinates?: (lat: number, lng: number) => void;
}

const COLOMBIA_BOUNDS: L.LatLngBoundsExpression = [
  [-4.5, -82.0],
  [15.8, -66.0],
];
const COLOMBIA_CENTER: L.LatLngExpression = [6.16, -75.4247];

const CATEGORY_SHORT: Record<string, string> = {
  combustible: 'EDS / Combustible',
  restaurante: 'Restaurante',
  hotel: 'Hotel y Hospedaje',
  otro: 'Parqueadero / Otro',
};

function createMarkerIcon(index: number, estado: Establecimiento['estado'], isSelected: boolean) {
  const bg =
    estado === 'fe'
      ? '#dc2626' // Exigir FE (Crimson)
      : estado === 'pendiente'
      ? '#d97706' // Pendiente (Amber)
      : '#0369a1'; // Autorizado sin FE (Sky-700)

  const size = isSelected ? 34 : 28;
  const ring = isSelected ? '0 0 0 4px #0f172a, 0 6px 16px rgba(15,23,42,0.35)' : '0 0 0 2.5px #ffffff, 0 3px 8px rgba(15,23,42,0.28)';

  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:#ffffff;
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:'JetBrains Mono',monospace;
      font-weight:700;
      font-size:${isSelected ? '13px' : '12px'};
      box-shadow:${ring};
      transition:transform 0.15s ease;
    ">${index}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createHeadquartersIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#0f172a;
      color:#ffffff;
      padding:4px 8px;
      border-radius:8px;
      font-family:'Plus Jakarta Sans',sans-serif;
      font-weight:700;
      font-size:11px;
      white-space:nowrap;
      box-shadow:0 0 0 2px #ffffff, 0 4px 12px rgba(15,23,42,0.3);
    ">Sede Naciente</div>`,
    iconSize: [96, 26],
    iconAnchor: [48, 13],
    popupAnchor: [0, -14],
  });
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  items,
  selectedId,
  userLocation,
  showHeadquarters,
  onSelectEstablishment,
  onOpenInvoice,
  mapPickMode = false,
  onMapPickCoordinates,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Record<string, L.Marker>>({});
  const prevItemsCountRef = useRef<number>(-1);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      maxBounds: COLOMBIA_BOUNDS,
      maxBoundsViscosity: 0.9,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: true,
    }).setView(COLOMBIA_CENTER, 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map click handler for picking coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (mapPickMode && onMapPickCoordinates) {
        onMapPickCoordinates(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        );
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mapPickMode, onMapPickCoordinates]);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerMapRef.current = {};
    const boundsPoints: L.LatLngExpression[] = [];

    if (showHeadquarters) {
      const hqMarker = L.marker([SEDE_NACIENTE.lat, SEDE_NACIENTE.lng], {
        icon: createHeadquartersIcon(),
      }).addTo(layer);

      hqMarker.bindPopup(`
        <div style="min-width:200px">
          <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:2px">Punto de Referencia</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px">${SEDE_NACIENTE.nombre}</div>
          <div style="font-size:12px;color:#334155">${SEDE_NACIENTE.direccion}</div>
        </div>
      `);
      boundsPoints.push([SEDE_NACIENTE.lat, SEDE_NACIENTE.lng]);
    }

    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#0284c7',
        fillOpacity: 1,
      }).addTo(layer);
      userMarker.bindPopup('<strong>Tu ubicación actual</strong>');
      boundsPoints.push([userLocation.lat, userLocation.lng]);
    }

    items.forEach((item, idx) => {
      if (isNaN(item.lat) || isNaN(item.lng)) return;
      const isSelected = item.id === selectedId;
      const marker = L.marker([item.lat, item.lng], {
        icon: createMarkerIcon(idx + 1, item.estado, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(layer);

      const estadoLabel =
        item.estado === 'fe'
          ? '<span style="color:#dc2626;font-weight:700">Exigir Factura Electrónica</span>'
          : item.estado === 'pendiente'
          ? '<span style="color:#d97706;font-weight:700">F.E. pendiente de verificar</span>'
          : '<span style="color:#0369a1;font-weight:700">Autorizado (Sin F.E.)</span>';

      const popupEl = document.createElement('div');
      popupEl.style.minWidth = '220px';
      popupEl.innerHTML = `
        <div style="font-size:11px;color:#64748b;margin-bottom:2px">
          ${CATEGORY_SHORT[item.categoria] || 'Otro'} · ${item.ciudad}
        </div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px">
          ${idx + 1}. ${item.nombre}
        </div>
        <div style="font-size:12px;margin-bottom:6px">${estadoLabel}</div>
        <div style="font-size:12px;color:#334155;margin-bottom:4px">${item.direccion}</div>
        <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#475569;margin-bottom:8px">
          NIT: ${item.nit || 'Pendiente'}${item.telefono ? ` · Tel: ${item.telefono}` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.lat + ',' + item.lng)}"
            target="_blank"
            rel="noopener noreferrer"
            style="flex:1;text-align:center;background:#0f172a;color:#ffffff;text-decoration:none;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:600;"
          >
            Ir con Maps
          </a>
          ${
            item.foto
              ? `<button type="button" class="popup-invoice-btn" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Ver factura</button>`
              : ''
          }
        </div>
      `;

      const invoiceBtn = popupEl.querySelector('.popup-invoice-btn');
      if (invoiceBtn) {
        invoiceBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onOpenInvoice(item);
        });
      }

      marker.bindPopup(popupEl);
      marker.on('click', () => {
        onSelectEstablishment(item);
      });

      markerMapRef.current[item.id] = marker;
      boundsPoints.push([item.lat, item.lng]);
    });

    // Only refit bounds when the filtered list count changes and no specific card is being focused
    if (prevItemsCountRef.current !== items.length) {
      prevItemsCountRef.current = items.length;
      if (boundsPoints.length > 0 && !selectedId) {
        map.fitBounds(L.latLngBounds(boundsPoints), {
          padding: [36, 36],
          maxZoom: 13,
        });
      } else if (boundsPoints.length === 0) {
        map.setView(COLOMBIA_CENTER, 6);
      }
    }
  }, [items, selectedId, userLocation, showHeadquarters, onSelectEstablishment, onOpenInvoice]);

  // Fly to selected marker when selectedId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const target = items.find((i) => i.id === selectedId);
    const marker = markerMapRef.current[selectedId];
    if (target && marker) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
      marker.openPopup();
    }
  }, [selectedId, items]);

  // Focus user location when acquired
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.flyTo([userLocation.lat, userLocation.lng], 12, { duration: 0.7 });
  }, [userLocation]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${
          mapPickMode ? 'cursor-crosshair ring-2 ring-sky-600' : ''
        }`}
      />
      {mapPickMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/95 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-lg pointer-events-none">
          Toca cualquier punto del mapa para capturar sus coordenadas
        </div>
      )}
    </div>
  );
};
