import { InspectionDraft, CompletedInspection, ClientData, ChecklistItemData, InspectionReport, DEFAULT_CHECKLIST_ITEMS } from './types';

const DRAFT_KEY = 'wayside_draft';
const HISTORY_KEY = 'wayside_history';
const TEMPLATE_KEY = 'wayside_template';

// ─── Draft ────────────────────────────────────────────────────────────────────

export function saveDraft(draft: InspectionDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.error('Failed to save draft', e);
  }
}

export function loadDraft(): InspectionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as InspectionDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

// ─── History ──────────────────────────────────────────────────────────────────

export function loadHistory(): CompletedInspection[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as CompletedInspection[]) : [];
  } catch {
    return [];
  }
}

export function saveCompletedInspection(
  report: InspectionReport,
  durationSeconds: number
): CompletedInspection {
  const record: CompletedInspection = {
    id: crypto.randomUUID(),
    clientInfo: report.clientInfo,
    checklist: report.checklist,
    completedAt: new Date().toISOString(),
    durationSeconds,
  };

  const existing = loadHistory();
  existing.unshift(record); // newest first
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save history', e);
  }
  return record;
}

export function deleteHistoryRecord(id: string): void {
  const updated = loadHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}

// ─── Template ─────────────────────────────────────────────────────────────────

export function loadTemplate(): string[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CHECKLIST_ITEMS;
  } catch {
    return DEFAULT_CHECKLIST_ITEMS;
  }
}

export function saveTemplate(template: string[]): void {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
  } catch (e) {
    console.error('Failed to save template', e);
  }
}
