import { useRef, useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface PhotoMarkupModalProps {
  initialSrc: string;
  onSave: (base64: string) => void;
  onClose: () => void;
}

export function PhotoMarkupModal({ initialSrc, onSave, onClose }: PhotoMarkupModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Load image
    const img = new Image();
    img.onload = () => {
      // Set canvas size to match image aspect ratio but fit in container
      canvas.width = img.width;
      canvas.height = img.height;
      
      context.drawImage(img, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#EF4444'; // Red for markup
      context.lineWidth = Math.max(5, Math.floor(img.width / 150)); // Scaled stroke width
      setCtx(context);
    };
    img.src = initialSrc;
  }, [initialSrc]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx || !canvasRef.current) return;
    setIsDrawing(true);
    
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;
    e.preventDefault(); // prevent scrolling
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Map screen coordinates to canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL('image/jpeg', 0.8));
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black animate-in fade-in duration-200">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 bg-black/80 text-white border-b border-white/10 shrink-0">
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm uppercase tracking-wider text-white/80">Draw to Highlight</span>
        <button onClick={handleSave} className="px-3 py-1.5 bg-pathway-green text-white rounded-lg hover:brightness-110 flex items-center gap-1.5 transition-all">
          <Check className="w-4 h-4" />
          <span className="font-bold text-sm">Save</span>
        </button>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center relative touch-none bg-black"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="max-w-full max-h-full object-contain cursor-crosshair shadow-2xl"
          style={{ touchAction: 'none' }}
        />
      </div>
      
      {/* Footer Instructions */}
      <div className="h-14 flex items-center justify-center bg-black/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
          <p className="text-white/60 text-[11px] font-medium uppercase tracking-wide">
            Use your finger to draw on the image
          </p>
        </div>
      </div>
    </div>
  );
}
