import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { CompletedInspection } from '../types';
import { deleteHistoryRecord, loadHistory, syncOfflineInspections } from '../storage';
import { generateAndDownloadPDF } from '../pdfGenerator';
import { loadTemplate } from '../storage';
import { get } from 'idb-keyval';
import {
  Search,
  Trash2,
  FileDown,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CloudOff,
  RefreshCw
} from 'lucide-react';

interface HistoryDashboardProps {
  onBack: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusCounts(record: CompletedInspection) {
  const items = Object.values(record.checklist);
  return {
    pass: items.filter((i) => i.status === 'Pass').length,
    attention: items.filter((i) => i.status === 'Needs Attention').length,
    fail: items.filter((i) => i.status === 'Fail').length,
  };
}

export function HistoryDashboard({ onBack }: HistoryDashboardProps) {
  const [records, setRecords] = useState<CompletedInspection[]>([]);
  const [pendingSyncIds, setPendingSyncIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchHistoryAndQueue = async () => {
    const hist = await loadHistory();
    setRecords(hist);
    const queue = (await get<any[]>('wayside_offline_inspections')) || [];
    setPendingSyncIds(queue.map(q => q.id));
  };

  useEffect(() => {
    fetchHistoryAndQueue();
  }, []);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!records.length) return { total: 0, avgMins: 0, passRate: 0 };
    const totalDuration = records.reduce((a, r) => a + r.durationSeconds, 0);
    const avgMins = Math.round(totalDuration / records.length / 60);

    let totalItems = 0;
    let passItems = 0;
    records.forEach((r) => {
      const items = Object.values(r.checklist);
      totalItems += items.length;
      passItems += items.filter((i: any) => i.status === 'Pass').length;
    });
    const passRate = totalItems > 0 ? Math.round((passItems / totalItems) * 100) : 0;

    return { total: records.length, avgMins, passRate };
  }, [records]);

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter(
      (r) =>
        r.clientInfo.clientName.toLowerCase().includes(q) ||
        r.clientInfo.propertyAddress.toLowerCase().includes(q) ||
        r.clientInfo.technicianName.toLowerCase().includes(q)
    );
  }, [records, query]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (deletingId === id) {
      await deleteHistoryRecord(id);
      await fetchHistoryAndQueue();
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  const handleDownload = async (record: CompletedInspection) => {
    setDownloadingId(record.id);
    try {
      const template = await loadTemplate();
      await generateAndDownloadPDF({ clientInfo: record.clientInfo, checklist: record.checklist }, template);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-deep-forest/60 hover:text-deep-forest transition-colors text-sm font-semibold"
        >
          Back
        </button>
        <div>
          <h2 className="text-lg font-bold text-deep-forest flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-pathway-green" />
            Inspection History
          </h2>
          <p className="text-deep-forest/60 text-xs mt-0.5">All completed inspections for this device</p>
        </div>
        {pendingSyncIds.length > 0 && (
          <button 
            onClick={async () => {
              setIsSyncing(true);
              await syncOfflineInspections();
              await fetchHistoryAndQueue();
              setIsSyncing(false);
            }}
            disabled={isSyncing}
            className="ml-auto bg-amber-porch text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : `Sync ${pendingSyncIds.length} Pending`}
          </button>
        )}
      </div>

      {/* ── Stats Strip ── */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Inspections', value: stats.total, icon: <ClipboardList className="w-4 h-4" /> },
            { label: 'Avg Duration', value: `${stats.avgMins}m`, icon: <Clock className="w-4 h-4" /> },
            { label: 'Pass Rate', value: `${stats.passRate}%`, icon: <CheckCircle2 className="w-4 h-4" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-deep-forest/10 p-4 flex flex-col gap-1">
              <div className="text-pathway-green">{icon}</div>
              <p className="text-xl font-bold text-deep-forest leading-none">{value}</p>
              <p className="text-[10px] uppercase font-bold text-deep-forest/40 tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      {records.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-forest/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by client, address, or technician…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-deep-forest/10 bg-white text-sm text-deep-forest placeholder:text-deep-forest/30 focus:outline-none focus:border-pathway-green focus:ring-2 focus:ring-pathway-green/20 transition-all"
          />
        </div>
      )}

      {/* ── Empty state ── */}
      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-deep-forest/5 flex items-center justify-center mb-4">
            <ClipboardList className="w-9 h-9 text-deep-forest/20" />
          </div>
          <h3 className="text-lg font-bold text-deep-forest mb-1">No inspections yet</h3>
          <p className="text-sm text-deep-forest/50 max-w-xs">
            Completed inspections will appear here. Go complete your first one!
          </p>
          <button
            onClick={onBack}
            className="mt-6 bg-pathway-green text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all"
          >
            Start an Inspection
          </button>
        </div>
      )}

      {/* ── No search results ── */}
      {records.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-deep-forest/40 text-sm">
          No inspections match "<span className="font-semibold">{query}</span>"
        </div>
      )}

      {/* ── Record cards ── */}
      <div className="flex flex-col gap-4">
        {filtered.map((record) => {
          const counts = getStatusCounts(record);
          const isDeleting = deletingId === record.id;
          const isDownloading = downloadingId === record.id;

          return (
            <div
              key={record.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                isDeleting ? 'border-red-300 bg-red-50' : 'border-deep-forest/10'
              }`}
            >
              {/* Row 1: client info */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="font-bold text-deep-forest text-base leading-tight truncate">
                    {record.clientInfo.clientName}
                  </p>
                  <p className="text-xs text-deep-forest/50 truncate">{record.clientInfo.propertyAddress}</p>
                  <p className="text-[10px] text-deep-forest/40 mt-1">
                    {record.clientInfo.technicianName} · {formatDate(record.completedAt)}
                  </p>
                  {pendingSyncIds.includes(record.id) && (
                    <span className="inline-flex items-center gap-1 bg-amber-porch/10 text-amber-porch text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-2 self-start">
                      <CloudOff className="w-3 h-3" /> Pending Sync
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-deep-forest/50 bg-linen-white px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    {formatDuration(record.durationSeconds)}
                  </span>
                </div>
              </div>

              {/* Row 2: status pills */}
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] font-bold bg-pathway-green/10 text-pathway-green px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> {counts.pass} Pass
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold bg-amber-porch/10 text-amber-porch px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {counts.attention} Attention
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold bg-red-500/10 text-red-600 px-2.5 py-1 rounded-full">
                  <XCircle className="w-3 h-3" /> {counts.fail} Fail
                </span>
              </div>

              {/* Row 3: actions */}
              <div className="flex gap-2 pt-1 border-t border-deep-forest/5">
                <button
                  onClick={() => handleDownload(record)}
                  disabled={isDownloading}
                  className="flex-1 flex items-center justify-center gap-2 bg-pathway-green/10 hover:bg-pathway-green hover:text-white text-pathway-green text-xs font-bold py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {isDownloading ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => handleDelete(record.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isDeleting
                      ? 'bg-red-600 text-white'
                      : 'bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Confirm' : 'Delete'}
                </button>
                {isDeleting && (
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold bg-deep-forest/5 text-deep-forest/50 hover:bg-deep-forest/10 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
