import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, Check, X, RotateCcw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

// Editor de imagen para recortar y ajustar logos de equipo
// Permite mover, hacer zoom y auto-ajustar la imagen antes de subirla
export default function ImageCropper({ file, onCrop, onCancel }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  // Tamano del area visible de recorte (cuadrado)
  const CROP_SIZE = 280;
  // Tamano de la imagen final exportada
  const OUTPUT_SIZE = 256;

  // Cargar imagen del archivo seleccionado
  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      // Auto-ajustar al cargar
      autoFit(img);
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file]);

  // Auto-ajustar: la imagen entera cabe en el recuadro
  const autoFit = useCallback((img) => {
    const image = img || imgRef.current;
    if (!image) return;
    const scale = Math.min(CROP_SIZE / image.width, CROP_SIZE / image.height);
    setZoom(scale);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Auto-rellenar: la imagen cubre todo el recuadro (sin espacios vacios)
  const autoFill = useCallback(() => {
    const image = imgRef.current;
    if (!image) return;
    const scale = Math.max(CROP_SIZE / image.width, CROP_SIZE / image.height);
    setZoom(scale);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Dibujar preview en canvas
  useEffect(() => {
    if (!imageLoaded || !imgRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const img = imgRef.current;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Fondo gris oscuro (para zonas sin imagen)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Dibujar imagen centrada + offset + zoom
    const w = img.width * zoom;
    const h = img.height * zoom;
    const x = (CROP_SIZE - w) / 2 + offset.x;
    const y = (CROP_SIZE - h) / 2 + offset.y;

    ctx.drawImage(img, x, y, w, h);
  }, [imageLoaded, zoom, offset]);

  // --- Drag con mouse ---
  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // --- Drag con touch (movil) ---
  const lastTouchRef = useRef(null);
  const lastPinchDistRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Un dedo: mover
      const touch = e.touches[0];
      setDragging(true);
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      // Dos dedos: pinch zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDistRef.current = dist;
    }
  };

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      const touch = e.touches[0];
      setOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    } else if (e.touches.length === 2 && lastPinchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / lastPinchDistRef.current;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
      lastPinchDistRef.current = dist;
    }
  }, [dragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    lastPinchDistRef.current = null;
  }, []);

  // Listeners globales para mouse (para que funcione al arrastrar fuera del canvas)
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Zoom con slider
  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };

  // Zoom con botones
  const zoomIn = () => setZoom(prev => Math.min(5, prev + 0.15));
  const zoomOut = () => setZoom(prev => Math.max(0.1, prev - 0.15));

  // Exportar imagen recortada
  const handleCrop = async () => {
    if (!imgRef.current) return;
    setProcessing(true);

    try {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = OUTPUT_SIZE;
      outputCanvas.height = OUTPUT_SIZE;
      const ctx = outputCanvas.getContext('2d');

      const img = imgRef.current;

      // Fondo blanco (por si hay transparencia o zonas vacias)
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Calcular posicion de la imagen en el output
      const scale = OUTPUT_SIZE / CROP_SIZE;
      const w = img.width * zoom * scale;
      const h = img.height * zoom * scale;
      const x = (OUTPUT_SIZE - w) / 2 + offset.x * scale;
      const y = (OUTPUT_SIZE - h) / 2 + offset.y * scale;

      ctx.drawImage(img, x, y, w, h);

      // Convertir a blob
      outputCanvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], 'team-avatar.png', { type: 'image/png' });
          onCrop(croppedFile);
        }
        setProcessing(false);
      }, 'image/png', 0.9);
    } catch {
      setProcessing(false);
    }
  };

  // Calcular rango del slider basado en el tamano de la imagen
  const getZoomRange = () => {
    const img = imgRef.current;
    if (!img) return { min: 0.1, max: 3 };
    // Min: la imagen cabe entera. Max: 5x
    const fitScale = Math.min(CROP_SIZE / img.width, CROP_SIZE / img.height);
    return { min: Math.max(0.05, fitScale * 0.3), max: Math.max(3, fitScale * 5) };
  };

  const zoomRange = getZoomRange();

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
      <div className="bg-slate-800 rounded-xl p-4 border-2 border-orange-500 max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-black text-orange-400">{t.adjustImage}</h3>
          <button
            onClick={onCancel}
            className="p-1 bg-slate-700 rounded-lg hover:bg-slate-600"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          {t.dragToMove}
        </p>

        {/* Area de recorte */}
        <div
          ref={containerRef}
          className="relative mx-auto mb-3 rounded-xl overflow-hidden border-2 border-slate-600"
          style={{ width: CROP_SIZE, height: CROP_SIZE, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            width={CROP_SIZE}
            height={CROP_SIZE}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
          />
          {/* Guia visual: borde del area de recorte */}
          <div className="absolute inset-0 pointer-events-none border-2 border-orange-500/40 rounded-xl" />
          {/* Cruz central sutil */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-6 h-px bg-orange-500/20" />
          </div>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="h-6 w-px bg-orange-500/20" />
          </div>
        </div>

        {/* Controles de zoom */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <button
            onClick={zoomOut}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg"
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={0.01}
            value={zoom}
            onChange={handleZoomChange}
            className="flex-1 accent-orange-500 h-2"
          />
          <button
            onClick={zoomIn}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Botones de ajuste rapido */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => autoFit(null)}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Maximize className="w-4 h-4" /> {t.fit}
          </button>
          <button
            onClick={autoFill}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <ZoomIn className="w-4 h-4" /> {t.fill}
          </button>
          <button
            onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> {t.resetImage}
          </button>
        </div>

        {/* Botones de accion */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-600 hover:bg-slate-500 py-2.5 rounded-lg font-bold"
          >
            {t.cancelBtn}
          </button>
          <button
            onClick={handleCrop}
            disabled={processing || !imageLoaded}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            {processing ? t.processing : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
