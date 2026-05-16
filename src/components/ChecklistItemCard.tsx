import { useState, useRef } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { InspectionStatus } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ChecklistItemCardProps {
  itemTitle: string;
  isSeasonalTask: boolean;
  status: InspectionStatus;
  notes: string;
  photoUrl?: string;
  seasonalTaskName?: string;
  onUpdate: (field: string, value: any) => void;
}

export function ChecklistItemCard({
  itemTitle,
  isSeasonalTask,
  status,
  notes,
  photoUrl,
  seasonalTaskName,
  onUpdate
}: ChecklistItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate('photoUrl', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const borderColor = status === 'Fail' ? 'border-l-red-600' : status === 'Needs Attention' ? 'border-l-amber' : status === 'Pass' ? 'border-l-pathway' : 'border-l-forest/20';
  
  return (
    <div className={isSeasonalTask 
      ? `bg-[#F2E8CF] rounded-lg shadow-sm border border-amber/30 p-4 mb-0 flex flex-col gap-4`
      : `bg-white rounded-lg shadow-sm border border-transparent p-4 mb-0 flex flex-col gap-4 border-l-4 ${borderColor}`
    }>
      <h3 className="font-bold text-deep-forest text-sm uppercase leading-tight">{itemTitle}</h3>
      
      {isSeasonalTask && (
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-bold uppercase text-deep-forest/50 block">Describe Seasonal Task</Label>
          <Input 
            value={seasonalTaskName || ''} 
            onChange={(e) => onUpdate('seasonalTaskName', e.target.value)}
            placeholder="e.g. Cleaned gutters"
            className="border-0 bg-white/60 text-sm placeholder:italic shadow-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-bold uppercase text-deep-forest/50 block">Status</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['Pass', 'Needs Attention', 'Fail'] as InspectionStatus[]).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onUpdate('status', s)}
              className={`py-2 px-3 rounded border text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm ${
                status === s 
                  ? s === 'Pass' ? 'bg-pathway-green text-white border-pathway'
                  : s === 'Fail' ? 'bg-red-600 text-white border-red-600'
                  : 'bg-amber-porch text-white border-amber'
                  : isSeasonalTask ? 'bg-white/60 text-deep-forest/70 border-white/60 hover:bg-white' : 'bg-linen-white text-deep-forest/70 border-offwhite hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-bold uppercase text-deep-forest/50 block">Technician Notes</Label>
        <Textarea 
          value={notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          placeholder="Add any observations or findings..."
          className={`border-0 min-h-[60px] resize-none text-sm placeholder:italic ${isSeasonalTask ? 'bg-white/60' : 'bg-linen-white'}`}
        />
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-forest/10">
        <Label className="flex justify-between items-center text-[10px] font-bold uppercase text-deep-forest/50">
          <span>Photo Evidence</span>
          {photoUrl && (
            <button type="button" onClick={() => onUpdate('photoUrl', undefined)} className="text-red-500 text-xs flex items-center hover:underline">
              <X className="w-3 h-3 mr-1" /> Remove
            </button>
          )}
        </Label>
        
        {photoUrl ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-forest/20 bg-linen-white shadow-sm">
            <img src={photoUrl} alt="Inspection" className="absolute inset-0 w-full h-full object-contain" />
          </div>
        ) : (
          <div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              className="hidden" 
              onChange={handlePhotoUpload}
            />
            <Button 
              type="button"
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 border-forest/20 border-dashed text-deep-forest/70 hover:text-pathway-green hover:border-pathway hover:bg-deep-forest/5 shadow-none h-12"
            >
              <Camera className="w-4 h-4" />
              Take Photo or Upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
