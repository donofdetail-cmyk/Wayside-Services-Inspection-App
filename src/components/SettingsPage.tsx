import { useState, useEffect } from 'react';
import { loadTemplate, saveTemplate, loadHistory, clearDraft } from '../storage';
import { DEFAULT_CHECKLIST_ITEMS } from '../types';
import { ArrowLeft, Save, Plus, Trash2, RotateCcw, Download, Upload, Settings as SettingsIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { set } from 'idb-keyval';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [templateItems, setTemplateItems] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadTemplate().then(setTemplateItems);
  }, []);

  const handleUpdateItem = (index: number, value: string) => {
    const newItems = [...templateItems];
    newItems[index] = value;
    setTemplateItems(newItems);
    setHasChanges(true);
  };

  const handleAddItem = () => {
    setTemplateItems([...templateItems, 'New Inspection Item']);
    setHasChanges(true);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = templateItems.filter((_, i) => i !== index);
    setTemplateItems(newItems);
    setHasChanges(true);
  };

  const handleResetDefault = () => {
    if (confirm('Are you sure you want to reset the checklist back to the default 10-point Wayside template?')) {
      setTemplateItems(DEFAULT_CHECKLIST_ITEMS);
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    await saveTemplate(templateItems);
    setHasChanges(false);
    alert('Settings saved! New inspections will use this checklist.');
  };

  // ── Database Backup & Restore ──

  const handleExportBackup = async () => {
    const data = {
      template: await loadTemplate(),
      history: await loadHistory(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wayside_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Importing a backup will overwrite your current settings and history. Are you sure?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.template) await saveTemplate(data.template);
        if (data.history) await set('wayside_history', data.history);
        
        await clearDraft(); // Prevent corrupt drafts
        setTemplateItems(await loadTemplate());
        alert('Backup imported successfully!');
      } catch (err) {
        alert('Failed to import backup. The file may be corrupted or invalid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-deep-forest/60 hover:text-deep-forest transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-deep-forest flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-pathway-green" />
              Settings
            </h2>
            <p className="text-deep-forest/60 text-xs mt-0.5">Customize checklist and manage data</p>
          </div>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            className="bg-pathway-green text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        )}
      </div>

      {/* ── Settings Content ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Checklist Editor */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-deep-forest/10 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-deep-forest/10 pb-3">
              <div>
                <h3 className="font-bold text-deep-forest">Checklist Template</h3>
                <p className="text-xs text-deep-forest/60 mt-0.5">Edit the items that appear on new inspections. The last item is treated as the "Seasonal" task.</p>
              </div>
              <button
                onClick={handleResetDefault}
                className="text-[10px] uppercase font-bold text-deep-forest/40 hover:text-deep-forest flex items-center gap-1 transition-colors bg-deep-forest/5 px-2 py-1.5 rounded-lg"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Default
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {templateItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-deep-forest/30 w-4 text-right shrink-0">{index + 1}.</span>
                  <Input
                    value={item}
                    onChange={(e) => handleUpdateItem(index, e.target.value)}
                    className="flex-1 bg-linen-white/50 border-deep-forest/10 focus-visible:ring-pathway-green"
                  />
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 text-deep-forest/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remove Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddItem}
              className="mt-2 w-full py-3 rounded-xl border border-dashed border-deep-forest/20 text-deep-forest/50 hover:text-pathway-green hover:border-pathway-green hover:bg-pathway-green/5 transition-all text-sm font-bold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Checklist Item
            </button>
          </div>
        </div>

        {/* Right Column: Data Management */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-deep-forest/10 p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-deep-forest">Data Backup</h3>
              <p className="text-xs text-deep-forest/60 mt-0.5">Export or import your complete history and settings.</p>
            </div>

            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 bg-deep-forest/5 hover:bg-deep-forest/10 text-deep-forest py-3 rounded-xl text-sm font-bold transition-all"
            >
              <Download className="w-4 h-4" />
              Export Backup
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="w-full flex items-center justify-center gap-2 bg-pathway-green/10 text-pathway-green hover:bg-pathway-green hover:text-white py-3 rounded-xl text-sm font-bold transition-all pointer-events-none">
                <Upload className="w-4 h-4" />
                Import Backup
              </button>
            </div>
            
            <div className="bg-amber-porch/10 rounded-xl p-3 border border-amber-porch/20 mt-2">
              <p className="text-[10px] text-amber-porch/80 leading-tight">
                <strong>Note:</strong> Since this app runs entirely offline on your device, clearing your browser history will delete your inspection data. Export backups regularly!
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
