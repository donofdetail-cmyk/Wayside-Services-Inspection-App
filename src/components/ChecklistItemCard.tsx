import React from 'react';
import { useRef, useState } from 'react';
import { Camera, Plus, Trash2, X, Edit3, Upload } from 'lucide-react';
import { InspectionStatus, Room } from '../types';
import { PhotoMarkupModal } from './PhotoMarkupModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ChecklistItemCardProps {
  itemTitle: string;
  isSeasonalTask: boolean;
  status: InspectionStatus;
  notes: string;
  photoUrls?: string[];
  rooms?: Room[];
  seasonalTaskName?: string;
  onUpdate: (field: string, value: any) => void;
  key?: any;
}

export function ChecklistItemCard({
  itemTitle,
  isSeasonalTask,
  status,
  notes,
  photoUrls = [],
  rooms = [],
  seasonalTaskName,
  onUpdate,
  }: ChecklistItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [markupIndex, setMarkupIndex] = useState<number | null>(null);

  // Image compression & watermarking helper
  const resizeImage = (file: File, watermarkText: string): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve('');

          ctx.drawImage(img, 0, 0, width, height);

          // Add watermark
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, height - 34, width, 34);
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(watermarkText, width - 12, height - 12);

          // Compress to JPEG format with 0.7 quality
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Multiple photo upload — in-memory only, compressed via canvas
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let locationStr = '';
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        locationStr = `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      } catch (err) {
        console.warn('Geolocation failed or timed out', err);
      }
    }

    const timestamp = new Date().toLocaleString();
    const watermarkText = locationStr ? `${timestamp} | ${locationStr}` : timestamp;

    const resizers = files.map((file: any) => resizeImage(file, watermarkText));
    Promise.all(resizers).then((newUrls) => {
      onUpdate('photoUrls', [...photoUrls, ...newUrls]);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) =>
    onUpdate('photoUrls', photoUrls.filter((_, i) => i !== idx));

  const handleMarkupSave = (newBase64: string) => {
    if (markupIndex === null) return;
    const newPhotos = [...photoUrls];
    newPhotos[markupIndex] = newBase64;
    onUpdate('photoUrls', newPhotos);
    setMarkupIndex(null);
  };

  // Room helpers
  const addRoom = () =>
    onUpdate('rooms', [...rooms, { name: '', notes: '' }]);

  const updateRoom = (idx: number, field: keyof Room, val: string) => {
    const updated = rooms.map((r, i) =>
      i === idx ? { ...r, [field]: val } : r
    );
    onUpdate('rooms', updated);
  };

  const removeRoom = (idx: number) =>
    onUpdate('rooms', rooms.filter((_, i) => i !== idx));

  const inputBase = `border border-deep-forest/10 rounded-xl px-4 text-sm placeholder:italic shadow-none h-auto`;
  const bg = isSeasonalTask ? 'bg-white/60' : 'bg-linen-white';

  return (
    <div
      className={
        isSeasonalTask
          ? 'bg-[#F2E8CF] rounded-2xl border border-amber-porch/30 p-6 flex flex-col gap-6'
          : 'bg-white rounded-2xl border border-deep-forest/10 p-6 flex flex-col gap-6'
      }
    >
      {/* Title */}
      <h3 className="font-bold text-deep-forest text-base uppercase leading-tight tracking-wide">
        {itemTitle}
      </h3>

      {/* Seasonal task description */}
      {isSeasonalTask && (
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-bold uppercase text-deep-forest/50">
            Describe Seasonal Task
          </Label>
          <Input
            value={seasonalTaskName || ''}
            onChange={(e) => onUpdate('seasonalTaskName', e.target.value)}
            placeholder="e.g. Cleaned gutters"
            className={`${inputBase} py-3 ${bg}`}
          />
        </div>
      )}

      {/* Status buttons */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-bold uppercase text-deep-forest/50">Status</Label>
        <div className="grid grid-cols-3 gap-3">
          {(['Pass', 'Needs Attention', 'Fail'] as InspectionStatus[]).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onUpdate('status', s)}
              className={`py-3 px-3 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                status === s
                  ? s === 'Pass'
                    ? 'bg-pathway-green text-white border-pathway-green'
                    : s === 'Fail'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-amber-porch text-white border-amber-porch'
                  : isSeasonalTask
                  ? 'bg-white/60 text-deep-forest/60 border-white/60 hover:bg-white'
                  : 'bg-linen-white text-deep-forest/60 border-deep-forest/10 hover:bg-deep-forest/5'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* General Notes */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-bold uppercase text-deep-forest/50">
          General Notes
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          placeholder="Add any general observations or findings..."
          className={`${inputBase} py-3 min-h-[72px] resize-none ${bg}`}
        />
      </div>

      {/* Rooms */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold uppercase text-deep-forest/50">
            Rooms
          </Label>
          <button
            type="button"
            onClick={addRoom}
            className="flex items-center gap-1 text-[10px] font-bold uppercase text-pathway-green hover:text-deep-forest transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Room
          </button>
        </div>

        {rooms.length === 0 ? (
          <p className="text-[11px] italic text-deep-forest/40">
            No rooms added. Tap "Add Room" to log findings per room.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rooms.map((room, idx) => (
              <div
                key={idx}
                className={`rounded-xl border border-deep-forest/10 p-4 flex flex-col gap-3 ${bg}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-deep-forest/30 uppercase shrink-0">
                    Room {idx + 1}
                  </span>
                  <Input
                    value={room.name}
                    onChange={(e) => updateRoom(idx, 'name', e.target.value)}
                    placeholder="Room name (e.g. Master Bathroom)"
                    className="border-0 border-b border-deep-forest/10 rounded-none bg-transparent px-1 py-1 text-sm font-semibold text-deep-forest placeholder:italic placeholder:font-normal shadow-none h-auto flex-1 focus-visible:ring-0 focus-visible:border-pathway-green"
                  />
                  <button
                    type="button"
                    onClick={() => removeRoom(idx)}
                    className="text-deep-forest/30 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Textarea
                  value={room.notes}
                  onChange={(e) => updateRoom(idx, 'notes', e.target.value)}
                  placeholder="Notes for this room..."
                  className="border border-deep-forest/10 rounded-lg bg-white/70 px-3 py-2 min-h-[56px] resize-none text-sm placeholder:italic shadow-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Evidence — multiple, in-memory only */}
      <div className="flex flex-col gap-3 pt-4 border-t border-deep-forest/10">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold uppercase text-deep-forest/50">
            Photo Evidence
          </Label>
          {photoUrls.length > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-pathway-green hover:text-deep-forest transition-colors"
            >
              <Camera className="w-3 h-3" />
              Add More
            </button>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          ref={cameraInputRef}
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={handlePhotoUpload}
        />

        {photoUrls.length === 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 border border-dashed border-deep-forest/20 rounded-xl h-20 text-sm font-bold text-deep-forest/50 hover:text-pathway-green hover:border-pathway-green transition-colors ${bg}`}
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 border border-dashed border-deep-forest/20 rounded-xl h-20 text-sm font-bold text-deep-forest/50 hover:text-pathway-green hover:border-pathway-green transition-colors ${bg}`}
            >
              <Upload className="w-5 h-5" />
              Upload
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photoUrls.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-video rounded-xl overflow-hidden border border-deep-forest/10 bg-linen-white group"
              >
                <img
                  src={url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                
                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                      title="Remove Photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setMarkupIndex(idx)}
                    className="bg-black/60 hover:bg-pathway-green text-white rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5 transition-colors self-center w-full mt-auto backdrop-blur-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Draw</span>
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 aspect-video">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className={`flex-1 rounded-xl border border-dashed border-deep-forest/20 flex flex-col items-center justify-center gap-1 text-deep-forest/40 hover:text-pathway-green hover:border-pathway-green transition-colors text-[10px] font-bold uppercase tracking-wider ${bg}`}
              >
                <Camera className="w-4 h-4" />
                Take
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 rounded-xl border border-dashed border-deep-forest/20 flex flex-col items-center justify-center gap-1 text-deep-forest/40 hover:text-pathway-green hover:border-pathway-green transition-colors text-[10px] font-bold uppercase tracking-wider ${bg}`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Markup Modal */}
      {markupIndex !== null && photoUrls[markupIndex] && (
        <PhotoMarkupModal
          initialSrc={photoUrls[markupIndex]}
          onSave={handleMarkupSave}
          onClose={() => setMarkupIndex(null)}
        />
      )}
    </div>
  );
}
