import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, FileCheck2 } from 'lucide-react';
import { Establecimiento } from '../data/establecimientos';

interface InvoiceLightboxProps {
  establishment: Establecimiento | null;
  onClose: () => void;
}

export const InvoiceLightbox: React.FC<InvoiceLightboxProps> = ({
  establishment,
  onClose,
}) => {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [establishment]);

  useEffect(() => {
    if (!establishment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [establishment, onClose]);

  if (!establishment || !establishment.foto) return null;

  const imgSrc = establishment.foto.startsWith('data:image')
    ? establishment.foto
    : `data:image/jpeg;base64,${establishment.foto}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Factura de referencia de ${establishment.nombre}`}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileCheck2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span>Soporte / Factura de Referencia</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">NIT: {establishment.nit}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
              {establishment.nombre} — {establishment.ciudad}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {zoomed ? (
                <>
                  <ZoomOut className="w-4 h-4" />
                  <span>Ajustar</span>
                </>
              ) : (
                <>
                  <ZoomIn className="w-4 h-4" />
                  <span>Ampliar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista de factura"
              className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-slate-900 flex items-center justify-center">
          <img
            src={imgSrc}
            alt={`Factura de ${establishment.nombre}`}
            referrerPolicy="no-referrer"
            className={`rounded-lg transition-transform duration-200 ${
              zoomed ? 'scale-125 cursor-zoom-out' : 'max-h-[70vh] w-auto object-contain cursor-zoom-in'
            }`}
            onClick={() => setZoomed((z) => !z)}
          />
        </div>

        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            {establishment.estado === 'fe'
              ? 'Recuerde exigir siempre Factura Electrónica a nombre de Naciente S.A.S.'
              : 'Establecimiento autorizado en ruta. Verifique que el soporte contenga NIT visible.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
