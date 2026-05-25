import { get, set, del } from 'idb-keyval';
import { InspectionDraft, CompletedInspection, ClientData, ChecklistItemData, InspectionReport, DEFAULT_CHECKLIST_ITEMS } from './types';
import { supabase } from './d2d/supabaseClient';

const DRAFT_KEY = 'wayside_draft';
const HISTORY_KEY = 'wayside_history';
const TEMPLATE_KEY = 'wayside_template';
const OFFLINE_INSPECTIONS_KEY = 'wayside_offline_inspections';

// ─── Draft ────────────────────────────────────────────────────────────────────

export async function saveDraft(draft: InspectionDraft): Promise<void> {
  try {
    await set(DRAFT_KEY, draft);
  } catch (e) {
    console.error('Failed to save draft', e);
  }
}

export async function loadDraft(): Promise<InspectionDraft | null> {
  try {
    const draft = await get<InspectionDraft>(DRAFT_KEY);
    return draft || null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await del(DRAFT_KEY);
  } catch (e) {
    console.error('Failed to clear draft', e);
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function loadHistory(): Promise<CompletedInspection[]> {
  try {
    const history = await get<CompletedInspection[]>(HISTORY_KEY);
    return history || [];
  } catch {
    return [];
  }
}

export async function saveCompletedInspection(
  report: InspectionReport,
  durationSeconds: number,
  technicianId: string
): Promise<CompletedInspection> {
  const record: CompletedInspection = {
    id: crypto.randomUUID(),
    clientInfo: report.clientInfo,
    checklist: report.checklist,
    completedAt: new Date().toISOString(),
    durationSeconds,
  };

  const existing = await loadHistory();
  existing.unshift(record); // newest first
  try {
    await set(HISTORY_KEY, existing);
  } catch (e) {
    console.error('Failed to save history', e);
  }

  // Attempt Supabase Sync
  if (technicianId) {
    const supabaseRecord = {
      id: record.id,
      technician_id: technicianId,
      client_name: record.clientInfo.clientName,
      client_email: record.clientInfo.clientEmail || null,
      property_address: record.clientInfo.propertyAddress,
      checklist_data: record.checklist as any,
      created_at: record.completedAt
    };

    const { error } = await supabase.from('inspections').insert([supabaseRecord]);
    if (error) {
      console.error('Supabase sync failed, queuing offline:', error);
      const queue = (await get<any[]>(OFFLINE_INSPECTIONS_KEY)) || [];
      queue.push(supabaseRecord);
      await set(OFFLINE_INSPECTIONS_KEY, queue);
    }
  }

  return record;
}

export async function syncOfflineInspections(): Promise<void> {
  const queue = await get<any[]>(OFFLINE_INSPECTIONS_KEY) || [];
  if (queue.length === 0) return;
  
  const remaining = [];
  for (const record of queue) {
    const { error } = await supabase.from('inspections').insert([record]);
    if (error) {
      remaining.push(record);
    }
  }
  await set(OFFLINE_INSPECTIONS_KEY, remaining);
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const updated = (await loadHistory()).filter((r) => r.id !== id);
  try {
    await set(HISTORY_KEY, updated);
  } catch (e) {
    console.error('Failed to delete history record', e);
  }
}

// ─── Template ─────────────────────────────────────────────────────────────────

export async function loadTemplate(): Promise<string[]> {
  try {
    const template = await get<string[]>(TEMPLATE_KEY);
    return template && template.length > 0 ? template : DEFAULT_CHECKLIST_ITEMS;
  } catch {
    return DEFAULT_CHECKLIST_ITEMS;
  }
}

export async function saveTemplate(template: string[]): Promise<void> {
  try {
    await set(TEMPLATE_KEY, template);
  } catch (e) {
    console.error('Failed to save template', e);
  }
}
